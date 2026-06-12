/**
 * Brand Discovery Brief API
 * 
 * 根据对话数据生成品牌简报
 * POST /api/discovery/brief
 */

import { NextRequest, NextResponse } from "next/server";
import { ExtractedData, STYLE_OPTIONS } from "@/lib/discovery/state-machine";
import { getSession } from "@/lib/discovery/session-store";

// ============================================
// DeepSeek API 配置
// ============================================

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL_NAME = "deepseek-chat";

// ============================================
// Brand Brief 类型定义
// ============================================

export interface BrandBriefJSON {
  brand_analysis: {
    brandType: string;
    industry: string;
    brandPersona: string;
    visualDirection: string;
    targetAudience: string;
    brandPositioning: string;
    existingAssets: {
      hasLogo: boolean;
      hasMascot: boolean;
      protectedAssets: string[];
    };
  };
  brand_story: {
    origin: string;
    core_value: string;
    signature: string;
    customer_quote: string;
    brand_spirit: string;
  };
  visual_dna: {
    style: string;
    colors: string[];
    elements: string[];
  };
  ip_strategy: {
    decision: "create_new" | "protect_existing" | "optional_recommend" | "not_needed";
    reason: string;
    ip_elements: Record<string, string>;
  };
  package_recommendation: {
    package: string;
    score: number;
    price: number;
  };
  slogan_candidates: string[];
  quality_guard: {
    assetProtection: string;
    generationRules: string[];
  };
}

// ============================================
// DeepSeek API 调用
// ============================================

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  const response = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 生成品牌简报
 */
async function generateBrandBrief(extractedData: ExtractedData): Promise<BrandBriefJSON> {
  const systemPrompt = `你是品牌策略专家，负责根据店主的回答生成结构化的品牌简报（Brand Brief）。

请根据收集到的信息，生成一份完整的品牌简报。输出必须是有效的 JSON 格式。

品牌简报结构说明：

1. brand_analysis（品牌分析）
   - brandType: 品牌类型，如"餐饮"、"零售"、"服务"等
   - industry: 具体行业
   - brandPersona: 品牌个性描述（3-5个关键词）
   - visualDirection: 视觉方向建议
   - targetAudience: 目标客群
   - brandPositioning: 品牌定位语（一句话）
   - existingAssets: 现有资产情况

2. brand_story（品牌故事）
   - origin: 品牌起源故事
   - core_value: 核心价值观
   - signature: 标志性特色
   - customer_quote: 顾客的一句话（从收集的信息中提炼）
   - brand_spirit: 品牌精神

3. visual_dna（视觉基因）
   - style: 推荐风格
   - colors: 推荐配色（4-6个颜色）
   - elements: 视觉元素建议

4. ip_strategy（IP策略）
   - decision: IP创建决策（create_new/protect_existing/optional_recommend/not_needed）
   - reason: 决策理由
   - ip_elements: IP元素建议

5. package_recommendation（套餐推荐）
   - package: 推荐套餐名称
   - score: 匹配度评分(0-100)
   - price: 价格区间

6. slogan_candidates: 口号候选（3-5个）

7. quality_guard（品质保障）
   - assetProtection: 资产保护建议
   - generationRules: 生成规则

请确保输出是有效的 JSON，不要包含任何解释文字。`;

  // 构建用户信息摘要
  const userInfoSummary = `
店铺基本信息：
- 开店年限：${extractedData.yearsInBusiness || "未知"}年
- 创始人：${extractedData.founder || "未知"}
- 店铺历史：${extractedData.storeHistory || extractedData.familyStory || "未知"}

客人来店原因：
${extractedData.customerReasons?.join("、") || "未知"}

骄傲时刻：
${extractedData.proudMoment || "未知"}

感人故事/顾客原话：
${extractedData.touchingStory || extractedData.customerQuote || "未知"}

品牌精神：
${extractedData.brandSpirit || extractedData.brandSpiritCustom || "未知"}

标志性物件：
${extractedData.signatureItem || "未知"}

选择的风格：
${extractedData.selectedStyle || "未知"}
${extractedData.styleNotes ? `\n风格备注：${extractedData.styleNotes}` : ""}

照片情况：
- 标志性物件照片：${extractedData.signatureItemPhoto ? "已上传" : "未上传"}
- 招牌照片：${extractedData.signboardPhoto ? "已上传" : "未上传"}
- 店面照片：${extractedData.storefrontPhoto ? "已上传" : "未上传"}
`;

  try {
    const result = await callDeepSeek(systemPrompt, userInfoSummary);
    
    // 提取 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[generateBrandBrief] Error:", error);
  }

  // 降级：生成默认简报
  return generateDefaultBrief(extractedData);
}

/**
 * 生成默认简报（当 API 不可用时）
 */
