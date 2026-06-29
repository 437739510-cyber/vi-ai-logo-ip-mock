import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { comfyuiGenerateLogo, isComfyUIAvailable } from "@/lib/ip/ip-image-provider/comfyui-provider";

/**
 * POST /api/ai/regenerate-logo
 *
 * Client-side logo regeneration with feedback.
 * Looks up submission by phone, verifies viewPassword, saves feedback, re-triggers logo gen.
 */

export const maxDuration = 180;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, viewPassword, feedback } = body;

    if (!phone || !viewPassword) {
      return NextResponse.json({ error: "Phone and view password required" }, { status: 400 });
    }

    // Step 1: Look up submission by phone
    const { data: submission, error: subErr } = await supabaseAdmin
      .from("submissions")
      .select("id, phone")
      .eq("phone", phone.trim())
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single();

    if (subErr || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Step 2: Find project
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, client_info, submission_id")
      .eq("submission_id", submission.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Step 3: Verify password
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const storedPassword = clientInfo.viewPassword || "";
    if (storedPassword !== viewPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }

    // Step 4: Save feedback to client_info
    const brandProfile = { ...(clientInfo.brandProfile || {}) };
    const regenerationHistory = brandProfile.regenerationHistory || [];
    regenerationHistory.push({
      timestamp: new Date().toISOString(),
      feedback: feedback || "",
    });
    brandProfile.regenerationHistory = regenerationHistory;
    brandProfile.selectedLogo = null;
    brandProfile.preferredLogo = null;

    // Reset logo generation status to trigger regeneration
    await supabaseAdmin
      .from("projects")
      .update({
        client_info: {
          ...clientInfo,
          brandProfile,
          generationStatus: "logo_regenerating",
          logoGenerationStatus: { started: false, completed: 0, total: 4 },
        },
      })
      .eq("id", project.id);

    // Step 5: Trigger background regeneration
    const projectId = project.id;
    const comfyAvailable = await isComfyUIAvailable();

    // Fire-and-forget: start generation in background
    (async () => {
      try {
        const companyName = clientInfo.companyName || "Brand";
        const industry = clientInfo.industry || "general";
        const logoSuggestions = brandProfile.logoDesignSuggestions;

        if (!logoSuggestions?.prompts || logoSuggestions.prompts.length === 0) {
          return;
        }

        const results: Array<{ index: number; imageUrl?: string; prompt: string; error?: string }> = [];

        for (let i = 0; i < logoSuggestions.prompts.length; i++) {
          const prompt = logoSuggestions.prompts[i];
          try {
            if (comfyAvailable) {
              const result = await comfyuiGenerateLogo({ prompt });
              results.push({ index: i, imageUrl: result.imageUrl, prompt });
            } else {
              results.push({ index: i, error: "ComfyUI not available", prompt });
            }
          } catch (e: any) {
            results.push({ index: i, error: e.message || "Generation failed", prompt });
          }

          // Update progress
          const bp = { ...brandProfile, logoGenerationResults: results };
          await supabaseAdmin
            .from("projects")
            .update({
              client_info: {
                ...clientInfo,
                brandProfile: bp,
                logoGenerationStatus: { started: true, completed: i + 1, total: logoSuggestions.prompts.length },
              },
            })
            .eq("id", projectId);
        }

        // Mark as complete
        await supabaseAdmin
          .from("projects")
          .update({
            client_info: {
              ...clientInfo,
              brandProfile: { ...brandProfile, logoGenerationResults: results },
              generationStatus: "logo_generated",
              logoGenerationStatus: { started: true, completed: logoSuggestions.prompts.length, total: logoSuggestions.prompts.length },
            },
          })
          .eq("id", projectId);
      } catch (e) {
        console.error("[regenerate-logo] Background generation failed:", e);
      }
    })();

    return NextResponse.json({
      success: true,
      projectId,
      status: "logo_regenerating",
      message: "Logo regeneration started",
    });
  } catch (error: any) {
    console.error("[regenerate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
