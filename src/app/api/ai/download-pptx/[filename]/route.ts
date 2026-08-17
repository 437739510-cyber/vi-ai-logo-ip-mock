export const dynamic = "force-dynamic";
/** API: Download a canonical generated PPTX file. */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync, existsSync } from "fs";
import { Readable } from "stream";
import path from "path";
import { SUPABASE_URL } from "@/lib/core/supabase-config";
import {
  createManualStorageUrl,
  parseManualFilename,
  VI_MANUAL_CONTENT_TYPE,
} from "@/lib/vi-manual/manual-delivery";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const parsed = parseManualFilename(filename);
  if (!parsed) return NextResponse.json({ error: "invalid filename" }, { status: 400 });

  const generatedRoot = path.resolve(process.cwd(), "public", "generated");
  const filePath = path.resolve(generatedRoot, filename);
  if (!filePath.startsWith(`${generatedRoot}${path.sep}`)) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  // Try local file first
  if (existsSync(filePath)) {
    try {
      const fileStat = statSync(filePath);
      if (!fileStat.isFile() || fileStat.size <= 0) throw new Error("invalid local file");
      const nodeStream = createReadStream(filePath, {
        highWaterMark: 64 * 1024,
      });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        headers: {
          "Content-Type": VI_MANUAL_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Content-Length": fileStat.size.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      // Fall through to Storage fallback
    }
  }

  // Proxy the exact canonical object. Authorization is intentionally outside TICKET-078.
  try {
    const storageUrl = createManualStorageUrl(SUPABASE_URL, parsed.projectId, filename);
    const resp = await fetch(storageUrl, { method: "GET", signal: AbortSignal.timeout(60_000) });
    if (!resp.ok) {
      return NextResponse.json(
        { error: "file not found or storage unavailable" },
        { status: resp.status === 404 ? 404 : 502 },
      );
    }
    const body = resp.body;
    const contentLength = resp.headers.get("content-length");
    const upstreamType = (resp.headers.get("content-type") || "").toLowerCase();
    if (!body || contentLength === "0" || upstreamType.includes("text/html")) {
      return NextResponse.json({ error: "invalid storage response" }, { status: 502 });
    }
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": VI_MANUAL_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[download-pptx] Storage proxy failed: ${message}`);
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
