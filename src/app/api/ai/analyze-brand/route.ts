/**
 * API: Analyze Brand — AI分析面板
 * V13: 调用DeepSeek做深度品牌分析，保存brandProfile（含logoDesignSuggestions）到数据库
 */
import { NextRequest, NextResponse } from "next/server";
import { getIndustryType, getIndustryDefaults, type IndustryType } from "../generate-manual-pptx/route";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BRAND_ANALYSIS_SYSTEM_PROMPT = `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

## 分析框架
1. 行业洞察：市场趋势、痛点与机会
2. 品牌定位：差异化定位方向、品牌调性关键词
3. 文案补全：客户没写的AI代写，已写的润色保留原意
4. 视觉方向：推荐视觉风格 + 5个写实场景图描述（中英文对照）
5. Logo设计建议：为没有Logo的客户提供4个不同方向的Logo设计方案

## 输出格式（严格JSON，不要markdown包裹）
{
  "industryInsight": "行业洞察，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议",
  "sceneImageSuggestions": [
    {"zh": "名片", "en": "Professional product photography of branded business cards with company logo printed on them, arranged on wooden desk, studio lighting, angled view"},
    {"zh": "手提袋", "en": "Professional product photography of a branded paper tote bag with company logo printed on front, standing upright, studio lighting"},
    {"zh": "产品", "en": "Professional product photography of a branded product with company logo label, on clean surface, studio lighting, product fully visible"},
    {"zh": "促销海报", "en": "Professional product photography of a branded promotional poster standee in store, with company branding visible, studio setting"},
    {"zh": "会员卡", "en": "Professional product photography of a branded VIP membership card with company logo, clean studio background"}
  ],
  "logoDesignSuggestions": {
    "concept": "Logo设计核心概念，1-2句话",
    "style": "设计风格",
    "elements": "建议包含的设计元素",
    "colorGuidance": "配色建议",
    "prompts": [
      "英文prompt1：用于AI生图的详细描述",
      "英文prompt2：风格变体",
      "英文prompt3：不同方向变体",
      "英文prompt4：另一个创意方向"
    ]
  }
}`;

function buildBrandAnalysisPrompt(info: {
  companyName: string; industry: string;
  mainProducts?: string; businessForm?: string;
  brandVision?: string; coreValues?: string; targetMarket?: string;
  logoPhilosophy?: string; mascotPhilosophy?: string;
  province?: string; city?: string; description?: string;
  brandColors?: { primary: string; secondary: string; accent: string };
}): string {
  const parts: string[] = [];
  parts.push("## 客户品牌基础信息");
  parts.push("");
  parts.push("公司名称：" + (info.companyName || "未提供"));
  parts.push("所属行业：" + (info.industry || "未提供"));
  if (info.mainProducts) parts.push("主营产品/服务：" + info.mainProducts);
  if (info.businessForm) {
    const viHints: Record<string, string> = {
      "路边摊/档口": "该客户是路边摊/档口经营，品牌视觉需要：远距离可识别、色彩饱和度高、图形简洁醒目、接地气、烟火气、适合招牌和包装印刷",
      "小店/夫妻店": "该客户是小店/夫妻店经营，品牌视觉需要：温馨亲切、社区感、有温度、可信赖、适合门头和小物料印刷",
      "门店/商铺": "该客户是门店/商铺经营，品牌视觉需要：专业感、标准化、适合多种物料应用、品牌识别清晰",
      "连锁/品牌": "该客户是连锁/品牌经营，品牌视觉需要：成熟品牌调性、系统化、可扩展、适合多门店统一形象",
      "高端/精品": "该客户是高端/精品经营，品牌视觉需要：品质感、精致、简约大气、适合高端场景展示",
    };
    const hint = viHints[info.businessForm];
    if (hint) parts.push("经营形态提示：" + hint);
    else parts.push("经营形态：" + info.businessForm);
  }
  if (info.province || info.city) parts.push("所在地：" + (info.province || "") + (info.city || ""));
  parts.push("");
  parts.push("### 客户已填写的品牌信息（有则保留润色，无则AI代写）：");
  parts.push("品牌愿景：" + (info.brandVision || "（客户未填写，请AI代写）"));
  parts.push("核心价值：" + (info.coreValues || "（客户未填写，请AI代写）"));
  parts.push("目标市场：" + (info.targetMarket || "（客户未填写，请AI代写）"));
  if (info.logoPhilosophy) parts.push("LOGO设计理念：" + info.logoPhilosophy);
  if (info.mascotPhilosophy) parts.push("IP公仔设计理念：" + info.mascotPhilosophy);
  if (info.brandColors) parts.push("品牌色：" + info.brandColors.primary + " / " + info.brandColors.secondary + " / " + info.brandColors.accent);
  if (info.description) parts.push("补充描述：" + info.description);
  parts.push("");
  parts.push("请基于以上信息进行深度品牌分析。");
  parts.push("");
  parts.push("重要：sceneImageSuggestions必须根据具体行业和品牌定制。zh字段是中文标签，en字段是英文生图prompt。prompt必须明确描述产品上印有品牌标识。");
  parts.push("");
  parts.push("重要：logoDesignSuggestions是为没有Logo的客户设计的。请根据品牌名称、行业特征，设计4个不同方向的Logo方案。每个prompt需要是完整的英文AI生图指令，详细描述设计风格、核心图形元素、配色方案、排版布局。");
  return parts.join("\n");
}

