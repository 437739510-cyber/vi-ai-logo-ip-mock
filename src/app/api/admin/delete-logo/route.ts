export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/core/admin-session';

const _DEV = process.env.NODE_ENV === "development";

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
    }
    const { projectId, fileName } = await request.json();
    if (!projectId || !fileName) {
      return NextResponse.json({ error: 'Missing projectId or fileName' }, { status: 400 });
    }

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('client_info, submission_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.submission_id) {
      const { data: sub } = await supabaseAdmin
        .from('submissions')
        .select('logo_assets')
        .eq('id', project.submission_id)
        .single();

      const assets = Array.isArray((sub as any)?.logo_assets) ? (sub as any).logo_assets : [];
      const filtered = assets.filter((a: any) => a.fileName !== fileName);
      if (filtered.length !== assets.length) {
        await supabaseAdmin
          .from('submissions')
          .update({ logo_assets: filtered })
          .eq('id', project.submission_id);
      }
    }

    let clientInfo = project.client_info;
    if (typeof clientInfo === 'string') clientInfo = JSON.parse(clientInfo);
    if (clientInfo && typeof clientInfo === 'object') {
      if (clientInfo.selectedLogoName === fileName) {
        clientInfo.selectedLogo = null;
        clientInfo.selectedLogoName = null;
        const bp = clientInfo.brandProfile || {};
        if (bp.selectedLogo) {
          bp.selectedLogo = null;
        }
        await supabaseAdmin
          .from('projects')
          .update({ client_info: clientInfo })
          .eq('id', projectId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    _DEV && console.error("[delete-logo] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}