function generateDefaultBrief(data: ExtractedData): BrandBriefJSON {
  const isOldStore = (data.yearsInBusiness || 0) >= 10;
  
  // 根据风格选项生成推荐
  const styleOption = STYLE_OPTIONS.find(s => 
    data.selectedStyle?.includes(s.name) || 
    data.selectedStyle?.includes(s.id)
  );

  return {
    brand_analysis: {
      brandType: "传统商业",
      industry: "餐饮/零售",
      brandPersona: isOldStore ? "怀旧、亲切、匠心、温暖" : "活力、热情、专业",
      visualDirection: styleOption?.name || "简约高级",
      targetAudience: "周边社区居民为主，兼顾年轻消费者",
      brandPositioning: `${data.founder || "店主"}的${data.brandSpirit || "用心经营"}小店`,
      existingAssets: {
        hasLogo: false,
        hasMascot: false,
        protectedAssets: [],
      },
    },
    brand_story: {
      origin: data.storeHistory || data.familyStory || `一家传承${data.yearsInBusiness || "多"}年的小店`,
      core_value: data.brandSpirit || data.brandSpiritCustom || "用心做好每一件事",
      signature: data.signatureItem || "待挖掘",
      customer_quote: data.customerQuote || "待收集",
      brand_spirit: data.brandSpirit || data.brandSpiritCustom || "待定义",
    },
    visual_dna: {
      style: styleOption?.name || "简约高级",
      colors: getColorsForStyle(styleOption?.id),
      elements: getElementsForStyle(styleOption?.id),
    },
    ip_strategy: {
      decision: isOldStore ? "optional_recommend" : "not_needed",
      reason: isOldStore 
        ? "老店有丰富的故事和传承，适合创作有温度的IP形象"
        : "新店建议先建立基础VI体系，IP可后续考虑",
      ip_elements: {},
    },
    package_recommendation: {
      package: isOldStore ? "老店焕新套餐" : "新店起步套餐",
      score: 75,
      price: isOldStore ? 499 : 99,
    },
    slogan_candidates: generateSlogans(data),
    quality_guard: {
      assetProtection: "建议注册商标，保护品牌名称和Logo",
      generationRules: [
        "保持品牌故事的一致性",
        "视觉风格统一协调",
        "保留核心识别元素",
      ],
    },
  };
}

/**
 * 根据风格获取推荐配色
 */
function getColorsForStyle(styleId?: string): string[] {
  const colorMap: Record<string, string[]> = {
    traditional: ["#8B0000", "#FFD700", "#2F4F4F", "#F5DEB3", "#CD853F"],
    vintage: ["#D2691E", "#F5F5DC", "#696969", "#8B4513", "#A0522D"],
    nature: ["#228B22", "#90EE90", "#F5F5DC", "#8B4513", "#87CEEB"],
    lively: ["#FF4500", "#FFD700", "#FF6347", "#FFFFFF", "#FF69B4"],
    minimal: ["#000000", "#FFFFFF", "#808080", "#C0C0C0", "#2F4F4F"],
    trendy: ["#FF1493", "#00CED1", "#FFD700", "#000000", "#FFFFFF"],
  };
  return colorMap[styleId || "minimal"] || colorMap.minimal;
}

/**
 * 根据风格获取视觉元素
 */
function getElementsForStyle(styleId?: string): string[] {
  const elementMap: Record<string, string[]> = {
    traditional: ["毛笔字", "传统纹样", "水墨", "印章", "祥云"],
    vintage: ["老照片质感", "泛黄纸张", "复古字体", "老式图案"],
    nature: ["植物线条", "手绘风格", "留白", "自然纹理"],
    lively: ["鲜艳色彩", "动态图案", "趣味插画", "热情字体"],
    minimal: ["几何图形", "极简线条", "现代字体", "大面积留白"],
    trendy: ["渐变色", "几何图形", "潮流插画", "动态元素"],
  };
  return elementMap[styleId || "minimal"] || elementMap.minimal;
}

/**
 * 生成口号候选
 */
function generateSlogans(data: ExtractedData): string[] {
  const spirit = data.brandSpirit || data.brandSpiritCustom || "用心";
  const years = data.yearsInBusiness || 5;
  
  return [
    `${years}年匠心，传承好味道`,
    `一口老味道，温暖一座城`,
    `${spirit}，只为遇见你`,
    `老店的温度，你来感受`,
    `用心做好每一份，${years}年不变`,
  ];
}

// ============================================
// API 路由处理
// ============================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // 获取会话（使用共享存储）
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found. Please start a new conversation." },
        { status: 404 }
      );
    }

    // 检查会话是否完成
    if (!session.isComplete) {
      return NextResponse.json(
        { error: "Discovery not complete. Please finish the conversation first." },
        { status: 400 }
      );
    }

    // 生成品牌简报
    const brief = await generateBrandBrief(session.extractedData);

    return NextResponse.json({
      brief,
      sessionId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API/discovery/brief] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate brief",
      },
      { status: 200 }
    );
  }
}
