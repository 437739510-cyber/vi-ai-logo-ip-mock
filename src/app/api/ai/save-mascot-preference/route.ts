import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import {
  authorizeProjectCustomer,
  hasCompatibleAdminCookies,
  normalizeProjectWriteCredentials,
  resolveDeliverableMascotSample,
  type JsonRecord,
  type ProjectWriteProject,
} from "@/lib/core/project-write-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody: unknown = await req.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody as JsonRecord : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const selectedSampleId = typeof body.selectedSampleId === "string" ? body.selectedSampleId.trim() : "";
    if (!projectId || !["a", "b", "c", "d"].includes(selectedSampleId)) {
      return NextResponse.json({ error: "projectId and selectedSampleId required" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from("projects")
      .select("id, submission_id, status, client_info").eq("id", projectId).single();
    if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const project = data as ProjectWriteProject;
    const clientInfo = project.client_info || {};
    const isAdmin = await hasCompatibleAdminCookies(req);
    const credentials = normalizeProjectWriteCredentials(body);
    if (!isAdmin) {
      if (!credentials.phone || !credentials.viewPassword) {
        return NextResponse.json({ error: "Customer credentials required" }, { status: 401 });
      }
      if (!project.submission_id) return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      const { data: submission } = await supabaseAdmin.from("submissions")
        .select("id, phone").eq("id", project.submission_id).single();
      if (!authorizeProjectCustomer(project, submission?.phone, credentials)) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
    }
    const currentGenerationStatus = typeof clientInfo.generationStatus === "string" ? clientInfo.generationStatus : "";
    const legalStatusPairs: Record<string, string> = {
      mascot_generated: "mascot_generated",
      mascot_samples_ready: "mascot_samples_ready",
    };
    if (legalStatusPairs[currentGenerationStatus] !== project.status) {
      return NextResponse.json({ error: "Mascot samples are not ready" }, { status: 409 });
    }
    const sample = resolveDeliverableMascotSample(clientInfo, selectedSampleId);
    if (!sample) return NextResponse.json({ error: "Mascot sample is not deliverable for this project" }, { status: 400 });

    const updatedInfo = {
      ...clientInfo,
      mascotSelectedId: sample.id,
      mascotStylePref: typeof body.mascotStylePref === "string" && body.mascotStylePref.trim()
        ? body.mascotStylePref.trim() : clientInfo.mascotStylePref || null,
      generationStatus: "mascot_full_generating",
      mascotSelectedAt: new Date().toISOString(),
    };
    const { data: updated, error: updateError } = await supabaseAdmin.from("projects")
      .update({ client_info: updatedInfo, status: "mascot_full_generating", updated_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("status", project.status)
      .eq("client_info->>generationStatus", currentGenerationStatus)
      .select("id");
    if (updateError) return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
    if (!updated?.length) return NextResponse.json({ error: "Project changed; refresh and retry" }, { status: 409 });
    return NextResponse.json({ success: true, projectId, selectedSampleId: sample.id, status: "mascot_full_generating" });
  } catch (error: unknown) {
    console.error("[save-mascot-preference] Request failed");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
