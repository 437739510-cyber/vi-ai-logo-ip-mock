import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { STORAGE_BUCKET } from "@/config/storage";

const _DEV = process.env.NODE_ENV === "development";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload-logo
 * Upload a logo (base64 data URL) to Supabase Storage,
 * then update project client_info + submission logo_assets
 * so the VI manual generator can find it.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, logoData, logoName } = await request.json();
    if (!projectId || !logoData) {
      return NextResponse.json({ error: 'Missing projectId or logoData' }, { status: 400 });
    }

    // Fetch project
    const { data: project, error: getErr } = await supabaseAdmin
      .from('projects')
      .select('client_info, submission_id')
      .eq('id', projectId)
      .single();

    if (getErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse client_info
    let clientInfo = project.client_info;
    if (typeof clientInfo === 'string') {
      clientInfo = JSON.parse(clientInfo);
    }
    if (!clientInfo || typeof clientInfo !== 'object') {
      clientInfo = {};
    }

    // 1. Convert data URL to buffer
    const commaIdx = logoData.indexOf(',');
    const mimeMatch = logoData.match(/^data:image\/(\w+)/);
    const ext = mimeMatch?.[1] === 'png' ? 'png' : 'jpg';
    const base64 = commaIdx >= 0 ? logoData.slice(commaIdx + 1) : logoData;
    const imgBuf = Buffer.from(base64, 'base64');
    const imgSize = imgBuf.length;

    // 2. Upload to Storage buckets (same flow as select-logo)
    const ts = Date.now();
    const sanitizedName = (logoName || 'logo.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const formAssetsPath = `${projectId}/uploaded-${ts}-${sanitizedName}`;
    const processedPath = `${projectId}/logo-${ts}.${ext}`;

    const [formUpload, processedUpload] = await Promise.all([
      supabaseAdmin.storage.from("form-assets").upload(formAssetsPath, imgBuf, {
        contentType: `image/${ext}`, upsert: true,
      }),
      supabaseAdmin.storage.from(STORAGE_BUCKET).upload(processedPath, imgBuf, {
        contentType: `image/${ext}`, upsert: true,
      }),
    ]);

    if (formUpload.error) {
      _DEV && console.warn("[upload-logo] form-assets upload failed:", formUpload.error.message);
    }
    if (processedUpload.error) {
      _DEV && console.warn("[upload-logo] STORAGE_BUCKET upload failed:", processedUpload.error.message);
    }

    // Build public URL (use form-assets as primary)
    const publicUrl = supabaseAdmin.storage
      .from("form-assets")
      .getPublicUrl(formAssetsPath).data.publicUrl;

    // 3. Update submissions.logo_assets
    const submissionId = project.submission_id;
    if (submissionId) {
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("logo_assets")
        .eq("id", submissionId)
        .single();

      const existingAssets = Array.isArray((sub as any)?.logo_assets) ? (sub as any).logo_assets : [];
      const newAsset = {
        fileName: logoName || 'uploaded_logo.png',
        url: publicUrl,
        size: imgSize,
        source: "manual-upload",
      };
      const updatedAssets = [newAsset, ...existingAssets];

      const { error: subErr } = await supabaseAdmin
        .from("submissions")
        .update({ logo_assets: updatedAssets })
        .eq("id", submissionId);

      if (subErr) {
        _DEV && console.warn("[upload-logo] Submission update failed:", subErr.message);
      }
    }

    // 4. Update project.client_info
    const bp = (clientInfo.brandProfile || {});
    const updatedInfo = {
      ...clientInfo,
      selectedLogo: publicUrl,               // legacy field
      selectedLogoName: logoName || 'uploaded_logo.png',
      brandProfile: {
        ...bp,
        selectedLogo: {
          imageUrl: publicUrl,
          index: 0,
          selectedAt: new Date().toISOString(),
          storagePath: processedPath,
          source: "manual-upload",
        },
      },
      generationStatus: "manual_pending",
    };

    const { error: updateErr } = await supabaseAdmin
      .from("projects")
      .update({
        client_info: updatedInfo,
        status: "manual_pending",
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      message: "Logo uploaded and linked. Ready for VI manual generation.",
    });
  } catch (err: any) {
    _DEV && console.error("[upload-logo] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}