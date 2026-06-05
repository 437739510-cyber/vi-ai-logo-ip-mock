/**
 * API: Analyze Brand — AI分析面板
 * 
 * 生成前展示AI分析结果，让用户确认后再生成PPTX
 * 复用 generate-manual-pptx/route.ts 的行业判定逻辑
 */
import { NextRequest, NextResponse } from "next/server";
import { getIndustryType, getIndustryDefaults, type IndustryType } from "../generate-manual-pptx/route";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ========== 行业场景物料映射 ==========
const SCENE_MATERIALS: Record<IndustryType, Record<string, { title: string; items: string[] }>> = {
  restaurant: {
    stationery: { title: "餐饮应用系统", items: ["餐巾纸套 / 筷子套", "围裙 / 工服"] },
    packaging: { title: "餐饮包装系统", items: ["外卖袋 / 手提袋", "打包盒"] },
    marketing: { title: "餐饮营销系统", items: ["促销海报 / 展架", "评价卡 / 立牌"] },
  },
  beverage: {
    stationery: { title: "茶饮应用系统", items: ["杯套 / 外带杯", "围裙"] },
    packaging: { title: "茶饮包装系统", items: ["手提袋", "饮品瓶标签"] },
    marketing: { title: "茶饮营销系统", items: ["促销海报", "会员卡"] },
  },
  beauty: {
    stationery: { title: "美容应用系统", items: ["产品包装瓶", "预约卡"] },
    packaging: { title: "美容包装系统", items: ["礼品袋", "产品标签"] },
    marketing: { title: "美容营销系统", items: ["促销海报", "会员卡"] },
  },
  retail: {
    stationery: { title: "零售应用系统", items: ["名片", "价签吊牌"] },
    packaging: { title: "零售包装系统", items: ["购物袋", "产品包装盒"] },
    marketing: { title: "零售营销系统", items: ["促销海报", "货架展示卡"] },
  },
  education: {
    stationery: { title: "教育应用系统", items: ["工牌 / 胸卡", "信纸抬头"] },
    packaging: { title: "教育包装系统", items: ["帆布袋", "课程资料夹"] },
    marketing: { title: "教育营销系统", items: ["招生海报", "活动展架"] },
  },
  general: {
    stationery: { title: "办公应用系统", items: ["名片", "信纸"] },
    packaging: { title: "产品包装系统", items: ["手提袋", "包装盒"] },
    marketing: { title: "营销展示系统", items: ["促销海报", "工牌"] },
  },
};

// ========== 行业标签 ==========
const INDUSTRY_LABELS: Record<IndustryType, { label: string; icon: string }> = {
  restaurant: { label: "餐饮行业", icon: "🍜" },
  beverage:   { label: "饮品行业", icon: "🥤" },
  beauty:     { label: "美容行业", icon: "💅" },
  retail:     { label: "零售行业", icon: "🛍️" },
  education:  { label: "教育行业", icon: "📚" },
  general:    { label: "通用行业", icon: "🏢" },
};

