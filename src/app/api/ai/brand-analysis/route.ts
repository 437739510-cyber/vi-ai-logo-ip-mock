// DEPRECATED V111: Use /api/ai/analyze-brand instead
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/ai/analyze-brand instead." },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/ai/analyze-brand instead." },
    { status: 410 }
  );
}
