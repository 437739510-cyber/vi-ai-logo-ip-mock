export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function POST(req: NextRequest) {
  try {
    const { projectIds } = await req.json();
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "projectIds (非空数组) required" }, { status: 400 });
    }

    let deleted = 0;
    let errors: string[] = [];

    for (const projectId of projectIds) {
      try {
        await supabaseAdmin.from("ai_plans").delete().eq("project_id", projectId);
        await supabaseAdmin.from("vi_manuals").delete().eq("project_id", projectId);
        await supabaseAdmin.from("manual_pages").delete().eq("project_id", projectId);
        await supabaseAdmin.from("favorites").delete().eq("project_id", projectId);
        const { error } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
        if (error) throw error;
        deleted++;
      } catch (e: any) {
        errors.push(`${projectId}: ${e.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      deleted, 
      total: projectIds.length,
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (error) {
    console.error("[API/batch-delete-projects] Error:", error);
    return NextResponse.json({ error: "Failed to batch delete" }, { status: 500 });
  }
}
