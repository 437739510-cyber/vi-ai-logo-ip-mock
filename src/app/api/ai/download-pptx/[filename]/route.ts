/**
 * API: Download generated PPTX file
 * Serves files from public/generated/ directory
 * Uses streaming to avoid OOM on large files (15MB+)
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Security: only allow pptx/pdf files
  if (!filename.match(/^vi-manual-[\w\-]+\.(pptx|pdf)$/)) {
    return NextResponse.json({ error: "无效的文件名" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "generated", filename);

  try {
    // Check file exists and get size (sync is fine for stat)
    const fileStat = statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    // Stream file instead of loading entire buffer into memory
    const nodeStream = createReadStream(filePath, {
      highWaterMark: 64 * 1024, // 64KB chunks - low memory pressure
    });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "文件不存在或已过期" },
      { status: 404 }
    );
  }
}
