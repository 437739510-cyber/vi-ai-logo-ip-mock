import { NextRequest, NextResponse } from 'next/server';

// 学生注册数据存储（内存中，生产环境应使用数据库）
const studentApplications: Array<{
  id: string;
  name: string;
  phone: string;
  school: string;
  major?: string;
  wechat?: string;
  intro?: string;
  appliedAt: string;
}> = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, school, major, wechat, intro } = body;

    // 验证必填字段
    if (!name || !phone || !school) {
      return NextResponse.json(
        { error: '请填写必填字段（姓名、手机号、学校）' },
        { status: 400 }
      );
    }

    // 生成申请ID
    const id = `STU-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 保存申请
    const application = {
      id,
      name,
      phone,
      school,
      major: major || '',
      wechat: wechat || '',
      intro: intro || '',
      appliedAt: new Date().toISOString(),
    };

    studentApplications.push(application);

    console.log('[学生注册] 新申请:', application);

    return NextResponse.json({
      success: true,
      id,
      message: '申请已提交，我们会在1-2个工作日内审核',
    });
  } catch (error: unknown) {
    console.error('[学生注册] 错误:', error);
    const msg = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 获取所有申请记录（供管理后台使用）
export async function GET() {
  return NextResponse.json({
    students: studentApplications,
    total: studentApplications.length,
  });
}
