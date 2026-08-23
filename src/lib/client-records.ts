// TICKET-122-R26: 客户管理批量删除服务层
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端（便于离线 mock 回归验证）。
// 删除语义：
//   - 软删除：submissions / projects 写入 deleted_at 时间戳，物理行保留，避免破坏
//     R22 结算账户与 R20 归属等关联数据；
//   - 关联保护：存在 student_assignments（归属）、member_contents（内容）、
//     settlements（结算流水）任一关联的客户整批拒绝删除（fail-closed）；
//   - 强确认：服务端再次校验确认文本，防绕过前端门。
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminOperation } from "./core/admin-operation-log";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

export const CLIENT_DELETE_CONFIRM_TEXT = "确认";

export class ClientRecordsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClientRecordsError";
    this.status = status;
  }
}

export interface ClientProtection {
  hasAssignments: boolean;
  hasMemberContents: boolean;
  hasSettlements: boolean;
  reasons: string[];
}

export interface ClientRecord {
  id: string;
  clientName: string;
  companyName: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  industry: string;
  budgetRange: string | null;
  description: string | null;
  submittedAt: string;
  status: string;
  projectId: string | null;
  projectStatus: string | null;
  projectUpdatedAt: string | null;
  protection: ClientProtection;
}

export interface ProtectedClient {
  id: string;
  reasons: string[];
}

export interface ClientDeleteResult {
  deleted: string[];
  protected: ProtectedClient[];
}

export interface DeleteOperator {
  id: string;
  role: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function emptyProtection(): ClientProtection {
  return { hasAssignments: false, hasMemberContents: false, hasSettlements: false, reasons: [] };
}

/** 查询未删除（软删）的 submissions。 */
async function fetchActiveSubmissions(db: Db): Promise<Row[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new ClientRecordsError(error.message, 500);
  return (data ?? []) as Row[];
}

/** 按 submission_id 加载全部 projects（含软删，保护判定需覆盖历史关联）。 */
async function loadProjectsBySubmission(db: Db, submissionIds: string[]): Promise<Map<string, Row[]>> {
  const map = new Map<string, Row[]>();
  if (submissionIds.length === 0) return map;
  const { data, error } = await db
    .from("projects")
    .select("id, submission_id, status, updated_at, created_at, deleted_at")
    .in("submission_id", submissionIds);
  if (error) throw new ClientRecordsError(error.message, 500);
  for (const row of (data ?? []) as Row[]) {
    const sid = asString(row.submission_id);
    if (!sid) continue;
    const list = map.get(sid) ?? [];
    list.push(row);
    map.set(sid, list);
  }
  return map;
}

/** 计算每个 submission 的关联保护：归属 / 内容 / 结算。 */
async function resolveProtection(
  db: Db,
  subs: Row[],
  projectsBySubmission: Map<string, Row[]>,
): Promise<Map<string, ClientProtection>> {
  const result = new Map<string, ClientProtection>();
  if (subs.length === 0) return result;

  const phones = unique(subs.map((s) => asString(s.phone)).filter(Boolean));
  const projectIds = unique(
    [...projectsBySubmission.values()].flat().map((p) => asString(p.id)).filter(Boolean),
  );

  let assignmentProjectIds = new Set<string>();
  if (projectIds.length > 0) {
    const { data, error } = await db
      .from("student_assignments")
      .select("project_id")
      .in("project_id", projectIds);
    if (error) throw new ClientRecordsError(error.message, 500);
    assignmentProjectIds = new Set(
      ((data ?? []) as Row[]).map((a) => asString(a.project_id)).filter(Boolean),
    );
  }

  let memberIdsByPhone = new Map<string, string[]>();
  if (phones.length > 0) {
    const { data, error } = await db.from("members").select("id, phone").in("phone", phones);
    if (error) throw new ClientRecordsError(error.message, 500);
    for (const row of (data ?? []) as Row[]) {
      const phone = asString(row.phone);
      const memberId = asString(row.id);
      if (!phone || !memberId) continue;
      const list = memberIdsByPhone.get(phone) ?? [];
      list.push(memberId);
      memberIdsByPhone.set(phone, list);
    }
  }
  const memberIds = unique([...memberIdsByPhone.values()].flat());

  let contentMemberIds = new Set<string>();
  if (memberIds.length > 0) {
    const { data, error } = await db
      .from("member_contents")
      .select("id, member_id")
      .in("member_id", memberIds);
    if (error) throw new ClientRecordsError(error.message, 500);
    contentMemberIds = new Set(
      ((data ?? []) as Row[]).map((c) => asString(c.member_id)).filter(Boolean),
    );
  }

  let settlementMemberIds = new Set<string>();
  if (memberIds.length > 0) {
    const { data, error } = await db
      .from("settlements")
      .select("id, member_id")
      .in("member_id", memberIds);
    if (error) throw new ClientRecordsError(error.message, 500);
    settlementMemberIds = new Set(
      ((data ?? []) as Row[]).map((s) => asString(s.member_id)).filter(Boolean),
    );
  }

  for (const sub of subs) {
    const id = asString(sub.id);
    const phone = asString(sub.phone);
    const subProjects = projectsBySubmission.get(id) ?? [];
    const hasAssignments = subProjects.some((p) => assignmentProjectIds.has(asString(p.id)));
    const memberIdsForPhone = memberIdsByPhone.get(phone) ?? [];
    const hasMemberContents = memberIdsForPhone.some((m) => contentMemberIds.has(m));
    const hasSettlements = memberIdsForPhone.some((m) => settlementMemberIds.has(m));
    const reasons: string[] = [];
    if (hasAssignments) reasons.push("存在学生归属记录（student_assignments）");
    if (hasMemberContents) reasons.push("存在客户内容记录（member_contents）");
    if (hasSettlements) reasons.push("存在结算流水（settlements）");
    result.set(id, { hasAssignments, hasMemberContents, hasSettlements, reasons });
  }
  return result;
}

/** 管理后台客户列表：真实 submissions + 关联 project + 保护标记（软删排除）。 */
export async function listClientRecords(db: Db): Promise<ClientRecord[]> {
  const subs = await fetchActiveSubmissions(db);
  const submissionIds = unique(subs.map((s) => asString(s.id)).filter(Boolean));
  const projectsBySubmission = await loadProjectsBySubmission(db, submissionIds);
  const protection = await resolveProtection(db, subs, projectsBySubmission);

  return subs.map((sub) => {
    const id = asString(sub.id);
    const activeProjects = (projectsBySubmission.get(id) ?? []).filter((p) => p.deleted_at == null);
    const project = activeProjects[0] ?? null;
    return {
      id,
      clientName: asString(sub.client_name ?? sub.contact_name),
      companyName: asString(sub.company_name),
      phone: asString(sub.phone),
      wechat: sub.wechat == null ? null : asString(sub.wechat),
      email: sub.email == null ? null : asString(sub.email),
      industry: asString(sub.industry),
      budgetRange: sub.budget_range == null ? null : asString(sub.budget_range),
      description: sub.description == null ? null : asString(sub.description),
      submittedAt: asString(sub.created_at ?? sub.submitted_at),
      status: asString(sub.status),
      projectId: project ? asString(project.id) : null,
      projectStatus: project ? asString(project.status) : null,
      projectUpdatedAt: project ? asString(project.updated_at ?? project.created_at) : null,
      protection: protection.get(id) ?? emptyProtection(),
    };
  });
}

/**
 * 批量删除（软删除 + 关联保护 + 操作日志）。
 * 任一选中客户存在关联保护 => 整批拒绝（fail-closed），不做部分删除。
 */
export async function deleteClientRecords(
  db: Db,
  submissionIds: string[],
  confirmText: string,
  operator: DeleteOperator,
): Promise<ClientDeleteResult> {
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    throw new ClientRecordsError("缺少要删除的客户（submissionIds 非空数组）", 400);
  }
  if (confirmText !== CLIENT_DELETE_CONFIRM_TEXT) {
    throw new ClientRecordsError(`请在弹窗中输入「${CLIENT_DELETE_CONFIRM_TEXT}」以完成删除`, 400);
  }

