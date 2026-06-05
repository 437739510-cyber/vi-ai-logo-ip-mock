/**
 * API: POST /api/ai/select-logo
 *
 * V10 Logo选择模块 — 客户/管理端选择1张Logo后保存
 *
 * 流程：
 * 1. 接收 projectId + logoImageUrl + logoIndex
 * 2. 下载Logo图片 → 上传到 Supabase Storage (form-assets/)
 * 3. 更新 submissions.logo_assets
 * 4. 同时上传到 processed-assets 桶（供 findFromStorage 查找）
 * 5. 更新 project.client_info 记录选择
 *
 * 之后 generate-manual-pptx 的 findFromStorage() 会自动找到Logo
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, logoImageUrl, logoIndex } = body;

    if (!projectId || !logoImageUrl) {
      return NextResponse.json({ error: "projectId and logoImageUrl required" }, { status: 400 });
    }

    // Step 1: 下载Logo图片
    console.log(`[select-logo] Downloading logo from: ${logoImageUrl.substring(0, 80)}...`);
    const imgResp = await fetch(logoImageUrl);
    if (!imgResp.ok) {
      return NextResponse.json({ error: "Failed to download logo image" }, { status: 400 });
    }
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const imgSize = imgBuffer.length;
    console.log(`[select-logo] Downloaded: ${imgSize} bytes`);

    // Step 2: 获取 project → submission 信息
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_info")
      .eq("id", projectId)
      .single();

    const submissionId = project?.submission_id;
    const clientInfo = (project?.client_info as Record<string, any>) || {};

    // Step 3: 上传到 Supabase Storage (form-assets) — 与表单上传一致
    const timestamp = Date.now();
    const logoFileName = `logo-${timestamp}.png`;
    const formAssetsPath = `${projectId}/${logoFileName}`;

    const { error: uploadErr1 } = await supabaseAdmin.storage
      .from("form-assets")
      .upload(formAssetsPath, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadErr1) {
      console.warn("[select-logo] form-assets upload failed:", uploadErr1.message);
    } else {
      console.log("[select-logo] Uploaded to form-assets:", formAssetsPath);
    }

    // Step 4: 上传到 processed-assets 桶 — findFromStorage 会在这里查找
    const processedPath = `${projectId}/logo-${timestamp}.png`;

    const { error: uploadErr2 } = await supabaseAdmin.storage
      .from("processed-assets")
      .upload(processedPath, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadErr2) {
      console.warn("[select-logo] processed-assets upload failed:", uploadErr2.message);
    } else {
      console.log("[select-logo] Uploaded to processed-assets:", processedPath);
    }

    // Step 5: 更新 submissions.logo_assets
    if (submissionId) {
      const formAssetsUrl = supabaseAdmin.storage.from("form-assets").getPublicUrl(formAssetsPath).data.publicUrl;
      const logoAssetEntry = { fileName: logoFileName, url: formAssetsUrl, size: imgSize, source: "ai-generated" };

      // 获取当前 logo_assets
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("logo_assets")
        .eq("id", submissionId)
        .single();

      const existingAssets = (sub?.logo_assets as any[]) || [];
      const updatedAssets = [...existingAssets, logoAssetEntry];

      const { error: subErr } = await supabaseAdmin
        .from("submissions")
        .update({ logo_assets: updatedAssets })
        .eq("id", submissionId);

      if (subErr) {
        console.warn("[select-logo] Submission update failed:", subErr.message);
      } else {
        console.log("[select-logo] Updated submission logo_assets");
      }
    }

    // Step 6: 更新 project.client_info
    const updatedInfo = {
      ...clientInfo,
      brandProfile: {
        ...(clientInfo.brandProfile || {}),
        selectedLogo: {
          imageUrl: logoImageUrl,
          index: logoIndex ?? 0,
          selectedAt: new Date().toISOString(),
          storagePath: processedPath,
        },
      },
    };

    await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    console.log("[select-logo] Done! Logo saved and linked to project.");

    return NextResponse.json({
      success: true,
      projectId,
      storagePath: processedPath,
      message: "Logo selected and saved. Ready for PPTX generation.",
    });
  } catch (error: any) {
    console.error("[select-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Logo selection failed" }, { status: 500 });
  }
}
