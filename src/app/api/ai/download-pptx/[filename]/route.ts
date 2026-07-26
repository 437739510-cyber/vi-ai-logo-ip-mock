export const dynamic = "force-dynamic"
﻿/**
 * API: Download generated PPTX file
 * V25: Relaxed filename validation, projectId query param support, broader regex
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

  // V25: Only check file extension, accept wider naming patterns (including Chinese)
  const extMatch = filename.match(/\.(pptx|pdf)$/i);
  if (!extMatch) {
    return NextResponse.json({ error: "invalid file type" }, { status: 400 });
  }

  // Extract projectId from filename: vi-manual-{projectId}-{timestamp}.pptx
  // Fallback: searchParams projectId
  const match = filename.match(/^vi-manual-([\w\-]+?)-\d+\.(pptx|pdf)$/i);
  let projectId = match ? match[1] : null;
  if (!projectId) {
    projectId = request.nextUrl.searchParams.get("projectId");
  }

  const ext = extMatch[1].toLowerCase();
  const contentType =
    ext === "pdf"
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
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Content-Length": fileStat.size.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      // Fall through to Storage fallback
    }
  }

  // Proxy from Supabase Storage (not redirect) to force download with Content-Disposition
  if (projectId) {
    try {
      const storagePath = `${projectId}/`;
      const storageUrl = `${"https://fzoscrutqhdfzwnjgjvs.supabase.co"}/storage/v1/object/public/manuals/`;

      console.log(`[download-pptx] Local file not found, proxying from Storage: ${storageUrl}`);
      
      const resp = await fetch(storageUrl, { 
        method: "GET",
        signal: AbortSignal.timeout(60000),
      });
      
      if (resp.ok) {
        const contentLength = resp.headers.get("content-length");
        const body = resp.body;
        
        if (body) {
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
    { error: "file not found or expired" },
    { status: 404 }
  );
}
