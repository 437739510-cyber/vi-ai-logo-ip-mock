import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (!['active', 'pending', 'suspended'].includes(status)) {
      return NextResponse.json({ error: '无效状态' }, { status: 400 });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[更新学生] Supabase错误:', err);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[更新学生] 错误:', error);
    const msg = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
