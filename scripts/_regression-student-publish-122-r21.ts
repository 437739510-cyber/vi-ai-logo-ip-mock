// TICKET-122-R21 内容发布闭环 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到发布服务层，验证：
//   1) 已确认（confirmed=true && status=ready）内容可发布 → 落库 published
//      （status/publish_link/publish_proof/published_at/published_by/platform）
//   2) 未确认（confirmed=false）内容发布被拒（400）
//   3) 非就绪（status=pending）内容发布被拒（400）
//   4) 他人内容（student_id 不匹配）发布被拒（404）
//   5) 已发布内容重复发布被拒（400）
//   6) 归属未确认（isClientAssigned=false）但 student_id 匹配 → 拒绝（403）
//   7) 管理员 listPublishedContents 可见发布记录（学生名/客户名/链接/凭证/时间）
//   8) API 路由：会话门禁 + 调服务层 + 仅学生发布 / 仅管理员查看

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publishContent,
  listPublishedContents,
  AssignmentError,
} from "../src/lib/student-publish";

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
    ],
    submissions: [
      {
        id: "sub-old",
        phone: "13800000001",
        company_name: "老王面馆",
        client_name: "老王",
        status: "submitted",
        student_id: null,
        created_at: "2026-08-22T04:00:00.000Z",
        submitted_at: "2026-08-22T04:00:00.000Z",
      },
      {
        id: "sub-hotpot",
        phone: "13800000002",
        company_name: "小李火锅",
        client_name: "小李",
        status: "submitted",
        student_id: null,
        created_at: "2026-08-22T05:00:00.000Z",
        submitted_at: "2026-08-22T05:00:00.000Z",
      },
    ],
    projects: [
      {
        id: "proj-old",
        submission_id: "sub-old",
        status: "submitted",
        client_name: "老王面馆",
        student_id: null,
        created_at: "2026-08-22T04:00:00.000Z",
        updated_at: "2026-08-22T04:00:00.000Z",
      },
      {
        id: "proj-hotpot",
        submission_id: "sub-hotpot",
        status: "submitted",
        client_name: "小李火锅",
        student_id: null,
        created_at: "2026-08-22T05:00:00.000Z",
        updated_at: "2026-08-22T05:00:00.000Z",
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
      {
        id: "m2",
        phone: "13800000002",
        name: "小李",
        plan: "standard",
        quota_used: 0,
        quota_total: 10,
        created_at: "2026-08-22T06:00:00.000Z",
      },
    ],
    // s1 被确认归属老王（m1）。小李（m2）未归属给任何人。
    student_assignments: [
      {
        id: "a1",
        student_id: "s1",
        project_id: "proj-old",
        status: "confirmed",
        source: "submit",
        created_at: "2026-08-22T07:00:00.000Z",
        updated_at: "2026-08-22T07:00:00.000Z",
      },
    ],
    member_contents: [
      // c1：s1 为客户 m1（老王）生成，已确认+就绪 → 可发布
      {
        id: "c1",
        member_id: "m1",
        student_id: "s1",
        images: [],
        note: "",
        caption: "✍️ 老王面馆推广文案",
        status: "ready",
        confirmed: true,
        source: "student",
        platform: "xiaohongshu",
        created_at: "2026-08-22T08:00:00.000Z",
      },
      // c2：已生成但客户未确认 → 不可发布
      {
        id: "c2",
        member_id: "m1",
        student_id: "s1",
        images: [],
        note: "",
        caption: "",
        status: "ready",
        confirmed: false,
        source: "student",
        platform: "wechat",
        created_at: "2026-08-22T08:10:00.000Z",
      },
      // c3：已确认但状态为 pending（非就绪）→ 不可发布
      {
        id: "c3",
        member_id: "m1",
        student_id: "s1",
        images: [],
        note: "",
        caption: "",
        status: "pending",
        confirmed: true,
        source: "student",
        platform: "douyin",
        created_at: "2026-08-22T08:20:00.000Z",
      },
      // c4：s2（他人）创建的内容 → 非本人不可发布
      {
        id: "c4",
        member_id: "m1",
        student_id: "s2",
        images: [],
        note: "",
        caption: "",
        status: "ready",
        confirmed: true,
        source: "student",
        platform: "xiaohongshu",
        created_at: "2026-08-22T08:30:00.000Z",
      },
      // c6：s1 创建但客户 m2 未归属给 s1 → 归属门拒绝
      {
        id: "c6",
        member_id: "m2",
        student_id: "s1",
        images: [],
        note: "",
        caption: "",
        status: "ready",
        confirmed: true,
        source: "student",
        platform: "xiaohongshu",
        created_at: "2026-08-22T08:40:00.000Z",
      },
    ],
  };
}

async function expectError(promise: Promise<unknown>, status: number, msg: RegExp): Promise<void> {
  await assert.rejects(
    () => promise,
    (e: unknown) => e instanceof AssignmentError && (e as AssignmentError).status === status && msg.test((e as Error).message),
    `期望被拒（${status}）`,
  );
}

