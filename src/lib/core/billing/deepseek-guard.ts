/**
 * DeepSeek API 璋冪敤瀹堝崼 (V55: 澶嶇敤supabaseAdmin鍗曚緥锛屼慨澶峞nv鍙橀噺鍛藉悕)
 * - 璁板綍姣忔璋冪敤鐨勮矾鐢便€乼oken鐢ㄩ噺銆佽垂鐢ㄣ€佹椂闂存埑鍒?api_usage_log
 * - 姣忔棩棰勭畻涓婇檺锛堥粯璁?鍏冿級锛岃秴鍑鸿嚜鍔ㄦ嫤鎴? * - 鎵€鏈?DeepSeek 璋冪敤蹇呴』閫氳繃姝ゆā鍧? * 
 * V55鍙樻洿锛氱Щ闄ゆ湰鍦癝upabase瀹㈡埛绔垱寤猴紝鏀逛负澶嶇敤 supabaseAdmin 鍗曚緥
 * - 淇锛氬師浠ｇ爜鐢?process.env.SUPABASE_SERVICE_KEY 鐩存帴鍒涘缓瀹㈡埛绔紝
 *   璇nv鍦╖eabur涓彲鑳芥湭閰嶇疆锛堝疄闄呭彉閲忓悕涓篠UPABASE_SERVICE_ROLE_KEY锛夛紝
 *   瀵艰嚧guard鍔熻兘闈欓粯闄嶇骇涓篴non key锛堟潈闄愪笉瓒冲啓涓嶄簡api_usage_log锛? * - 鐜板湪缁熶竴浣跨敤 supabaseAdmin锛岀‘淇濆缁堟湁service_role鏉冮檺
 */

import { supabaseAdmin } from "@/lib/core/supabase";
// DeepSeek API configuration constants
export const DEEPSEEK_MODEL = "deepseek-chat";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";


// DeepSeek deepseek-chat pricing (CNY per 1K tokens)
// Input: 楼0.001/1K, Output: 楼0.002/1K, Cached input: 楼0.0001/1K
const PRICE_INPUT_PER_1K = 0.001;
const PRICE_OUTPUT_PER_1K = 0.002;
const PRICE_CACHED_PER_1K = 0.0001;

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
    model = 'deepseek-chat',
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
        request_summary: `棰勭畻瓒呴檺: 楼${todayTotal.toFixed(2)} / 楼${dailyBudgetCny.toFixed(2)}`,
        response_status: 402,
        error_message: 'Daily budget exceeded',
      });

      return {
        allowed: false,
        reason: `浠婃棩DeepSeek棰勭畻宸茬敤瀹? 楼${todayTotal.toFixed(2)} / 楼${dailyBudgetCny.toFixed(2)}`,
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
    const inputCost = ((update.input_tokens || 0) / 1000) * PRICE_INPUT_PER_1K;
    const outputCost = ((update.output_tokens || 0) / 1000) * PRICE_OUTPUT_PER_1K;
    const cachedCost = ((update.cached_tokens || 0) / 1000) * PRICE_CACHED_PER_1K;
    const totalCost = update.cost_cny ?? inputCost + outputCost + cachedCost;

    await supabaseAdmin
      .from("api_usage_log")
      .update({
        input_tokens: update.input_tokens || 0,
        output_tokens: update.output_tokens || 0,
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
    timeoutMs?: number;  // 瓒呮椂姣鏁帮紝榛樿60000
  }
): Promise<Response> {
  const { route, body, projectId, requestSummary, dailyBudgetCny, timeoutMs = 60000 } = options;

  const check = await deepseekPreCheck({
    route,
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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'DeepSeek API Key not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
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
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const cloned = response.clone();
      try {
        const result = await cloned.json();
        const usage = result?.usage;
        if (usage) {
          await deepseekPostLog(check.logId, {
            input_tokens: usage.prompt_tokens || 0,
            output_tokens: usage.completion_tokens || 0,
            cached_tokens: usage.prompt_cache_hit_tokens || 0,
            response_status: response.status,
          });
        }
      } catch {
        await deepseekPostLog(check.logId, { response_status: response.status });
      }
    } else {
      const errText = await response.clone().text().catch(() => 'unknown');
      await deepseekPostLog(check.logId, {
        response_status: response.status,
        error_message: errText.substring(0, 200),
      });
    }

    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    await deepseekPostLog(check.logId, {
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