const SCENE_MATERIALS: Record<IndustryType, Record<string, { title: string; items: string[] }>> = {
  restaurant: { stationery: { title: "餐饮应用系统", items: ["餐巾纸套 / 筷子套", "围裙 / 工服"] }, packaging: { title: "餐饮包装系统", items: ["外卖袋 / 手提袋", "打包盒"] }, marketing: { title: "餐饮营销系统", items: ["促销海报 / 展架", "评价卡 / 立牌"] } },
  fastfood: { stationery: { title: "快餐应用系统", items: ["围裙 / 工服", "点餐单"] }, packaging: { title: "快餐包装系统", items: ["外卖袋 / 手提袋", "汉堡盒 / 饮料杯"] }, marketing: { title: "快餐营销系统", items: ["招牌灯箱", "促销海报 / 立牌"] } },
  beverage: { stationery: { title: "茶饮应用系统", items: ["杯套 / 外带杯", "围裙"] }, packaging: { title: "茶饮包装系统", items: ["手提袋", "饮品瓶标签"] }, marketing: { title: "茶饮营销系统", items: ["促销海报", "会员卡"] } },
  beauty: { stationery: { title: "美容应用系统", items: ["产品包装瓶", "预约卡"] }, packaging: { title: "美容包装系统", items: ["礼品袋", "产品标签"] }, marketing: { title: "美容营销系统", items: ["促销海报", "会员卡"] } },
  retail: { stationery: { title: "零售应用系统", items: ["名片", "价签吊牌"] }, packaging: { title: "零售包装系统", items: ["购物袋", "产品包装盒"] }, marketing: { title: "零售营销系统", items: ["促销海报", "货架展示卡"] } },
  education: { stationery: { title: "教育应用系统", items: ["工牌 / 胸卡", "信纸抬头"] }, packaging: { title: "教育包装系统", items: ["帆布袋", "课程资料夹"] }, marketing: { title: "教育营销系统", items: ["招生海报", "活动展架"] } },
  general: { stationery: { title: "办公应用系统", items: ["名片", "信纸"] }, packaging: { title: "产品包装系统", items: ["手提袋", "包装盒"] }, marketing: { title: "营销展示系统", items: ["促销海报", "工牌"] } },
  fashion: { stationery: { title: "时尚应用系统", items: ["吊牌/标签", "购物袋"] }, packaging: { title: "时尚包装系统", items: ["礼品盒", "手提袋"] }, marketing: { title: "时尚营销系统", items: ["新品海报", "橱窗展示"] } },
  mother_baby: { stationery: { title: "母婴应用系统", items: ["产品标签", "会员卡"] }, packaging: { title: "母婴包装系统", items: ["礼盒", "手提袋"] }, marketing: { title: "母婴营销系统", items: ["促销海报", "活动展架"] } },
  wedding: { stationery: { title: "婚庆应用系统", items: ["请柬", "席位卡"] }, packaging: { title: "婚庆包装系统", items: ["喜糖盒", "伴手礼袋"] }, marketing: { title: "婚庆营销系统", items: ["婚礼海报", "展示架"] } },
  fitness: { stationery: { title: "健身应用系统", items: ["会员卡", "毛巾标识"] }, packaging: { title: "健身包装系统", items: ["运动水杯", "健身包"] }, marketing: { title: "健身营销系统", items: ["促销海报", "课程表"] } },
  pharmacy: { stationery: { title: "药房应用系统", items: ["处方袋", "药盒标签"] }, packaging: { title: "药房包装系统", items: ["手提袋", "保健礼盒"] }, marketing: { title: "药房营销系统", items: ["健康海报", "会员卡"] } },
  pet: { stationery: { title: "宠物应用系统", items: ["宠物牌", "会员卡"] }, packaging: { title: "宠物包装系统", items: ["宠物食品袋", "礼盒"] }, marketing: { title: "宠物营销系统", items: ["促销海报", "活动展架"] } },
};