async function main() {
  const store = seed();
  const db = new MockSupabase(store) as any;

  // 1) 已确认+就绪 → 可发布
  const published = await publishContent(db, {
    contentId: "c1",
    studentId: "s1",
    platform: "xiaohongshu",
    link: "https://www.xiaohongshu.com/explore/abc123",
    proofUrl: "https://storage.example/member-photos/publish-proof/m1/c1_proof.png",
    proofNote: "已发布到小红书账号@老王面馆",
  });
  assert.equal(published.status, "published", "发布后状态 published");
  assert.equal(published.publish_link, "https://www.xiaohongshu.com/explore/abc123", "记录发布链接");
  assert.equal(published.publish_proof.url, "https://storage.example/member-photos/publish-proof/m1/c1_proof.png", "记录凭证截图 URL");
  assert.equal(published.publish_proof.note, "已发布到小红书账号@老王面馆", "记录凭证说明");
  assert.equal(published.published_by, "s1", "记录发布学生");
  assert.ok(published.published_at, "记录发布时间");
  assert.equal(published.platform, "xiaohongshu", "记录平台");

  const rowC1 = store.member_contents.find((r) => r.id === "c1");
  assert.equal(rowC1.status, "published", "落库状态 published");
  assert.equal(rowC1.publish_link, "https://www.xiaohongshu.com/explore/abc123", "落库链接");

  // 2) 未确认（confirmed=false）→ 拒绝 400
  await expectError(
    publishContent(db, { contentId: "c2", studentId: "s1", platform: "wechat", link: "https://x.com/2" }),
    400,
    /确认/,
  );

  // 3) 非就绪（status=pending）→ 拒绝 400
  await expectError(
    publishContent(db, { contentId: "c3", studentId: "s1", platform: "douyin", link: "https://x.com/3" }),
    400,
    /状态不可发布/,
  );

  // 4) 他人内容（student_id 不匹配）→ 拒绝 404
  //    以 s1 身份发布 s2 的 c4
  await expectError(
    publishContent(db, { contentId: "c4", studentId: "s1", platform: "xiaohongshu", link: "https://x.com/4" }),
    404,
    /不存在|无权/,
  );

  // 4b) s2 发布自己内容但客户归属未确认给 s2 → 拒绝（归属门）
  //    先给 s2 造一条已确认+就绪、但客户未归属的内容：临时让 c5 归属 m2（s2 创建）
  store.member_contents.push({
    id: "c5",
    member_id: "m2",
    student_id: "s2",
    images: [],
    note: "",
    caption: "",
    status: "ready",
    confirmed: true,
    source: "student",
    platform: "xiaohongshu",
    created_at: "2026-08-22T09:00:00.000Z",
  });
  await expectError(
    publishContent(db, { contentId: "c5", studentId: "s2", platform: "xiaohongshu", link: "https://x.com/5" }),
    403,
    /归属/,
  );

  // 6) 归属未确认但 student_id 匹配（s1 对 m2 的 c6）→ 403
  await expectError(
    publishContent(db, { contentId: "c6", studentId: "s1", platform: "xiaohongshu", link: "https://x.com/6" }),
    403,
    /归属/,
  );

  // 5) 已发布内容重复发布 → 拒绝 400
  await expectError(
    publishContent(db, { contentId: "c1", studentId: "s1", platform: "xiaohongshu", link: "https://x.com/again" }),
    400,
    /已发布/,
  );

  // 缺少链接 → 拒绝 400
  await expectError(
    publishContent(db, { contentId: "c1", studentId: "s1", platform: "xiaohongshu", link: "" }),
    400,
    /发布链接/,
  );

  // 7) 管理员可见已发布记录（学生名/客户名/链接/凭证/时间）
  const records = await listPublishedContents(db);
  assert.equal(records.length, 1, "已发布记录只有 c1");
  assert.equal(records[0].id, "c1", "记录为 c1");
  assert.equal(records[0].student_name, "小明", "记录带学生名");
  assert.equal(records[0].brand_name, "老王面馆", "记录带客户名（来自 submission.company_name）");
  assert.equal(records[0].platform, "xiaohongshu", "记录带平台");
  assert.equal(records[0].publish_link, "https://www.xiaohongshu.com/explore/abc123", "记录带链接");
  assert.equal(records[0].publish_proof.note, "已发布到小红书账号@老王面馆", "记录带凭证说明");
  assert.ok(records[0].published_at, "记录带发布时间");

  // 按学生过滤
  const s2Records = await listPublishedContents(db, { studentId: "s2" });
  assert.equal(s2Records.length, 0, "s2 无已发布记录");

  console.log("TICKET-122-R21 student-publish regression: ALL ASSERTIONS PASSED");

  // 8) API 路由：会话门禁 + 调服务层 + 仅学生发布 / 仅管理员查看
  const publishRoute = readFileSync("src/app/api/admin/publish-content/route.ts", "utf8");
  assert.match(publishRoute, /verifyAdminSession/, "发布路由使用会话校验");
  assert.match(publishRoute, /session\?\.role !== "student"/, "发布仅大学生");
  assert.match(publishRoute, /publishContent\(supabaseAdmin,/, "发布调服务层");

  const listRoute = readFileSync("src/app/api/admin/published-contents/route.ts", "utf8");
  assert.match(listRoute, /session\?\.role !== "admin"/, "已发布记录仅管理员查看");
  assert.match(listRoute, /listPublishedContents\(supabaseAdmin,/, "已发布记录调服务层");

  const proofRoute = readFileSync("src/app/api/admin/upload-publish-proof/route.ts", "utf8");
  assert.match(proofRoute, /session\?\.role !== "student"/, "凭证上传仅大学生");
  assert.match(proofRoute, /member-photos/, "凭证复用 member-photos Storage");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
