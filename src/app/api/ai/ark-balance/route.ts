import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

// GET /api/ai/ark-balance
export async function GET() {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("client_info")
    .not("client_info", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const arkUsage: Record<string, number> = {
    "doubao-seedream-3-0-t2i-250415": 0,
    "doubao-seedream-4-0-250828": 0,
    "doubao-seedream-4-5-251128": 0,
    "doubao-seedream-5-0-260128": 0,
  };

  const pricing: Record<string, number> = {
    "doubao-seedream-3-0-t2i-250415": 0.259,
    "doubao-seedream-4-0-250828": 0.20,
    "doubao-seedream-4-5-251128": 0.25,
    "doubao-seedream-5-0-260128": 0.22,
  };

  const freeQuota: Record<string, number> = {
    "doubao-seedream-3-0-t2i-250415": 200,
    "doubao-seedream-4-0-250828": 191,
    "doubao-seedream-4-5-251128": 200,
    "doubao-seedream-5-0-260128": 50,
  };

  for (const project of (data || [])) {
    const ci = (project.client_info as Record<string, any>) || {};
    const arkCalls = ci.arkUsageLog || [];
    for (const call of arkCalls) {
      if (arkUsage[call.model] !== undefined) {
        arkUsage[call.model] += call.count || 1;
      }
    }
  }

  const models = Object.entries(arkUsage).map(([model, used]) => ({
    model,
    used,
    freeQuota: freeQuota[model] || 0,
    remaining: Math.max(0, (freeQuota[model] || 0) - used),
    pricePerImage: pricing[model] || 0,
    totalCost: Math.round(used * (pricing[model] || 0) * 1000) / 1000,
  }));

  const totalUsed = models.reduce((s, m) => s + m.used, 0);
  const totalFree = models.reduce((s, m) => s + m.freeQuota, 0);
  const totalRemaining = models.reduce((s, m) => s + m.remaining, 0);
  const totalCost = models.reduce((s, m) => s + m.totalCost, 0);

  return NextResponse.json({
    models,
    summary: { totalUsed, totalFree, totalRemaining, totalCost: Math.round(totalCost * 1000) / 1000 },
    note: "余额为本地记账，基于免费额度减去已用量。实际额度以火山引擎控制台为准。",
  });
}
