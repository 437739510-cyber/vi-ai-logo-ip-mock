import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

/**
 * POST /api/ai/regenerate-logo
 *
 * Client-side logo regeneration with feedback.
 * Looks up submission by phone, verifies viewPassword, saves feedback, re-triggers logo gen.
 */

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, viewPassword, feedback, logoTextLanguage } = body;

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

    // Save current logos to history before overwriting
    const currentLogoResults = brandProfile.logoGenerationResults || [];
    const validCurrentLogos = currentLogoResults.filter((r: any) => r.imageUrl && !r.error);
    if (validCurrentLogos.length > 0) {
      const logoHistory = (clientInfo.logoHistory || []) as Array<{
        round: number; logos: Array<{ index: number; imageUrl: string; prompt?: string }>; savedAt: string;
      }>;
      logoHistory.push({
        round: logoHistory.length + 1,
        logos: validCurrentLogos.map((r: any) => ({ index: r.index, imageUrl: r.imageUrl, prompt: r.prompt })),
        savedAt: new Date().toISOString(),
      });
      clientInfo.logoHistory = logoHistory;
    }

    brandProfile.selectedLogo = null;
    brandProfile.preferredLogo = null;

    // 工单 038：024 契约——客户在重新生成时显式选择拼音则更新语言字段
    if (logoTextLanguage === "pinyin" || logoTextLanguage === "chinese") {
      clientInfo.logoTextLanguage = logoTextLanguage;
    }

    // 工单 038：改走本地 worker——写 pending_logo（worker 轮询接管），
    // 不再调外部 mock 域名，也不再使用旧的重生成状态（worker 不轮询）。
    await supabaseAdmin
      .from("projects")
      .update({
        client_info: {
          ...clientInfo,
          brandProfile,
          generationStatus: "pending_logo",
          logoGenerationStatus: { started: false, completed: 0, total: 4 },
        },
      })
      .eq("id", project.id);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      status: "pending_logo",
      message: "Logo regeneration queued for local worker",
    });
  } catch (error: any) {
    console.error("[regenerate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
