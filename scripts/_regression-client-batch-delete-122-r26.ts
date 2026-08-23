// TICKET-122-R26 客户批量删除 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到服务层，验证：
//   1) 列表接真实数据：submissions + 关联 project + 保护标记（软删排除）
//   2) 确认门：确认文本不匹配 / 空数组 => 服务端拒绝（防绕过前端）
//   3) 关联保护：有归属(student_assignments)/内容(member_contents)/结算(settlements)
//      任一关联 => 整批拒绝（fail-closed），不部分删除
//   4) 成功路径：无关联客户软删除（submissions/projects 打 deleted_at），列表刷新后消失
//   5) 操作日志：成功删除与拦截均写入 admin_operation_logs（删除人/时间/数量）
//   6) 路由与页面接线断言（文件内容）：会话门 / admin 角色门 / 409 / 强确认 UI / 不再用 mock
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  listClientRecords,
  deleteClientRecords,
  ClientRecordsError,
  CLIENT_DELETE_CONFIRM_TEXT,
} from "../src/lib/client-records";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

class MockQuery {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string | null = null;
  private where: Array<["eq" | "neq" | "in" | "is", string, any]> = [];
  private orderBy: [string, { ascending?: boolean }] | null = null;
  private payload: Row | Row[] | null = null;
  private singleFlag = false;