  const ids = unique(submissionIds.map((id) => asString(id)).filter(Boolean));
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw new ClientRecordsError(error.message, 500);
  const targets = (data ?? []) as Row[];
  if (targets.length === 0) {
    return { deleted: [], protected: [] };
  }

  const targetIds = unique(targets.map((s) => asString(s.id)).filter(Boolean));
  const projectsBySubmission = await loadProjectsBySubmission(db, targetIds);
  const protection = await resolveProtection(db, targets, projectsBySubmission);

  const protectedClients: ProtectedClient[] = [];
  const deletableIds: string[] = [];
  for (const target of targets) {
    const id = asString(target.id);
    const prot = protection.get(id) ?? emptyProtection();
    if (prot.reasons.length > 0) {
      protectedClients.push({ id, reasons: prot.reasons });
    } else {
      deletableIds.push(id);
    }
  }

  if (protectedClients.length > 0) {
    await logAdminOperation(db, {
      operatorId: operator.id,
      operatorRole: operator.role,
      action: "client_batch_delete_blocked",
      entityType: "submission",
      entityIds: targetIds,
      detail: {
        deletedCount: 0,
        protectedCount: protectedClients.length,
        protected: protectedClients,
      },
    });
    return { deleted: [], protected: protectedClients };
  }

  const isoNow = new Date().toISOString();
  const { error: subErr } = await db
    .from("submissions")
    .update({ deleted_at: isoNow })
    .in("id", deletableIds)
    .is("deleted_at", null);
  if (subErr) throw new ClientRecordsError(subErr.message, 500);

  const { error: projErr } = await db
    .from("projects")
    .update({ deleted_at: isoNow })
    .in("submission_id", deletableIds)
    .is("deleted_at", null);
  if (projErr) throw new ClientRecordsError(projErr.message, 500);

  await logAdminOperation(db, {
    operatorId: operator.id,
    operatorRole: operator.role,
    action: "client_batch_delete",
    entityType: "submission",
    entityIds: deletableIds,
    detail: { deletedCount: deletableIds.length, protectedCount: 0 },
  });

  return { deleted: deletableIds, protected: [] };
}
