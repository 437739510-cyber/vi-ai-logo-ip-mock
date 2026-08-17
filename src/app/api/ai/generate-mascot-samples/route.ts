import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { checkLegacyWebGenerationGate } from "@/lib/core/legacy-web-generation-gate";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate-mascot-samples
 * 标记项目准备生成4款IP样稿，客户端轮询状态后触发ComfyUI生成
 * 实际生图由本地ComfyUI Worker执行（通过轮询/回调获取结果）
 */
export async function POST(req: NextRequest) {
  const gate = await checkLegacyWebGenerationGate(req);
  if (!gate.allowed) return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id, client_info")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    if (clientInfo.generationStatus === "mascot_generating") {
      return NextResponse.json({ error: "Already generating" }, { status: 400 });
    }

    const updatedInfo = {
      ...clientInfo,
      generationStatus: "mascot_generating",
      mascotSampleCount: 4,
      mascotSampleStartedAt: new Date().toISOString(),
      mascotSamples: [],
    };

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "mascot_generating", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to start" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      projectId,
      status: "mascot_generating",
      message: "Mascot sample generation queued",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
