// API Route: GET/POST /api/ai/list-references
// GET: 列出项目所有参考档案
// POST: 切换活跃参考档案
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const refDir = path.join(process.cwd(), "public", "mock", "reference");

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    await mkdir(refDir, { recursive: true });
    const indexPath = path.join(refDir, `ref-${projectId}-index.json`);
    let allRefs: any[] = [];
    try {
      allRefs = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch {}

    return NextResponse.json({ success: true, allRefs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, refId } = body;
    if (!projectId || !refId) {
      return NextResponse.json({ error: "projectId and refId required" }, { status: 400 });
    }

    await mkdir(refDir, { recursive: true });
    const indexPath = path.join(refDir, `ref-${projectId}-index.json`);
    let allRefs: any[] = [];
    try {
      allRefs = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch {}

    // Toggle active state: only the selected ref is active
    allRefs = allRefs.map((r: any) => ({
      ...r,
      active: r.refId === refId,
    }));

    await writeFile(indexPath, JSON.stringify(allRefs, null, 2));

    return NextResponse.json({ success: true, allRefs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
