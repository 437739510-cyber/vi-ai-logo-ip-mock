/**
 * API: Analyze Brand — AI分析面板
 * V54: 本地行业分析 + 委托 /api/ai/brand-analysis 做深度品牌分析（消除重复DeepSeek调用）
 */
import { NextRequest, NextResponse } from "next/server";
import { getIndustryType, type IndustryType, getIndustryDefaults } from "@/lib/brand/industry-types";
import { supabaseAdmin } from "@/lib/core/supabase";
import { canStartProduction, PRODUCTION_BLOCKED_CODE, PRODUCTION_BLOCKED_MESSAGE } from "@/lib/core/project-workbench";

export const dynamic = "force-dynamic";
export const maxDuration = 120;


const SCENE_MATERIALS: Record<IndustryType, Record<string, { title: string; items: string[] }>> = {
  car: { stationery: { title: "汽车服务应用系统", items: ["工牌 / 胸卡", "会员卡"] }, packaging: { title: "汽车服务包装系统", items: ["养护用品包装", "手提袋"] }, marketing: { title: "汽车服务营销系统", items: ["促销海报", "洗车套餐卡"] } },
  restaurant: { stationery: { title: "餐饮应用系统", items: ["餐巾纸套 / 筷子套", "围裙 / 工服"] }, packaging: { title: "餐饮包装系统", items: ["外卖袋 / 手提袋", "打包盒"] }, marketing: { title: "餐饮营销系统", items: ["促销海报 / 展架", "评价卡 / 立牌"] } },
  fastfood: { stationery: { title: "快餐应用系统", items: ["围裙 / 工服", "点餐单"] }, packaging: { title: "快餐包装系统", items: ["外卖袋 / 手提袋", "汉堡盒 / 饮料杯"] }, marketing: { title: "快餐营销系统", items: ["招牌灯箱", "促销海报 / 立牌"] } },
  beverage: { stationery: { title: "茶饮应用系统", items: ["杯套 / 外带杯", "围裙"] }, packaging: { title: "茶饮包装系统", items: ["手提袋", "饮品瓶标签"] }, marketing: { title: "茶饮营销系统", items: ["促销海报", "会员卡"] } },
  beauty: { stationery: { title: "美容应用系统", items: ["产品包装瓶", "预约卡"] }, packaging: { title: "美容包装系统", items: ["礼品袋", "产品标签"] }, marketing: { title: "美容营销系统", items: ["促销海报", "会员卡"] } },
  retail: { stationery: { title: "零售应用系统", items: ["名片", "价签吊牌"] }, packaging: { title: "零售包装系统", items: ["购物袋", "产品包装盒"] }, marketing: { title: "零售营销系统", items: ["促销海报", "货架展示卡"] } },
  education: { stationery: { title: "教育应用系统", items: ["工牌 / 胸卡", "信纸抬头"] }, packaging: { title: "教育包装系统", items: ["帆布袋", "课程资料夹"] }, marketing: { title: "教育营销系统", items: ["招生海报", "活动展架"] } },
  fresh_food: { stationery: { title: "生鲜应用系统", items: ["价签标签", "会员卡"] }, packaging: { title: "生鲜包装系统", items: ["水果贴纸", "果篮包装"] }, marketing: { title: "生鲜营销系统", items: ["促销立牌", "手提袋"] } },
  floral: { stationery: { title: "花艺应用系统", items: ["预约卡", "会员卡"] }, packaging: { title: "花艺包装系统", items: ["花束包装纸", "花篮"] }, marketing: { title: "花艺营销系统", items: ["节日海报", "展示卡"] } },
  home: { stationery: { title: "家居应用系统", items: ["名片", "产品标签"] }, packaging: { title: "家居包装系统", items: ["手提袋", "产品包装盒"] }, marketing: { title: "家居营销系统", items: ["促销海报", "展厅展示卡"] } },
  nail: { stationery: { title: "美甲应用系统", items: ["色板卡", "预约卡"] }, packaging: { title: "美甲包装系统", items: ["甲油瓶贴", "礼品袋"] }, marketing: { title: "美甲营销系统", items: ["促销海报", "会员卡"] } },
  tea: { stationery: { title: "茶业应用系统", items: ["品鉴卡", "名片"] }, packaging: { title: "茶业包装系统", items: ["茶叶罐标签", "礼盒"] }, marketing: { title: "茶业营销系统", items: ["品鉴海报", "茶单"] } },
  general: { stationery: { title: "品牌应用系统", items: ["名片", "信纸"] }, packaging: { title: "产品包装系统", items: ["手提袋", "包装盒"] }, marketing: { title: "营销展示系统", items: ["促销海报", "工牌"] } },
  fashion: { stationery: { title: "时尚应用系统", items: ["吊牌/标签", "购物袋"] }, packaging: { title: "时尚包装系统", items: ["礼品盒", "手提袋"] }, marketing: { title: "时尚营销系统", items: ["新品海报", "橱窗展示"] } },
  mother_baby: { stationery: { title: "母婴应用系统", items: ["产品标签", "会员卡"] }, packaging: { title: "母婴包装系统", items: ["礼盒", "手提袋"] }, marketing: { title: "母婴营销系统", items: ["促销海报", "活动展架"] } },
  wedding: { stationery: { title: "婚庆应用系统", items: ["请柬", "席位卡"] }, packaging: { title: "婚庆包装系统", items: ["喜糖盒", "伴手礼袋"] }, marketing: { title: "婚庆营销系统", items: ["婚礼海报", "展示架"] } },
  fitness: { stationery: { title: "健身应用系统", items: ["会员卡", "毛巾标识"] }, packaging: { title: "健身包装系统", items: ["运动水杯", "健身包"] }, marketing: { title: "健身营销系统", items: ["促销海报", "课程表"] } },
  pharmacy: { stationery: { title: "药房应用系统", items: ["处方袋", "药盒标签"] }, packaging: { title: "药房包装系统", items: ["手提袋", "保健礼盒"] }, marketing: { title: "药房营销系统", items: ["健康海报", "会员卡"] } },
  pet: { stationery: { title: "宠物应用系统", items: ["宠物牌", "会员卡"] }, packaging: { title: "宠物包装系统", items: ["宠物食品袋", "礼盒"] }, marketing: { title: "宠物营销系统", items: ["促销海报", "活动展架"] } },
};

