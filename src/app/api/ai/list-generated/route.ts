import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const dataPath = path.join(process.cwd(), "public", "mock", `manual-pages-${projectId}.json`);
    const generatedDir = path.join(process.cwd(), "public", "generated");
    const pdfPath = path.join(generatedDir, `manual-${projectId}.pdf`);

    const manuals: any[] = [];

    // Check for JSON manual data
    if (fs.existsSync(dataPath)) {
      try {
        const raw = fs.readFileSync(dataPath, "utf-8");
        const data = JSON.parse(raw);
        manuals.push({
          id: data.projectId || projectId,
          generatedAt: data.generatedAt || fs.statSync(dataPath).mtime.toISOString(),
          totalPages: data.totalPages || (data.pages?.length || 0),
          failedPages: data.failedPages || 0,
          hasPdf: fs.existsSync(pdfPath),
          source: "generated",
        });
      } catch {}
    }

    return NextResponse.json({ success: true, manuals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}