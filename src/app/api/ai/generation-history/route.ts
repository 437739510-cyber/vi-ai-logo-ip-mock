export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

// GET /api/ai/generation-history?projectId=XXX
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ci = (data?.client_info as Record<string, any>) || {};
  const history = ci.viGenerationHistory || [];
  return NextResponse.json({ history });
}

// DELETE /api/ai/generation-history?projectId=XXX&generationId=YYY
export async function DELETE(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!projectId || !generationId) return NextResponse.json({ error: "projectId and generationId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ci = (data?.client_info as Record<string, any>) || {};
  const history = (ci.viGenerationHistory || []).filter((h: any) => h.id !== generationId);

  // Also try to delete from storage
  const target = (ci.viGenerationHistory || []).find((h: any) => h.id === generationId);
  if (target?.storageUrl) {
    try {
      const path = target.storageUrl.split("/").pop();
      if (path) await supabaseAdmin.storage.from("manuals").remove([`${projectId}/${path}`]);
    } catch {}
  }

  await supabaseAdmin.from("projects").update({ client_info: { ...ci, viGenerationHistory: history } }).eq("id", projectId);
  return NextResponse.json({ success: true });
}
