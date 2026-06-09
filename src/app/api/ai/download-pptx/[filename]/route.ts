/**
 * API: Download generated PPTX file
 * V24: Local file first, then proxy from Storage with Content-Disposition (fixes cross-origin download)
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync, existsSync } from "fs";
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

  // Extract projectId from filename: vi-manual-{projectId}-{timestamp}.pptx
  const match = filename.match(/^vi-manual-([\w\-]+?)-\d+\.(pptx|pdf)$/);
  const projectId = match ? match[1] : null;

  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const filePath = path.join(process.cwd(), "public", "generated", filename);

  // Try local file first
  if (existsSync(filePath)) {
    try {
      const fileStat = statSync(filePath);
      const nodeStream = createReadStream(filePath, {
        highWaterMark: 64 * 1024,
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
      // Fall through to Storage fallback
    }
  }

  // V24: Proxy from Supabase Storage (not redirect) to force download with Content-Disposition
  if (projectId) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const storagePath = `${projectId}/${filename}`;
      const storageUrl = `${supabaseUrl}/storage/v1/object/public/manuals/${storagePath}`;

      console.log(`[download-pptx] Local file not found, proxying from Storage: ${storageUrl}`);
      
      const resp = await fetch(storageUrl, { 
        method: "GET",
        signal: AbortSignal.timeout(60000),  // 60s timeout for large files
      });
      
      if (resp.ok) {
        const contentLength = resp.headers.get("content-length");
        const body = resp.body;
        
        if (body) {
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
              ...(contentLength ? { "Content-Length": contentLength } : {}),
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    } catch (err: any) {
      console.error(`[download-pptx] Storage proxy error: ${err.message}`);
    }
  }

  return NextResponse.json(
    { error: "文件不存在或已过期，请重新生成" },
    { status: 404 }
  );
}
