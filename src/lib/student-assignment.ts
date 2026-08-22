// TICKET-122-R20：学生获客归属服务层（GAP-C 修正）。
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端，便于离线 mock 回归验证。
//
// 方向（Chris 2026-08-22 确认）：平台无线下触角，全国本地大学生负责当地获客，
// 「管理员分配客户」作废，改为「学生获客归属」——student_assignments 由学生动作
// 产生（提交线索 / 认领客户，status=pending），管理员只做查看与纠错
// （确认/拒绝/解除，防抢单）。确认后学生才可服务该客户。
//
// 归属解析链路（复用并固化为单一路径）：
//   student_assignments(student_id, project_id, status, source)
//     → projects(id, submission_id)
//     → submissions(id, phone, company_name)
//     → members(phone)   // 客户（老板）实体，generate-for-client 依赖 member_id

import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentStatus = "pending" | "confirmed" | "rejected";
export type AssignmentSource = "submit" | "claim";

export class AssignmentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AssignmentError";
    this.status = status;
  }
}

export interface AssignedClient {
  id: string;
  phone: string | null;
  name: string | null;
  plan: string | null;
  quota_used: number | null;
  quota_total: number | null;
  brand_name: string;
}

export interface AssignmentRecord {
  studentId: string;
  studentName: string;
  projectId: string;
  status: AssignmentStatus;
  source: AssignmentSource | string | null;
  brandName: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentLead {
  phone: string;
  companyName?: string;
  clientName?: string;
  wechat?: string;
  industry?: string;
}

type Db = SupabaseClient;

function nowIso(): string {
  return new Date().toISOString();
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ---------------------------------------------------------------------------
// 内部解析：student_assignments → projects → submissions → members
// ---------------------------------------------------------------------------

async function resolveProjectIdsForStudent(db: Db, studentId: string, status?: AssignmentStatus): Promise<string[]> {
  let query = db.from("student_assignments").select("project_id").eq("student_id", studentId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new AssignmentError(error.message, 500);
  return unique(((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => r.project_id as string)
    .filter(Boolean));
}

async function resolveSubmissionIdsByProjects(db: Db, projectIds: string[]): Promise<string[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await db.from("projects").select("id, submission_id").in("id", projectIds);
  if (error) throw new AssignmentError(error.message, 500);
  return unique(((data ?? []) as Array<Record<string, unknown>>)
    .map((p) => p.submission_id as string)
    .filter(Boolean));
}

async function resolvePhonesBySubmissions(db: Db, submissionIds: string[]): Promise<string[]> {
  if (submissionIds.length === 0) return [];
  const { data, error } = await db.from("submissions").select("phone").in("id", submissionIds);
  if (error) throw new AssignmentError(error.message, 500);
  return unique(((data ?? []) as Array<Record<string, unknown>>)
    .map((s) => s.phone as string)
    .filter(Boolean));
}

async function resolveProjectIdsByPhone(db: Db, phone: string): Promise<string[]> {
  const { data: subs, error: subErr } = await db.from("submissions").select("id").eq("phone", phone);
  if (subErr) throw new AssignmentError(subErr.message, 500);
  const submissionIds = unique(((subs ?? []) as Array<Record<string, unknown>>)
    .map((s) => s.id as string)
    .filter(Boolean));
  if (submissionIds.length === 0) return [];

  const { data: projects, error: projErr } = await db
    .from("projects")
    .select("id, submission_id, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: false });
  if (projErr) throw new AssignmentError(projErr.message, 500);
  return ((projects ?? []) as Array<Record<string, unknown>>).map((p) => p.id as string).filter(Boolean);
}

async function buildBrandPhoneMaps(db: Db, submissionIds: string[]): Promise<{ brandMap: Record<string, string>; phoneMap: Record<string, string> }> {
  const brandMap: Record<string, string> = {};
  const phoneMap: Record<string, string> = {};
  if (submissionIds.length === 0) return { brandMap, phoneMap };
  const { data, error } = await db.from("submissions").select("phone, company_name").in("id", submissionIds);
  if (error) throw new AssignmentError(error.message, 500);
  for (const s of (data ?? []) as Array<Record<string, unknown>>) {
    const phone = s.phone as string;
    const company = s.company_name as string;
    if (phone) {
      phoneMap[phone] = company || "";
      if (company) brandMap[phone] = company;
    }
  }
  return { brandMap, phoneMap };
}

// ---------------------------------------------------------------------------
// 学生「我的客户」：已确认归属的可服务客户列表（口径与 /api/admin/clients 一致）
// ---------------------------------------------------------------------------

export async function getAssignedClients(db: Db, studentId: string): Promise<AssignedClient[]> {
  const projectIds = await resolveProjectIdsForStudent(db, studentId, "confirmed");
  if (projectIds.length === 0) return [];

  const submissionIds = await resolveSubmissionIdsByProjects(db, projectIds);
  if (submissionIds.length === 0) return [];

  const { brandMap } = await buildBrandPhoneMaps(db, submissionIds);
  const phones = await resolvePhonesBySubmissions(db, submissionIds);
  if (phones.length === 0) return [];

  const { data: members, error } = await db.from("members").select("id, phone, name, plan, quota_used, quota_total").in("phone", phones);
  if (error) throw new AssignmentError(error.message, 500);

  return ((members ?? []) as Array<Record<string, unknown>>).map((m) => {
    const phone = m.phone as string | null;
    return {
      id: String(m.id),
      phone,
      name: (m.name as string) ?? null,
      plan: (m.plan as string) ?? null,
      quota_used: (m.quota_used as number) ?? null,
      quota_total: (m.quota_total as number) ?? null,
      brand_name: (phone && brandMap[phone]) || (m.name as string) || (phone as string) || "",
    };
  });
}

// ---------------------------------------------------------------------------
// 服务端越权门：学生只能服务「已确认归属」的客户
// ---------------------------------------------------------------------------

export async function isClientAssigned(db: Db, studentId: string, memberId: string): Promise<boolean> {
  const { data: member, error } = await db.from("members").select("phone").eq("id", memberId).single();
  if (error || !member?.phone) return false;

  const projectIds = await resolveProjectIdsByPhone(db, member.phone as string);
  if (projectIds.length === 0) return false;

  const { data: assigns, error: assignErr } = await db
    .from("student_assignments")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "confirmed")
    .in("project_id", projectIds);
  if (assignErr) throw new AssignmentError(assignErr.message, 500);
  return (((assigns ?? []) as Array<Record<string, unknown>>).length) > 0;
}

// ---------------------------------------------------------------------------
// 归属记录展示（学生自己的记录 / 管理员全量记录）
// ---------------------------------------------------------------------------

export async function getStudentAssignments(db: Db, studentId: string): Promise<AssignmentRecord[]> {
  const { data, error } = await db
    .from("student_assignments")
    .select("student_id, project_id, status, source, created_at, updated_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new AssignmentError(error.message, 500);
  return hydrateAssignments(db, (data ?? []) as Array<Record<string, unknown>>);
}

export async function listAllAssignments(db: Db, filter?: { status?: AssignmentStatus; studentId?: string }): Promise<AssignmentRecord[]> {
  let query = db.from("student_assignments").select("student_id, project_id, status, source, created_at, updated_at");
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.studentId) query = query.eq("student_id", filter.studentId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new AssignmentError(error.message, 500);
  return hydrateAssignments(db, (data ?? []) as Array<Record<string, unknown>>);
}

async function hydrateAssignments(db: Db, rows: Array<Record<string, unknown>>): Promise<AssignmentRecord[]> {
  if (rows.length === 0) return [];

  const studentIds = unique(rows.map((r) => r.student_id as string).filter(Boolean));
  const projectIds = unique(rows.map((r) => r.project_id as string).filter(Boolean));

  let studentNameMap: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: accounts } = await db.from("student_accounts").select("id, name").in("id", studentIds);
    studentNameMap = Object.fromEntries(
      ((accounts ?? []) as Array<Record<string, unknown>>).map((a) => [String(a.id), String(a.name || "")]),
    );
  }

  const submissionIds = await resolveSubmissionIdsByProjects(db, projectIds);
  const submissionToBrand: Record<string, string> = {};
  const submissionToPhone: Record<string, string> = {};
  if (submissionIds.length > 0) {
    const { data: subs } = await db.from("submissions").select("id, phone, company_name").in("id", submissionIds);
    for (const s of (subs ?? []) as Array<Record<string, unknown>>) {
      submissionToBrand[String(s.id)] = String(s.company_name || "");
      submissionToPhone[String(s.id)] = String(s.phone || "");
    }
  }

  const projectToSubmission: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await db.from("projects").select("id, submission_id").in("id", projectIds);
    for (const p of (projects ?? []) as Array<Record<string, unknown>>) {
      projectToSubmission[String(p.id)] = String(p.submission_id || "");
    }
  }

  return rows.map((r) => {
    const projectId = r.project_id as string;
    const submissionId = projectToSubmission[projectId] || "";
    const phone = submissionId ? (submissionToPhone[submissionId] || "") : "";
    return {
      studentId: r.student_id as string,
      studentName: studentNameMap[r.student_id as string] || "",
      projectId,
      status: (r.status as AssignmentStatus) || "pending",
      source: (r.source as AssignmentSource) ?? null,
      brandName: submissionId ? (submissionToBrand[submissionId] || "") : "",
      phone,
      createdAt: (r.created_at as string) || "",
      updatedAt: (r.updated_at as string) || "",
    };
  });
}

// ---------------------------------------------------------------------------
// 学生动作：提交线索 / 认领客户（创建 student_assignments，status=pending）
// ---------------------------------------------------------------------------

function generateProjectId(now: Date): string {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VI-${dateStr}-${rand}`;
}

function generateSubmissionId(now: Date): string {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;
}

export async function submitLead(db: Db, studentId: string, lead: StudentLead): Promise<{ projectId: string; submissionId: string }> {
  const phone = (lead.phone || "").trim();
  if (!phone) throw new AssignmentError("请填写客户手机号");

  // 已存在同名/同号已提交客户：提示改用「认领」，避免重复建单。
  const existingProjectIds = await resolveProjectIdsByPhone(db, phone);
  if (existingProjectIds.length > 0) {
    throw new AssignmentError("该手机号已有客户提交，请改用「认领客户」");
  }

  const now = new Date();
  const isoNow = now.toISOString();
  const submissionId = generateSubmissionId(now);
  const projectId = generateProjectId(now);

  const submission = {
    id: submissionId,
    client_name: lead.clientName || lead.companyName || "",
    company_name: lead.companyName || lead.clientName || "",
    phone,
    wechat: lead.wechat || "",
    industry: lead.industry || "",
    status: "submitted",
    student_id: studentId,
    submitted_at: isoNow,
    created_at: isoNow,
  };
  const { error: subErr } = await db.from("submissions").insert(submission);
  if (subErr) throw new AssignmentError(subErr.message, 500);

  const project = {
    id: projectId,
    submission_id: submissionId,
    status: "submitted",
    client_name: lead.companyName || lead.clientName || "",
    industry: lead.industry || "",
    student_id: studentId,
    client_info: {
      companyName: lead.companyName || lead.clientName || "",
      formalBrandName: lead.companyName || lead.clientName || "",
      industry: lead.industry || "",
      generationStatus: "submitted",
    },
    created_at: isoNow,
    updated_at: isoNow,
  };
  const { error: projErr } = await db.from("projects").insert(project);
  if (projErr) {
    // 建项目失败则清理已建 submission，避免脏数据。
    await db.from("submissions").delete().eq("id", submissionId);
    throw new AssignmentError(projErr.message, 500);
  }

  await createAssignment(db, studentId, projectId, "submit", phone);
  return { projectId, submissionId };
}

export async function claimCustomer(db: Db, studentId: string, phone: string): Promise<{ projectId: string }> {
  const normalized = (phone || "").trim();
  if (!normalized) throw new AssignmentError("请输入客户手机号");

  const projectIds = await resolveProjectIdsByPhone(db, normalized);
  if (projectIds.length === 0) {
    throw new AssignmentError("未找到该手机号对应的客户，请先提交线索", 404);
  }
  const projectId = projectIds[0];

  // 同学生重复认领拦截。
  const existing = await resolveProjectIdsForStudent(db, studentId);
  if (existing.includes(projectId)) {
    throw new AssignmentError("您已认领该客户，请勿重复认领", 409);
  }

  // 防抢单：项目已有其他学生「已确认」归属时，不再允许新认领。
  const { data: confirmed, error: confErr } = await db
    .from("student_assignments")
    .select("student_id")
    .eq("project_id", projectId)
    .eq("status", "confirmed")
    .neq("student_id", studentId);
  if (confErr) throw new AssignmentError(confErr.message, 500);
  if (((confirmed ?? []) as Array<Record<string, unknown>>).length > 0) {
    throw new AssignmentError("该客户已被其他学生认领，请联系管理员", 409);
  }

  await createAssignment(db, studentId, projectId, "claim", normalized);
  return { projectId };
}

async function createAssignment(db: Db, studentId: string, projectId: string, source: AssignmentSource, phone: string): Promise<void> {
  const isoNow = nowIso();
  const { error } = await db.from("student_assignments").insert({
    student_id: studentId,
    project_id: projectId,
    status: "pending",
    source,
    updated_at: isoNow,
    created_at: isoNow,
  });
  if (error) {
    if (String(error.code) === "23505") {
      throw new AssignmentError("该客户归属已存在，请勿重复操作", 409);
    }
    throw new AssignmentError(error.message, 500);
  }
}

// ---------------------------------------------------------------------------
// 管理员裁决：确认 / 拒绝 / 解除（防抢单）
// ---------------------------------------------------------------------------

export async function confirmAssignment(db: Db, studentId: string, projectId: string): Promise<void> {
  const { error } = await db
    .from("student_assignments")
    .update({ status: "confirmed", updated_at: nowIso() })
    .eq("student_id", studentId)
    .eq("project_id", projectId);
  if (error) throw new AssignmentError(error.message, 500);

  // 防抢单：确认一人后，自动拒绝该项目的其他 pending 申请。
  const { data: others } = await db
    .from("student_assignments")
    .select("student_id")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .neq("student_id", studentId);
  const otherStudentIds = unique(((others ?? []) as Array<Record<string, unknown>>).map((r) => r.student_id as string).filter(Boolean));
  for (const otherId of otherStudentIds) {
    await db
      .from("student_assignments")
      .update({ status: "rejected", updated_at: nowIso() })
      .eq("student_id", otherId)
      .eq("project_id", projectId);
  }
}

export async function rejectAssignment(db: Db, studentId: string, projectId: string): Promise<void> {
  const { error } = await db
    .from("student_assignments")
    .update({ status: "rejected", updated_at: nowIso() })
    .eq("student_id", studentId)
    .eq("project_id", projectId);
  if (error) throw new AssignmentError(error.message, 500);
}

export async function unbindAssignment(db: Db, studentId: string, projectId: string): Promise<{ removed: boolean }> {
  const { data, error } = await db
    .from("student_assignments")
    .delete()
    .eq("student_id", studentId)
    .eq("project_id", projectId)
    .select();
  if (error) throw new AssignmentError(error.message, 500);
  return { removed: ((data ?? []) as unknown[]).length > 0 };
}
