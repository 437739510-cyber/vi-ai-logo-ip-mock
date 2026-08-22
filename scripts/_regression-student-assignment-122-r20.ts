// TICKET-122-R20 学生获客归属闭环 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到归属服务层，验证：
//   1) 学生提交线索 → 创建 submission + project + 归属（pending/source=submit）
//   2) 同客户重复认领 / 重复提交拦截
//   3) 不同学生同客户认领 → 允许并存 pending（管理员裁决），已确认则拦截
//   4) 管理员确认 → 该学生可服务（isClientAssigned=true）；并自动拒绝同项目其他 pending
//   5) 未确认 / 未归属 / 已拒绝 → generate-for-client 403（isClientAssigned=false）
//   6) 解除归属后不可再服务
//   7) 归属 API 路由：会话门禁（student 提交/认领，admin 确认/拒绝/解除）

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  submitLead,
  claimCustomer,
  confirmAssignment,
  rejectAssignment,
  unbindAssignment,
  isClientAssigned,
  getAssignedClients,
  getStudentAssignments,
  listAllAssignments,
  AssignmentError,
} from "../src/lib/student-assignment";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

class MockQuery {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string | null = null;
  private where: Array<["eq" | "neq" | "in", string, any]> = [];
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

  private matches(row: Row): boolean {
    return this.where.every(([op, col, val]) => {
      const actual = row[col];
      if (op === "eq") {
        // JSON 对象比较：submissions/projects 的 client_info 等按引用插入，这里只比较标量字段
        if (typeof val === "object" && val !== null) return actual === val;
        if (actual == null) return val == null;
        return String(actual) === String(val);
      }
      if (op === "neq") return actual !== val;
      if (op === "in") return (Array.isArray(val) ? val : []).some((v) => String(actual) === String(v));
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
      // 唯一约束模拟：student_assignments(student_id, project_id) 重复 -> 23505
      if (this.table === "student_assignments") {
        for (const r of rows) {
          if (table.some((x) => x.student_id === r.student_id && x.project_id === r.project_id)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
        }
      }
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
        return inserted.length
          ? { data: this.pick(inserted[0]), error: null }
          : { data: null, error: { message: "no rows" } };
      }
      return { data: inserted.map((r) => this.pick(r)), error: null };
    }

    if (this.op === "update") {
      const matched = table.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      const data = matched.map((r) => this.pick(r));
      if (this.singleFlag) {
        return data.length
          ? { data: data[0], error: null }
          : { data: null, error: { message: "no rows" } };
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
    student_accounts: [
      { id: "s1", name: "小明", phone: "13900000001", created_at: "2026-08-22T01:00:00.000Z" },
      { id: "s2", name: "小红", phone: "13900000002", created_at: "2026-08-22T02:00:00.000Z" },
      { id: "s3", name: "小刚", phone: "13900000003", created_at: "2026-08-22T03:00:00.000Z" },
      { id: "s4", name: "新同学", phone: "13900000004", created_at: "2026-08-22T06:00:00.000Z" },
    ],
    submissions: [
      {
        id: "sub-existing",
        phone: "13800000001",
        company_name: "老王面馆",
        client_name: "老王",
        status: "submitted",
        student_id: null,
        created_at: "2026-08-22T04:00:00.000Z",
        submitted_at: "2026-08-22T04:00:00.000Z",
      },
    ],
    projects: [
      {
        id: "proj-existing",
        submission_id: "sub-existing",
        status: "submitted",
        client_name: "老王面馆",
        student_id: null,
        created_at: "2026-08-22T04:00:00.000Z",
        updated_at: "2026-08-22T04:00:00.000Z",
      },
    ],
    members: [
      {
        id: "m1",
        phone: "13800000001",
        name: "老王",
        plan: "standard",
        quota_used: 0,
        quota_total: 10,
        created_at: "2026-08-22T05:00:00.000Z",
      },
    ],
    student_assignments: [],
  };
}

async function main() {
  const store = seed();
  const db = new MockSupabase(store) as any;

  // 1) 学生 s1 提交新线索（新商家手机号）→ 建 submission+project+归属(pending)
  const lead = await submitLead(db, "s1", {
    phone: "13800000099",
    companyName: "小李火锅",
    clientName: "李老板",
    wechat: "li_wechat",
    industry: "火锅",
  });
  assert.ok(lead.projectId.startsWith("VI-"), "提交线索生成项目 ID");
  assert.ok(lead.submissionId.startsWith("SBM-"), "提交线索生成 submission ID");

  const leadSub = store.submissions.find((s) => s.id === lead.submissionId);
  assert.equal(leadSub.phone, "13800000099", "线索 submission 手机号正确");
  assert.equal(leadSub.student_id, "s1", "线索 submission 绑定学生");
  assert.equal(leadSub.company_name, "小李火锅", "线索 submission 店名正确");
  assert.equal(leadSub.wechat, "li_wechat", "线索 submission 微信落库");

  const leadProj = store.projects.find((p) => p.id === lead.projectId);
  assert.equal(leadProj.submission_id, lead.submissionId, "线索 project 关联 submission");

  let mine = await getStudentAssignments(db, "s1");
  assert.equal(mine.length, 1, "提交线索后 s1 有 1 条归属记录");
  assert.equal(mine[0].status, "pending", "新归属为待确认");
  assert.equal(mine[0].source, "submit", "归属来源为提交线索");
  assert.equal(mine[0].projectId, lead.projectId, "归属关联新项目");
  assert.equal(mine[0].brandName, "小李火锅", "归属记录带品牌名");
  assert.equal(mine[0].phone, "13800000099", "归属记录带手机号");
  assert.equal(mine[0].studentName, "小明", "归属记录带学生名");

  const pendingList = await listAllAssignments(db, { status: "pending" });
  assert.equal(pendingList.length, 1, "管理员待确认列表有 1 条");

  // 2) 同客户重复认领拦截：s1 再认领自己刚提交的手机号
  await assert.rejects(
    () => claimCustomer(db, "s1", "13800000099"),
    (e: unknown) => e instanceof AssignmentError && /已认领/.test((e as Error).message),
    "同一学生重复认领被拦截",
  );
  // 重复提交线索：该手机号已存在
  await assert.rejects(
    () => submitLead(db, "s1", { phone: "13800000099", companyName: "重名" }),
    (e: unknown) => e instanceof AssignmentError && /认领/.test((e as Error).message),
    "同手机号重复提交线索被拦截",
  );

  // 3) s1 认领已提交的老客户（老王，手机号 13800000001）→ pending
  const claim1 = await claimCustomer(db, "s1", "13800000001");
  assert.equal(claim1.projectId, "proj-existing", "认领命中已有项目");
  const claimRecord = store.student_assignments.find((a) => a.student_id === "s1" && a.project_id === "proj-existing");
  assert.equal(claimRecord.status, "pending", "认领归属为待确认");
  assert.equal(claimRecord.source, "claim", "认领来源为 claim");

  // 4) 不同学生同客户认领（防抢单：pending 并存，管理员裁决）
  await claimCustomer(db, "s2", "13800000001");
  await claimCustomer(db, "s3", "13800000001");
  const allPendingForProj = store.student_assignments.filter((a) => a.project_id === "proj-existing" && a.status === "pending");
  assert.equal(allPendingForProj.length, 3, "同客户三个学生并存 pending");

  // 5) 未确认/未归属时不可服务：s1 对 m1（老王）服务校验为 false → generate-for-client 会 403
  assert.equal(await isClientAssigned(db, "s1", "m1"), false, "未确认→不可服务");
  assert.equal(await isClientAssigned(db, "s2", "m1"), false, "未确认→不可服务");
  assert.equal(await isClientAssigned(db, "sX", "m1"), false, "非归属学生→不可服务");

  // 6) 已确认归属的学生不可再认领该客户（防抢单门）
  await confirmAssignment(db, "s1", "proj-existing");
  assert.equal(await isClientAssigned(db, "s1", "m1"), true, "确认后 s1 可服务");
  assert.equal(await isClientAssigned(db, "s2", "m1"), false, "s2 被自动拒绝→不可服务");
  assert.equal(await isClientAssigned(db, "s3", "m1"), false, "s3 被自动拒绝→不可服务");

  const s1Assign = store.student_assignments.find((a) => a.student_id === "s1" && a.project_id === "proj-existing");
  assert.equal(s1Assign.status, "confirmed", "s1 确认成功");
  const s2Assign = store.student_assignments.find((a) => a.student_id === "s2" && a.project_id === "proj-existing");
  const s3Assign = store.student_assignments.find((a) => a.student_id === "s3" && a.project_id === "proj-existing");
  assert.equal(s2Assign.status, "rejected", "确认一人后自动拒绝其他 pending");
  assert.equal(s3Assign.status, "rejected", "确认一人后自动拒绝其他 pending");

  // 已被其他人确认后，从未认领过的新学生再认领 → 拦截
  await assert.rejects(
    () => claimCustomer(db, "s4", "13800000001"),
    (e: unknown) => e instanceof AssignmentError && /已被其他学生/.test((e as Error).message),
    "已被其他学生确认的客户不可再认领",
  );

  // 7) getAssignedClients：确认后 s1 能看到可服务客户 m1
  const clients = await getAssignedClients(db, "s1");
  assert.equal(clients.length, 1, "确认后 s1 的可服务客户有 1 个");
  assert.equal(clients[0].id, "m1", "可服务客户为 m1");
  assert.equal(clients[0].brand_name, "老王面馆", "brand_name 来自 submission");

  // 8) 归属确认列表：status=confirmed 返回确认记录
  const confirmedList = await listAllAssignments(db, { status: "confirmed" });
  assert.equal(confirmedList.length, 1, "confirmed 列表只有 s1 一条");
  assert.equal(confirmedList[0].studentId, "s1", "confirmed 为 s1");

  // 9) 拒绝路径：s3 认领新项目 → 管理员拒绝
  const claimNew = await claimCustomer(db, "s3", "13800000099");
  await rejectAssignment(db, "s3", claimNew.projectId);
  const s3New = store.student_assignments.find((a) => a.student_id === "s3" && a.project_id === claimNew.projectId);
  assert.equal(s3New.status, "rejected", "管理员拒绝生效");
  assert.equal(await isClientAssigned(db, "s3", "m1"), false, "拒绝后不可服务");

  // 10) 解除归属：s1 解除 proj-existing → 不可再服务
  const unbound = await unbindAssignment(db, "s1", "proj-existing");
  assert.equal(unbound.removed, true, "解除归属成功");
  assert.equal(await isClientAssigned(db, "s1", "m1"), false, "解除后不可服务");
  assert.equal(store.student_assignments.some((a) => a.student_id === "s1" && a.project_id === "proj-existing"), false, "解除后归属行已删");

  console.log("TICKET-122-R20 student-assignment regression: ALL ASSERTIONS PASSED");

  // 11) API 路由：会话门禁 + 动作分派
  const route = readFileSync("src/app/api/admin/student-assignments/route.ts", "utf8");
  assert.match(route, /verifyAdminSession/, "路由使用会话校验");
  assert.match(route, /session\.role !== "student"/, "提交/认领仅学生");
  assert.match(route, /session\.role !== "admin"/, "确认/拒绝/解除仅管理员");
  assert.match(route, /action === "submitLead"/, "支持提交线索动作");
  assert.match(route, /action === "claim"/, "支持认领动作");
  assert.match(route, /action === "confirm"/, "支持确认动作");
  assert.match(route, /action === "reject"/, "支持拒绝动作");
  assert.match(route, /submitLead\(supabaseAdmin, session\.userId,/, "提交线索调服务层");
  assert.match(route, /claimCustomer\(supabaseAdmin, session\.userId,/, "认领调服务层");
  assert.match(route, /confirmAssignment\(supabaseAdmin,/, "确认调服务层");
  assert.match(route, /rejectAssignment\(supabaseAdmin,/, "拒绝调服务层");
  assert.match(route, /unbindAssignment\(supabaseAdmin,/, "解除调服务层");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