const INDUSTRY_LABELS: Record<IndustryType, { label: string; icon: string }> = {
  car: { label: "汽车服务行业", icon: "🚗" },
  restaurant: { label: "餐饮行业", icon: "🍜" }, fastfood: { label: "快餐行业", icon: "🍔" }, beverage: { label: "饮品行业", icon: "🥤" },
  beauty: { label: "美容行业", icon: "💅" }, retail: { label: "零售行业", icon: "🛍️" },
  education: { label: "教育行业", icon: "📚" }, fresh_food: { label: "生鲜行业", icon: "🍎" }, floral: { label: "花艺行业", icon: "🌸" },
  home: { label: "家居行业", icon: "🏠" }, nail: { label: "美甲行业", icon: "💅" },
  tea: { label: "茶业行业", icon: "🍵" }, general: { label: "通用行业", icon: "🏢" },
  fashion: { label: "时尚行业", icon: "👗" }, mother_baby: { label: "母婴行业", icon: "👶" },
  wedding: { label: "婚庆行业", icon: "💒" }, fitness: { label: "健身行业", icon: "💪" },
  pharmacy: { label: "药房行业", icon: "💊" }, pet: { label: "宠物行业", icon: "🐾" },
};

const PAGE_LIST: Record<IndustryType, string[]> = {
  car: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","汽车应用","汽车包装","汽车营销","总结","感谢观看"],
  restaurant: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","餐饮应用","餐饮包装","餐饮营销","总结","感谢观看"],
  fastfood: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","快餐应用","快餐包装","快餐营销","总结","感谢观看"],
  beverage: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","茶饮应用","茶饮包装","茶饮营销","总结","感谢观看"],
  beauty: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","美容应用","美容包装","美容营销","总结","感谢观看"],
  retail: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","零售应用","零售包装","零售营销","总结","感谢观看"],
  education: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","教育应用","教育包装","教育营销","总结","感谢观看"],
  fresh_food: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","生鲜应用","生鲜包装","生鲜营销","总结","感谢观看"],
  floral: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","花艺应用","花艺包装","花艺营销","总结","感谢观看"],
  home: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","家居应用","家居包装","家居营销","总结","感谢观看"],
  nail: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","美甲应用","美甲包装","美甲营销","总结","感谢观看"],
  tea: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","茶业应用","茶业包装","茶业营销","总结","感谢观看"],
  general: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","品牌应用","产品包装","营销展示","总结","感谢观看"],
  fashion: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","时尚应用","时尚包装","时尚营销","总结","感谢观看"],
  mother_baby: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","母婴应用","母婴包装","母婴营销","总结","感谢观看"],
  wedding: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","婚庆应用","婚庆包装","婚庆营销","总结","感谢观看"],
  fitness: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","健身应用","健身包装","健身营销","总结","感谢观看"],
  pharmacy: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","药房应用","药房包装","药房营销","总结","感谢观看"],
  pet: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","宠物应用","宠物包装","宠物营销","总结","感谢观看"],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { data: project } = await supabaseAdmin.from("projects").select("id, submission_id, status, client_info").eq("id", projectId).single();
    // R34 生产门禁：未付款不能生产（测试工单豁免）
    if (project && !canStartProduction(project)) {
      return NextResponse.json({ error: PRODUCTION_BLOCKED_MESSAGE, code: PRODUCTION_BLOCKED_CODE }, { status: 403 });
    }
    let submission: any = null;
    if (project?.submission_id) {
      const { data: sub } = await supabaseAdmin.from("submissions").select("*").eq("id", project.submission_id).single();
      if (sub) submission = sub;
    }

    const companyName = body.clientInfo?.companyName || body.clientInfo?.clientName || submission?.company_name || "品牌";
    const industry = body.clientInfo?.industry || submission?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || "";
    const coreValues = body.clientInfo?.coreValues || submission?.core_values || "";
    const targetMarket = body.clientInfo?.targetMarket || submission?.target_market || "";
    const logoPhilosophy = body.clientInfo?.logoPhilosophy || submission?.logo_philosophy || "";
    const mascotPhilosophy = body.clientInfo?.mascotPhilosophy || submission?.mascot_philosophy || "";
    const mainProducts = body.clientInfo?.mainProducts || submission?.main_products || "";
    const businessForm = body.clientInfo?.businessForm || (submission as any)?.business_form || "";
    const rawColors = body.brandColors || submission?.existing_brand_color;

    const industryType = getIndustryType(industry);
    const industryInfo = INDUSTRY_LABELS[industryType];
    const defaults = getIndustryDefaults(industry);

    let primaryColor = defaults.primary;
    let colorSource = "行业默认色";
    if (rawColors?.primary?.hex && rawColors.primary.hex !== "#1A73E8") {
      primaryColor = rawColors.primary.hex;
      colorSource = "用户设定";
    } else if (rawColors?.primary && typeof rawColors.primary === "string" && rawColors.primary !== "#1A73E8") {
      primaryColor = rawColors.primary;
      colorSource = "用户设定";
    }

    const sceneMaterials = SCENE_MATERIALS[industryType];
    const pageList = PAGE_LIST[industryType];
    const colorAnalysis = analyzeColorMeaning(primaryColor, industryType);
    const reason = buildReason(industry, industryType);
    const costEstimate = { images: 5, costPerImage: 0.20, total: 1.00, model: "wan2.6-t2i" };
    const fontRecommendation = {
      zh: { heading: "思源黑体 / Noto Sans SC", body: "思源宋体 / Noto Serif SC" },
      en: { heading: "Montserrat", body: "Open Sans" },
    };

    // ===== DeepSeek brand analysis → background fire-and-forget =====
    // API returns immediately with basic analysis.
    // DeepSeek runs in background, saves brandProfile (with logoDesignSuggestions) to DB.
    const shouldRunDeepSeek = companyName !== "品牌";
    
    // Update status to "analyzing" immediately
    if (shouldRunDeepSeek) {
      try {
        const existingInfo = (project?.client_info as Record<string, any>) || {};
        await supabaseAdmin.from("projects").update({
          client_info: {
            ...existingInfo,
            companyName: companyName || existingInfo.companyName || null,
            industry: industry || existingInfo.industry || null,
            brandProfile: {
              ...existingInfo.brandProfile,
              analysisStatus: "analyzing",
              analyzedAt: null,
            }
          }
        }).eq("id", projectId);
      } catch (e) { /* ignore */ }

      // V54: 委托给 brand-analysis 路由，避免重复DeepSeek调用
      void (async () => {
        try {
          console.log("[analyze-brand BG] Delegating to /api/ai/brand-analysis for:", companyName);
          const baseUrl = "https://vi-ai-logo-ip-mock.edgeone.dev";
          const analysisResp = await fetch(`${baseUrl}/api/ai/brand-analysis`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              clientInfo: {
                companyName, industry, mainProducts, businessForm,
                brandVision, coreValues, targetMarket,
                logoPhilosophy, mascotPhilosophy,
                province: body.clientInfo?.province || submission?.province,
                city: body.clientInfo?.city || submission?.city,
                description: body.clientInfo?.description || submission?.description,
                brandColors: { primary: primaryColor, secondary: defaults.secondary, accent: defaults.accent },
              },
            }),
            signal: AbortSignal.timeout(90000),
          });

          if (analysisResp.ok) {
            const result = await analysisResp.json();
            if (result.success) {
              console.log("[analyze-brand BG] brand-analysis OK, reused:", result.reused || false);
              // 保存品牌分析结果到DB
              if (result.profile) {
                try {
                  const { data: latestProj } = await supabaseAdmin
                    .from("projects").select("client_info").eq("id", projectId).single();
                  const existing = (latestProj?.client_info as Record<string, any>) || {};
                  await supabaseAdmin.from("projects").update({
                    client_info: {
                      ...existing,
                      brandProfile: { ...result.profile, analysisStatus: "completed", analyzedAt: new Date().toISOString() },
                    }
                  }).eq("id", projectId);
                  console.log("[analyze-brand BG] Saved brand profile to DB");
                } catch (saveErr) {
                  console.warn("[analyze-brand BG] Save failed:", saveErr);
                }
              }
            } else {
              console.warn("[analyze-brand BG] brand-analysis error:", result.error);
              await markAnalysisFailed(projectId);
            }
          } else {
            console.warn("[analyze-brand BG] brand-analysis fetch failed:", analysisResp.status);
            await markAnalysisFailed(projectId);
          }
        } catch (err: any) {
          console.warn("[analyze-brand BG] Error:", err?.message);
          await markAnalysisFailed(projectId);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      analysis: {
        companyName,
        industry: { type: industryType, label: industryInfo.label, icon: industryInfo.icon, reason },
        brandColors: { primary: primaryColor, secondary: defaults.secondary, accent: defaults.accent, source: colorSource, analysis: colorAnalysis },
        sceneMaterials,
        fontRecommendation,
        pageList,
        pageCount: pageList.length,
        costEstimate,
        brandProfile: null, // Now generated in background
        brandProfileStatus: shouldRunDeepSeek ? "analyzing" : "skipped",
      },
    });
  } catch (error: any) {
    console.error("[analyze-brand] Error:", error);
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}


