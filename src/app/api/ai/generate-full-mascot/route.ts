import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { checkLegacyWebGenerationGate } from "@/lib/core/legacy-web-generation-gate";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate-full-mascot
 * 管理员确认客户选定IP样稿后，标记项目进入全套16张生成阶段
 * 实际生图由本地ComfyUI Worker执行分段生成（三视图→表情→场景）
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
    if (clientInfo.generationStatus !== "mascot_pending") {
      return NextResponse.json(
        { error: `Invalid status: "${clientInfo.generationStatus}". Expected mascot_pending.` },
        { status: 400 }
      );
    }

    if (!clientInfo.mascotSelectedId) {
      return NextResponse.json({ error: "No mascot sample selected yet" }, { status: 400 });
    }

    const updatedInfo = {
      ...clientInfo,
      generationStatus: "mascot_full_generating",
      fullMascotStartedAt: new Date().toISOString(),
      fullMascotProgress: { views: 0, emotions: 0, scenes: 0, total: 16 },
    };

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "mascot_full_generating", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to start" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      projectId,
      status: "mascot_full_generating",
      message: "Full mascot generation queued (16 images)",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
