/**
 * DeepSeek API 调用守卫 (V51)
 * - 记录每次调用的路由、token用量、费用、时间戳到 api_usage_log
 * - 每日预算上限（默认5元），超出自动拦截
 * - 所有 DeepSeek 调用必须通过此模块
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// DeepSeek deepseek-chat pricing (CNY per 1K tokens)
// Input: ¥0.001/1K, Output: ¥0.002/1K, Cached input: ¥0.0001/1K
const PRICE_INPUT_PER_1K = 0.001;
const PRICE_OUTPUT_PER_1K = 0.002;
const PRICE_CACHED_PER_1K = 0.0001;

// Default daily budget cap (CNY)
const DEFAULT_DAILY_BUDGET = 5.00;

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

    const spendRes = await fetch(
      `${SUPABASE_URL}/rest/v1/api_usage_log?select=cost_cny&created_at=gte.${todayStart.toISOString()}&route=not.like.[BLOCKED]%25`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    let todayTotal = 0;
    if (spendRes.ok) {
      const rows = (await spendRes.json()) as Array<{ cost_cny: number }>;
      todayTotal = rows.reduce((sum, r) => sum + (r.cost_cny || 0), 0);
    }

    if (todayTotal >= dailyBudgetCny) {
      // Budget exceeded - log the blocked attempt
      await fetch(`${SUPABASE_URL}/rest/v1/api_usage_log`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: `[BLOCKED] ${route}`,
          method,
          model,
          cost_cny: 0,
          project_id: projectId || null,
          request_summary: `预算超限: ¥${todayTotal.toFixed(2)} / ¥${dailyBudgetCny.toFixed(2)}`,
          response_status: 402,
          error_message: 'Daily budget exceeded',
        }),
      });

      return {
        allowed: false,
        reason: `今日DeepSeek预算已用完: ¥${todayTotal.toFixed(2)} / ¥${dailyBudgetCny.toFixed(2)}`,
      };
    }

    // 2. Log the call attempt
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/api_usage_log`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        route,
        method,
        model,
        cost_cny: 0,
        project_id: projectId || null,
        request_summary: (requestSummary || '').substring(0, 200),
      }),
    });

    let logId: number | undefined;
    if (insertRes.ok) {
      const inserted = (await insertRes.json()) as Array<{ id: number }>;
      logId = inserted[0]?.id;
    }

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

    await fetch(`${SUPABASE_URL}/rest/v1/api_usage_log?id=eq.${logId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_tokens: update.input_tokens || 0,
        output_tokens: update.output_tokens || 0,
        cost_cny: parseFloat(totalCost.toFixed(6)),
        response_status: update.response_status,
        error_message: update.error_message || null,
      }),
    });
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
  }
): Promise<Response> {
  const { route, body, projectId, requestSummary, dailyBudgetCny } = options;

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
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

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
    await deepseekPostLog(check.logId, {
      response_status: 0,
      error_message: error instanceof Error ? error.message : 'Network error',
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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/api_usage_log?select=route,cost_cny&created_at=gte.${todayStart.toISOString()}&route=not.like.[BLOCKED]%25`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!res.ok) return { totalCost: 0, callCount: 0, byRoute: {} };

    const rows = (await res.json()) as Array<{ route: string; cost_cny: number }>;
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
