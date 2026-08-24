export const dynamic = "force-dynamic"
// API Route: POST /api/delete-project
// 软删除（R36）：给 projects 写 deleted_at，保留行与关联数据；列表默认排除，可在「已归档」查看
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
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

    // 软删除：写 deleted_at（R26 迁移已建列），保留行；不删 ai_plans / vi_manuals 等关联数据
    const deletedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ deleted_at: deletedAt })
      .eq("id", projectId)
      .is("deleted_at", null);
    if (error) throw new Error("Supabase soft delete: " + error.message);

    // Local JSON 同步软删除标记 - only on local dev, skip on Vercel (read-only filesystem)
    if (process.env.VERCEL !== "1") {
      const projPath = path.join(MOCK_DIR, "projects.json");
      const projects: any[] = await loadJson(projPath);
      const updatedProjects = projects.map((p: any) =>
        p.id === projectId ? { ...p, deleted_at: deletedAt } : p
      );
      await writeFile(projPath, JSON.stringify(updatedProjects, null, 2), "utf-8");
    }

    return NextResponse.json({ success: true, soft: true, deletedAt, message: "Project " + projectId + " marked as deleted" });
  } catch (error) {
    console.error("[API/delete-project] Error:", error);
    return NextResponse.json({ error: "Failed to soft delete" }, { status: 500 });
  }
}
