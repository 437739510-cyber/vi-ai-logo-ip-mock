/**
 * AI Layout Planner
 *
 * 用 DeepSeek AI 动态生成页面布局。
 * 当 AI 调用失败或格式不对时，自动回退到硬编码布局。
 *
 * 调用流程：
 *   planLayoutWithAI(pageId, context)
 *     → 调用 plan-layout-engine（直接调用，不走 HTTP）
 *     → 成功 → 验证 JSON 格式 → 返回 PageElement[]
 *     → 失败 → 返回 null（调用方走 fallback 硬编码）
 */
import type { PageElement } from "./page-planner";
import { planLayoutEngine } from "./plan-layout-engine";

/** AI 布局规划的输入上下文 */
export interface AILayoutContext {
  companyName: string;
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  brandColors?: {
    primary: { hex: string; name?: string };
    secondary: { hex: string; name?: string };
    accent: { hex: string; name?: string };
  };
  hasLogo?: boolean;
  logoElements?: string[];
  logoMeaning?: string;
  logoStyleTags?: string[];
  hasMascot?: boolean;
  mascotName?: string;
  mascotStyle?: string;
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
    const result = await planLayoutEngine({
      pageId,
      companyName: ctx.companyName || "",
      brandVision: ctx.brandVision || "",
      coreValues: ctx.coreValues || "",
      targetMarket: ctx.targetMarket || "",
      brandColors: ctx.brandColors || undefined,
      hasLogo: ctx.hasLogo || false,
      hasMascot: ctx.hasMascot || false,
      mascotName: ctx.mascotName || "",
      mascotStyle: ctx.mascotStyle || "",
      mascotPersonality: ctx.mascotPersonality || "",
      logoElements: ctx.logoElements || [],
      logoMeaning: ctx.logoMeaning || "",
      logoStyleTags: ctx.logoStyleTags || [],
    });

    if (!result.success || !Array.isArray(result.elements) || result.elements.length === 0) {
      console.warn("[AILayoutPlanner] Engine returned no valid elements:", result.error);
      return null;
    }

    // 验证每个元素
    const validTypes = new Set(["logo", "text", "ip-mascot", "color-swatch", "decoration", "divider", "image"]);
    const validPositions = new Set(["top-center", "center", "bottom-center", "bottom-right", "left", "right"]);

    const elements: PageElement[] = result.elements.filter((el: any) => {
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
