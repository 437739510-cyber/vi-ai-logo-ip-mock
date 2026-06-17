import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// DeepSeek模型关键词
const DEEPSEEK_MODELS = ['deepseek'];
// 通义万相/阿里云模型关键词（含百炼DashScope全家桶）
const DASHSCOPE_MODELS = ['wan2', 'qwen', 'wanx'];

interface ProviderSummary {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byRoute: Record<string, { cost: number; calls: number }>;
  byModel: Record<string, { cost: number; calls: number }>;
}

function classifyModel(model: string): 'deepseek' | 'dashscope' | 'other' {
  const m = (model || '').toLowerCase();
  if (DEEPSEEK_MODELS.some(k => m.includes(k))) return 'deepseek';
  if (DASHSCOPE_MODELS.some(k => m.includes(k))) return 'dashscope';
  return 'other';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const route = searchParams.get('route');
  const date = searchParams.get('date'); // YYYY-MM-DD

  try {
    let query = `${SUPABASE_URL}/rest/v1/api_usage_log?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    
    if (route) query += `&route=eq.${route}`;
    if (date) {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;
      query += `&created_at=gte.${start}&created_at=lt.${end}`;
    }

    const res = await fetch(query, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    const logs = await res.json();
    
    // Get today's summary - fetch all today's rows with model field
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const summaryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/api_usage_log?select=route,model,cost_cny,input_tokens,output_tokens&created_at=gte.${todayStart.toISOString()}&route=not.like.[BLOCKED]%25`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    const emptySummary = (): ProviderSummary => ({
      totalCost: 0, totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0,
      byRoute: {}, byModel: {},
    });

    const todayDeepseekSummary = emptySummary();
    const todayDashscopeSummary = emptySummary();

    if (summaryRes.ok) {
      const rows = await summaryRes.json();
      for (const row of rows) {
        const provider = classifyModel(row.model || '');
        const target = provider === 'deepseek' ? todayDeepseekSummary
                     : provider === 'dashscope' ? todayDashscopeSummary
                     : null;
        if (!target) continue;

        target.totalCost += row.cost_cny || 0;
        target.totalCalls += 1;
        target.totalInputTokens += row.input_tokens || 0;
        target.totalOutputTokens += row.output_tokens || 0;
        
        // byRoute
        if (!target.byRoute[row.route]) target.byRoute[row.route] = { cost: 0, calls: 0 };
        target.byRoute[row.route].cost += row.cost_cny || 0;
        target.byRoute[row.route].calls += 1;
        
        // byModel
        if (!target.byModel[row.model]) target.byModel[row.model] = { cost: 0, calls: 0 };
        target.byModel[row.model].cost += row.cost_cny || 0;
        target.byModel[row.model].calls += 1;
      }
    }

    // 兼容旧字段 todaySummary（全部合计）
    const todaySummary = {
      totalCost: todayDeepseekSummary.totalCost + todayDashscopeSummary.totalCost,
      totalCalls: todayDeepseekSummary.totalCalls + todayDashscopeSummary.totalCalls,
      totalInputTokens: todayDeepseekSummary.totalInputTokens + todayDashscopeSummary.totalInputTokens,
      totalOutputTokens: todayDeepseekSummary.totalOutputTokens + todayDashscopeSummary.totalOutputTokens,
      byRoute: { ...todayDeepseekSummary.byRoute, ...todayDashscopeSummary.byRoute },
    };

    return NextResponse.json({ 
      logs, 
      todaySummary,
      todayDeepseekSummary,
      todayDashscopeSummary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
