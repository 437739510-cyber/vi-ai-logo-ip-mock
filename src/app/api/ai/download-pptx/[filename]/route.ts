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
import { evaluateDeliverableDownload } from "@/lib/core/project-workbench";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const parsed = parseManualFilename(filename);
  if (!parsed) return NextResponse.json({ error: "invalid filename" }, { status: 400 });

  // R34 下载门禁：退款中/未付款/已取消/待确认锁定；交付中/已交付可下载；测试工单豁免
  try {
    const { data: downloadProject } = await supabaseAdmin
      .from("projects").select("id, status, client_info").eq("id", parsed.projectId).maybeSingle();
    if (!downloadProject) {
      return NextResponse.json({ error: "项目不存在，无法下载" }, { status: 404 });
    }
    const decision = evaluateDeliverableDownload(downloadProject);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, code: "DOWNLOAD_LOCKED" }, { status: 403 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[download-pptx] R34 gate check failed: ${message}`);
    return NextResponse.json({ error: "无法验证订单状态，请稍后重试" }, { status: 403 });
  }

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
