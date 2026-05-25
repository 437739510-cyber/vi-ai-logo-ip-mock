// API Route: DELETE /api/delete-project
// Remove a project and its submission from the JSON files
import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), "public", "mock");

async function loadJson<T>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [] as unknown as T;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // 1. Load projects and find the one to delete
    const projPath = path.join(MOCK_DIR, "projects.json");
    const projects: any[] = await loadJson(projPath);
    const target = projects.find((p: any) => p.id === projectId);
    if (!target) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Remove from projects.json
    const updatedProjects = projects.filter((p: any) => p.id !== projectId);
    await writeFile(projPath, JSON.stringify(updatedProjects, null, 2), "utf-8");

    // 3. Also remove the associated submission if exists
    if (target.submissionId) {
      const subPath = path.join(MOCK_DIR, "submissions.json");
      const submissions: any[] = await loadJson(subPath);
      const updatedSubs = submissions.filter((s: any) => s.id !== target.submissionId);
      await writeFile(subPath, JSON.stringify(updatedSubs, null, 2), "utf-8");
    }

    return NextResponse.json({ success: true, message: `Deleted ${projectId}` });
  } catch (error) {
    console.error("[API/delete-project] Error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
