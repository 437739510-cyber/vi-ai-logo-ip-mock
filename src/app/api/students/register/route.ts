import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, school, major, wechat, intro } = body;

    if (!name || !phone || !school) {
      return NextResponse.json(
        { error: '请填写必填字段（姓名、手机号、学校）' },
        { status: 400 }
      );
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        real_name: name,
        phone,
        university: school,
        major: major || '',
        wechat: wechat || '',
        bio: intro || '',
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[学生注册] Supabase错误:', err);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    const student = await response.json();
    console.log('[学生注册] 新申请:', student);

    return NextResponse.json({
      success: true,
      id: student[0]?.id,
      message: '申请已提交，我们会在1-2个工作日内审核',
    });
  } catch (error: unknown) {
    console.error('[学生注册] 错误:', error);
    const msg = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/students?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ students: [], total: 0 });
    }

    const students = await response.json();
    return NextResponse.json({ students, total: students.length });
  } catch {
    return NextResponse.json({ students: [], total: 0 });
  }
}
