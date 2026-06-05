import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // DeepSeek balance
    const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
    let deepseekBalance = -1;
    let deepseekStatus = 'not_configured';

    if (deepseekKey) {
      try {
        const res = await fetch('https://api.deepseek.com/user/balance', {
          headers: { Authorization: `Bearer ${deepseekKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          deepseekBalance = data?.balance_infos?.[0]?.total_balance
            ? parseFloat(data.balance_infos[0].total_balance)
            : -1;
          deepseekStatus = 'active';
        } else {
          deepseekStatus = 'error';
        }
      } catch {
        deepseekStatus = 'error';
      }
    }

    // DashScope / Tongyi Wanxiang balance via BSS
    let dashscopeBalance = -1;
    let dashscopeStatus = 'not_configured';
    let dashscopeDetail = '';

    const dashscopeKey =
      process.env.DASHSCOPE_API_KEY ||
      process.env.ALIYUN_API_KEY ||
      process.env.WANXIANG_API_KEY ||
      '';

    if (dashscopeKey) {
      dashscopeStatus = 'key_configured';
    }

    // Try calling the dashscope-balance endpoint internally
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const dsRes = await fetch(`${baseUrl}/api/billing/dashscope-balance`);
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        if (dsData.balance >= 0) {
          dashscopeBalance = dsData.balance;
          dashscopeStatus = 'active';
          dashscopeDetail = dsData.detail || '';
        } else {
          dashscopeStatus = dsData.status || 'key_configured';
          dashscopeDetail = dsData.detail || dsData.error || '';
        }
      }
    } catch {
      // Fallback: at least mark key as configured
    }

    return NextResponse.json({
      deepseek: {
        provider: 'DeepSeek',
        balance: deepseekBalance,
        currency: 'CNY',
        status: deepseekStatus,
      },
      dashscope: {
        provider: '通义万相 (阿里云百炼)',
        balance: dashscopeBalance,
        currency: 'CNY',
        status: dashscopeStatus,
        detail: dashscopeDetail,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '内部错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
