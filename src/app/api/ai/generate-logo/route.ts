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
import { canStartProduction, PRODUCTION_BLOCKED_CODE, PRODUCTION_BLOCKED_MESSAGE } from "@/lib/core/project-workbench";
import { getUnifiedParam } from "@/lib/vi-manual/param-bus";
import { logArkUsage } from "@/lib/core/billing/ark-usage-log";
import { getDefaultRegistry, type GenerateImageResult } from "@/lib/ip/ip-image-provider";
import { overlayChineseText } from "@/lib/ip/overlay-chinese";
import { preGenerationGuard, postGenerationGuard } from "@/lib/vi-manual/asset-guardian";
import { STORAGE_BUCKET } from "@/config/storage";
import { checkLegacyWebGenerationGate } from "@/lib/core/legacy-web-generation-gate";
const _DEV = process.env.NODE_ENV === "development";


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
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error("[persistLogo] Upload failed:", error.message);
      return null;
    }
    const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    _DEV && console.log("[persistLogo] Persisted logo " + index + " -> " + data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.error("[persistLogo] Error:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const gate = await checkLegacyWebGenerationGate(req);
  if (!gate.allowed) return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  try {
    const body = await req.json();
    const projectId: string = body.projectId || "";
    const regenerate = body.regenerate;
    const forceRegenerate = body.force === true || regenerate === true;
    const requestedProvider: string = (body.provider || "comfyui").toLowerCase();

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Step 1: Read brand profile from Supabase
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, status, client_info")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // R34 生产门禁：未付款不能生产（测试工单豁免）
    if (!canStartProduction(project)) {
      return NextResponse.json({ error: PRODUCTION_BLOCKED_MESSAGE, code: PRODUCTION_BLOCKED_CODE }, { status: 403 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const brandProfile = clientInfo.brandProfile || {};
    const logoSuggestions = brandProfile.logoDesignSuggestions;

    if (!logoSuggestions?.prompts || logoSuggestions.prompts.length === 0) {
      const analysisStatus = brandProfile.analysisStatus;
      let errorMsg = "请先完成品牌分析";
      if (analysisStatus === "analyzing") {
        errorMsg = "AI品牌分析进行中";
      }

      // Already have logos, not forcing -> return existing
      const existingLogos = brandProfile.logoGenerationResults;
      if (!forceRegenerate && existingLogos && existingLogos.length >= 4 && clientInfo.logoGenerationStatus?.completed >= 4) {
        return NextResponse.json({
          status: "already_completed",
          message: "已经生成4个Logo，无需重复生成",
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

    // M1.4: Read unified param package for font + color
    let headingFont = "Source Han Sans SC";
    let primaryColor = "#C0392B";
    try {
      const params = await getUnifiedParam(projectId);
      headingFont = params.fonts.heading.nameEn || headingFont;
      primaryColor = params.colors.primary.hex || primaryColor;
    } catch (e: any) {
      console.warn("[generate-logo] param-bus read failed, using defaults:", e.message);
    }

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

    // V121: synchronous generation for Zeabur serverless compatibility
      try {
      const logoResults: any[] = [];
      let actualProvider = await getDefaultRegistry().getActive();
      if (requestedProvider === "comfyui") {
        const comfy = getDefaultRegistry().get("comfyui");
        if (comfy && await comfy.isAvailable()) {
          actualProvider = comfy;
        } else {
          console.warn("[generate-logo] ComfyUI not available, falling back: liblibai -> ark");
        }
      } else if (requestedProvider === "ark") {
        const ark = getDefaultRegistry().get("ark-seedream");
        if (ark && await ark.isAvailable()) actualProvider = ark;
      }
      _DEV && console.log("[generate-logo] Generating " + prompts.length + " logos for: " + companyName + " via " + actualProvider.name);
      _DEV && console.log("[generate-logo] Provider details: name=" + actualProvider.name + ", type=" + (actualProvider.constructor?.name || "unknown"));

      for (let i = 0; i < prompts.length; i++) {
        const rawPrompt = prompts[i];
        const enhancedPrompt = rawPrompt + ", logo design on clean white background, centered composition";
        const negativePrompt = "cartoon, illustration, vector art, flat design, digital art, 3d render, painting, photorealistic, shadow, gradient, complex background, text, watermark";


        // P1-ASSET-GUARDIAN: pre-generation prompt safety check
        const guardResult = preGenerationGuard(enhancedPrompt, companyName);
        if (guardResult.riskLevel === "high") console.warn("[asset-guardian] High risk prompt:", guardResult.blockedTerms);
        const finalPrompt = guardResult.enhancedPrompt || enhancedPrompt;
        _DEV && console.log("[generate-logo] Prompt " + (i+1) + "/" + prompts.length);

        try {
          const result = await actualProvider.generateImage({ brandContext: { brandName: companyName, industry: brandProfile?.industry || "", brandPositioning: brandProfile?.brandPositioning || "", brandPersona: brandProfile?.brandToneKeywords || [], visualDirection: brandProfile?.visualStyleSuggestion || "" }, ipProfile: { type: "logo", personality: [], visualTraits: [], colorDirection: [] }, step: { stepId: `logo-${i+1}`, label: "Logo", description: rawPrompt }, prompt: finalPrompt, negativePrompt, output: { width: 1024, height: 1024, format: "png" } });
          _DEV && console.log("[generate-logo] " + actualProvider.name + " logo " + (i+1) + " OK (" + result.durationMs + "ms)");
          // Log ARK usage
          void logArkUsage({ route: "ai/generate-logo", model: String(result.providerMeta?.model || "seedream"), imageCount: 1, projectId, durationMs: result.durationMs, success: true });
          // V121: Overlay Chinese brand name on logo (SDXL/Star-3 can''t do Chinese)
          let logoImageUrl: string = result.imageUrl || "";
          try {
            logoImageUrl = await overlayChineseText(result.imageUrl, companyName, headingFont);
          } catch (e: any) {
            console.warn("[generate-logo] Chinese overlay failed for logo " + (i+1) + ":", e.message);
          }

          // P1-ASSET-GUARDIAN: post-generation asset validation (fire-and-forget)
          postGenerationGuard(null, logoImageUrl, companyName).then(r => {
            if (r.riskLevel !== "none") console.warn("[asset-guardian] Post-gen:", r.blockedTerms);
          });
          logoResults.push({
            index: i, prompt: rawPrompt, imageUrl: logoImageUrl,
            model: result.providerMeta?.model || result.providerName, durationMs: result.durationMs,
          });
        } catch (err: any) {
          const errDetail = {
            prompt: rawPrompt.slice(0, 80),
            message: err.message,
            stack: err.stack?.slice(0, 300),
            code: err.code,
            name: err.name,
            providerName: actualProvider.name || "unknown",
          };
          console.error("[generate-logo] Failed prompt " + (i+1) + ":", JSON.stringify(errDetail, null, 2));
          // P2-02: 1 retry on failure
          let retried = false;
          try {
            _DEV && console.log("[generate-logo] Retrying prompt " + (i+1) + "...");
            const retryResult = await actualProvider.generateImage({ brandContext: { brandName: companyName, industry: brandProfile?.industry || "", brandPositioning: brandProfile?.brandPositioning || "", brandPersona: brandProfile?.brandToneKeywords || [], visualDirection: brandProfile?.visualStyleSuggestion || "" }, ipProfile: { type: "logo", personality: [], visualTraits: [], colorDirection: [] }, step: { stepId: `logo-retry-${i+1}`, label: "Logo Retry", description: rawPrompt }, prompt: finalPrompt, negativePrompt, output: { width: 1024, height: 1024, format: "png" } });
            let retryUrl: string = retryResult.imageUrl || "";
            try { retryUrl = await overlayChineseText(retryResult.imageUrl, companyName, headingFont); } catch (e: any) {}
            logoResults.push({ index: i, prompt: rawPrompt, imageUrl: retryUrl, model: retryResult.providerMeta?.model || retryResult.providerName, durationMs: retryResult.durationMs });
            retried = true;
            _DEV && console.log("[generate-logo] Retry " + (i+1) + " OK");
          } catch (retryErr: any) {
            console.error("[generate-logo] Retry also failed for prompt " + (i+1) + ":", retryErr.message);
          }
          if (!retried) {
            logoResults.push({ index: i, prompt: rawPrompt, imageUrl: null, error: err.message });
          }
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
          if (permanentUrl) {
            r.imageUrl = permanentUrl;
          } else {
            // Persist failed - clear base64 to avoid bloating client_info
            console.warn("[generate-logo] Persist failed for logo " + r.index + ", clearing base64");
            r.imageUrl = "";
          }
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
              generationMessage: "Logo生成完毕 (" + successCount + "/" + prompts.length + ")",
              brandProfile: {
                ...finalBrandProfile,
                logoGenerationResults: logoResults.map(r => ({
                  index: r.index, prompt: r.prompt, imageUrl: r.imageUrl, error: r.error,
                })),
                logoGeneratedAt: new Date().toISOString(),
              },
              arkUsageLog: [...(finalInfo.arkUsageLog || []),
                ...logoResults.filter(r => r.imageUrl).map((r) => ({
                  model: r.model, type: "logo", cost: r.actualCost || 0,
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
              brandProfile: {
                ...(finalInfo.brandProfile || {}),
                logoGenerationResults: logoResults.map(r => ({ index: r.index, prompt: r.prompt, imageUrl: r.imageUrl || null, error: r.error || null })),
              },
              generationMessage: "Logo已全部失败，请重试",
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
      // V121: synchronous return — Zeabur serverless kills fire-and-forget
      const generatedCount = logoResults.filter((r: any) => r.imageUrl).length;
      return NextResponse.json({
        success: generatedCount > 0,
        message: `Logo generation complete (${generatedCount}/${prompts.length})`,
        projectId, companyName, totalLogos: prompts.length,
        logos: logoResults,
        generatedCount,
      });
    } catch (fatalErr: any) {
        console.error("[generate-logo] FATAL error:", fatalErr.message, fatalErr.stack?.slice(0, 300));
        try {
          const { data: fatalProj } = await supabaseAdmin
            .from("projects").select("client_info").eq("id", projectId).single();
          const fatalInfo: any = (fatalProj?.client_info as Record<string, any>) || {};
          await supabaseAdmin.from("projects").update({
            status: "submitted",
            client_info: {
              ...fatalInfo,
              generationStatus: "failed",
              generationMessage: "Logo generation crashed: " + (fatalErr.message || "unknown error"),
              logoGenerationStatus: {
                total: 4, completed: 0,
                results: [],
                failedAt: new Date().toISOString(),
                error: fatalErr.message || "unknown",
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        } catch (e2) {
          console.error("[generate-logo] Failed to update fatal error status:", e2);
        }
      return NextResponse.json({
        success: false,
        message: "Logo generation failed: " + (fatalErr.message || "unknown error"),
        projectId, companyName,
        error: fatalErr.message || "unknown",
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[generate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Logo generation failed" }, { status: 500 });
  }
}
