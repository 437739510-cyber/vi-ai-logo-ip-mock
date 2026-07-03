// V120: Switched to ComfyUI local (free) -- ARK/DashScope cloud APIs removed
/**
 * API: POST /api/ai/generate-logo
 *
 * V120 Logo generation via ComfyUI local -- async version
 *
 * Flow:
 * 1. API immediately returns 202 (Logo generation started)
 * 2. Background generates 3-4 Logo variants via ComfyUI SDXL (serial, free)
 * 3. Progress written to DB in real-time
 * 4. Frontend polls get-project-status for progress
 * 5. Status changes to "logo_generated" when all complete
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { getDefaultRegistry, type GenerateImageResult } from "@/lib/ip/ip-image-provider";
import { overlayChineseText } from "@/lib/ip/overlay-chinese";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

// V120: Persist base64 image to Supabase Storage
async function persistLogoBase64(projectId: string, index: number, base64DataUrl: string): Promise<string | null> {
  try {
    const matches = base64DataUrl.match(/^data:image.(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) return null;
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = projectId + "/logo_" + index + "_" + Date.now() + ".jpeg";
    const { error } = await supabaseAdmin.storage
      .from("brand-brain-generated")
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error("[persistLogo] Upload failed:", error.message);
      return null;
    }
    const { data } = supabaseAdmin.storage.from("brand-brain-generated").getPublicUrl(fileName);
    console.log("[persistLogo] Persisted logo " + index + " -> " + data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.error("[persistLogo] Error:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, regenerate, logoId } = body;
    const forceRegenerate = body.force === true || regenerate === true;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Step 1: Read brand profile from Supabase
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, client_info")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const brandProfile = clientInfo.brandProfile || {};
    const logoSuggestions = brandProfile.logoDesignSuggestions;

    if (!logoSuggestions?.prompts || logoSuggestions.prompts.length === 0) {
      const analysisStatus = brandProfile.analysisStatus;
      let errorMsg = "请先完成品牌分析";
      if (analysisStatus === "analyzing") {
        errorMsg = "AI分析正在进行中";
      }

      // Already have logos, not forcing -> return existing
      const existingLogos = brandProfile.logoGenerationResults;
      if (!forceRegenerate && existingLogos && existingLogos.length >= 4 && clientInfo.logoGenerationStatus?.completed >= 4) {
        return NextResponse.json({
          status: "already_completed",
          message: "已有4个Logo，无需重复生成",
          logos: existingLogos,
        }, { status: 200 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Check if already generating
    if (clientInfo.generationStatus === "logo_generating") {
      return NextResponse.json({
        success: true,
        message: "Logo生成已经在进行中",
        status: "logo_generating"
      }, { status: 202 });
    }

    const companyName = clientInfo.companyName || "品牌";
    const prompts: string[] = logoSuggestions.prompts;

    // Step 2: Write initial status
    await supabaseAdmin.from("projects").update({
      status: "logo_generating",
      client_info: {
        ...clientInfo,
        generationStatus: "logo_generating",
        generationMessage: `正在生成Logo (0/${prompts.length})...`,
        logoGenerationStatus: {
          total: prompts.length, completed: 0, results: [],
          startedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    // Fire-and-forget: background generation via provider registry
    void (async () => {
      const logoResults: any[] = [];
      const provider = await getDefaultRegistry().getActive();
      console.log("[generate-logo] Generating " + prompts.length + " logos for: " + companyName + " via " + provider.name);

      for (let i = 0; i < prompts.length; i++) {
        const rawPrompt = prompts[i];
        const enhancedPrompt = rawPrompt + ", logo design on clean white background, centered composition";
        const negativePrompt = "cartoon, illustration, vector art, flat design, digital art, 3d render, painting, photorealistic, shadow, gradient, complex background, text, watermark";

        console.log("[generate-logo] Prompt " + (i+1) + "/" + prompts.length);

        try {
          const result = await provider.generateImage({ brandContext: { brandName: companyName, industry: brandProfile?.industry || "", brandPositioning: brandProfile?.brandPositioning || "", brandPersona: brandProfile?.brandToneKeywords || [], visualDirection: brandProfile?.visualStyleSuggestion || "" }, ipProfile: { type: "logo", personality: [], visualTraits: [], colorDirection: [] }, step: { stepId: `logo-${i+1}`, label: "Logo", description: rawPrompt }, prompt: enhancedPrompt, negativePrompt, output: { width: 1024, height: 1024, format: "png" } });
          console.log("[generate-logo] " + provider.name + " logo " + (i+1) + " OK (" + result.durationMs + "ms)");
          // V121: Overlay Chinese brand name on logo (SDXL/Star-3 can''t do Chinese)
          let logoImageUrl = result.imageUrl;
          try {
            if (result.providerName.indexOf(chr(97)+chr(114)+chr(107)) === -1) { logoImageUrl = await overlayChineseText(result.imageUrl, companyName); }
          } catch (e: any) {
            console.warn("[generate-logo] Chinese overlay failed for logo " + (i+1) + ":", e.message);
          }
          logoResults.push({
            index: i, prompt: rawPrompt, imageUrl: logoImageUrl,
            model: result.providerMeta?.model || result.providerName, durationMs: result.durationMs,
          });
        } catch (err: any) {
          console.error("[generate-logo] Failed prompt " + (i+1) + ":", err.message);
          logoResults.push({ index: i, prompt: rawPrompt, imageUrl: null, error: err.message });
        }

        // Update progress
        try {
          const cachedInfo: any = { ...clientInfo };
          cachedInfo.generationStatus = "logo_generating";
          cachedInfo.generationMessage = `正在生成Logo (${i+1}/${prompts.length})...`;
          cachedInfo.logoGenerationStatus = {
            total: prompts.length, completed: i + 1,
            results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
            startedAt: cachedInfo.logoGenerationStatus?.startedAt || new Date().toISOString(),
          };
          await supabaseAdmin.from("projects").update({
            client_info: cachedInfo,
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        } catch (e) {}

        if (i < prompts.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      const successCount = logoResults.filter(r => r.imageUrl).length;

      // Persist base64 to Supabase Storage
      for (const r of logoResults) {
        if (r.imageUrl && r.imageUrl.startsWith("data:")) {
          const permanentUrl = await persistLogoBase64(projectId, r.index, r.imageUrl);
          if (permanentUrl) r.imageUrl = permanentUrl;
        }
      }

      // Final update
      try {
        const { data: finalProj } = await supabaseAdmin
          .from("projects").select("client_info").eq("id", projectId).single();
        const finalInfo: any = (finalProj?.client_info as Record<string, any>) || {};
        const finalBrandProfile = finalInfo.brandProfile || {};

        if (successCount > 0) {
          await supabaseAdmin.from("projects").update({
            status: "logo_generated",
            client_info: {
              ...finalInfo,
              generationStatus: "logo_generated",
              generationMessage: "Logo生成完成 (" + successCount + "/" + prompts.length + ")",
              brandProfile: {
                ...finalBrandProfile,
                logoGenerationResults: logoResults.map(r => ({
                  index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error,
                })),
                logoGeneratedAt: new Date().toISOString(),
              },
              comfyuiUsageLog: [...(finalInfo.comfyuiUsageLog || []),
                ...logoResults.filter(r => r.imageUrl).map(() => ({
                  model: "dreamshaperXL10", type: "logo", cost: 0,
                  timestamp: new Date().toISOString(),
                }))],
              logoGenerationStatus: {
                total: prompts.length, completed: prompts.length,
                results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
                completedAt: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        } else {
          await supabaseAdmin.from("projects").update({
            status: "submitted",
            client_info: {
              ...finalInfo,
              generationStatus: "failed",
              generationMessage: "Logo生成全部失败，请重试",
              logoGenerationStatus: {
                total: prompts.length, completed: prompts.length,
                results: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error })),
                failedAt: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        }
      } catch (e) {
        console.error("[generate-logo] Final update failed:", e);
      }
    })();

    return NextResponse.json({
      success: true,
      message: "Logo生成已启动，请稍候",
      projectId, companyName, totalLogos: prompts.length,
    }, { status: 202 });

  } catch (error: any) {
    console.error("[generate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Logo generation failed" }, { status: 500 });
  }
}