// ========== 页面列表 ==========
const PAGE_LIST: Record<IndustryType, string[]> = {
  restaurant: ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "餐饮应用", "餐饮包装", "餐饮营销", "总结", "感谢观看"],
  beverage:   ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "茶饮应用", "茶饮包装", "茶饮营销", "总结", "感谢观看"],
  beauty:     ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "美容应用", "美容包装", "美容营销", "总结", "感谢观看"],
  retail:     ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "零售应用", "零售包装", "零售营销", "总结", "感谢观看"],
  education:  ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "教育应用", "教育包装", "教育营销", "总结", "感谢观看"],
  general:    ["封面", "目录", "品牌理念", "标识诠释", "标准色彩", "字体系统", "基础规范", "办公应用", "产品包装", "营销展示", "总结", "感谢观看"],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // 从 Supabase 查数据
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id")
      .eq("id", projectId)
      .single();

    let submission: any = null;
    if (project?.submission_id) {
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("id", project.submission_id)
        .single();
      if (sub) submission = sub;
    }

    // 提取品牌数据
    const companyName = body.clientInfo?.companyName || body.clientInfo?.clientName || submission?.company_name || "品牌";
    const industry = body.clientInfo?.industry || submission?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || "";
    const rawColors = body.brandColors || submission?.brand_colors;

    // 行业判定
    const industryType = getIndustryType(industry);
    const industryInfo = INDUSTRY_LABELS[industryType];
    const defaults = getIndustryDefaults(industry);

    // 解析品牌色
    let primaryColor = defaults.primary;
    let colorSource = "行业默认色";
    if (rawColors?.primary?.hex && rawColors.primary.hex !== "#1A73E8") {
      primaryColor = rawColors.primary.hex;
      colorSource = "用户设定";
    } else if (rawColors?.primary && typeof rawColors.primary === "string" && rawColors.primary !== "#1A73E8") {
      primaryColor = rawColors.primary;
      colorSource = "用户设定";
    }

    // 场景物料
    const sceneMaterials = SCENE_MATERIALS[industryType];
    
    // 页面列表
    const pageList = PAGE_LIST[industryType];

    // 品牌色分析
    const colorAnalysis = analyzeColorMeaning(primaryColor, industryType);

    // 字体推荐
    const fontRecommendation = {
      zh: { heading: "思源黑体 / Noto Sans SC", body: "思源宋体 / Noto Serif SC" },
      en: { heading: "Montserrat", body: "Open Sans" },
    };

    // 分析原因
    const reason = buildReason(industry, industryType);

    // 费用预估
    const costEstimate = {
      images: 5,
      costPerImage: 0.20,
      total: 1.00,
      model: "wan2.6-t2i",
    };

    return NextResponse.json({
      success: true,
      analysis: {
        companyName,
        industry: {
          type: industryType,
          label: industryInfo.label,
          icon: industryInfo.icon,
          reason,
        },
        brandColors: {
          primary: primaryColor,
          secondary: defaults.secondary,
          accent: defaults.accent,
          source: colorSource,
          analysis: colorAnalysis,
        },
        sceneMaterials,
        fontRecommendation,
        pageList,
        pageCount: pageList.length,
        costEstimate,
      },
    });
  } catch (error: any) {
    console.error("[analyze-brand] Error:", error);
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}

function analyzeColorMeaning(hex: string, industry: IndustryType): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  if (g > r && g > b) return "绿色系 — 传递自然、健康、生机，适合强调产品天然属性";
  if (r > g && r > b && b < 100) return "红色系 — 传递热情、活力、食欲感，适合强调品牌温度";
  if (b > r && b > g) return "蓝色系 — 传递专业、信任、科技感，适合强调品牌实力";
  if (r > 150 && g > 100 && b < 100) return "橙黄色系 — 传递温暖、活力、阳光，适合营造亲切氛围";
  if (r > 150 && b > 100) return "紫粉色系 — 传递优雅、浪漫、精致，适合高端定位";
  return "中性色系 — 传递稳重、专业、可靠，适合塑造可信赖形象";
}

function buildReason(industry: string, type: IndustryType): string {
  if (!industry) return "未提供行业信息，按通用行业处理";
  const s = industry.toLowerCase();
  if (/椰|椰子|椰汁/.test(s)) return `关键词"椰子/椰汁"匹配饮品行业`;
  if (/茶|奶茶|咖啡/.test(s)) return `关键词"茶/咖啡"匹配饮品行业`;
  if (/饮|饮品|果汁/.test(s)) return `关键词"饮品/果汁"匹配饮品行业`;
  if (/餐|食|面|火锅|烧烤/.test(s)) return `关键词匹配餐饮行业`;
  if (/美容|美发|美甲|spa/.test(s)) return `关键词匹配美容行业`;
  if (/零售|超市|便利/.test(s)) return `关键词匹配零售行业`;
  if (/教育|培训|学/.test(s)) return `关键词匹配教育行业`;
  return `根据行业"${industry}"判断为${type === "general" ? "通用" : type}行业`;
}
