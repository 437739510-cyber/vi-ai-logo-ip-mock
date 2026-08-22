export const dynamic = "force-dynamic"
/**
 * GET /api/config/pricing — 获取前端定价配置
 * PUT /api/config/pricing — 更新定价配置（管理后台）
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

const DEFAULT_PRICING = {
  basic: { price: "19", name: "基础版", period: "一次性", desc: "品牌基建，适合新店起步", enabled: true },
  standard: { price: "49", name: "标准版", period: "一次性", desc: "全套打包，含 IP 公仔，适合老店焕新", enabled: true },
  manager: { price: "199", name: "品牌管家", period: "/月", desc: "持续运营，拍照我们搞定", enabled: true },
};

const DEFAULT_LOGO_PRICING = {
  standalone: { price: "9.9", name: "Logo单独购买", desc: "仅Logo方案，不含VI手册", enabled: true },
  upgrade_basic: { price: "400", name: "基础版补差价", desc: "从基础版升级到标准版", enabled: true },
  upgrade_standard: { price: "0", name: "标准版补差价", desc: "已有标准版，无需补差", enabled: true },
};

const DEFAULT_COMMISSION = {
  base: 72,
  silver: 78,
  gold: 83,
  upgradeOrders: { silver: 20, gold: 50 },
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("site_config")
      .select("key, value")
      .in("key", ["pricing", "logo_pricing", "commission"]);

    const pricingData = data?.find((d: any) => d.key === "pricing")?.value;
    const logoPricingData = data?.find((d: any) => d.key === "logo_pricing")?.value;
    const commissionData = data?.find((d: any) => d.key === "commission")?.value;

    const pricing = pricingData ? { ...DEFAULT_PRICING, ...pricingData } : DEFAULT_PRICING;
    const logoPricing = logoPricingData ? { ...DEFAULT_LOGO_PRICING, ...logoPricingData } : DEFAULT_LOGO_PRICING;
    const commission = commissionData
      ? { ...DEFAULT_COMMISSION, ...commissionData, upgradeOrders: { ...DEFAULT_COMMISSION.upgradeOrders, ...commissionData.upgradeOrders } }
      : DEFAULT_COMMISSION;

    return NextResponse.json({ success: true, pricing, logoPricing, commission });
  } catch {
    return NextResponse.json({ success: true, pricing: DEFAULT_PRICING, logoPricing: DEFAULT_LOGO_PRICING, commission: DEFAULT_COMMISSION });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { pricing, logoPricing, commission } = body;

    const updates = [];
    if (pricing && typeof pricing === "object") {
      updates.push(
        supabaseAdmin
          .from("site_config")
          .upsert({ key: "pricing", value: pricing, updated_at: new Date().toISOString() }, { onConflict: "key" })
      );
    }
    if (logoPricing && typeof logoPricing === "object") {
      updates.push(
        supabaseAdmin
          .from("site_config")
          .upsert({ key: "logo_pricing", value: logoPricing, updated_at: new Date().toISOString() }, { onConflict: "key" })
      );
    }
    if (commission && typeof commission === "object") {
      updates.push(
        supabaseAdmin
          .from("site_config")
          .upsert({ key: "commission", value: commission, updated_at: new Date().toISOString() }, { onConflict: "key" })
      );
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "无有效配置" }, { status: 400 });
    }

    const results = await Promise.all(updates);
    const errors = results.filter((r: any) => r.error);
    if (errors.length > 0) {
      console.error("保存定价失败:", errors);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "保存失败" }, { status: 500 });
  }
}
