// API Route: POST /api/ai/export-pdf-v6
// V6: Support V4 14-page + return PDF as binary stream
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("/generated/") || url.startsWith("/downloads/")) {
      const localPath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
      try {
        const buf = await readFile(localPath);
        return new Uint8Array(buf);
      } catch { /* fall through */ }
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch { return null; }
}

function getImageFormat(buffer: Uint8Array): "png" | "jpg" | "jpeg" | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
  return null;
}

const PAGE_ORDER = [
  "cover", "toc", "brand-philosophy", "logo-interpretation",
  "brand-colors", "typography", "basic-spec", "mascot-spec",
  "stationery", "packaging", "marketing", "digital",
  "summary", "closing"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, pages } = body;
    console.log("[export-pdf-v6] projectId:", projectId, "pages:", pages?.length ?? "none");

    let pageList: { pageId: string; label: string; url: string }[] = [];

    if (pages && Array.isArray(pages) && pages.length > 0) {
      pageList = pages;
    }
    if (pageList.length === 0) {
      const jsonPath = path.join(process.cwd(), "public", "mock", `manual-pages-${projectId}.json`);
      try {
        const jsonData = JSON.parse(await readFile(jsonPath, "utf-8"));
        if (jsonData.pages) pageList = jsonData.pages;
      } catch { /* no file */ }
    }
    if (pageList.length === 0) {
      try {
        const { supabase, supabaseAdmin } = await import("@/lib/supabase");
        const dbClient = supabaseAdmin ?? supabase;
        const { data: manuals } = await dbClient.from("vi_manuals").select("pages, generated_at").eq("project_id", projectId).order("generated_at", { ascending: false }).limit(1);
        if (manuals?.[0]?.pages) pageList = manuals[0].pages;
      } catch { /* no supabase */ }
    }

    if (pageList.length === 0) {
      return NextResponse.json({ error: "No pages found" }, { status: 404 });
    }

    const sortedPages = PAGE_ORDER.map(id => pageList.find(p => p.pageId === id)).filter((p): p is { pageId: string; label: string; url: string } => p !== undefined);
    console.log("[export-pdf-v6] Sorted:", sortedPages.length, "/", pageList.length);

    if (sortedPages.length === 0) {
      return NextResponse.json({ error: "No valid pages" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [595.28, 841.89];
    let embeddedCount = 0;

    for (const page of sortedPages) {
      console.log("[export-pdf-v6] Fetching:", page.pageId, page.url?.substring(0, 80));
      const imgBuffer = await fetchImageAsBuffer(page.url);
      if (!imgBuffer) { console.warn("[export-pdf-v6] Skip:", page.pageId); continue; }
      const format = getImageFormat(imgBuffer);
      if (!format) { console.warn("[export-pdf-v6] Unknow format:", page.pageId); continue; }
      try {
        const image = format === "png" ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
        const pdfPage = pdfDoc.addPage(pageSize);
        const { width, height } = image.scaleToFit(pageSize[0], pageSize[1]);
        pdfPage.drawImage(image, { x: (pageSize[0] - width) / 2, y: (pageSize[1] - height) / 2, width, height });
        embeddedCount++;
      } catch (embedErr) { console.warn("[export-pdf-v6] Embed failed:", page.pageId, String(embedErr)); }
    }

    if (embeddedCount === 0) {
      return NextResponse.json({ error: "Failed to embed any pages" }, { status: 500 });
    }

    const pdfBytes = await pdfDoc.save();
    console.log("[export-pdf-v6] PDF:", embeddedCount, "pages,", pdfBytes.length, "bytes");

    return new NextResponse(new Uint8Array(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"" + projectId + "-VI-manual.pdf\"",
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (error) {
    console.error("[export-pdf-v6] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