  constructor(private store: TableMap, private table: string) {}

  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }
  eq(col: string, value: any) {
    this.where.push(["eq", col, value]);
    return this;
  }
  neq(col: string, value: any) {
    this.where.push(["neq", col, value]);
    return this;
  }
  in(col: string, values: any[]) {
    this.where.push(["in", col, values]);
    return this;
  }
  is(col: string, value: any) {
    this.where.push(["is", col, value]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = [col, opts ?? {}];
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = values;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  single() {
    this.singleFlag = true;
    return this;
  }
  maybeSingle() {
    this.singleFlag = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.where.every(([op, col, val]) => {
      const actual = row[col];
      if (op === "eq") {
        if (val == null) return actual == null;
        return String(actual) === String(val);
      }
      if (op === "neq") return actual !== val;
      if (op === "in") return (Array.isArray(val) ? val : []).some((v) => String(actual) === String(v));
      if (op === "is") return val == null ? actual == null : actual === val;
      return false;
    });
  }

  private pick(row: Row): Row {
    if (!this.selectCols || this.selectCols === "*") return { ...row };
    const out: Row = {};
    for (const col of this.selectCols.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (col in row) out[col] = row[col];
    }
    return out;
  }

  private run(): { data: any; error: any } {
    const table = this.store[this.table] ?? (this.store[this.table] = []);

    if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted: Row[] = [];
      for (const r of rows) {
        const row: Row = {
          id: `mock-${this.table}-${table.length + 1}-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...r,
        };
        table.push(row);
        inserted.push(row);
      }
      if (this.singleFlag) {
        return inserted.length ? { data: this.pick(inserted[0]), error: null } : { data: null, error: { message: "no rows" } };
      }
      return { data: inserted.map((r) => this.pick(r)), error: null };
    }

    if (this.op === "update") {
      const matched = table.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      const data = matched.map((r) => this.pick(r));
      if (this.singleFlag) {
        return data.length ? { data: data[0], error: null } : { data: null, error: { message: "no rows" } };
      }
      return { data, error: null };
    }

    if (this.op === "delete") {
      const matched = table.filter((r) => this.matches(r));
      const deleted = matched.map((r) => this.pick(r));
      this.store[this.table] = table.filter((r) => !this.matches(r));
      return { data: deleted, error: null };
    }

    // select
    let rows = table.filter((r) => this.matches(r));
    if (this.orderBy) {
      const [col, opts] = this.orderBy;
      rows = [...rows].sort((a, b) => {
        if (a[col] == null && b[col] == null) return 0;
        if (a[col] == null) return 1;
        if (b[col] == null) return -1;
        const av = String(a[col]);
        const bv = String(b[col]);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return opts?.ascending === false ? -cmp : cmp;
      });
    }
    const data = rows.map((r) => this.pick(r));
    if (this.singleFlag) {
      if (data.length === 0) return { data: null, error: { message: "no rows" } };
      if (data.length > 1) return { data: null, error: { message: "multiple rows" } };
      return { data: data[0], error: null };
    }
    return { data, error: null };
  }

  then(onSuccess: (v: any) => void, onError?: (e: unknown) => void) {
    try {
      onSuccess(this.run());
    } catch (e) {
      onError?.(e);
    }
  }
}

class MockSupabase {
  constructor(public store: TableMap) {}
  from(table: string) {
    return new MockQuery(this.store, table);
  }
}

function seed(): TableMap {
  return {
    submissions: [
      { id: "s_clean", client_name: "老王", company_name: "老王面馆", phone: "13800000001", wechat: "laowang", email: "a@b.c", industry: "餐饮/食品", budget_range: "100-300", description: "面馆品牌升级", created_at: "2026-08-23T01:00:00.000Z", submitted_at: "2026-08-23T01:00:00.000Z", status: "submitted" },
      { id: "s_assign", client_name: "小李", company_name: "小李火锅", phone: "13800000002", wechat: null, email: null, industry: "餐饮/食品", budget_range: null, description: null, created_at: "2026-08-23T02:00:00.000Z", submitted_at: "2026-08-23T02:00:00.000Z", status: "submitted" },
      { id: "s_settle", client_name: "老张", company_name: "老张茶饮", phone: "13800000003", wechat: null, email: null, industry: "餐饮/食品", budget_range: null, description: null, created_at: "2026-08-23T03:00:00.000Z", submitted_at: "2026-08-23T03:00:00.000Z", status: "submitted" },
      { id: "s_content", client_name: "老刘", company_name: "老刘美容", phone: "13800000004", wechat: null, email: null, industry: "医疗/健康", budget_range: null, description: null, created_at: "2026-08-23T04:00:00.000Z", submitted_at: "2026-08-23T04:00:00.000Z", status: "submitted" },
    ],
    projects: [
      { id: "p_clean", submission_id: "s_clean", status: "submitted", created_at: "2026-08-23T01:00:00.000Z", updated_at: "2026-08-23T01:00:00.000Z" },
      { id: "p_assign", submission_id: "s_assign", status: "confirmed", created_at: "2026-08-23T02:00:00.000Z", updated_at: "2026-08-23T02:00:00.000Z" },
    ],
    members: [
      { id: "m3", phone: "13800000003", name: "老张", created_at: "2026-08-23T03:00:00.000Z" },
      { id: "m4", phone: "13800000004", name: "老刘", created_at: "2026-08-23T04:00:00.000Z" },
    ],
    member_contents: [
      { id: "c3", member_id: "m3", student_id: "stu1", status: "ready", confirmed: true, source: "student", created_at: "2026-08-23T05:00:00.000Z" },
      { id: "c4", member_id: "m4", student_id: "stu2", status: "pending", confirmed: false, source: "student", created_at: "2026-08-23T06:00:00.000Z" },
    ],
    settlements: [
      { id: "st1", content_id: "c3", member_id: "m3", student_id: "stu1", status: "pending", created_at: "2026-08-23T07:00:00.000Z" },
    ],
    student_assignments: [
      { id: "a1", project_id: "p_assign", student_id: "stu1", status: "confirmed", source: "claim", created_at: "2026-08-23T08:00:00.000Z" },
    ],
    admin_operation_logs: [],
  };
}

async function main() {
  const store = seed();
  const db = new MockSupabase(store) as any;

  // 1) 列表：真实数据 + 关联 project + 保护标记
  const list1 = await listClientRecords(db);
  assert.equal(list1.length, 4, "列表初始 4 个客户");
  const clean = list1.find((c) => c.id === "s_clean")!;
  assert.equal(clean.companyName, "老王面馆", "company_name 映射");
  assert.equal(clean.projectId, "p_clean", "关联项目映射");
  assert.equal(clean.protection.reasons.length, 0, "无关联客户不保护");
  const assign = list1.find((c) => c.id === "s_assign")!;
  assert.equal(assign.protection.hasAssignments, true, "归属记录 => hasAssignments");
  const settle = list1.find((c) => c.id === "s_settle")!;
  assert.equal(settle.protection.hasSettlements, true, "结算流水 => hasSettlements");
  assert.equal(settle.protection.hasMemberContents, true, "结算客户通常也有内容记录");
  const content = list1.find((c) => c.id === "s_content")!;
  assert.equal(content.protection.hasMemberContents, true, "内容记录 => hasMemberContents");
  assert.equal(content.protection.hasSettlements, false, "纯内容无结算");

  // 2) 确认门（服务端强确认，防绕过前端）
  await assert.rejects(
    () => deleteClientRecords(db, ["s_clean"], "delete", { id: "admin1", role: "admin" }),
    (e: unknown) => e instanceof ClientRecordsError && e.status === 400,
    "确认文本不匹配必须拒绝",
  );
  await assert.rejects(
    () => deleteClientRecords(db, [], CLIENT_DELETE_CONFIRM_TEXT, { id: "admin1", role: "admin" }),
    (e: unknown) => e instanceof ClientRecordsError && e.status === 400,
    "空数组必须拒绝",
  );

  // 3) 关联保护：整批拒绝（fail-closed），不部分删除
  const blockedResult = await deleteClientRecords(
    db,
    ["s_clean", "s_assign", "s_settle", "s_content"],
    CLIENT_DELETE_CONFIRM_TEXT,
    { id: "admin1", role: "admin" },
  );
  assert.equal(blockedResult.deleted.length, 0, "有关联时整批不删（含无关联的 s_clean）");
  assert.equal(blockedResult.protected.length, 3, "3 个有关联客户被拦截");
  assert.deepEqual(
    blockedResult.protected.map((p) => p.id).sort(),
    ["s_assign", "s_content", "s_settle"],
    "拦截名单",
  );
  assert.equal(store.submissions.find((s) => s.id === "s_clean")!.deleted_at, undefined, "s_clean 未被删除");
  assert.equal(store.projects.find((p) => p.id === "p_clean")!.deleted_at, undefined, "p_clean 未被删除");
  const blockedLog = store.admin_operation_logs.find((l) => l.action === "client_batch_delete_blocked");
  assert.ok(blockedLog, "拦截写入操作日志");
  assert.equal(blockedLog!.operator_id, "admin1", "日志记录删除人");
  assert.equal(blockedLog!.entity_ids.length, 4, "日志记录数量（4 条尝试）");

  // 4) 成功路径：无关联客户软删除 + 列表刷新
  const okResult = await deleteClientRecords(db, ["s_clean"], CLIENT_DELETE_CONFIRM_TEXT, {
    id: "admin1",
    role: "admin",
  });
  assert.deepEqual(okResult.deleted, ["s_clean"], "成功删除 s_clean");
  assert.equal(okResult.protected.length, 0, "无拦截");
  assert.ok(store.submissions.find((s) => s.id === "s_clean")!.deleted_at, "submissions 打 deleted_at（软删）");
  assert.ok(store.projects.find((p) => p.id === "p_clean")!.deleted_at, "projects 打 deleted_at（软删）");
  const okLog = store.admin_operation_logs.find((l) => l.action === "client_batch_delete");
  assert.ok(okLog, "成功删除写入操作日志");
  assert.equal(okLog!.operator_id, "admin1", "日志记录删除人");
  assert.equal(okLog!.detail.deletedCount, 1, "日志记录数量");

  const list2 = await listClientRecords(db);
  assert.equal(list2.length, 3, "列表刷新后 3 个（软删排除）");
  assert.equal(list2.some((c) => c.id === "s_clean"), false, "s_clean 不再出现在列表");

  // 幂等：再次删除同客户 => 空结果不报错
  const again = await deleteClientRecords(db, ["s_clean"], CLIENT_DELETE_CONFIRM_TEXT, {
    id: "admin1",
    role: "admin",
  });
  assert.deepEqual(again.deleted, [], "已软删客户幂等");

  // 5) 路由/页面/迁移/服务层接线断言（文件内容）
  const listRoute = readFileSync("src/app/api/admin/client-records/route.ts", "utf8");
  assert.match(listRoute, /verifyAdminSession/, "列表路由使用会话校验");
  assert.match(listRoute, /session\.role !== "admin"/, "列表路由仅管理员");
  assert.match(listRoute, /listClientRecords\(supabaseAdmin\)/, "列表路由调服务层");

  const deleteRoute = readFileSync("src/app/api/admin/client-records/batch-delete/route.ts", "utf8");
  assert.match(deleteRoute, /verifyAdminSession/, "删除路由使用会话校验");
  assert.match(deleteRoute, /session\.role !== "admin"/, "删除路由仅管理员");
  assert.match(deleteRoute, /deleteClientRecords\(/, "删除路由调服务层");
  assert.match(deleteRoute, /status: 409/, "有关联返回 409");

  const page = readFileSync("src/app/admin/clients/page.tsx", "utf8");
  assert.match(page, /\/api\/admin\/client-records/, "页面接真实数据 API");
  assert.match(page, /type="checkbox"/, "页面多选 checkbox");
  assert.match(page, /批量删除/, "页面批量删除按钮");
  assert.match(page, /CONFIRM_TEXT/, "页面强确认输入（确认文案）");
  assert.match(page, /确认删除/, "页面确认删除按钮");
  assert.doesNotMatch(page, /getSubmissions|getProjects|@\/lib\/core\/mock/, "页面不再读 mock");

  const service = readFileSync("src/lib/client-records.ts", "utf8");
  assert.match(service, /deleted_at/, "服务层软删除标记");
  assert.match(service, /student_assignments/, "服务层归属保护");
  assert.match(service, /member_contents/, "服务层内容保护");
  assert.match(service, /settlements/, "服务层结算保护");
  assert.match(service, /logAdminOperation/, "服务层写操作日志");

  const migration = readFileSync("supabase/migrations/20260823_client_batch_delete_soft_delete.sql", "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_at timestamptz/, "迁移加 submissions 软删列");
  assert.match(migration, /admin_operation_logs/, "迁移建操作日志表");

  console.log("TICKET-122-R26 client-batch-delete regression: ALL ASSERTIONS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

