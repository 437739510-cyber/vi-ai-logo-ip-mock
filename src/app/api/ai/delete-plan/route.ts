// API Route: POST /api/ai/delete-plan
// Remove a single AI generation plan from local JSON
import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const RUNTIME_PATH = path.join(process.cwd(), "public", "mock", "ai-plans-runtime.json");

async function loadPlans(): Promise<any[]> {
  try {
    const data = await readFile(RUNTIME_PATH, "utf-8");
    return JSON.parse(data);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();
    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const plans = await loadPlans();
    const filtered = plans.filter((p: any) => p.id !== planId);
    if (filtered.length === plans.length) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    await writeFile(RUNTIME_PATH, JSON.stringify(filtered, null, 2), "utf-8");
    return NextResponse.json({ success: true, deleted: planId });
  } catch (error) {
    console.error("[API/delete-plan] Error:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
