import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    
    // Get today's summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const summaryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/api_usage_log?select=route,cost_cny,input_tokens,output_tokens&created_at=gte.${todayStart.toISOString()}&route=not.like.[BLOCKED]%25`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    let todaySummary = { totalCost: 0, totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, byRoute: {} as Record<string, { cost: number; calls: number }> };
    if (summaryRes.ok) {
      const rows = await summaryRes.json();
      for (const row of rows) {
        todaySummary.totalCost += row.cost_cny || 0;
        todaySummary.totalCalls += 1;
        todaySummary.totalInputTokens += row.input_tokens || 0;
        todaySummary.totalOutputTokens += row.output_tokens || 0;
        if (!todaySummary.byRoute[row.route]) todaySummary.byRoute[row.route] = { cost: 0, calls: 0 };
        todaySummary.byRoute[row.route].cost += row.cost_cny || 0;
        todaySummary.byRoute[row.route].calls += 1;
      }
    }

    return NextResponse.json({ logs, todaySummary });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
