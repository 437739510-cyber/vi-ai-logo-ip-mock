export const dynamic = "force-dynamic"
// API Route: POST /api/batch-delete-projects
// 批量软删除（R36）：给 projects 写 deleted_at，保留行与关联数据
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function POST(req: NextRequest) {
  try {
    const { projectIds } = await req.json();
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "projectIds (非空数组) required" }, { status: 400 });
    }

    const deletedAt = new Date().toISOString();
    let deleted = 0;
    let errors: string[] = [];

    for (const projectId of projectIds) {
      try {
        const { error } = await supabaseAdmin
          .from("projects")
          .update({ deleted_at: deletedAt })
          .eq("id", projectId)
          .is("deleted_at", null);
        if (error) throw error;
        deleted++;
      } catch (e: any) {
        errors.push(projectId + ": " + e.message);
      }
    }

    return NextResponse.json({
      success: true,
      soft: true,
      deleted,
      total: projectIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[API/batch-delete-projects] Error:", error);
    return NextResponse.json({ error: "Failed to batch soft delete" }, { status: 500 });
  }
}
