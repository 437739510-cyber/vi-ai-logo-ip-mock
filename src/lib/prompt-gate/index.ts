/**
 * TICKET-122-R10：提示词合理性门（DeepSeek 核验 + 拦截记录 + 自动修正 ≤2 轮）。
 *
 * - 校验「最终拼装完成的完整提示词」；fail 即停（调用方不得继续生图）。
 * - 核验上下文只含当前客户方案 + 通用行业规则；不含手机号/地址等隐私、不含其它
 *   项目数据。
 * - geoContext：inferred=true 用洞察；inferred=false / 缺失 → 计数为管线异常，
 *   不猜不编。
 * - 每次 DeepSeek 调用记录 token/费用/模型/finish_reason（reporter 落盘）。
 * - transport 可注入（离线 stub 测试）；绝不写生产 Supabase。
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateDeepSeekCost } from "../core/billing/deepseek-pricing";
import { sanitizeBlock } from "./admin-reader";
import { upsertPromptGateBlock } from "./upsert";

export const PROMPT_GATE_MODEL = "deepseek-v4-flash";
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";

export type Transport = typeof fetch;

export interface PromptGateContext {
  prompt: string;
  industryFamily: string;
  category?: string;
  brandName: string;
  palette: string[];
  logoSemantics?: string;
  mascotIntent: "yes" | "no";
  targetAudience?: string;
  storeType?: string;
  sceneKeys: string[];
  province?: string;
  city?: string;
  geoContext?: { inferred: boolean; geoInsight?: string } | null;
  rules: string[];
  ticketCode: string;
}

export interface PromptGateAttempt {
  model: string;
  responseModel: string | null;
  httpStatus: number;
  finishReason: string | null;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costCny: number;
  latencyMs: number;
  kind: "check" | "fix";
}

export interface GateVerdict {
  pass: boolean;
  ruleId: string;
  reason: string;
  fixSuggestion?: string;
}

export interface BlockedRecord {
  ticket: string;
  blockedAt: string;
  ruleId: string;
  industryFamily: string;
  projectCode: string;
  promptPreview: string;
  beforePrompt: string;
  afterPrompt?: string;
  result: "fixed" | "auto_fix_failed" | "needs_review";
  verification: {
    attempts: PromptGateAttempt[];
    costCny: number;
    tokens: { prompt: number; completion: number };
    model: string;
    finishReason: string | null;
  };
  status: "待核验";
  geoInferredFalse: boolean;
}

export interface PromptGateResult {
  final: "pass" | "needs_review";
  verdict: GateVerdict | null;
  blockedRecords: BlockedRecord[];
  attempts: PromptGateAttempt[];
  geoAnomalyCount: number;
}

let geoAnomalyCount = 0;
export function resetGeoAnomalyCount(): void { geoAnomalyCount = 0; }
export function getGeoAnomalyCount(): number { return geoAnomalyCount; }

export function buildGateRules(ctx: Pick<PromptGateContext, "industryFamily" | "mascotIntent" | "sceneKeys">): string[] {
  const rules: string[] = [
    `行业族=${ctx.industryFamily}；提示词不得出现与该行业无关的异行业元素（如洗车出现美甲色卡、餐饮出现洗车工位等）。`,
    "不得出现可识别文字/乱码/品牌名以外的商标；画面中的招牌、屏幕、卡片、包装保持空白或仅允许品牌标识。",
    "禁止出现皇冠、盾牌、翅膀、火焰、红金土豪风等禁止元素。",
    ctx.mascotIntent === "no"
      ? "无 IP 项目：提示词不得要求/包含公仔、吉祥物、玩偶、卡通形象等 IP 元素。以否定式防护（no mascots / no 公仔 / 禁止吉祥物等）明确排除时属于合规表述，不得判为泄漏。"
      : "有 IP 项目：提示词允许包含指定公仔元素，但不得混入其它客户公仔/项目数据。",
    `已选场景/物料清单：${ctx.sceneKeys.join("、")}；提示词内容必须与这些场景/物料匹配。`,
    "提示词必须包含品牌主色板的核心色（若为英文提示词则用颜色名称等价表达），不得使用与品牌无关的色板。",
  ];
  return rules;
}

export function buildContextText(ctx: PromptGateContext): string {
  const lines: string[] = [];
  lines.push(`行业族：${ctx.industryFamily}${ctx.category ? `（品类：${ctx.category}）` : ""}`);
  lines.push(`品牌名：${ctx.brandName}`);
  lines.push(`品牌色板：${ctx.palette.join("、")}`);
  if (ctx.logoSemantics) lines.push(`LOGO 语义：${ctx.logoSemantics}`);
  lines.push(`公仔购买意图：${ctx.mascotIntent === "yes" ? "有 IP" : "无 IP（禁止公仔/IP 元素）"}`);
  if (ctx.targetAudience) lines.push(`目标客群：${ctx.targetAudience}`);
  if (ctx.storeType) lines.push(`门店类型：${ctx.storeType}`);
  if (ctx.province) lines.push(`省：${ctx.province}`);
  if (ctx.city) lines.push(`市：${ctx.city}`);
  lines.push(`已选场景/物料：${ctx.sceneKeys.join("、")}`);
  if (ctx.geoContext?.inferred && ctx.geoContext.geoInsight) {
    lines.push(`地理上下文洞察：${ctx.geoContext.geoInsight}`);
  } else {
    lines.push("地理上下文：不可用（管线异常计数，不编造）");
  }
  lines.push("门规则：");
  ctx.rules.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  return lines.join("\n");
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const cleaned = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function deepSeekGateCall(
  kind: "check" | "fix",
  system: string,
  user: string,
  transport: Transport,
  reporter?: (attempt: PromptGateAttempt) => void,
): Promise<{ raw: string; parsed: Record<string, unknown> | null; attempt: PromptGateAttempt }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const attempt: PromptGateAttempt = {
    model: PROMPT_GATE_MODEL, responseModel: null, httpStatus: 0, finishReason: null,
    promptTokens: 0, cachedTokens: 0, completionTokens: 0, costCny: 0, latencyMs: 0, kind,
  };
  if (!apiKey) return { raw: "", parsed: null, attempt };
  const started = Date.now();
  const response = await transport(DEEPSEEK_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PROMPT_GATE_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0,
      // fix 需输出完整重写提示词，给足余量防截断（实测 2048 会 finish=length）
      max_tokens: kind === "fix" ? 4096 : 2048,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  attempt.httpStatus = response.status;
  const text = await response.clone().text();
  if (!response.ok) {
    attempt.latencyMs = Date.now() - started;
    return { raw: text.slice(0, 300), parsed: null, attempt };
  }
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* keep null */ }
  const choice = body?.choices?.[0];
  const raw = String(choice?.message?.content || "");
  attempt.responseModel = body?.model || null;
  attempt.finishReason = choice?.finish_reason || null;
  attempt.promptTokens = body?.usage?.prompt_tokens || 0;
  attempt.cachedTokens = body?.usage?.prompt_cache_hit_tokens || 0;
  attempt.completionTokens = body?.usage?.completion_tokens || 0;
  attempt.costCny = calculateDeepSeekCost("deepseek-v4-flash", {
    promptTokens: attempt.promptTokens,
    cachedPromptTokens: attempt.cachedTokens,
    completionTokens: attempt.completionTokens,
  }, new Date()).totalCostCny;
  attempt.latencyMs = Date.now() - started;
  if (reporter) reporter(attempt);
  return { raw, parsed: parseJsonLoose(raw), attempt };
}

