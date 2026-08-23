// TICKET-122-R26: 管理员操作日志（best-effort，不阻塞主业务）
// 记录删除人/角色/时间/动作/实体与数量，供审计追溯。
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminOperationLogEntry {
  operatorId: string;
  operatorRole: string;
  action: string;
  entityType: string;
  entityIds: string[];
  detail?: Record<string, unknown>;
}

export async function logAdminOperation(
  db: SupabaseClient,
  entry: AdminOperationLogEntry,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.from("admin_operation_logs").insert({
      id,
      operator_id: entry.operatorId,
      operator_role: entry.operatorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_ids: entry.entityIds,
      detail: entry.detail ?? {},
      created_at: now,
    });
  } catch (error) {
    // 日志写入失败不阻断删除主流程，但必须在服务端留下告警
    console.error("[admin-operation-log] failed to write operation log:", error);
  }
}
