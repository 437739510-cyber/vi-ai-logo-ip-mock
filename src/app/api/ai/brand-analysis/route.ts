/**
 * API Route: POST /api/ai/brand-analysis
 *
 * AI 品牌分析引擎 — 补全"信息断层"的核心层
 * 
 * 输入：客户原始信息（公司名、行业、地理位置、品牌愿景等）
 * 处理：DeepSeek 分析 → 行业洞察、地理环境、竞品格局、品牌定位
 * 输出：品牌档案 JSON → 存入 projects.client_info (JSONB)
 * 
 * 下游消费：
 * - planPages（蓝图规划）→ 品牌档案内容驱动页面结构
 * - buildScenePrompt（写实图prompt）→ 行业+定位驱动场景描述
 * - ai-layout-planner → 品牌调性驱动布局风格
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, projectId, clientInfo } = body;

    if (!projectId || !clientInfo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 });
    }

    console.log("[brand-analysis] Analyzing:", clientInfo.companyName, "| Industry:", clientInfo.industry);

    // 构建分析prompt
    const analysisPrompt = buildAnalysisPrompt(clientInfo);

    // 调用 DeepSeek
    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
- 适合该行业的色彩倾向
- 推荐的视觉风格（如极简、国潮、科技感等）
- 写实场景图的内容建议（5个场景，要具体到画面内容描述，中英文对照）

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
    {"zh": "中文场景描述", "en": "English scene description for image generation"},
    {"zh": "中文场景描述", "en": "English scene description for image generation"},
    {"zh": "中文场景描述", "en": "English scene description for image generation"},
    {"zh": "中文场景描述", "en": "English scene description for image generation"},
    {"zh": "中文场景描述", "en": "English scene description for image generation"}
  ],
  "logoDesignSuggestions": {
    "concept": "Logo设计核心概念，1-2句话",
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
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(45000),
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

    // 保存到 projects.client_info (JSONB)
    // 获取当前client_info，合并
    const { data: projData } = await supabaseAdmin
      .from("projects")
      .select("client_info")
      .eq("id", projectId)
      .single();

    const existingInfo = (projData?.client_info as Record<string, any>) || {};
    const updatedInfo = {
      ...existingInfo,
      // 原始客户信息
      companyName: clientInfo.companyName || existingInfo.companyName,
      industry: clientInfo.industry || existingInfo.industry,
      province: clientInfo.province || existingInfo.province,
      city: clientInfo.city || existingInfo.city,
      brandVision: clientInfo.brandVision || existingInfo.brandVision,
      coreValues: clientInfo.coreValues || existingInfo.coreValues,
      targetMarket: clientInfo.targetMarket || existingInfo.targetMarket,
      logoPhilosophy: clientInfo.logoPhilosophy || existingInfo.logoPhilosophy,
      mascotPhilosophy: clientInfo.mascotPhilosophy || existingInfo.mascotPhilosophy,
      description: clientInfo.description || existingInfo.description,
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
        logoDesignSuggestions: profile.logoDesignSuggestions || null,
        aiGeneratedFields: profile.aiGeneratedFields || {},
        analyzedAt: new Date().toISOString(),
      },
    };

    const { error: dbError } = await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, updated_at: new Date().toISOString() })
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

  if (clientInfo.description) {
    parts.push(`补充描述：${clientInfo.description}`);
  }

  parts.push("");
  parts.push("请基于以上信息，进行深度品牌分析，输出品牌档案JSON。");

  return parts.join("\n");
}
