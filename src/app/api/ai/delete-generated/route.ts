import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const mockDir = path.join(process.cwd(), "public", "mock");
    const generatedDir = path.join(process.cwd(), "public", "generated");

    // Delete the JSON data file
    const dataPath = path.join(mockDir, `manual-pages-${projectId}.json`);
    const refDir = path.join(mockDir, "reference");
    const refIndexPath = path.join(refDir, `ref-${projectId}-index.json`);

    let deletedCount = 0;

    if (fs.existsSync(dataPath)) {
      fs.unlinkSync(dataPath);
      deletedCount++;
    }

    // Delete generated images
    if (fs.existsSync(generatedDir)) {
      const files = fs.readdirSync(generatedDir);
      for (const file of files) {
        if (file.startsWith(`${projectId}-`)) {
          fs.unlinkSync(path.join(generatedDir, file));
          deletedCount++;
        }
      }
    }

    // Delete PDF
    const pdfPath = path.join(generatedDir, `manual-${projectId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      deletedCount++;
    }

    // Delete reference index if it exists (to clean up)
    if (fs.existsSync(refIndexPath)) {
      try {
        const refs = JSON.parse(fs.readFileSync(refIndexPath, "utf-8"));
        for (const ref of refs) {
          const refFilePath = path.join(refDir, `ref-${ref.refId}.json`);
          if (fs.existsSync(refFilePath)) {
            fs.unlinkSync(refFilePath);
          }
        }
        fs.unlinkSync(refIndexPath);
      } catch {}
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}