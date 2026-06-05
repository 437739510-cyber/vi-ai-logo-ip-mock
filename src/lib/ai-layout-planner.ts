/**
 * AI Layout Planner
 *
 * Phase 10 核心模块：用 DeepSeek AI 动态生成页面布局。
 * 当 AI 调用失败或格式不对时，自动回退到硬编码布局。
 *
 * 调用流程：
 *   planLayoutWithAI(pageId, context)
 *     → 调用 /api/ai/plan-layout
 *     → 成功 → 验证 JSON 格式 → 返回 PageElement[]
 *     → 失败 → 返回 null（调用方走 fallback 硬编码）
 */
import type { PageElement } from "./page-planner";

/** AI 布局规划的输入上下文 */
export interface AILayoutContext {
  /** 公司名称 */
  companyName: string;
  /** 品牌愿景 */
  brandVision?: string;
  /** 核心价值 */
  coreValues?: string;
  /** 目标市场 */
  targetMarket?: string;
  /** 品牌颜色 */
  brandColors?: {
    primary: { hex: string; name?: string };
    secondary: { hex: string; name?: string };
    accent: { hex: string; name?: string };
  };
  /** 是否有 LOGO */
  hasLogo?: boolean;
  /** LOGO 元素 */
  logoElements?: string[];
  /** LOGO 设计含义 */
  logoMeaning?: string;
  /** LOGO 风格标签 */
  logoStyleTags?: string[];
  /** 是否有 IP 公仔 */
  hasMascot?: boolean;
  /** IP 公仔名称 */
  mascotName?: string;
  /** IP 公仔风格 */
  mascotStyle?: string;
  /** IP 公仔性格 */
  mascotPersonality?: string;
}

/**
 * 使用 AI 规划页面布局
 * @returns PageElement[] 或 null（失败时走 fallback）
 */
export async function planLayoutWithAI(
  pageId: string,
  ctx: AILayoutContext
): Promise<PageElement[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const resp = await fetch(baseUrl + "/api/ai/plan-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        companyName: ctx.companyName || "",
        brandVision: ctx.brandVision || "",
        coreValues: ctx.coreValues || "",
        targetMarket: ctx.targetMarket || "",
        brandColors: ctx.brandColors || {},
        hasLogo: ctx.hasLogo || false,
        hasMascot: ctx.hasMascot || false,
        mascotName: ctx.mascotName || "",
        mascotStyle: ctx.mascotStyle || "",
        mascotPersonality: ctx.mascotPersonality || "",
        logoElements: ctx.logoElements || [],
        logoMeaning: ctx.logoMeaning || "",
        logoStyleTags: ctx.logoStyleTags || [],
      }),
      signal: AbortSignal.timeout(50000),
    });

    if (!resp.ok) {
      console.warn("[AILayoutPlanner] API error:", resp.status);
      return null;
    }

    const data = await resp.json();
    if (!data.success || !Array.isArray(data.elements) || data.elements.length === 0) {
      console.warn("[AILayoutPlanner] Invalid response format");
      return null;
    }

    // 验证每个元素
    const validTypes = new Set(["logo", "text", "ip-mascot", "color-swatch", "decoration", "divider", "image"]);
    const validPositions = new Set(["top-center", "center", "bottom-center", "bottom-right", "left", "right"]);

    const elements: PageElement[] = data.elements.filter((el: any) => {
      if (!el.type || !validTypes.has(el.type)) return false;
      if (el.position && !validPositions.has(el.position)) return false;
      return true;
    });

    if (elements.length === 0) {
      console.warn("[AILayoutPlanner] No valid elements in AI response");
      return null;
    }

    return elements;
  } catch (error) {
    console.warn("[AILayoutPlanner] Failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
