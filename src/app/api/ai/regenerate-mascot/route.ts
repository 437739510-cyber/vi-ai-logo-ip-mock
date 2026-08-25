import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { canStartProduction, PRODUCTION_BLOCKED_CODE, PRODUCTION_BLOCKED_MESSAGE } from "@/lib/core/project-workbench";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/regenerate-mascot
 * 客户对已生成公仔不满意，重置状态允许重新生成
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id, status, client_info")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // R34 生产门禁：未付款不能生产（测试工单豁免）
    if (!canStartProduction(project)) {
      return NextResponse.json({ error: PRODUCTION_BLOCKED_MESSAGE, code: PRODUCTION_BLOCKED_CODE }, { status: 403 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const currentStatus = clientInfo.generationStatus;
    const allowedStatuses = ["mascot_generated", "mascot_failed", "mascot_full_fail", "mascot_sample_fail"];

    if (!allowedStatuses.includes(currentStatus)) {
      return NextResponse.json(
        { error: `Cannot regenerate from status "${currentStatus}"` },
        { status: 400 }
      );
    }

    const updatedInfo = {
      ...clientInfo,
      mascotStatus: undefined,
      mascotSelectedId: undefined,
      mascotStylePref: undefined,
      mascotAssets: undefined,
      mascotPartial: undefined,
      mascotError: undefined,
      mascotDebug: undefined,
      generationStatus: "mascot_pending",
      regenerationCount: (clientInfo.regenerationCount || 0) + 1,
      regeneratedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "mascot_pending", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
    }

    return NextResponse.json({ success: true, projectId, status: "mascot_pending" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}