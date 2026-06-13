/**
 * GET /api/config/pricing — 获取前端定价配置
 * PUT /api/config/pricing — 更新定价配置（管理后台）
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 默认定价（fallback）
const DEFAULT_PRICING = {
  basic: { price: "99", name: "基础版", period: "一次性", desc: "Logo方案+VI手册", enabled: true },
  standard: { price: "499", name: "标准版", period: "一次性", desc: "品牌故事+Logo+IP+完整VI", enabled: true },
  manager: { price: "299", name: "品牌管家", period: "/月", desc: "每月12条品牌化内容", enabled: true },
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("site_config")
      .select("value")
      .eq("key", "pricing")
      .single();

    if (error || !data?.value) {
      return NextResponse.json({ success: true, pricing: DEFAULT_PRICING });
    }

    const pricing = { ...DEFAULT_PRICING, ...data.value };
    return NextResponse.json({ success: true, pricing });
  } catch {
    return NextResponse.json({ success: true, pricing: DEFAULT_PRICING });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { pricing } = body;

    if (!pricing || typeof pricing !== "object") {
      return NextResponse.json({ error: "pricing 配置无效" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("site_config")
      .upsert(
        { key: "pricing", value: pricing, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      console.error("保存定价失败:", error);
      return NextResponse.json({ error: "保存失败: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, pricing });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "保存失败" }, { status: 500 });
  }
}
