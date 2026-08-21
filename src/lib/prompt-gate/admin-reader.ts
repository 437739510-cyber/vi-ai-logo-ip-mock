/**
 * TICKET-122-R11：管理后台「提示词门拦截记录」只读数据源（本地 JSON）。
 *
 * - 数据源：`logs/prompt-gate/blocked-*.json`（R10 产出，字段见 R10）。
 * - 只读解析 + 筛选 + 摘要；禁止网络、禁止生产 Supabase 写。
 * - 展示脱敏：列表只返回 projectCode（项目代号）、提示词截断预览，不返回完整
 *   客户提示词全文。
 */
import fs from "node:fs/promises";
import path from "node:path";

export interface PromptGateBlockView {
  blockedAt: string;
  ticketCode: string;
  industryFamily: string;
  sceneRole: string;
  ruleId: string;
  promptPreview: string;
  result: string;
  status: string;
  costCny: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  finishReason: string | null;
  geoInferredFalse: boolean;
  hasAfterPrompt: boolean;
}

export interface PromptGateSummary {
  total: number;
  byRuleId: Record<string, number>;
  byIndustry: Record<string, number>;
  byStatus: Record<string, number>;
  byResult: Record<string, number>;
}

const PREVIEW_LIMIT = 200;

export function sanitizeBlock(raw: Record<string, unknown>): PromptGateBlockView {
  const verification = (raw.verification || {}) as Record<string, unknown>;
  const tokens = (verification.tokens || {}) as Record<string, unknown>;
  const preview = String(raw.promptPreview || String(raw.beforePrompt || "")).slice(0, PREVIEW_LIMIT);
  return {
    blockedAt: String(raw.blockedAt || ""),
    ticketCode: String(raw.projectCode || raw.ticket || ""),
    industryFamily: String(raw.industryFamily || ""),
    sceneRole: String(raw.sceneRole || ""),
    ruleId: String(raw.ruleId || ""),
    promptPreview: preview,
    result: String(raw.result || ""),
    status: String(raw.status || "待核验"),
    costCny: Number(verification.costCny || 0),
    promptTokens: Number(tokens.prompt || 0),
    completionTokens: Number(tokens.completion || 0),
    model: String(verification.model || ""),
    finishReason: verification.finishReason == null ? null : String(verification.finishReason),
    geoInferredFalse: raw.geoInferredFalse === true,
    hasAfterPrompt: Boolean(raw.afterPrompt),
  };
}

export async function readPromptGateBlocks(dir?: string): Promise<PromptGateBlockView[]> {
  const root = dir || path.join(process.cwd(), "logs", "prompt-gate");
  let files: string[] = [];
  try {
    files = (await fs.readdir(root)).filter((f) => f.startsWith("blocked-") && f.endsWith(".json"));
  } catch {
    return [];
  }
  const blocks: PromptGateBlockView[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(root, f), "utf8")) as Record<string, unknown>;
      blocks.push(sanitizeBlock(raw));
    } catch {
      // 单个损坏记录跳过，不拖垮整个列表
    }
  }
  return blocks.sort((a, b) => (a.blockedAt < b.blockedAt ? 1 : -1));
}

export function filterPromptGateBlocks(
  blocks: PromptGateBlockView[],
  filters: { ruleId?: string; industryFamily?: string; from?: string; to?: string; status?: string } = {},
): PromptGateBlockView[] {
  return blocks.filter((b) => {
    if (filters.ruleId && b.ruleId !== filters.ruleId) return false;
    if (filters.industryFamily && b.industryFamily !== filters.industryFamily) return false;
    if (filters.status && b.status !== filters.status) return false;
    if (filters.from && b.blockedAt && b.blockedAt < filters.from) return false;
    if (filters.to && b.blockedAt && b.blockedAt > filters.to) return false;
    return true;
  });
}

export function summarizePromptGateBlocks(blocks: PromptGateBlockView[]): PromptGateSummary {
  const byRuleId: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byResult: Record<string, number> = {};
  for (const b of blocks) {
    byRuleId[b.ruleId || "unknown"] = (byRuleId[b.ruleId || "unknown"] || 0) + 1;
    byIndustry[b.industryFamily || "unknown"] = (byIndustry[b.industryFamily || "unknown"] || 0) + 1;
    byStatus[b.status || "待核验"] = (byStatus[b.status || "待核验"] || 0) + 1;
    byResult[b.result || "unknown"] = (byResult[b.result || "unknown"] || 0) + 1;
  }
  return { total: blocks.length, byRuleId, byIndustry, byStatus, byResult };
}
