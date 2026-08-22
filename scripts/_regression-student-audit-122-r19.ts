// TICKET-122-R19 审核 API 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到审核服务层，验证：
//   1) pending 列表读取（含字段映射、按时间倒序）
//   2) 通过：一键建账号（提成=30）并回写关联（status=approved + student_account_id，
//      拒绝备注清空），初始密码为可登录的 scrypt 哈希
//   3) 拒绝+备注：回写 status=rejected + rejection_reason
//   4) 已处理/不存在/手机号重复等异常路径

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  listPendingApplications,
  approveApplication,
  rejectApplication,
} from "../src/lib/student-application-audit";
import { isPasswordHash, verifyPassword } from "../src/lib/password";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

class MockQuery {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string | null = null;
  private where: Array<[string, any]> = [];
  private orderBy: [string, { ascending?: boolean }] | null = null;
  private payload: Row | Row[] | null = null;
  private singleFlag = false;

  constructor(private store: TableMap, private table: string) {}

  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }
  eq(col: string, value: any) {
    this.where.push([col, value]);
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
  single() {
    this.singleFlag = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.where.every(([c, v]) => row[c] === v);
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
        if (this.table === "student_accounts" && r.phone != null && table.some((x) => x.phone === r.phone)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const row: Row = {
          id: `mock-${table.length + 1}-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...r,
        };
        if (this.table === "student_accounts") {
          if (row.level == null) row.level = "青铜";
          if (row.active == null) row.active = true;
          if (row.total_orders == null) row.total_orders = 0;
        }
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
      return { data: matched.map((r) => this.pick(r)), error: null };
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

function seedStudents(): TableMap {
  return {
    students: [
      {
        id: "app-003",
        real_name: "小明",
        phone: "13800000003",
        university: "上海大学",
        major: "视觉传达",
        wechat: "ming_wechat",
        bio: "会拍照，时间自由",
        status: "pending",
        created_at: "2026-08-22T09:00:00.000Z",
      },
      {
        id: "app-001",
        real_name: "小红",
        phone: "13800000001",
        university: "复旦大学",
        major: "新闻",
        wechat: "hong_wechat",
        bio: "擅长文案",
        status: "pending",
        created_at: "2026-08-22T07:00:00.000Z",
      },
      {
        id: "app-002",
        real_name: "已通过",
        phone: "13800000002",
        university: "同济大学",
        major: "设计",
        wechat: "approved_wechat",
        bio: "已处理",
        status: "approved",
        created_at: "2026-08-22T08:00:00.000Z",
      },
    ],
    student_accounts: [],
  };
}

async function main() {
  const store = seedStudents();
  const db = new MockSupabase(store) as any;

  // 1) pending 列表：只返回两张 pending，按 created_at 倒序，字段映射为友好键
  const pending = await listPendingApplications(db);
  assert.equal(pending.length, 2, "只返回 2 张 pending");
  assert.equal(pending[0].name, "小明", "倒序第 1 为 app-003（09:00）");
  assert.equal(pending[1].school, "复旦大学", "第 2 为 app-001");
  assert.equal(pending[0].school, "上海大学", "school 字段来自 university");
  assert.equal(pending[0].intro, "会拍照，时间自由", "intro 字段来自 bio");
  assert.equal(pending.every((p) => p.status === "pending"), true, "都为 pending");

  // 2) 通过 app-003 建账号 + 回写关联
  const appr = await approveApplication(db, "app-003");
  assert.ok(appr.studentAccountId, "返回 studentAccountId");
  assert.ok(appr.initialPassword && appr.initialPassword.length >= 10, "初始密码非空且足够长");
  assert.match(appr.initialPassword, /^[A-HJ-NP-Za-km-np-z2-9]{10}$/, "初始密码不含易混淆字符");

  const account = store.student_accounts.find((a) => a.phone === "13800000003");
  assert.ok(account, "已创建 student_accounts 行");
  assert.equal(account.name, "小明", "账号姓名取申请姓名");
  assert.equal(account.commission_rate, 72, "提成默认 72%（新手档，R24 统一口径）");
  assert.equal(isPasswordHash(account.password_hash), true, "密码为 scrypt 哈希而非明文");
  assert.equal(verifyPassword(appr.initialPassword, account.password_hash), true, "初始密码可登录");

  const updatedApp = store.students.find((a) => a.id === "app-003");
  assert.equal(updatedApp.status, "approved", "申请状态回写 approved");
  assert.equal(updatedApp.student_account_id, account.id, "回写 student_account_id 关联");
  assert.equal(updatedApp.rejection_reason, null, "通过时清空拒绝备注");
  const afterApproved = await listPendingApplications(db);
  assert.equal(afterApproved.length, 1, "通过后剩余 1 张 pending");

  // 3) 通过已处理申请 → 抛错
  await assert.rejects(approveApplication(db, "app-003"), /已处理/, "重复通过被拒");
  await assert.rejects(approveApplication(db, "app-002"), /已处理/, "已通过申请不可再审批");
  await assert.rejects(approveApplication(db, "app-999"), /申请不存在/, "不存在的申请");

  // 4) 拒绝 + 备注
  await rejectApplication(db, "app-001", "资料不全，请补充在校证明");
  const rejectedApp = store.students.find((a) => a.id === "app-001");
  assert.equal(rejectedApp.status, "rejected", "申请状态回写 rejected");
  assert.equal(rejectedApp.rejection_reason, "资料不全，请补充在校证明", "拒绝备注已落库");
  await assert.rejects(rejectApplication(db, "app-001"), /已处理/, "重复拒绝被拒");

  // 5) 手机号已在 student_accounts 时通过 → 冲突（独立 store：pending 申请 + 已存在同号账号）
  const storeDup = {
    students: [
      {
        id: "app-dup",
        real_name: "冲突者",
        phone: "13800000009",
        university: "XX大学",
        major: "",
        wechat: "",
        bio: "",
        status: "pending",
        created_at: "2026-08-22T10:00:00.000Z",
      },
    ],
    student_accounts: [
      { id: "acc-existing", phone: "13800000009", name: "已存在", created_at: "2026-08-22T01:00:00.000Z" },
    ],
  } as TableMap;
  await assert.rejects(approveApplication(new MockSupabase(storeDup) as any, "app-dup"), /该手机号已注册/, "重复手机号建号被拒");

  // 6) 无备注拒绝：reason 为空串时落 null
  const store2 = seedStudents();
  const db2 = new MockSupabase(store2) as any;
  await rejectApplication(db2, "app-003", "");
  assert.equal(store2.students.find((a) => a.id === "app-003").rejection_reason, null, "空备注落 null");

  console.log("TICKET-122-R19 student-audit regression: ALL ASSERTIONS PASSED");

  // 7) 审核 API 路由：会话门禁（仅 admin）+ 动作分派（approve/reject）
  const route = readFileSync("src/app/api/admin/student-applications/route.ts", "utf8");
  assert.match(route, /verifyAdminSession/, "路由使用会话校验");
  assert.match(route, /session\.role !== "admin"/, "仅 admin 可审核");
  assert.match(route, /action === "approve"/, "支持通过动作");
  assert.match(route, /action === "reject"/, "支持拒绝动作");
  assert.match(route, /listPendingApplications\(supabaseAdmin\)/, "列表读 pending");
  assert.match(route, /approveApplication\(supabaseAdmin, id\)/, "通过建账号+回写");
  assert.match(route, /rejectApplication\(supabaseAdmin, id,/, "拒绝+备注");
  assert.match(route, /initialPassword/, "通过返回初始密码（一次性给管理员转交学生）");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