const CHECK_SYSTEM = `你是提示词合理性审核员。对照「门规则」与客户方案上下文，检查待检提示词是否：
1) 出现异行业元素（串行业）；2) 品牌/色板/公仔意图写错；3) 地理矛盾（如海南椰汁出现雪景、北方品牌出现椰林）；4) 缺失必须要素（品牌主色、无 IP 禁公仔等）；5) 含其它项目/客户数据。
注意：提示词中以否定形式出现公仔类词（如 "no mascots"、"no 公仔"、"no 玩偶"、"no 吉祥物"、"no dolls"、"no cartoon figures" 等）是「明确排除公仔」的合规防护表述，表示画面中不得出现公仔，不构成 mascot-leak；只有提示词要求/包含公仔元素（如 "with mascot"、"加上公仔"）才判 mascot-leak。
只输出严格JSON：{"pass":true或false,"ruleId":"规则ID(如 cross-industry/geo-contradiction/mascot-leak/missing-core/other)","reason":"一句话","fixSuggestion":"修正建议片段(英文/中文均可，保持品牌与色板不变)"}。`;

const FIX_SYSTEM = `你是提示词修正员。按门规则与客户方案上下文，只修改待检提示词中的问题片段；严禁改动行业、品牌名、品牌色板、公仔购买意图等核心信息。只输出严格JSON：{"fixedPrompt":"完整修正后的提示词","changedCore":true或false,"note":"一句话"}。`;

