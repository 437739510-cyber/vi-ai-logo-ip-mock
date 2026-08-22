// TICKET-122-R21：内容发布闭环（GAP-D）
// 学生侧发布：内容被客户确认（status=ready && confirmed=true）后，学生可填写
// 「发布平台 + 链接 + 凭证（截图/说明）」提交，内容进入 published；
// 管理员后台可查已发布记录（平台/链接/凭证/时间/学生/客户），作为代发验收依据。
//
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端，便于离线 mock 回归验证。
// 复用 student-assignment 的归属门（isClientAssigned）与错误类型（AssignmentError）。

import type { SupabaseClient } from "@supabase/supabase-js";
import { AssignmentError, isClientAssigned } from "./student-assignment";

export { AssignmentError } from "./student-assignment";

type Db = SupabaseClient;

export type PublishStatus = "pending" | "processing" | "ready" | "published";

export interface PublishProof {
  url: string;
  note: string;
}

export interface PublishPayload {
  contentId: string;
  studentId: string;
  platform?: string;
  link: string;
  proofUrl?: string;
  proofNote?: string;
}

export interface PublishedRecord {
  id: string;
  member_id: string;
  brand_name: string;
  student_name: string;
  caption: string;
  platform: string;
  publish_link: string;
  publish_proof: PublishProof;
  published_at: string;
  published_by: string;
  confirmed: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeProof(raw: unknown): PublishProof {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return { url: String(obj.url || ""), note: String(obj.note || "") };
  }
  return { url: "", note: "" };
}

function normalizeRecord(row: Record<string, unknown>): PublishedRecord {
  return {
    id: String(row.id ?? ""),
    member_id: String(row.member_id ?? ""),
    brand_name: String(row.brand_name ?? ""),
    student_name: String(row.student_name ?? ""),
    caption: String(row.caption ?? ""),
    platform: String(row.platform ?? ""),
    publish_link: String(row.publish_link ?? ""),
    publish_proof: normalizeProof(row.publish_proof),
    published_at: String(row.published_at ?? ""),
    published_by: String(row.published_by ?? ""),
    confirmed: row.confirmed === true,
  };
}

// ---------------------------------------------------------------------------
// 学生发布：确认后可发布；越权 / 未确认 / 非就绪 均拒绝；落库 published
// ---------------------------------------------------------------------------

export async function publishContent(db: Db, payload: PublishPayload) {
  const { contentId, studentId, platform, link, proofUrl, proofNote } = payload;
  const normalizedLink = (link || "").trim();

  if (!contentId) throw new AssignmentError("缺少内容 ID", 400);
  if (!studentId) throw new AssignmentError("缺少学生身份", 400);
  if (!normalizedLink) throw new AssignmentError("请填写发布链接", 400);

  // 归属硬门：内容必须属于该学生自己创建（student_id 匹配）
  const { data: content, error: contentErr } = await db
    .from("member_contents")
    .select("*")
    .eq("id", contentId)
    .eq("student_id", studentId)
    .single();

  if (contentErr || !content) {
    throw new AssignmentError("内容不存在或无权操作", 404);
  }

  const row = content as Record<string, unknown>;

  // 归属交叉校验：学生必须被确认归属该客户（复用 isClientAssigned）
  const memberId = String(row.member_id ?? "");
  const assigned = await isClientAssigned(db, studentId, memberId);
  if (!assigned) {
    throw new AssignmentError("无权限发布该客户的内容（未确认归属）", 403);
  }

  // 状态门：仅 confirmed/ready 可发布；已发布拒绝重复
  if (row.confirmed !== true) {
    throw new AssignmentError("内容尚未经客户确认，无法发布", 400);
  }
  if (row.status === "published") {
    throw new AssignmentError("内容已发布，请勿重复提交", 400);
  }
  if (row.status !== "ready") {
    throw new AssignmentError("内容当前状态不可发布（需为已确认/就绪）", 400);
  }

  const nextPlatform = (platform || String(row.platform || "") || "xiaohongshu").trim();
  const proof: PublishProof = {
    url: (proofUrl || "").trim(),
    note: (proofNote || "").trim(),
  };
  const now = nowIso();

  const { data: updated, error: updateErr } = await db
    .from("member_contents")
    .update({
      status: "published",
      platform: nextPlatform,
      publish_link: normalizedLink,
      publish_proof: proof,
      published_at: now,
      published_by: studentId,
      updated_at: now,
    })
    .eq("id", contentId)
    .select()
    .single();

  if (updateErr) {
    throw new AssignmentError(updateErr.message, 500);
  }

  return updated as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 管理员 / 学生 查询已发布记录（后台代发验收依据）
// ---------------------------------------------------------------------------

export async function listPublishedContents(db: Db, filter?: { studentId?: string; platform?: string }) {
  let query = db.from("member_contents").select("*").eq("status", "published");
  if (filter?.studentId) query = query.eq("student_id", filter.studentId);
  if (filter?.platform) query = query.eq("platform", filter.platform);

  const { data, error } = await query.order("published_at", { ascending: false });
  if (error) throw new AssignmentError(error.message, 500);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((r) => r.status === "published");
  if (rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => String(r.published_by || r.student_id || "")).filter(Boolean))];
  const memberIds = [...new Set(rows.map((r) => String(r.member_id || "")).filter(Boolean))];

  let studentNameMap: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: accounts } = await db
      .from("student_accounts")
      .select("id, name")
      .in("id", studentIds);
    studentNameMap = Object.fromEntries(
      ((accounts ?? []) as Array<Record<string, unknown>>).map((a) => [String(a.id), String(a.name || "")]),
    );
  }

  let brandNameMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await db
      .from("members")
      .select("id, name, phone")
      .in("id", memberIds);
    const memberRows = ((members ?? []) as Array<Record<string, unknown>>);
    // 客户名优先取 submission.company_name（与管理后台归属记录口径一致），回退 members.name
    const phones = [...new Set(memberRows.map((m) => String(m.phone || "")).filter(Boolean))];
    let companyByPhone: Record<string, string> = {};
    if (phones.length > 0) {
      const { data: subs } = await db
        .from("submissions")
        .select("phone, company_name")
        .in("phone", phones);
      companyByPhone = Object.fromEntries(
        ((subs ?? []) as Array<Record<string, unknown>>).map((s) => [String(s.phone || ""), String(s.company_name || "")]),
      );
    }
    brandNameMap = Object.fromEntries(
      memberRows.map((m) => {
        const phone = String(m.phone || "");
        return [String(m.id), (phone && companyByPhone[phone]) || String(m.name || "")];
      }),
    );
  }

  return rows.map((r) => {
    const studentId = String(r.published_by || r.student_id || "");
    const memberId = String(r.member_id || "");
    return normalizeRecord({
      ...r,
      student_name: studentNameMap[studentId] || studentId,
      brand_name: brandNameMap[memberId] || String(r.brand_name || ""),
    });
  });
}
