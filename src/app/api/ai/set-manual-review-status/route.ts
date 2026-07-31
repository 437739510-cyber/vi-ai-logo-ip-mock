import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * API: POST /api/ai/set-manual-review-status
 *
 * 管理员人工校验完成时调用，将项目状态从 "waiting_manual_review" 推进到 "manual_review_complete"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, status } = body;

    if (!projectId || status !== "manual_review_complete") {
      return NextResponse.json(
        { error: "projectId and status='manual_review_complete' required" },
        { status: 400 }
      );
    }

    // 查询项目，确认当前状态
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id, client_info")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const currentStatus = clientInfo.generationStatus;

    // 校验：只有 waiting_manual_review 状态才能推进
    if (currentStatus !== "waiting_manual_review") {
      return NextResponse.json(
        {
          error: `Invalid current status: "${currentStatus}". Expected "waiting_manual_review".`,
          currentStatus,
        },
        { status: 400 }
      );
    }

    // 更新项目 client_info 和 project.status
    const updatedInfo = {
      ...clientInfo,
      generationStatus: "manual_review_complete",
    };

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({
        client_info: updatedInfo,
        status: "manual_review_complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("[set-manual-review-status] Update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to update project status" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      projectId,
      status: "manual_review_complete",
      message: "Manual review completed. Ready for manual rendering.",
    });
  } catch (error: any) {
    console.error("[set-manual-review-status] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
