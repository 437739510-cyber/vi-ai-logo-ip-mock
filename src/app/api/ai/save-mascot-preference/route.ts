import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 
 * POST /api/ai/save-mascot-preference
 * 客户从4款IP样稿中选定方向，保存选择偏好
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, selectedSampleId, mascotStylePref } = body;

    if (!projectId || !selectedSampleId || !["a", "b", "c", "d"].includes(selectedSampleId)) {
      return NextResponse.json(
        { error: "projectId and selectedSampleId (a/b/c/d) required" },
        { status: 400 }
      );
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
    const allowedStatuses = ["mascot_generated", "mascot_samples_ready"];
    if (!allowedStatuses.includes(clientInfo.generationStatus)) {
      return NextResponse.json(
        { error: `Invalid status: "${clientInfo.generationStatus}". Expected mascot_generated or mascot_samples_ready.`, currentStatus: clientInfo.generationStatus },
        { status: 400 }
      );
    }

    const updatedInfo = {
      ...clientInfo,
      mascotSelectedId: selectedSampleId,
      mascotStylePref: mascotStylePref || clientInfo.mascotStylePref || null,
      generationStatus: "mascot_full_generating",
      mascotSelectedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "mascot_full_generating", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (updateError) {
      console.error("[save-mascot-preference] Update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
    }

    return NextResponse.json({ success: true, projectId, selectedSampleId, status: "mascot_full_generating" });
  } catch (e: any) {
    console.error("[save-mascot-preference] Error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}