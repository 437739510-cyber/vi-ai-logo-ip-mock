// API Route: POST /api/ai/export-pdf
// Generate PDF from generated manual page images using pdf-lib (pure Node.js)
// Compatible with Vercel Serverless (no Python / Pillow dependency)
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import path from "path";

const STORAGE_BUCKET = "brand-brain-generated";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // 1. Fetch manual pages from Supabase vi_manuals
    // Use anon key (supabase) for read-only queries — supabaseAdmin may be null in production
    const { data: manuals, error: manualErr } = await supabase
      .from("vi_manuals")
      .select("pages, generated_at, pdf_url")
      .eq("project_id", projectId)
      .order("generated_at", { ascending: false })
      .limit(1);

    if (manualErr) {
      console.error("[export-pdf] Supabase query error:", manualErr);
      return NextResponse.json({ error: "Failed to query manual data" }, { status: 500 });
    }

    if (!manuals || manuals.length === 0 || !manuals[0].pages) {
      return NextResponse.json({ error: "No generated pages found for this project" }, { status: 404 });
    }

    // Return cached pdf_url if available
    if (manuals[0].pdf_url) {
      return NextResponse.json({
        success: true,
        url: manuals[0].pdf_url,
        pdfUrl: manuals[0].pdf_url,
        downloadUrl: manuals[0].pdf_url,
        message: "PDF from cache",
        totalPages: 0,
      });
    }

    const pages = manuals[0].pages as { pageId: string; label: string; url: string }[];

    // 2. Page order (11 pages matching the VI manual template)
    const pageOrder = [
      "cover", "brand-philosophy", "logo-interpretation", "brand-colors",
      "typography", "basic-spec", "stationery", "packaging", "marketing",
      "summary", "closing"
    ];

    // 3. Sort pages in order
    const sortedPages = pageOrder
      .map((id) => pages.find((p) => p.pageId === id))
      .filter((p): p is { pageId: string; label: string; url: string } => p !== undefined);

    if (sortedPages.length === 0) {
      return NextResponse.json({ error: "No valid page images found" }, { status: 404 });
    }

    // 4. Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [595.28, 841.89]; // A4
    let embeddedCount = 0;

    for (const page of sortedPages) {
      const imgBuffer = await fetchImageAsBuffer(page.url);
      if (!imgBuffer) {
        console.warn(`[export-pdf] Could not fetch image: ${page.pageId} (${page.url})`);
        continue;
      }

      const format = getImageFormat(imgBuffer);
      if (!format) {
        console.warn(`[export-pdf] Unknown image format: ${page.pageId}`);
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
        console.warn(`[export-pdf] Failed to embed ${page.pageId}:`, embedErr);
      }
    }

    if (embeddedCount === 0) {
      return NextResponse.json({ error: "Failed to embed any page images into PDF" }, { status: 500 });
    }

    const pdfBytes = await pdfDoc.save();

    // 5. Upload PDF to Supabase Storage
    // Try supabaseAdmin first (has full write access), fall back to supabase (anon)
    const pdfPath = `${projectId}/manual-${projectId}.pdf`;
    const storageClient = supabaseAdmin ?? supabase;
    const { error: uploadErr } = await storageClient.storage
      .from(STORAGE_BUCKET)
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[export-pdf] Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }

    // 6. Get public URL
    const { data: publicUrlData } = storageClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(pdfPath);

    const publicUrl = publicUrlData?.publicUrl;

    // Save pdf_url to vi_manuals for caching
    try {
      // Use whichever client succeeded for storage (likely has write access)
      await (supabaseAdmin ?? supabase)
        .from("vi_manuals")
        .update({ pdf_url: publicUrl })
        .eq("project_id", projectId);
    } catch (cacheErr) {
      console.warn("[export-pdf] Failed to cache pdf_url:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      pdfUrl: publicUrl,
      downloadUrl: publicUrl,
      message: `PDF generated with ${embeddedCount} pages`,
      totalPages: embeddedCount,
    });
  } catch (error) {
    console.error("[export-pdf] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
