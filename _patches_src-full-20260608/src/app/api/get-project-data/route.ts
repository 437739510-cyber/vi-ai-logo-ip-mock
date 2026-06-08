import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    let project = null;
    let submission = null;
    let plans = [];

    // 1. Try Supabase first
    try {
      const { data: pData } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      project = pData;

      if (project?.submission_id) {
        const { data: sData } = await supabaseAdmin
          .from("submissions")
          .select("*")
          .eq("id", project.submission_id)
          .single();
        submission = sData;
      }

      const { data: plansData } = await supabaseAdmin
        .from("ai_plans")
        .select("*")
        .eq("project_id", projectId);
      plans = plansData || [];
    } catch (e) {
      console.warn("[get-project-data] Supabase query failed, trying mock:", e);
    }

    // 2. Fallback: try mock JSON files for missing data
    try {
      const baseUrl = new URL(req.url).origin;
      const [projRes, subRes, plansRes] = await Promise.all([
        fetch(baseUrl + "/mock/projects.json"),
        fetch(baseUrl + "/mock/submissions.json"),
        fetch(baseUrl + "/mock/ai-plans-runtime.json"),
      ]);
      if (projRes.ok && subRes.ok) {
        const allProjects = await projRes.json();
        const allSubmissions = await subRes.json();
        if (!project) {
          project = allProjects.find((p: any) => p.id === projectId);
        }
        if (!submission && project) {
          const subId = project.submissionId || project.submission_id;
          if (subId) {
            submission = allSubmissions.find((s: any) => s.id === subId);
          }
        }
        if (plans.length === 0 && plansRes.ok) {
          const allPlans = await plansRes.json();
          plans = allPlans.filter((p: any) => p.projectId === projectId);
        }
      }
    } catch {}

    return NextResponse.json({ success: true, project, submission, plans });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}