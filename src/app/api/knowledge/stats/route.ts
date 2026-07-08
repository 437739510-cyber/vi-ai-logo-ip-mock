/**
 * API: GET /api/knowledge/stats
 * Knowledge base statistics for admin dashboard (KM-009).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ANTI_PATTERNS } from "@/lib/quality-check/anti-patterns";
import { INDUSTRY_CONFIGS, FLOWER_INDUSTRY } from "@/lib/knowledge/industries";
import { SAFE_FONTS } from "@/lib/knowledge/font-library";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    // 1. Industry config counts
    const uniqueIndustries = new Set<string>();
    for (const key of Object.keys(INDUSTRY_CONFIGS)) {
      const cfg = INDUSTRY_CONFIGS[key] as any;
      if (cfg?.industry) uniqueIndustries.add(cfg.industry);
    }
    const industryCount = uniqueIndustries.size;

    // 2. Case library stats from Supabase
    const { data: cases, error: caseError } = await supabaseAdmin
      .from("case_library")
      .select("industry, highlight_tags, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const casesByIndustry: Record<string, number> = {};
    const errorHitCounts: Record<string, number> = {};
    if (cases) {
      for (const c of cases) {
        const ind = c.industry || "unknown";
        casesByIndustry[ind] = (casesByIndustry[ind] || 0) + 1;
        if (c.highlight_tags) {
          for (const tag of c.highlight_tags) {
            if (tag.startsWith("ERR_")) {
              errorHitCounts[tag] = (errorHitCounts[tag] || 0) + 1;
            }
          }
        }
      }
    }

    // Error hit rate top 5 (from ANTI_PATTERNS occurrenceCount)
    const topErrors = ANTI_PATTERNS
      .filter(p => p.occurrenceCount > 0 || errorHitCounts[p.errorId])
      .map(p => ({
        errorId: p.errorId,
        errorFeature: p.errorFeature,
        occurrenceCount: p.occurrenceCount + (errorHitCounts[p.errorId] || 0),
      }))
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 5);

    // 3. Font reference frequency (from SAFE_FONTS — bestFor as proxy)
    const fontStats = SAFE_FONTS.map(f => ({
      name: f.name,
      nameZh: f.nameZh,
      bestFor: f.bestFor,
      weights: f.weights.length,
    }));

    // 4. Total case count
    const { count: totalCases } = await supabaseAdmin
      .from("case_library")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      success: true,
      data: {
        industryConfigs: industryCount,
        totalCases: totalCases || 0,
        casesByIndustry,
        topErrors,
        fontStats,
      },
    });
  } catch (error) {
    console.error("[knowledge-stats] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stats query failed" },
      { status: 500 }
    );
  }
}