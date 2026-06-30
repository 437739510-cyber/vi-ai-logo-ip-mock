import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';

export async function POST(request: NextRequest) {
  try {
    const { projectId, logoData, logoName } = await request.json();
    if (!projectId || !logoData) {
      return NextResponse.json({ error: 'Missing projectId or logoData' }, { status: 400 });
    }

    const { data: project, error: getErr } = await supabaseAdmin
      .from('projects')
      .select('client_info')
      .eq('id', projectId)
      .single();

    if (getErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const clientInfo = project.client_info || {};
    clientInfo.selectedLogo = logoData;
    clientInfo.selectedLogoName = logoName || 'uploaded_logo.png';

    const { error: updateErr } = await supabaseAdmin
      .from('projects')
      .update({ client_info: clientInfo, status: 'logo_selected' })
      .eq('id', projectId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
