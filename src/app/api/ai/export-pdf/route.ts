// API Route: POST /api/ai/export-pdf
// V6: Support V4 14-page layout + return PDF as binary stream (no file system dependency)
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    // Try local file first (if URL starts with /generated/ or /downloads/)
    if (url.startsWith("/generated/") || url.startsWith("/downloads/")) {
      const localPath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
      try {
        const buf = await readFile(localPath);
        return new Uint8Array(buf);
      } catch { /* fall through to fetch */ }
    }
    // Full URL (Supabase storage etc.)
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

function getImageFormat(buffer: Uint8Array): "png" | "jpg" | "jpeg" | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
  return null;
}

// V4: 14 pages with new toc + digital pages
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

    console.log("[export-pdf] projectId:", projectId, "pages from frontend:", pages?.length ?? "none");

    let pageList: { pageId: string; label: string; url: string }[] = [];

    // 1. Try pages from frontend first
    if (pages && Array.isArray(pages) && pages.length > 0) {
      pageList = pages;
      console.log("[export-pdf] Using pages from frontend:", pageList.length);
    }

    // 2. Try local JSON file
    if (pageList.length === 0) {
      const jsonPath = path.join(process.cwd(), "public", "mock", `manual-pages-${projectId}.json`);
      try {
        const jsonBuf = await readFile(jsonPath, "utf-8");
        const jsonData = JSON.parse(jsonBuf);
        if (jsonData.pages && Array.isArray(jsonData.pages)) {
          pageList = jsonData.pages;
          console.log("[export-pdf] Using pages from local JSON:", pageList.length);
        }
      } catch { /* no file */ }
    }

    // 3. Try Supabase
    if (pageList.length === 0) {
      try {
        const { supabase, supabaseAdmin } = await import("@/lib/supabase");
        const dbClient = supabaseAdmin ?? supabase;
        const { data: manuals } = await dbClient
          .from("vi_manuals")
          .select("pages, generated_at")
          .eq("project_id", projectId)
          .order("generated_at", { ascending: false })
          .limit(1);
        if (manuals && manuals.length > 0 && manuals[0].pages) {
          pageList = manuals[0].pages as { pageId: string; label: string; url: string }[];
          console.log("[export-pdf] Using pages from Supabase:", pageList.length);
        }
      } catch { /* no supabase */ }
    }

    if (pageList.length === 0) {
      return NextResponse.json({ error: "No pages found. Please generate pages first." }, { status: 404 });
    }

    // Sort pages by V4 order
    const sortedPages = PAGE_ORDER
      .map((id) => pageList.find((p) => p.pageId === id))
      .filter((p): p is { pageId: string; label: string; url: string } => p !== undefined);

    console.log("[export-pdf] Sorted pages:", sortedPages.length, "/", pageList.length);

    if (sortedPages.length === 0) {
      return NextResponse.json({ error: "No valid page images found" }, { status: 404 });
    }

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [595.28, 841.89]; // A4
    let embeddedCount = 0;

    for (const page of sortedPages) {
      console.log("[export-pdf] Fetching:", page.pageId, page.url?.substring(0, 80));
      const imgBuffer = await fetchImageAsBuffer(page.url);
      if (!imgBuffer) {
        console.warn("[export-pdf] Could not fetch image:", page.pageId);
        continue;
      }

      const format = getImageFormat(imgBuffer);
      if (!format) {
        console.warn("[export-pdf] Unknown image format:", page.pageId);
        continue;
      }

      try {
        let image;
        if (format === "png") {
          image = await pdfDoc.embedPng(imgBuffer);
        } else {
          image = await pdfDoc.embedJpg(imgBuffer);
        }

        const pdfPage = pdfDoc.addPage(pageSize);
        const { width, height } = image.scaleToFit(pageSize[0], pageSize[1]);
        pdfPage.drawImage(image, {
          x: (pageSize[0] - width) / 2,
          y: (pageSize[1] - height) / 2,
          width,
          height,
        });
        embeddedCount++;
      } catch (embedErr) {
        console.warn("[export-pdf] Failed to embed:", page.pageId, embedErr);
      }
    }

    if (embeddedCount === 0) {
      return NextResponse.json({ error: "Failed to embed any page images into PDF" }, { status: 500 });
    }

    const pdfBytes = await pdfDoc.save();
    console.log("[export-pdf] PDF generated:", embeddedCount, "pages,", pdfBytes.length, "bytes");

    // V6: Return PDF as binary stream directly (no file system dependency)
    return new NextResponse(new Uint8Array(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${projectId}-VI-manual.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (error) {
    console.error("[export-pdf] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
