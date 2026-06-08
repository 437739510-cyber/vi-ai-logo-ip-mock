// API Route: POST /api/ai/save-plans
// Save to Supabase + local JSON fallback
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const RUNTIME_PATH = path.join(process.cwd(), "public", "mock", "ai-plans-runtime.json");

async function loadExistingPlans(): Promise<any[]> {
  try {
    const data = await readFile(RUNTIME_PATH, "utf-8");
    return JSON.parse(data);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { plans } = await req.json();
    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ error: "No plans provided" }, { status: 400 });
    }

    await mkdir(path.dirname(RUNTIME_PATH), { recursive: true });

    // 写入 Supabase
    const supabasePlans = plans.map((p: any) => ({
      id: p.id,
      project_id: p.projectId || p.project_id || "",
      name: p.name || "未命名方案",
      style: p.style || "",
      description: p.description || "",
      colors: p.colors || [],
      typography: p.typography || [],
      preview_url: p.previewUrl || p.preview_url || "",
      mockup_urls: p.mockupUrls || p.mockup_urls || [],
      is_favorite: p.isFavorite || p.is_favorite || false,
    }));
    const { error: dbErr } = await supabaseAdmin.from("ai_plans").upsert(supabasePlans);
    if (dbErr) console.warn("[save-plans] Supabase warning:", dbErr.message);

    // 本地备份
    const existing = await loadExistingPlans();
    const merged = [...existing];
    for (const plan of plans) {
      const idx = merged.findIndex((p: any) => p.id === plan.id);
      if (idx >= 0) merged[idx] = plan;
      else merged.push(plan);
    }
    await writeFile(RUNTIME_PATH, JSON.stringify(merged, null, 2), "utf-8");

    return NextResponse.json({ success: true, count: plans.length, total: merged.length });
  } catch (error) {
    console.error("[API/save-plans] Error:", error);
    return NextResponse.json({ error: "Failed to save plans" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const plans = await loadExistingPlans();
    return NextResponse.json(plans);
  } catch {
    return NextResponse.json([]);
  }
}
