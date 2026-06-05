/**
 * API Route: POST /api/ai/plan-layout
 *
 * AI Layout Planner API
 * 使用共享引擎 plan-layout-engine 生成布局，同时对外提供 HTTP 接口。
 */
import { NextRequest, NextResponse } from "next/server";
import { planLayoutEngine } from "@/lib/plan-layout-engine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const {
      pageId,
      companyName,
      brandVision,
      coreValues,
      targetMarket,
      brandColors,
      hasLogo,
      hasMascot,
      mascotName,
      mascotStyle,
      mascotPersonality,
      logoElements,
      logoMeaning,
      logoStyleTags,
    } = await req.json();

    const result = await planLayoutEngine({
      pageId,
      companyName,
      brandVision,
      coreValues,
      targetMarket,
      brandColors,
      hasLogo,
      hasMascot,
      mascotName,
      mascotStyle,
      mascotPersonality,
      logoElements,
      logoMeaning,
      logoStyleTags,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[plan-layout] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Layout planning failed",
    }, { status: 500 });
  }
}