async function markAnalysisFailed(projectId: string) {
  try {
    const { data: latestProject } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
    const existingInfo = (latestProject?.client_info as Record<string, any>) || {};
    await supabaseAdmin.from("projects").update({
      client_info: {
        ...existingInfo,
        brandProfile: {
          ...(existingInfo.brandProfile as Record<string, any> || {}),
          analysisStatus: "failed",
        }
      }
    }).eq("id", projectId);
  } catch (e) { /* ignore */ }
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
  if (/椰|椰子|椰汁/.test(s)) return "关键词\"椰子/椰汁\"匹配饮品行业";
  if (/茶|奶茶|咖啡/.test(s)) return "关键词\"茶/咖啡\"匹配饮品行业";
  if (/饮|饮品|果汁/.test(s)) return "关键词\"饮品/果汁\"匹配饮品行业";
  if (/餐|食|面|火锅|烧烤/.test(s)) return "关键词匹配餐饮行业";
  if (/美容|美发|美甲|spa/.test(s)) return "关键词匹配美容行业";
  if (/零售|超市|便利/.test(s)) return "关键词匹配零售行业";
  if (/教育|培训|学/.test(s)) return "关键词匹配教育行业";
  return "根据行业\"" + industry + "\"判断为" + (type === "general" ? "通用" : type) + "行业";
}
