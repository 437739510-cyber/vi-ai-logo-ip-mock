// API Route: POST /api/ai/regenerate-logo
// Client-side triggered: verify phone+password, then trigger logo regeneration
// Saves current logos to history before regenerating
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, viewPassword, projectId, feedback } = body;

    const hasPhone = phone?.trim();
    const hasProjectId = projectId?.trim();

    if (!hasPhone && !hasProjectId) {
      return NextResponse.json({ error: "请提供手机号或项目编号" }, { status: 400 });
    }
    if (!viewPassword) {
      return NextResponse.json({ error: "请输入查看密码" }, { status: 400 });
    }

    // Find and verify project (same logic as /api/view)
    let project: any = null;

    if (hasPhone) {
      const { data: submission } = await supabaseAdmin
        .from("submissions")
        .select("id, phone")
        .eq("phone", phone.trim())
        .order("submitted_at", { ascending: false })
        .limit(1)
        .single();

      if (!submission) {
        return NextResponse.json({ error: "未找到该手机号关联的项目" }, { status: 404 });
      }

      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info, submission_id")
        .eq("submission_id", submission.id)
        .single();

      if (!proj) {
        return NextResponse.json({ error: "未找到关联项目" }, { status: 404 });
      }
      project = proj;
    } else {
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id, status, client_info, submission_id")
        .eq("id", projectId.trim())
        .single();

      if (!proj) {
        return NextResponse.json({ error: "项目不存在" }, { status: 404 });
      }
      project = proj;
    }

    // Verify password
    const clientInfo = (project.client_info as Record<string, any>) || {};
    const storedPassword = clientInfo.viewPassword || "";
    if (!storedPassword || storedPassword !== viewPassword) {
      return NextResponse.json({ error: "查看密码不正确" }, { status: 403 });
    }

    // Check project is paid
    if (project.status !== "paid" && project.status !== "logo_generated") {
      return NextResponse.json({ error: "请先完成付款" }, { status: 400 });
    }

    // Save current logos to history before regenerating
    const brandProfile = clientInfo.brandProfile || {};
    const currentLogos = brandProfile.logoGenerationResults || [];
    
    if (currentLogos.length > 0) {
      const logoHistory = clientInfo.logoHistory || [];
      logoHistory.push({
        logos: currentLogos,
        savedAt: new Date().toISOString(),
        round: logoHistory.length + 1,
      });
      clientInfo.logoHistory = logoHistory;
    }

    // Clear current results, keep suggestions for re-generation
    // If feedback provided, append it to the prompts for AI reference
    const logoSuggestions = brandProfile.logoDesignSuggestions || {};
    if (feedback && feedback.trim()) {
      const feedbackNote = `[客户反馈：${feedback.trim()}]`;
      // Append feedback to each existing prompt so AI incorporates the feedback
      if (logoSuggestions.prompts && logoSuggestions.prompts.length > 0) {
        logoSuggestions.prompts = logoSuggestions.prompts.map((p: string) => `${p}, ${feedbackNote}`);
      }
      // Also update concept to include feedback
      logoSuggestions.concept = `${logoSuggestions.concept || ""} 客户反馈：${feedback.trim()}`;
      // Save feedback to history
      clientInfo.regenerationFeedback = [
        ...(clientInfo.regenerationFeedback || []),
        { feedback: feedback.trim(), at: new Date().toISOString() },
      ];
    }

    clientInfo.brandProfile = {
      ...brandProfile,
      logoDesignSuggestions: logoSuggestions,
      logoGenerationResults: [],
    };
    clientInfo.generationStatus = "logo_generating";
    clientInfo.generationMessage = feedback ? "根据您的意见重新生成中..." : "重新生成Logo中...";

    await supabaseAdmin.from("projects").update({
      status: "logo_generating",
      client_info: clientInfo,
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);

    // Trigger logo generation (same as admin trigger)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/ai/generate-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) {
        console.warn("[regenerate] Logo generation trigger failed:", await res.text());
      }
    } catch (e) {
      console.warn("[regenerate] Logo generation trigger error:", e);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Logo重新生成已启动",
      projectId: project.id,
    });

  } catch (error: any) {
    console.error("[regenerate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "重新生成失败" }, { status: 500 });
  }
}
