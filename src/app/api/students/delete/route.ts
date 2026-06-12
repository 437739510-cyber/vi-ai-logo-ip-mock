import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少学生ID' }, { status: 400 });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[删除学生] Supabase错误:', err);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '已删除' });
  } catch (error: unknown) {
    console.error('[删除学生] 错误:', error);
    const msg = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
