/**
 * AI Layout Planner
 *
 * 鐢?DeepSeek AI 鍔ㄦ€佺敓鎴愰〉闈㈠竷灞€銆? * 褰?AI 璋冪敤澶辫触鎴栨牸寮忎笉瀵规椂锛岃嚜鍔ㄥ洖閫€鍒扮‖缂栫爜甯冨眬銆? *
 * 璋冪敤娴佺▼锛? *   planLayoutWithAI(pageId, context)
 *     鈫?璋冪敤 plan-layout-engine锛堢洿鎺ヨ皟鐢紝涓嶈蛋 HTTP锛? *     鈫?鎴愬姛 鈫?楠岃瘉 JSON 鏍煎紡 鈫?杩斿洖 PageElement[]
 *     鈫?澶辫触 鈫?杩斿洖 null锛堣皟鐢ㄦ柟璧?fallback 纭紪鐮侊級
 */
import type { PageElement } from "./page-planner";
import { planLayoutEngine } from "./plan-layout-engine";

/** AI 甯冨眬瑙勫垝鐨勮緭鍏ヤ笂涓嬫枃 */
export interface AILayoutContext {
  companyName: string;
  industry?: string;
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
 * 浣跨敤 AI 瑙勫垝椤甸潰甯冨眬
 * @returns PageElement[] 鎴?null锛堝け璐ユ椂璧?fallback锛? */
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

    // 楠岃瘉姣忎釜鍏冪礌
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
