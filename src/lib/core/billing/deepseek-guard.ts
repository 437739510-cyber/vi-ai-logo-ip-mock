/**
 * DeepSeek API 调用守卫。
 * - 在 api_usage_log 记录路由、模型、token、费用和响应状态。
 * - 调用前检查每日预算，调用后按实际模型与缓存命中量计费。
 * - 所有受保护调用统一使用 DEEPSEEK_MODEL，默认 deepseek-v4-flash。
 */

import { supabaseAdmin } from "@/lib/core/supabase";
import {
  calculateDeepSeekCost,
  normalizeDeepSeekResponseModel,
  resolveDeepSeekModel,
  type SupportedDeepSeekModel,
} from "./deepseek-pricing";
// DeepSeek API configuration constants
export const DEEPSEEK_MODEL = resolveDeepSeekModel();
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// Default daily budget cap (CNY)
const DEFAULT_DAILY_BUDGET = parseFloat(process.env.DEEPSEEK_DAILY_BUDGET || "20.00");

interface GuardOptions {
  route: string;
  method?: string;
  model?: string;
  projectId?: string;
  requestSummary?: string;
  dailyBudgetCny?: number;
}

interface CallLogUpdate {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cost_cny?: number;
  response_status?: number;
  error_message?: string;
}

/**
 * Pre-call check: verify daily budget not exceeded, log the attempt
 */
export async function deepseekPreCheck(options: GuardOptions): Promise<{
  allowed: boolean;
  reason?: string;
  logId?: number;
}> {
  const {
    route,
    method = 'POST',
    model = DEEPSEEK_MODEL,
    projectId,
    requestSummary,
    dailyBudgetCny = DEFAULT_DAILY_BUDGET,
  } = options;

  try {
    // 1. Check today's spending
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: spendRows } = await supabaseAdmin
      .from("api_usage_log")
      .select("cost_cny")
      .gte("created_at", todayStart.toISOString())
      .not("route", "like", "[BLOCKED]%");

    let todayTotal = 0;
    if (spendRows) {
      todayTotal = spendRows.reduce((sum, r) => sum + (r.cost_cny || 0), 0);
    }

    if (todayTotal >= dailyBudgetCny) {
      // Budget exceeded - log the blocked attempt
      await supabaseAdmin.from("api_usage_log").insert({
        route: `[BLOCKED] ${route}`,
        method,
        model,
        cost_cny: 0,
        project_id: projectId || null,
        request_summary: `预算超限: ¥${todayTotal.toFixed(2)} / ¥${dailyBudgetCny.toFixed(2)}`,
        response_status: 402,
        error_message: 'Daily budget exceeded',
      });

      return {
        allowed: false,
        reason: `今日 DeepSeek 预算已用完: ¥${todayTotal.toFixed(2)} / ¥${dailyBudgetCny.toFixed(2)}`,
      };
    }

    // 2. Log the call attempt
    const { data: inserted } = await supabaseAdmin
      .from("api_usage_log")
      .insert({
        route,
        method,
        model,
        cost_cny: 0,
        project_id: projectId || null,
        request_summary: (requestSummary || '').substring(0, 200),
      })
      .select("id")
      .single();

    const logId = inserted?.id;

    return { allowed: true, logId };
  } catch (error) {
    console.error('[DeepSeek-Guard] Pre-check failed:', error);
    return { allowed: true };
  }
}

/**
 * Post-call: update the log with actual token usage and cost
 */
export async function deepseekPostLog(
  logId: number | undefined,
  update: CallLogUpdate
): Promise<void> {
  if (!logId) return;

  try {
    const model = resolveDeepSeekModel(update.model);
    const breakdown = calculateDeepSeekCost(model, {
      promptTokens: update.input_tokens || 0,
      cachedPromptTokens: update.cached_tokens || 0,
      completionTokens: update.output_tokens || 0,
    });
    const totalCost = update.cost_cny ?? breakdown.totalCostCny;

    await supabaseAdmin
      .from("api_usage_log")
      .update({
        input_tokens: update.input_tokens || 0,
        output_tokens: update.output_tokens || 0,
        model,
        cost_cny: parseFloat(totalCost.toFixed(6)),
        response_status: update.response_status,
        error_message: update.error_message || null,
      })
      .eq("id", logId);
  } catch (error) {
    console.error('[DeepSeek-Guard] Post-log failed:', error);
  }
}

/**
 * Wrapped DeepSeek API call with automatic guard + logging
 */
export async function guardedDeepSeekCall(
  options: GuardOptions & {
    body: Record<string, unknown>;
    timeoutMs?: number;  // 超时毫秒数，默认 60000
  }
): Promise<Response> {
  const { route, body, projectId, requestSummary, dailyBudgetCny, timeoutMs = 60000 } = options;
  const model: SupportedDeepSeekModel = resolveDeepSeekModel();

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'DeepSeek API Key not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const check = await deepseekPreCheck({
    route,
    model,
    projectId,
    requestSummary,
    dailyBudgetCny,
  });

  if (!check.allowed) {
    return new Response(JSON.stringify({ error: check.reason }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, model }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const cloned = response.clone();
      try {
        const result = await cloned.json() as {
          model?: unknown;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_cache_hit_tokens?: number;
          };
        };
        const usage = result?.usage;
        if (usage) {
          const responseModel = normalizeDeepSeekResponseModel(result.model, model);
          if (responseModel.warning) {
            console.warn(`[DeepSeek-Guard] ${responseModel.warning}`);
          }
          await deepseekPostLog(check.logId, {
            model: responseModel.model,
            input_tokens: usage.prompt_tokens || 0,
            output_tokens: usage.completion_tokens || 0,
            cached_tokens: usage.prompt_cache_hit_tokens || 0,
            response_status: response.status,
          });
        }
      } catch {
        await deepseekPostLog(check.logId, { model, response_status: response.status });
      }
    } else {
      const errText = await response.clone().text().catch(() => 'unknown');
      await deepseekPostLog(check.logId, {
        model,
        response_status: response.status,
        error_message: errText.substring(0, 200),
      });
    }

    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    await deepseekPostLog(check.logId, {
      model,
      response_status: 0,
      error_message: isTimeout
        ? `Timeout after ${timeoutMs}ms`
        : (error instanceof Error ? error.message : 'Network error'),
    });
    throw error;
  }
}

/**
 * Get today's usage summary for admin dashboard
 */
export async function getTodayUsage(): Promise<{
  totalCost: number;
  callCount: number;
  byRoute: Record<string, { cost: number; count: number }>;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const { data: rows } = await supabaseAdmin
      .from("api_usage_log")
      .select("route, cost_cny")
      .gte("created_at", todayStart.toISOString())
      .not("route", "like", "[BLOCKED]%");

    if (!rows) return { totalCost: 0, callCount: 0, byRoute: {} };

    const byRoute: Record<string, { cost: number; count: number }> = {};
    let totalCost = 0;

    for (const row of rows) {
      if (!byRoute[row.route]) byRoute[row.route] = { cost: 0, count: 0 };
      byRoute[row.route].cost += row.cost_cny || 0;
      byRoute[row.route].count += 1;
      totalCost += row.cost_cny || 0;
    }

    return { totalCost, callCount: rows.length, byRoute };
  } catch {
    return { totalCost: 0, callCount: 0, byRoute: {} };
  }
}
