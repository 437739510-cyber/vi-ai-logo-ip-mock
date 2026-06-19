/**
 * API Route: POST /api/ai/brand-analysis
 *
 * AI 品牌分析引擎 — 补全"信息断层"的核心层
 * 
 * V55优化：Supabase查询从7次→4次
 * - 合并Query1+2: 一次查projects获取client_info+submission_id
 * - 消除Query5: 复用已有的existingCI数据，不再重复查询
 * - 合并Query6+7: status和client_info一次update写入
 * 
 * 输入：客户原始信息（公司名、行业、地理位置、品牌愿景等）
 * 处理：DeepSeek 分析 → 行业洞察、地理环境、竞品格局、品牌定位
 * 输出：品牌档案 JSON → 存入 projects.client_info (JSONB)
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { guardedDeepSeekCall } from '@/lib/core/billing/deepseek-guard';


export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, projectId, clientInfo } = body;

    if (!projectId || !clientInfo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // V55: 一次查询获取 client_info + submission_id（合并原Query1+2）
    const { data: existingProject } = await supabaseAdmin
      .from("projects").select("client_info, submission_id, client_name, industry").eq("id", projectId).single();
    const existingCI = (existingProject?.client_info as Record<string, any>) || {};
    const existingBP = existingCI.brandProfile;
    
    if (existingBP?.brandToneKeywords?.length > 0) {
      console.log("[brand-analysis] Reusing existing brand analysis — skipped DeepSeek call");
      return NextResponse.json({
        success: true,
        profile: { ...existingBP, submissionId, projectId },
        reused: true,
      });
    }

    console.log("[brand-analysis] Analyzing:", clientInfo.companyName, "| Industry:", clientInfo.industry);

    // Auto-fill from submission if clientInfo is incomplete
    if (!clientInfo.companyName || !clientInfo.industry) {
      if (existingProject?.submission_id) {
        const { data: sub } = await supabaseAdmin.from("submissions").select("*").eq("id", existingProject.submission_id).single();
        if (sub) {
          clientInfo.companyName = clientInfo.companyName || sub.company_name || existingProject.client_name || "";
          clientInfo.industry = clientInfo.industry || sub.industry || existingProject.industry || "";
          clientInfo.province = clientInfo.province || sub.province || "";
          clientInfo.city = clientInfo.city || sub.city || "";
          clientInfo.brandVision = clientInfo.brandVision || sub.brand_vision || "";
          clientInfo.coreValues = clientInfo.coreValues || sub.core_values || "";
          clientInfo.targetMarket = clientInfo.targetMarket || sub.target_market || "";
          clientInfo.description = clientInfo.description || sub.description || "";
          clientInfo.mainProducts = clientInfo.mainProducts || sub.main_products || "";
          clientInfo.brandPersonality = clientInfo.brandPersonality || sub.brand_personality || "";
          clientInfo.logoUsage = clientInfo.logoUsage || sub.logo_usage || "";
          clientInfo.logoStyle = clientInfo.logoStyle || sub.logo_style || "";
          clientInfo.avoidElements = clientInfo.avoidElements || sub.avoid_elements || "";
          clientInfo.existingSignagePain = clientInfo.existingSignagePain || sub.existing_signage_pain || "";
          clientInfo.competitorReference = clientInfo.competitorReference || sub.competitor_reference || "";
          clientInfo.customerProfile = clientInfo.customerProfile || sub.customer_profile || "";
          clientInfo.existingBrandColor = clientInfo.existingBrandColor || sub.existing_brand_color || "";
          clientInfo.brandHighlight = clientInfo.brandHighlight || sub.brand_highlight || "";
          clientInfo.businessForm = clientInfo.businessForm || sub.business_form || "";
          clientInfo.budgetRange = clientInfo.budgetRange || sub.budget_range || "";
          clientInfo.businessYears = clientInfo.businessYears || sub.business_years;
        }
      }
    }
    // 更新项目状态为"品牌分析中"
    await supabaseAdmin.from("projects").update({ status: "brand_analyzing", updated_at: new Date().toISOString() }).eq("id", projectId);

    // 构建分析prompt
    const analysisPrompt = buildAnalysisPrompt(clientInfo);

    // 调用 DeepSeek
    const resp = await guardedDeepSeekCall({
      route: "ai/brand-analysis",
      body: {model: "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content: `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

## 分析框架

### 1. 行业洞察
- 该行业的市场趋势、增长方向
- 行业痛点与机会
- 技术变革对行业的影响

### 2. 地理环境分析
- 所在地区的商业环境与资源优势
- 地域文化对品牌的影响
- 区域市场的特殊性

### 3. 竞品格局
- 主要竞品及其市场定位
- 竞品的视觉风格与传播策略
- 差异化机会

### 4. 品牌定位建议
- 基于以上分析的差异化定位方向
- 品牌独特价值主张(UVP)
- 品牌调性关键词（3-5个形容词）

### 5. 文案补全
- 如果客户没有填写品牌愿景、核心价值、目标市场，请根据行业和公司信息代写
- 如果客户已填写，请优化润色，保留客户原意

### 6. 视觉方向建议
- 【必填】colorPalette必须输出3个具体hex色值（主色、辅助色、强调色），如果客户已有品牌色则必须优先使用客户品牌色。每个色的meaning必须说明该色与品牌定位/行业特征的关联（如"深墨绿呼应中医经络的专业与沉稳"），不可写泛泛的"温暖""活力"等空话
- 推荐的视觉风格（如极简、国潮、科技感等）
- VI应用效果图建议（5个场景，必须是品牌Logo/视觉元素印在该行业真实使用的品牌物料上的效果图，场景品类根据客户行业动态决定，中英文对照）
- sceneSectionTitles：3个场景页的中文标题，必须根据客户行业动态生成（如餐饮→"餐饮应用系统/餐饮包装系统/餐饮营销系统"，水果→"生鲜应用系统/生鲜包装系统/生鲜营销系统"，洗车→"洗车应用系统/洗车包装系统/洗车营销系统"）

### 7. Logo设计建议（为客户没有Logo的情况）
- 根据品牌名称、行业特征、地域文化特色，设计4个不同方向的Logo方案
- 每个方案需包含完整英文AI生图prompt，描述设计风格、核心图形元素、配色方案、排版布局
- Logo需简洁、辨识度高、适合各种尺寸应用

## 输出格式
返回严格JSON，不要markdown包裹：
{
  "industryInsight": "行业洞察内容，2-3句话",
  "geoEnvironment": "地理环境分析，2-3句话",
  "competitiveLandscape": "竞品格局，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景，一句话",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场，一句话",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议，2-3句话",
  "sceneImageSuggestions": [
    {"zh": "【该行业物料1，如餐饮→筷子套、水果→水果贴纸、美甲→色板卡】", "en": "Professional product photography of a branded [行业物料] with company logo clearly printed, studio lighting, product fully visible"},
    {"zh": "【该行业物料2，如餐饮→外卖袋、水果→果篮包装、零售→手提袋】", "en": "Professional product photography of a branded [行业物料] with company logo clearly printed, studio lighting, product fully visible"},
    {"zh": "【该行业物料3，如餐饮→菜单、水果→价格标签、美甲→甲油瓶贴】", "en": "Professional product photography of a branded [行业物料] with company logo clearly printed, studio lighting, product fully visible"},
    {"zh": "【该行业物料4，如餐饮→桌牌、通用→店面招牌】", "en": "Professional product photography of a branded [行业物料] with company logo clearly printed, studio lighting, product fully visible"},
    {"zh": "【该行业物料5，如餐饮→员工围裙、通用→营销海报】", "en": "Professional product photography of a branded [行业物料] with company logo clearly printed, studio lighting, product fully visible"}
  ],
  "sceneSectionTitles": {
    "stationery": "【该行业应用系统标题，如餐饮→餐饮应用系统、水果→生鲜应用系统、洗车→洗车应用系统】",
    "packaging": "【该行业包装系统标题，如餐饮→餐饮包装系统、水果→生鲜包装系统、洗车→洗车包装系统】",
    "marketing": "【该行业营销系统标题，如餐饮→餐饮营销系统、水果→生鲜营销系统、洗车→洗车营销系统】"
  },
  "logoDesignSuggestions": {
    "concept": "Logo设计理念详述：3-5句话，需说明（1）品牌名含义与视觉转化逻辑（2）核心图形元素的选择理由（3）造型与品牌调性的呼应关系（4）整体传达的情感与识别价值",
    "style": "设计风格（如：传统书法、现代简约、国潮、手绘等）",
    "elements": "建议包含的设计元素（图形、符号、字体风格）",
    "colorGuidance": "配色建议，需与品牌色协调",
    "prompts": [
      "英文prompt1：用于AI生图的详细描述，需包含设计风格、核心图形元素、配色方案、布局方式",
      "英文prompt2：同一概念的风格变体",
      "英文prompt3：不同方向的变体",
      "英文prompt4：另一个创意方向"
    ]
  },
  "colorPalette": [
    {"name": "品牌主色", "hex": "#RRGGBB", "oklch": "oklch值", "nameEn": "Primary", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"},
    {"name": "辅助色", "hex": "#RRGGBB", "oklch": "oklch值", "nameEn": "Secondary", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"},
    {"name": "强调色", "hex": "#RRGGBB", "oklch": "oklch值", "nameEn": "Accent", "meaning": "该色彩与品牌定位/行业特征的关联说明，1-2句话"}
  ],
  "aiGeneratedFields": {
    "brandVision": "如果客户没写，AI代写的品牌愿景；如果已写，留空",
    "coreValues": "如果客户没写，AI代写的核心价值；如果已写，留空",
    "targetMarket": "如果客户没写，AI代写的目标市场；如果已写，留空"
  }
}`,
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,},
      timeoutMs: 45000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`DeepSeek error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // 解析JSON
    let profile: any;
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      profile = JSON.parse(cleaned);
    } catch {
      console.warn("[brand-analysis] Failed to parse AI response:", content.substring(0, 200));
      return NextResponse.json({ error: "Failed to parse AI analysis" }, { status: 422 });
    }

    console.log("[brand-analysis] Analysis complete:", profile.brandToneKeywords);

    // V55: 复用existingCI（已在开头查询），不再重复查projects
    const updatedInfo = {
      ...existingCI,
      // 原始客户信息
      companyName: clientInfo.companyName || existingCI.companyName,
      industry: clientInfo.industry || existingCI.industry,
      province: clientInfo.province || existingCI.province,
      city: clientInfo.city || existingCI.city,
      brandVision: clientInfo.brandVision || existingCI.brandVision,
      coreValues: clientInfo.coreValues || existingCI.coreValues,
      targetMarket: clientInfo.targetMarket || existingCI.targetMarket,
      logoPhilosophy: clientInfo.logoPhilosophy || existingCI.logoPhilosophy,
      mascotPhilosophy: clientInfo.mascotPhilosophy || existingCI.mascotPhilosophy,
      description: clientInfo.description || existingCI.description,
      // AI品牌档案
      brandProfile: {
        industryInsight: profile.industryInsight || "",
        geoEnvironment: profile.geoEnvironment || "",
        competitiveLandscape: profile.competitiveLandscape || "",
        brandPositioning: profile.brandPositioning || "",
        refinedBrandVision: profile.refinedBrandVision || "",
        refinedCoreValues: profile.refinedCoreValues || "",
        refinedTargetMarket: profile.refinedTargetMarket || "",
        brandToneKeywords: profile.brandToneKeywords || [],
        visualStyleSuggestion: profile.visualStyleSuggestion || "",
        sceneImageSuggestions: profile.sceneImageSuggestions || [],
        sceneSectionTitles: profile.sceneSectionTitles || null,
        logoDesignSuggestions: profile.logoDesignSuggestions || null,
        colorPalette: profile.colorPalette || null,  // V103: 保存AI色彩方案
        aiGeneratedFields: profile.aiGeneratedFields || {},
        analysisStatus: "completed",
        analyzedAt: new Date().toISOString(),
      },
    };

    // V55: 合并status和client_info为一次update（原Query6+7→1次）
    const { error: dbError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "brand_analyzed", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (dbError) {
      console.warn("[brand-analysis] DB save failed:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        submissionId,
        projectId,
      },
    });
  } catch (error) {
    console.error("[brand-analysis] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Brand analysis failed",
    }, { status: 500 });
  }
}

function buildAnalysisPrompt(clientInfo: any): string {
  const parts = [
    `## 客户品牌基础信息`,
    ``,
    `公司名称：${clientInfo.companyName || "未提供"}`,
    `所属行业：${clientInfo.industry || "未提供"}`,
  ];

  if (clientInfo.province || clientInfo.city) {
    parts.push(`所在地：${clientInfo.province || ""}${clientInfo.city || ""}`);
  }

  parts.push("");
  parts.push("### 客户已填写的品牌信息（有则保留润色，无则AI代写）：");

  if (clientInfo.brandVision) {
    parts.push(`品牌愿景：${clientInfo.brandVision}`);
  } else {
    parts.push(`品牌愿景：（客户未填写，请AI代写）`);
  }

  if (clientInfo.coreValues) {
    parts.push(`核心价值：${clientInfo.coreValues}`);
  } else {
    parts.push(`核心价值：（客户未填写，请AI代写）`);
  }

  if (clientInfo.targetMarket) {
    parts.push(`目标市场：${clientInfo.targetMarket}`);
  } else {
    parts.push(`目标市场：（客户未填写，请AI代写）`);
  }

  if (clientInfo.logoPhilosophy) {
    parts.push(`LOGO设计理念：${clientInfo.logoPhilosophy}`);
  }

  if (clientInfo.mascotPhilosophy) {
    parts.push(`IP公仔设计理念：${clientInfo.mascotPhilosophy}`);
  }

  if (clientInfo.brandColors) {
    const bc = clientInfo.brandColors;
    parts.push(`品牌色：${bc.primary || "未定"} / ${bc.secondary || "未定"} / ${bc.accent || "未定"}`);
  }

  if (clientInfo.brandPersonality) {
    parts.push(`品牌个性：${clientInfo.brandPersonality}`);
  }
  if (clientInfo.logoStyle) {
    parts.push(`Logo图形偏好：${clientInfo.logoStyle}`);
  }
  if (clientInfo.logoUsage) {
    parts.push(`Logo主要用途：${clientInfo.logoUsage}`);
  }
  if (clientInfo.avoidElements) {
    parts.push(`设计禁忌（避免出现）：${clientInfo.avoidElements}`);
  }
  if (clientInfo.existingSignagePain) {
    parts.push(`现有门头最不满意：${clientInfo.existingSignagePain}`);
  }
  if (clientInfo.existingBrandColor) {
    parts.push(`现有门头颜色：${clientInfo.existingBrandColor}`);
  }
  if (clientInfo.competitorReference) {
    parts.push(`喜欢的竞品/参考品牌：${clientInfo.competitorReference}`);
  }
  if (clientInfo.customerProfile) {
    parts.push(`常见客户群体：${clientInfo.customerProfile}`);
  }
  if (clientInfo.brandHighlight) {
    parts.push(`品牌独特点：${clientInfo.brandHighlight}`);
  }
  if (clientInfo.businessForm) {
    parts.push(`经营形态：${clientInfo.businessForm}`);
  }
  if (clientInfo.budgetRange) {
    parts.push(`预算范围：${clientInfo.budgetRange}`);
  }
  if (clientInfo.businessYears) {
    parts.push(`经营年限：${clientInfo.businessYears}年`);
  }
  if (clientInfo.mainProducts) {
    parts.push(`主营产品：${clientInfo.mainProducts}`);
  }
  if (clientInfo.description) {
    parts.push(`补充描述：${clientInfo.description}`);
  }

  parts.push("");
  parts.push("请基于以上信息，进行深度品牌分析，输出品牌档案JSON。");

  return parts.join("\n");
}
