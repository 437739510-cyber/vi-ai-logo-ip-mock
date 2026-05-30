/**
 * API Route: POST /api/ai/plan-layout
 *
 * AI Layout Planner
 * 使用 DeepSeek 根据客户资料 + 品牌色 + 页面类型 + 设计规则，生成动态布局。
 * 返回符合 PageElement[] 结构的 JSON 数组。
 *
 * 这是 Phase 10 "AI 布局智能体"的核心 API。
 */
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const {
      pageId,
      companyName,
      brandVision,
      coreValues,
      targetMarket,
      brandColors,
      hasLogo,
      hasMascot,
      mascotName,
      mascotStyle,
      mascotPersonality,
      logoElements,
      logoMeaning,
      logoStyleTags,
    } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 });
    }

    const priHex = brandColors?.primary?.hex || "#1A73E8";
    const secHex = brandColors?.secondary?.hex || "#34A853";
    const accHex = brandColors?.accent?.hex || "#FBBC04";

    // 构建页面上下文信息
    const pageContext = buildPageContext(pageId, {
      companyName, brandVision, coreValues, targetMarket,
      priHex, secHex, accHex,
      hasLogo, hasMascot, mascotName, mascotStyle, mascotPersonality,
      logoElements, logoMeaning, logoStyleTags,
    });

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
            content: `你是一位资深品牌 VI 设计师。你的任务是为企业 VI 手册的每一页设计布局。
你收到页面的品牌信息和内容后，输出页面元素的定位和样式。
页面尺寸为 1024×1024 像素。

品牌主色: ${priHex}
品牌辅助色: ${secHex}
品牌强调色: ${accHex}

## 设计规则（必须遵守）
- 品牌色在页面中占主导地位
- 一页不超过 3 种字重
- LOGO 四周保留 15% 保护空间
- 文本必须有足够对比度
- 页面边缘保留 5-10% 留白
- 装饰元素不得遮挡主要信息
- 每页最多使用一个 IP 公仔

## 输出格式
返回 JSON 数组，每个元素对象包含：
{
  "type": "logo|text|ip-mascot|color-swatch|decoration|divider|image",
  "id": "唯一标识",
  "content": "文本内容（仅 text 类型需要）",
  "position": "top-center|center|bottom-center|bottom-right|left|right",
  "xPct": 0-100（可选）,
  "yPct": 0-100（可选）,
  "widthPct": 0-100,
  "heightPct": 0-100,
  "marginTop": 像素值,
  "marginBottom": 像素值,
  "marginLeft": 像素值,
  "marginRight": 像素值,
  "fontSize": 字号,
  "fontWeight": 400|500|600|700,
  "color": "十六进制颜色",
  "opacity": 0-1,
  "shadow": true|false
}

只输出 JSON 数组，不要 markdown 包裹。`,
          },
          {
            role: "user",
            content: `请为 "${pageId}" 页设计布局。\n\n${pageContext}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error("DeepSeek error: " + resp.status + " " + errText);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // 解析 JSON
    let elements: any[];
    try {
      // 尝试直接解析，可能被 markdown 包裹
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      elements = JSON.parse(cleaned);
      if (!Array.isArray(elements)) {
        elements = [elements];
      }
    } catch {
      console.warn("[plan-layout] Failed to parse AI response:", content.substring(0, 200));
      return NextResponse.json({ error: "Failed to parse AI layout" }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      pageId,
      elements,
      count: elements.length,
    });
  } catch (error) {
    console.error("[plan-layout] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Layout planning failed",
    }, { status: 500 });
  }
}

/**
 * 根据页面类型 + 品牌信息，构建发给 AI 的页面上下文
 */
function buildPageContext(pageId: string, ctx: any): string {
  const pageLabels: Record<string, string> = {
    cover: "封面",
    "brand-philosophy": "品牌核心理念",
    "logo-interpretation": "标识诠释",
    "brand-colors": "标准色彩规范",
    typography: "字体系统",
    "basic-spec": "基础规范",
    stationery: "办公应用系统",
    packaging: "产品包装系统",
    marketing: "营销展示系统",
    summary: "总结",
    closing: "感谢观看",
  };

  const pageDescriptions: Record<string, string> = {
    cover: "企业 VI 手册的封面。包含品牌 LOGO、公司名称、副标题'品牌视觉识别系统 (VI) 规范手册'、底部版权信息。",
    "brand-philosophy": "展示品牌核心理念。包含品牌愿景、核心价值、目标市场三个板块，用分隔线隔开。",
    "logo-interpretation": "标识诠释页。展示 LOGO 设计元素拆解和设计含义，以及 IP 公仔角色介绍。",
    "brand-colors": "品牌色彩规范。展示主色、辅助色、强调色的色块和色值。",
    typography: "字体系统。展示中文和英文字体名称、字号层级表。",
    "basic-spec": "基础规范。展示 LOGO 保护空间和最小使用尺寸。",
    stationery: "办公应用系统。展示名片、信纸等商务场景。",
    packaging: "产品包装系统。展示产品包装场景应用。",
    marketing: "营销展示系统。展示营销海报等应用场景。",
    summary: "总结页。回顾品牌定位、核心价值和三大原则（一致性/专业性/持续性）。",
    closing: "感谢观看页。深色背景，公司名和版权信息。",
  };

  let context = `## 页面：${pageLabels[pageId] || pageId}\n`;
  context += `描述：${pageDescriptions[pageId] || ""}\n\n`;

  context += `公司名称：${ctx.companyName || "品牌名称"}\n`;
  if (ctx.brandVision) context += `品牌愿景：${ctx.brandVision}\n`;
  if (ctx.coreValues) context += `核心价值：${ctx.coreValues}\n`;
  if (ctx.targetMarket) context += `目标市场：${ctx.targetMarket}\n`;
  if (ctx.logoMeaning) context += `LOGO 设计含义：${ctx.logoMeaning}\n`;

  context += `\n品牌色：主色 ${ctx.priHex}，辅助色 ${ctx.secHex}，强调色 ${ctx.accHex}\n`;

  if (ctx.hasLogo && ctx.logoElements?.length) {
    context += `LOGO 元素：${ctx.logoElements.join("、")}\n`;
  }
  if (ctx.hasLogo && ctx.logoStyleTags?.length) {
    context += `LOGO 风格：${ctx.logoStyleTags.join("、")}\n`;
  }

  if (ctx.hasMascot) {
    context += `IP 公仔：${ctx.mascotName || "未命名"}`;
    if (ctx.mascotStyle) context += `，风格 ${ctx.mascotStyle}`;
    if (ctx.mascotPersonality) context += `，性格 ${ctx.mascotPersonality}`;
    context += "\n";
  }

  // 页面特定需求
  if (pageId === "cover") {
    context += `\n封面要求：LOGO 居中，公司名 40-48px 加粗白色文字，副标题 22px，底部品牌管理部版权信息。深色品牌色背景。`;
  } else if (pageId === "closing") {
    context += `\n封底要求：深色品牌色背景，白色文字居中显示"感谢观看"，底部装饰条。`;
  } else if (pageId === "brand-colors") {
    context += `\n色块要求：三个色块横向排列（主色/辅助色/强调色），标注 HEX 色值。`;
  } else if (pageId === "basic-spec") {
    context += `\nLOGO 保护空间：四周 15%。标注最小使用尺寸（印刷 8mm / 屏幕 24px）。`;
  }

  return context;
}