export async function checkPrompt(
  ctx: PromptGateContext,
  opts: { transport?: Transport; reporter?: (attempt: PromptGateAttempt) => void } = {},
): Promise<GateVerdict> {
  const transport = opts.transport || fetch;
  const user = `【待检提示词】\n${ctx.prompt}\n\n【客户方案上下文】\n${buildContextText(ctx)}`;
  const { parsed } = await deepSeekGateCall("check", CHECK_SYSTEM, user, transport, opts.reporter);
  if (!parsed) return { pass: false, ruleId: "gate-unavailable", reason: "核验不可用（无响应/解析失败）" };
  return {
    pass: parsed.pass === true,
    ruleId: String(parsed.ruleId || "other"),
    reason: String(parsed.reason || ""),
    fixSuggestion: parsed.fixSuggestion ? String(parsed.fixSuggestion) : undefined,
  };
}

export async function fixPrompt(
  ctx: PromptGateContext,
  opts: { transport?: Transport; reporter?: (attempt: PromptGateAttempt) => void } = {},
): Promise<{ fixedPrompt: string | null; changedCore: boolean; note: string }> {
  const transport = opts.transport || fetch;
  const user = `【待修正提示词】\n${ctx.prompt}\n\n【客户方案上下文】\n${buildContextText(ctx)}\n\n【核验理由/建议】\n${ctx.rules.join("\n")}`;
  const { parsed } = await deepSeekGateCall("fix", FIX_SYSTEM, user, transport, opts.reporter);
  if (!parsed || !parsed.fixedPrompt) return { fixedPrompt: null, changedCore: false, note: "修正无响应" };
  return {
    fixedPrompt: String(parsed.fixedPrompt),
    changedCore: parsed.changedCore === true,
    note: String(parsed.note || ""),
  };
}

export function coreInfoProtected(original: string, fixed: string, ctx: Pick<PromptGateContext, "brandName" | "palette">): boolean {
  if (!fixed || !fixed.trim()) return false;
  const brandOk = ctx.brandName ? fixed.includes(ctx.brandName) : true;
  const primaryHex = ctx.palette[0] ? ctx.palette[0].toLowerCase() : null;
  const hexOk = primaryHex ? fixed.toLowerCase().includes(primaryHex) || fixed.toLowerCase().includes(primaryHex.replace("#", "")) : true;
  return brandOk && hexOk;
}

function tsName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function writeBlockedRecord(
  record: BlockedRecord,
  logRoot = path.join(process.cwd(), "logs", "prompt-gate"),
  opts: { upsert?: boolean; client?: unknown } = {},
): Promise<string> {
  await fs.mkdir(logRoot, { recursive: true });
  const file = path.join(logRoot, `blocked-${record.ticket}-${tsName()}.json`);
  await fs.writeFile(file, JSON.stringify(record, null, 2), "utf8");
  // TICKET-122-R14：生产 upsert（PROMPT_GATE_UPSERT=1 或显式启用；失败不抛错，本地 JSON 兜底）
  const upsertEnabled = opts.upsert !== false && (opts.upsert === true || process.env.PROMPT_GATE_UPSERT === "1");
  if (upsertEnabled) {
    upsertPromptGateBlock(sanitizeBlock(record as unknown as Record<string, unknown>), opts.client as never).catch(() => {});
  }
  return file;
}

