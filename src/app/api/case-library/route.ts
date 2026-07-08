/**
 * API: GET /api/case-library
 * Search and list VI manual reference cases from case_library table.
 *
 * Query params:
 *   ?industry=餐饮     — filter by industry
 *   ?q=花语            — fuzzy search brand_name
 *   ?page=1&limit=10   — pagination (default limit=20)
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const industry = url.searchParams.get("industry") || "";
    const q = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("case_library")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (industry) {
      query = query.ilike("industry", `%${industry}%`);
    }
    if (q) {
      query = query.or(`industry.ilike.%${q}%,brand_name.ilike.%${q}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("[case-library] Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
