/**
 * API: GET /api/ai/templates
 * 获取模板库列表
 */
import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/template-library";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await listTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list templates" }, { status: 500 });
  }
}
