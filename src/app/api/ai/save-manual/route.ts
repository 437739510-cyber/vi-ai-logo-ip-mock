// API Route: POST /api/ai/save-manual
// Save to Supabase + local JSON fallback
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const RUNTIME_PATH = path.join(process.cwd(), "public", "mock", "vi-manuals-runtime.json");

async function loadExistingManuals(): Promise<any[]> {
  try {
    const data = await readFile(RUNTIME_PATH, "utf-8");
    return JSON.parse(data);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { manual } = await req.json();
    if (!manual || !manual.id || !manual.projectId) {
      return NextResponse.json({ error: "Valid manual object required" }, { status: 400 });
    }

    await mkdir(path.dirname(RUNTIME_PATH), { recursive: true });

    // 写入 Supabase
    const dbManual = {
      id: manual.id,
      project_id: manual.projectId,
      plan_id: manual.planId || null,
      status: manual.status || "draft",
      pages: manual.pages || [],
      generated_at: manual.generatedAt || new Date().toISOString(),
    };
    const { error: dbErr } = await supabaseAdmin.from("vi_manuals").upsert(dbManual);
    if (dbErr) console.warn("[save-manual] Supabase warning:", dbErr.message);

    // 本地备份
    const existing = await loadExistingManuals();
    const idx = existing.findIndex((m: any) => m.projectId === manual.projectId);
    if (idx >= 0) existing[idx] = manual;
    else existing.push(manual);
    await writeFile(RUNTIME_PATH, JSON.stringify(existing, null, 2), "utf-8");

    return NextResponse.json({ success: true, manualId: manual.id });
  } catch (error) {
    console.error("[API/save-manual] Error:", error);
    return NextResponse.json({ error: "Failed to save manual" }, { status: 500 });
  }
}

export async function GET() {
  const manuals = await loadExistingManuals();
  return NextResponse.json(manuals);
}
