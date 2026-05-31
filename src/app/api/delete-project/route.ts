// API Route: DELETE /api/delete-project
// Remove a project from Supabase + local JSON
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), "public", "mock");

async function loadJson<T>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch { return [] as unknown as T; }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Delete from Supabase
    const { error: delErr } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
    if (delErr) throw new Error("Supabase delete: " + delErr.message);

    // Delete related data
    await supabaseAdmin.from("ai_plans").delete().eq("project_id", projectId);
    await supabaseAdmin.from("vi_manuals").delete().eq("project_id", projectId);
    await supabaseAdmin.from("manual_pages").delete().eq("project_id", projectId);
    await supabaseAdmin.from("favorites").delete().eq("project_id", projectId);

    // Local JSON backup cleanup - only on local dev, skip on Vercel (read-only filesystem)
    if (process.env.VERCEL !== "1") {
      const projPath = path.join(MOCK_DIR, "projects.json");
      const projects: any[] = await loadJson(projPath);
      const target = projects.find((p: any) => p.id === projectId);
      const updatedProjects = projects.filter((p: any) => p.id !== projectId);
      await writeFile(projPath, JSON.stringify(updatedProjects, null, 2), "utf-8");

      if (target?.submissionId) {
        const subPath = path.join(MOCK_DIR, "submissions.json");
        const submissions: any[] = await loadJson(subPath);
        const updatedSubs = submissions.filter((s: any) => s.id !== target.submissionId);
        await writeFile(subPath, JSON.stringify(updatedSubs, null, 2), "utf-8");
      }
    }

    return NextResponse.json({ success: true, message: `Deleted ${projectId}` });
  } catch (error) {
    console.error("[API/delete-project] Error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