const INDUSTRY_LABELS: Record<IndustryType, { label: string; icon: string }> = {
  restaurant: { label: "餐饮行业", icon: "🍜" }, fastfood: { label: "快餐行业", icon: "🍔" }, beverage: { label: "饮品行业", icon: "🥤" },
  beauty: { label: "美容行业", icon: "💅" }, retail: { label: "零售行业", icon: "🛍️" },
  education: { label: "教育行业", icon: "📚" }, general: { label: "通用行业", icon: "🏢" },
  fashion: { label: "时尚行业", icon: "👗" }, mother_baby: { label: "母婴行业", icon: "👶" },
  wedding: { label: "婚庆行业", icon: "💒" }, fitness: { label: "健身行业", icon: "💪" },
  pharmacy: { label: "药房行业", icon: "💊" }, pet: { label: "宠物行业", icon: "🐾" },
};

const PAGE_LIST: Record<IndustryType, string[]> = {
  restaurant: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","餐饮应用","餐饮包装","餐饮营销","总结","感谢观看"],
  fastfood: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","快餐应用","快餐包装","快餐营销","总结","感谢观看"],
  beverage: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","茶饮应用","茶饮包装","茶饮营销","总结","感谢观看"],
  beauty: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","美容应用","美容包装","美容营销","总结","感谢观看"],
  retail: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","零售应用","零售包装","零售营销","总结","感谢观看"],
  education: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","教育应用","教育包装","教育营销","总结","感谢观看"],
  general: ["封面","目录","品牌理念","标识诠释","标准色彩","字体系统","基础规范","办公应用","产品包装","营销展示","总结","感谢观看"],
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

    const { data: project } = await supabaseAdmin.from("projects").select("id, submission_id, client_info").eq("id", projectId).single();
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
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const shouldRunDeepSeek = apiKey && companyName !== "品牌";
    
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

      // Fire-and-forget background DeepSeek call
      void (async () => {
        try {
          const analysisPrompt = buildBrandAnalysisPrompt({
            companyName, industry, mainProducts, businessForm, brandVision, coreValues, targetMarket,
            logoPhilosophy, mascotPhilosophy,
            province: body.clientInfo?.province || submission?.province,
            city: body.clientInfo?.city || submission?.city,
            description: body.clientInfo?.description || submission?.description,
            brandColors: { primary: primaryColor, secondary: defaults.secondary, accent: defaults.accent },
          });

          console.log("[analyze-brand BG] Calling DeepSeek for:", companyName);
          const analysisResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
                { role: "user", content: analysisPrompt },
              ],
              temperature: 0.7,
              max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(90000),
          });

          if (analysisResp.ok) {
            const analysisData = await analysisResp.json();
            const analysisContent = analysisData.choices?.[0]?.message?.content || "{}";
            const cleaned = analysisContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            const brandProfile = JSON.parse(cleaned);
            console.log("[analyze-brand BG] DeepSeek OK, logoDesignSuggestions:", brandProfile.logoDesignSuggestions ? "YES" : "NO");

            // Save to DB
            const { data: latestProject } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
            const existingInfo = (latestProject?.client_info as Record<string, any>) || {};
            const existingBP = (existingInfo.brandProfile as Record<string, any>) || {};
            await supabaseAdmin.from("projects").update({
              client_info: {
                ...existingInfo,
                companyName: companyName || existingInfo.companyName || null,
                industry: industry || existingInfo.industry || null,
                brandProfile: {
                  ...brandProfile,
                  analysisStatus: "completed",
                  analyzedAt: new Date().toISOString(),
                  selectedLogo: existingBP.selectedLogo || null,
                  logoGenerationResults: existingBP.logoGenerationResults || null,
                  logoGeneratedAt: existingBP.logoGeneratedAt || null,
                }
              }
            }).eq("id", projectId);
            console.log("[analyze-brand BG] Saved brandProfile to DB for", projectId);
          } else {
            console.warn("[analyze-brand BG] DeepSeek failed:", analysisResp.status);
            // Mark as failed
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
          }
        } catch (err: any) {
          console.warn("[analyze-brand BG] Error:", err?.message);
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
