/**
 * TICKET-122-R14：prompt_gate_blocks 生产 upsert + 表读取（双源可切换）。
 * - upsert 失败返回 { ok:false } 且不抛错（写入失败不阻塞生图，本地 blocked-*.json 兜底）；
 * - 表只存脱敏展示字段，不含客户提示词全文/密钥；
 * - client 可注入（stub/no-I/O 测试）；真实调用使用 supabaseAdmin。
 */
import type { PromptGateBlockView } from "./admin-reader";

export interface UpsertResult {
  ok: boolean;
  error?: string;
  id?: unknown;
}

export interface TableClient {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null; data?: unknown }>;
    select: (cols: string) => {
      order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
  };
}

export function blockToRow(block: PromptGateBlockView): Record<string, unknown> {
  return {
    blocked_at: block.blockedAt || new Date().toISOString(),
    rule_id: block.ruleId,
    industry_family: block.industryFamily,
    project_code: block.ticketCode,
    scene_role: block.sceneRole,
    prompt_preview: block.promptPreview.slice(0, 200),
    result: block.result,
    status: block.status,
    cost_cny: block.costCny,
    prompt_tokens: block.promptTokens,
    completion_tokens: block.completionTokens,
    model: block.model,
    finish_reason: block.finishReason,
    geo_inferred_false: block.geoInferredFalse,
    source_file: "",
  };
}

export async function upsertPromptGateBlock(
  block: PromptGateBlockView,
  client?: TableClient,
): Promise<UpsertResult> {
  try {
    const tableClient = client || (await import("@/lib/core/supabase")).supabaseAdmin as unknown as TableClient;
    const { error, data } = await tableClient.from("prompt_gate_blocks").insert([blockToRow(block)]);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as unknown as Array<{ id?: unknown }> | null)?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readPromptGateBlocksFromTable(client?: TableClient): Promise<PromptGateBlockView[]> {
  try {
    const tableClient = client || (await import("@/lib/core/supabase")).supabaseAdmin as unknown as TableClient;
    const { data, error } = await tableClient.from("prompt_gate_blocks").select("blocked_at,rule_id,industry_family,project_code,scene_role,prompt_preview,result,status,cost_cny,prompt_tokens,completion_tokens,model,finish_reason,geo_inferred_false").order("blocked_at", { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      blockedAt: String(r.blocked_at || ""),
      ticketCode: String(r.project_code || ""),
      industryFamily: String(r.industry_family || ""),
      sceneRole: String(r.scene_role || ""),
      ruleId: String(r.rule_id || ""),
      promptPreview: String(r.prompt_preview || ""),
      result: String(r.result || ""),
      status: String(r.status || "待核验"),
      costCny: Number(r.cost_cny || 0),
      promptTokens: Number(r.prompt_tokens || 0),
      completionTokens: Number(r.completion_tokens || 0),
      model: String(r.model || ""),
      finishReason: r.finish_reason == null ? null : String(r.finish_reason),
      geoInferredFalse: r.geo_inferred_false === true,
      hasAfterPrompt: false,
    }));
  } catch {
    return [];
  }
}
