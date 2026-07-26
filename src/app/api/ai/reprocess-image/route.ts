export const dynamic = "force-dynamic"
﻿// API Route: POST /api/ai/reprocess-image
// Force reprocess a cached image (LOGO or mascot) with optional method override.
import { NextRequest, NextResponse } from "next/server";
import { reprocessImage } from "@/lib/core/image-cache";

export async function POST(req: NextRequest) {
  try {
    const { originalPath, method } = await req.json();

    if (!originalPath) {
      return NextResponse.json({ error: "originalPath required" }, { status: 400 });
    }

    // Strip leading slash if present
    const cleanPath = originalPath.startsWith("/") ? originalPath : "/" + originalPath;

    const processedPath = await reprocessImage(cleanPath, method || "sharp");

    return NextResponse.json({
      success: true,
      originalPath: cleanPath,
      processedPath,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Reprocess failed";
    // File not found: return soft-failure instead of 500 to avoid blocking the flow
    if (msg.startsWith("FILE_NOT_FOUND:")) {
      console.warn("[reprocess-image] File not found, skipping:", msg);
      return NextResponse.json({ success: true, skipped: true, reason: "Image file not found, skipped" });
    }
    console.error("[reprocess-image] Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
