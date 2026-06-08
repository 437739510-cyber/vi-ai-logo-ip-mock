// API Route: GET /api/ai/processed-assets
// Returns all cached processed image entries for visualization.
import { NextRequest, NextResponse } from "next/server";
import { getAllProcessedEntries } from "@/lib/image-cache";

export async function GET(req: NextRequest) {
  try {
    const entries = await getAllProcessedEntries();
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