export async function runPromptGateWithAutoFix(
  ctx: PromptGateContext,
  opts: {
    transport?: Transport;
    reporter?: (attempt: PromptGateAttempt) => void;
    maxFixRounds?: number;
    logRoot?: string;
    writeRecords?: boolean;
    upsert?: boolean;
    upsertClient?: unknown;
  } = {},
): Promise<PromptGateResult> {
  const transport = opts.transport || fetch;
  const maxFixRounds = opts.maxFixRounds ?? 2;
  const attempts: PromptGateAttempt[] = [];
  const reporter = (a: PromptGateAttempt) => { attempts.push(a); opts.reporter?.(a); };
  const blockedRecords: BlockedRecord[] = [];
  const geoInferredFalse = !ctx.geoContext?.inferred;
  if (geoInferredFalse) geoAnomalyCount += 1;

  const runCheck = async (promptText: string) => {
    const verdict = await checkPrompt({ ...ctx, prompt: promptText }, { transport, reporter });
    return verdict;
  };

  let current = ctx.prompt;
  let verdict = await runCheck(current);
  if (verdict.pass) {
    return { final: "pass", verdict, blockedRecords: [], attempts, geoAnomalyCount };
  }

  // 拦截记录（首轮失败）
  const baseRecord: Omit<BlockedRecord, "result" | "afterPrompt"> = {
    ticket: ctx.ticketCode,
    blockedAt: new Date().toISOString(),
    ruleId: verdict.ruleId,
    industryFamily: ctx.industryFamily,
    projectCode: ctx.ticketCode,
    promptPreview: current.slice(0, 200),
    beforePrompt: current,
    verification: {
      attempts: [],
      costCny: 0,
      tokens: { prompt: 0, completion: 0 },
      model: PROMPT_GATE_MODEL,
      finishReason: null,
    },
    status: "待核验" as const,
    geoInferredFalse,
  };

  for (let round = 1; round <= maxFixRounds; round += 1) {
    const fix = await fixPrompt({ ...ctx, prompt: current }, { transport, reporter });
    if (!fix.fixedPrompt || fix.changedCore || !coreInfoProtected(current, fix.fixedPrompt, ctx)) {
      const record: BlockedRecord = fillVerification({ ...baseRecord, result: "needs_review" }, attempts);
      blockedRecords.push(record);
      if (opts.writeRecords !== false) await writeBlockedRecord(record, opts.logRoot, { upsert: opts.upsert, client: opts.upsertClient });
      return { final: "needs_review", verdict, blockedRecords, attempts, geoAnomalyCount };
    }
    current = fix.fixedPrompt;
    verdict = await runCheck(current);
    if (verdict.pass) {
      const record: BlockedRecord = fillVerification({ ...baseRecord, afterPrompt: current, result: "fixed" }, attempts);
      blockedRecords.push(record);
      if (opts.writeRecords !== false) await writeBlockedRecord(record, opts.logRoot, { upsert: opts.upsert, client: opts.upsertClient });
      return { final: "pass", verdict, blockedRecords, attempts, geoAnomalyCount };
    }
  }

  const record: BlockedRecord = fillVerification({ ...baseRecord, afterPrompt: current, result: "auto_fix_failed" }, attempts);
  blockedRecords.push(record);
  if (opts.writeRecords !== false) await writeBlockedRecord(record, opts.logRoot, { upsert: opts.upsert, client: opts.upsertClient });
  return { final: "needs_review", verdict, blockedRecords, attempts, geoAnomalyCount };
}

function fillVerification(record: BlockedRecord, attempts: PromptGateAttempt[]): BlockedRecord {
  const checkAttempts = attempts.filter((a) => a.kind === "check");
  const last = checkAttempts[checkAttempts.length - 1];
  record.verification.attempts = attempts;
  record.verification.costCny = attempts.reduce((s, a) => s + a.costCny, 0);
  record.verification.tokens.prompt = attempts.reduce((s, a) => s + a.promptTokens, 0);
  record.verification.tokens.completion = attempts.reduce((s, a) => s + a.completionTokens, 0);
  record.verification.model = last?.model || PROMPT_GATE_MODEL;
  record.verification.finishReason = last?.finishReason ?? null;
  return record;
}

export function promptSha256(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}
