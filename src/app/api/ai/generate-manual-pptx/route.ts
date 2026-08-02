/**
 * API: Generate VI Manual PPTX via PptxGenJS Engine V120 (ComfyUI local only)
 *
 * V7 核心改动（在V6基础上）：
 * - 修复行业判定：椰子水→饮品(不是餐饮)，删掉"椰岛"从餐饮正则
 * - V26: 场景图单引擎 — ComfyUI local 5张，Promise.all真正并行
 * - 修复API端点：compatible-mode不支持万相 → 改用DashScope原生异步API
 * - 修复模型名：wanx2.6-image(错) → wan2.6-t2i(纯文生图)
 * - 场景图从7张减为5张（¥0 — ComfyUI local, free）
 * - 异步调用流程：提交任务 → 轮询结果 → 获取URL → 下载base64
 * - 新增analyze-brand共享逻辑
 * - V27: 场景图方舟Ark Seedream图生图优先(Logo做参考) + DashScope降级
 */
import { NextRequest, NextResponse } from "next/server";
// V120: ARK removed, using ComfyUI local only
import { getDefaultRegistry } from "@/lib/ip/ip-image-provider";
import { extractBrandDNA, fillScenePrompts } from "@/lib/vi-manual/deepseek-dna";
import path from "path";
import { readFile, mkdir, writeFile, readdir } from "fs/promises";
import { planPages } from "@/lib/vi-manual/page-planner";
import { normalizeMascotAssetSet } from "@/lib/vi-manual/mascot-assets";
import { renderPptxToBuffer } from "@/lib/pptx/render-pptx";
import { supabaseAdmin } from "@/lib/core/supabase";
import { type IndustryType, getIndustryType, getIndustryDefaults } from "@/lib/brand/industry-types";
import { guardedDeepSeekCall, DEEPSEEK_MODEL } from '@/lib/core/billing/deepseek-guard';
import { getIndustryKnowledge } from "@/lib/brand/industry-knowledge";
import { validateAndBlockAsync, checkColorNarrativeConsistency } from "@/lib/vi-manual/quality-check";
import { extractLogoElements, resolveLogoColorsFromProfile } from "@/lib/vi-manual/brand-visual-rules";
const _DEV = process.env.NODE_ENV === "development";


export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ========== 行业判定（与analyze-brand共享） ==========

// ========== 行业场景图定义（5张/份，¥0 — ComfyUI free） ==========
interface SceneImgDef {
  key: string;
  rawPrompt: string;
  page: string;
}

const SCENE_IMG_DEFS: Record<IndustryType, SceneImgDef[]> = {
  restaurant: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a restaurant napkin sleeve and chopstick cover set, placed on a wooden table, clean minimalist design, studio lighting, top-down angle" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a food delivery paper bag standing on a surface, minimalist design, clean studio background, side angle view" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a takeout food container box with lid, placed on clean surface, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional standee poster display in a restaurant, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a restaurant menu card on a dining table, clean minimal design, studio lighting" },
  ],
  fastfood: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a fast food restaurant apron and staff uniform with branded logo, clean studio background, bright lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded fast food paper bag with logo, hamburger box and drink cup on counter, studio lighting, eye-level angle" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a branded hamburger wrapper and fries container on clean surface, fast food packaging design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fast food storefront sign light box with brand logo, illuminated at night, eye-catching design" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a promotional standee poster for a fast food brand, vibrant colors, studio setting" },
  ],
  beverage: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of branded office stationery set: business cards, envelopes, letterheads with company logo printed, arranged on wooden desk, studio lighting, angled view, product fully visible" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded paper tote bag with company logo printed on it, standing upright, studio lighting, product fully visible" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beverage bottle with branded label and company logo, on clean surface, studio lighting, product fully visible" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional poster display for a beverage brand in store, with company branding visible, studio setting, product fully visible" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded membership card with company logo design, clean studio background, product fully visible" },
  ],
  beauty: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of beauty product bottles and packaging set, elegant minimalist design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded gift bag with ribbon handles, elegant design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beauty product jar with label, clean design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a beauty salon promotional poster, elegant and luxurious style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a VIP membership card with elegant design, clean background" },
  ],
  retail: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded shopping bag with handles, standing on surface, minimalist design, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a retail promotional poster display, modern clean style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a retail price tag with hanging string, clean studio background" },
  ],
  education: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a school ID badge and lanyard, clean design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag for education, brand color design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a course material folder, brand color accent, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of an education enrollment promotional poster, inspiring style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a campus event banner stand, brand color design, studio lighting" },
  ],
  fresh_food: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a fruit price tag label with brand logo, clean design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a fruit sticker label on an apple, brand logo printed, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a fruit gift basket with branded ribbon and packaging, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fruit shop promotional standee, fresh and vibrant style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded paper bag for fruit shop, standing upright, studio lighting" },
  ],
  floral: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a flower shop business card with pressed flower design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a flower bouquet wrapping paper with brand logo printed, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a flower gift box with branded ribbon, elegant design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a flower shop promotional poster, romantic style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded flower pot label tag, clean design, studio lighting" },
  ],
  home: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a home decor brand business card, warm elegant design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a home product packaging box, modern minimalist design, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a branded shopping bag for home store, standing upright, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a home store promotional catalog, warm inviting style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded price tag for home product, clean design, studio lighting" },
  ],
  nail: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a nail salon color palette card with brand logo, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a nail polish bottle with branded label, elegant design, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a nail care product gift bag with brand logo, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a nail salon promotional poster, chic glamorous style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a nail salon appointment card with brand logo, studio lighting" },
  ],
  tea: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a tea brand business card, traditional elegant design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a tea tin canister with branded label, premium design, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a tea gift box set with branded packaging, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a tea house promotional poster, serene traditional style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded tea menu card, elegant typography, studio lighting" },
  ],
  general: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag, standing upright, minimalist design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a corporate promotional poster, modern professional style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a company ID badge, brand color accent, studio lighting" },
  ],
  fashion: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a fashion brand clothing tag and label, luxury minimalist design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a luxury fashion shopping bag, elegant design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a fashion gift box with ribbon, premium look, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fashion new collection poster, modern chic style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a fashion window display card, elegant typography, studio lighting" },
  ],
  mother_baby: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a baby product label and membership card, warm pastel colors, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a baby gift box set, soft pastel packaging, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a mother-baby brand tote bag, cute design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a baby store promotional poster, warm inviting style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a baby event display stand, pastel theme, studio lighting" },
  ],
  wedding: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a wedding invitation card, elegant gold foil design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a wedding favor candy box, romantic design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a wedding gift bag, elegant floral design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a wedding planning poster, romantic elegant style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a wedding venue display stand, luxurious design, studio lighting" },
  ],
  fitness: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a gym membership card and branded towel, modern sporty design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a sports water bottle with brand logo, energetic design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a gym duffel bag with brand identity, modern athletic style, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fitness promotion poster, dynamic energetic style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a fitness class schedule card, modern design, studio lighting" },
  ],
  pharmacy: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a pharmacy prescription bag and medicine box label, clean professional design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a health supplement gift box, professional medical branding, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a pharmacy branded tote bag, clean trustworthy design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a health awareness poster, professional medical style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a pharmacy loyalty card, clean modern design, studio lighting" },
  ],
  pet: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a pet tag and membership card, fun colorful design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a pet food bag with brand identity, premium design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a pet gift box, cute playful design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a pet store promotional poster, fun vibrant style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a pet event display stand, playful design, studio lighting" },
  ],
};

// V95: 中文颜色名→hex映射（客户输入"红色和金色"时能正确解析）
const CN_COLOR_MAP: Record<string, string> = {
  "红": "#D32F2F", "红色": "#D32F2F", "大红": "#D32F2F", "正红": "#D32F2F", "中国红": "#C62828",
  "暗红": "#8B0000", "深红": "#8B0000", "酒红": "#722F37", "玫红": "#E91E63",
  "金": "#F9A825", "金色": "#F9A825", "金黄": "#F9A825", "暗金": "#C9A96E",
  "橙": "#E65100", "橙色": "#E65100", "橘色": "#E65100", "暖橙": "#EF6C00",
  "黄": "#F9A825", "黄色": "#F9A825", "明黄": "#FFD600", "鹅黄": "#FFF9C4",
  "绿": "#2E7D32", "绿色": "#2E7D32", "翠绿": "#00695C", "墨绿": "#1B5E20",
  "蓝": "#1565C0", "蓝色": "#1565C0", "深蓝": "#0D47A1", "天蓝": "#42A5F5",
  "紫": "#7B1FA2", "紫色": "#7B1FA2", "深紫": "#4A148C", "薰衣草": "#9C27B0",
  "粉": "#E8576C", "粉色": "#E8576C", "粉红": "#E8576C", "桃粉": "#F48FB1",
  "棕": "#5D4037", "棕色": "#5D4037", "咖啡": "#5D4037", "深棕": "#3E2723",
  "黑": "#212121", "黑色": "#212121", "墨色": "#1A1A2E",
  "白": "#FFFFFF", "白色": "#FFFFFF",
  "灰": "#78909C", "灰色": "#78909C", "银灰": "#90A4AE", "银": "#90A4AE",
};

function parseChineseColors(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  // 清洗：去掉"色"重复、提取颜色词
  const results: string[] = [];
  // 先尝试提取hex色值
  const hexMatches = text.match(/#[0-9a-fA-F]{6}/g);
  if (hexMatches && hexMatches.length > 0) return hexMatches;
  // 逐词匹配中文颜色名（从长到短匹配）
  const sortedKeys = Object.keys(CN_COLOR_MAP).sort((a, b) => b.length - a.length);
  let remaining = text;
  for (const cn of sortedKeys) {
    if (remaining.includes(cn)) {
      results.push(CN_COLOR_MAP[cn]);
      remaining = remaining.replace(cn, '');
    }
  }
  return results;
}

function normalizeColors(colors: any, industry?: string): { primary: string; secondary: string; accent: string } {
  const defaults = getIndustryDefaults(industry);
  if (!colors) return defaults;
  
  // V95: 处理中文字符串如"红色和金色"
  if (typeof colors === 'string') {
    const parsed = parseChineseColors(colors);
    if (parsed.length > 0) {
      return {
        primary: parsed[0] || defaults.primary,
        secondary: parsed[1] || defaults.secondary,
        accent: parsed[2] || defaults.accent,
      };
    }
    // 不是颜色名，可能是纯hex
    if (/^#[0-9a-fA-F]{6}$/.test(colors)) {
      return { primary: colors, secondary: defaults.secondary, accent: defaults.accent };
    }
    return defaults;
  }
  if (colors.primary?.hex) {
    return {
      primary: colors.primary.hex || defaults.primary,
      secondary: colors.secondary?.hex || defaults.secondary,
      accent: colors.accent?.hex || defaults.accent,
    };
  }
  if (typeof colors.primary === "string" && colors.primary) {
    return {
      primary: colors.primary || defaults.primary,
      secondary: (typeof colors.secondary === "string" ? colors.secondary : defaults.secondary) || defaults.secondary,
      accent: (typeof colors.accent === "string" ? colors.accent : defaults.accent) || defaults.accent,
    };
  }
  if (Array.isArray(colors) && colors.length > 0) {
    return {
      primary: colors[0]?.hex || colors[0] || defaults.primary,
      secondary: (colors[1]?.hex || colors[1] || defaults.secondary) as string,
      accent: (colors[2]?.hex || colors[2] || defaults.accent) as string,
    };
  }
  return defaults;
}

// ========== V103: 品牌专属文案生成 ==========
function buildAuxGraphicsIntro(bp: any, colors: { primary: string; secondary: string; accent: string }, industry?: string): string | undefined {
  if (!bp) return undefined;
  const parts: string[] = [];
  const colorGuidance = bp.logoDesignSuggestions?.colorGuidance;
  if (colorGuidance) {
    parts.push(colorGuidance);
  }
  const style = bp.logoDesignSuggestions?.style || bp.visualStyleSuggestion;
  if (style) {
    parts.push(`视觉风格为${style}，辅助图形与整体风格统一。`);
  }
  if (parts.length > 0) {
    return parts.join('。') + '。条纹组合呼应品牌节奏感，点阵组合传递精致秩序。';
  }
  return undefined;
}

function buildColorMeaning(bp: any, colors: { primary: string; secondary: string; accent: string }, industry?: string): string | undefined {
  if (!bp) return undefined;
  const palette = bp.colorPalette;
  if (Array.isArray(palette) && palette.length >= 3) {
    const primaryMeaning = palette[0]?.meaning || '';
    const secondaryMeaning = palette[1]?.meaning || '';
    const accentMeaning = palette[2]?.meaning || '';
    const parts: string[] = [];
    if (primaryMeaning) parts.push(`品牌主色#${colors.primary}：${primaryMeaning}`);
    if (secondaryMeaning) parts.push(`辅助色#${colors.secondary}：${secondaryMeaning}`);
    if (accentMeaning) parts.push(`强调色#${colors.accent}：${accentMeaning}`);
    if (parts.length > 0) return parts.join('；') + '。';
  }
  // fallback: 用colorGuidance和品牌定位
  const colorGuidance = bp.logoDesignSuggestions?.colorGuidance;
  const positioning = bp.brandPositioning;
  const keywords = bp.brandToneKeywords?.join('、');
  if (colorGuidance || positioning) {
    const parts: string[] = [];
    if (colorGuidance) parts.push(colorGuidance);
    if (positioning && keywords) parts.push(`呼应品牌「${keywords}」的调性定位`);
    if (parts.length > 0) return parts.join('；') + '。三色组合确保品牌视觉的专业性、一致性与识别度。';
  }
  return undefined;
}

// ========== 通义万相 异步图片生成 ==========
// V120: DASHSCOPE_API removed
// V120: DASHSCOPE_TASK removed


// V120: XYQ + uploadBase64ToUrl removed — dead code

// V120: generateSceneImage removed — DashScope API deprecated (no budget)
async function generateSceneImage(prompt: string, logoBase64?: string): Promise<string | null> {
  console.warn("[generate-manual-pptx] generateSceneImage called but DashScope is disabled");
  return null;
}



// V120: generateLogoImage stubbed — logo generation now handled by /api/ai/generate-logo (ComfyUI)
async function generateLogoImage(
  prompt: string,
  brandColors: { primary: string; secondary: string }
): Promise<string | null> {
  console.warn("[generate-manual-pptx] generateLogoImage called but DashScope is disabled");
  return null;
}


// ========== 流式进度推送辅助函数 ==========
function createStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  
  const stream = new ReadableStream({
    start(c) { controller = c; },
    cancel() { /* cleanup */ },
  });

  function sendEvent(type: string, data: any) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}

`));
    } catch { /* stream closed */ }
  }

  function sendProgress(step: string, message: string, percent?: number) {
    sendEvent("progress", { step, message, percent });
  }

  function sendComplete(data: any) {
    sendEvent("complete", { success: true, ...data });
    try { controller.close(); } catch { /* already closed */ }
  }

  function sendError(message: string) {
    sendEvent("error", { message });
    try { controller.close(); } catch { /* already closed */ }
  }

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });

  return { response, sendProgress, sendComplete, sendError };
}


// ========== DB-based progress helpers (for background async tasks) ==========
function createDbProgressHelpers(projectId: string, initialClientInfo: Record<string, any>) {
  // Cache client_info in memory to avoid redundant select before every update
  let cachedClientInfo = { ...initialClientInfo };

  async function updateDb(status: string, message: string, percent?: number, extra?: Record<string, any>) {
    try {
      cachedClientInfo = { ...cachedClientInfo, generationStatus: status, generationMessage: message, generationPercent: percent ?? cachedClientInfo.generationPercent, ...(extra || {}) };
      await supabaseAdmin.from("projects").update({
        client_info: cachedClientInfo,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
    } catch (e: any) {
      console.warn("[generate-pptx] DB status update error:", e.message);
    }
  }

  return {
    sendProgress: (step: string, message: string, percent?: number) => {
      updateDb("pptx_assembling", message, percent);
    },
    sendComplete: async (data: any) => {
      await updateDb("completed", "生成完成！", 100, {
        pptxResult: { url: data.url, storageUrl: data.storageUrl, pageCount: data.pageCount, fileName: data.fileName },
      });
      await supabaseAdmin.from("projects").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", projectId);
    },
    sendError: async (message: string) => {
      await updateDb("failed", message);
      await supabaseAdmin.from("projects").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", projectId);
    },
  };
}

// ========== 主流程（异步后台） ==========
// V97: 根据场景物料中文名动态归类到PPTX页面分类
function mapSceneToPage(zhLabel: string): "stationery" | "packaging" | "marketing" {
  const label = zhLabel.toLowerCase();
  // 包装类：袋、盒、贴纸、杯、瓶、外卖、果篮、筷子套、餐巾等
  if (/包装|袋|盒|贴纸|杯套|杯|瓶|外卖|果篮|筷子套|餐巾/.test(label)) return "packaging";
  // 文具/卡证类：名片、信封、卡、证、文件夹、课程表、色板、标签等
  if (/名片|信封|信纸|文具|证|卡|文件夹|课程表|色板|标签/.test(label)) return "stationery";
  // 默认归marketing：招牌、海报、展架、围裙、菜单、立牌等
  return "marketing";
}

export async function POST(req: NextRequest) {
  // Parse request body first
  let projectId: string | null = null;
  let body: any = {};
  let prev: Record<string, any> = {};  // cached client_info for reducing DB queries
  let step = 'full';  // V83: 'full' = 全流程, 'resume' = 断点续传
  try {
    body = await req.json();
    projectId = body.projectId || null;
    step = body.step || 'full';
    if (!['full', 'resume'].includes(step)) step = 'full';
  } catch { /* ignore parse error */ }

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // V88: 已有完成结果且非强制重新生成 → 直接返回，避免重复烧钱
  const forceRegenerate = body.force === true;
  if (!forceRegenerate && step === 'full') {
    try {
      const { data: existingProject } = await supabaseAdmin.from("projects").select("status, client_info").eq("id", projectId).single();
      const existingCi = (existingProject?.client_info as Record<string, any>) || {};
      const existingResult = existingCi.pptxResult;
      if (existingProject?.status === 'completed' && existingResult?.url && existingResult?.storageUrl) {
        _DEV && console.log(`[generate-pptx] V88: Project ${projectId} already has completed result, skipping. Use force=true to override.`);
        return NextResponse.json({
          status: "already_completed",
          message: "该项目已有完成的VI手册，无需重复生成",
          pptxResult: existingResult,
        }, { status: 200 });
      }
    } catch (e: any) {
      console.warn("[generate-pptx] V88 guard check error:", e.message);
    }
  }

  // Set initial status in DB immediately
  try {
    const { data: existingInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
    prev = (existingInfo?.client_info as Record<string, any>) || {};
    const isResume = step === 'resume';
    const resumePercent = isResume ? (prev.generationPercent || 40) : 0;
    await supabaseAdmin.from("projects").update({
      status: "pptx_assembling",
      updated_at: new Date().toISOString(),
      client_info: { ...prev, generationStatus: "pptx_assembling", generationMessage: isResume ? "正在续传生成..." : "正在准备生成VI手册...", generationPercent: resumePercent },
    }).eq("id", projectId);
  } catch (e: any) {
    console.warn("[generate-pptx] Initial status update error:", e.message);
  }

  // Run generation in background (fire-and-forget)
  void (async () => {
    const { sendProgress, sendComplete, sendError } = createDbProgressHelpers(projectId!, prev);
    const generationId = `gen-${Date.now()}`;
    const arkUsageLog: { model: string; type: string; cost: number; timestamp: string }[] = [];  // V32: 方舟用量追踪
    // V91: 图片成本同步写入api_usage_log
    const flushArkUsageToLog = (projectId: string, clientName: string) => {
      for (const entry of arkUsageLog) {
        supabaseAdmin.from('api_usage_log').insert({
          route: 'generate-manual-pptx',
          model: entry.model,
          cost_cny: entry.cost,
          input_tokens: 0,
          output_tokens: 0,
          project_id: projectId, client_name: clientName, request_summary: entry.type,
          created_at: entry.timestamp,
        }).then(() => {}, () => {});
      }
    };
    const generationFormat = body.format || 'pptx';
  try {
    // V30: 记录生成历史到viGenerationHistory
    sendProgress("loading", "正在加载项目数据...", 5);
    try {
      // Use cached prev instead of redundant select
      const history = prev.viGenerationHistory || [];
      history.push({ id: generationId, format: generationFormat, status: 'generating', createdAt: new Date().toISOString(), fileName: '', fileSize: 0, pageCount: 0, selectedLogoUrl: '', sceneImageCount: 0, downloadUrl: '' });
      prev.viGenerationHistory = history;
      await supabaseAdmin.from("projects").update({ client_info: { ...prev } }).eq("id", projectId!);
    } catch (e: any) { console.warn("[generate-pptx] History record error:", e.message); }
    // ===== Step 1: 从 Supabase 查 project + submission =====
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_name, industry, client_info")
      .eq("id", projectId)
      .single();

    if (projErr) console.error("[generate-pptx] Project query error:", projErr.message);

    let submission: any = null;
    if (project?.submission_id) {
      const { data: sub, error: subErr } = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("id", project.submission_id)
        .single();
      if (!subErr && sub) submission = sub;
    }

    sendProgress("extracting", "正在提取品牌数据...", 10);
    // ===== Step 2: 提取所有数据 =====
    // V83: 从client_info.discoveryData补充数据，不再丢失
    const ci = (project?.client_info as Record<string, any>) || {};
    const dd = (ci?.discoveryData) as Record<string, any> || {};
// V120: extract contact info for business card
    const clientPhone = body.clientInfo?.phone || submission?.phone || ci?.phone || "";
    const clientCity = body.clientInfo?.city || submission?.city || ci?.city || "";
    const clientProvince = body.clientInfo?.province || submission?.province || ci?.province || "";

    // V105: companyName取值链 — 加client_info.companyName兜底
    const companyName = body.clientInfo?.companyName || submission?.company_name || submission?.companyName || project?.client_name || ci?.companyName || body.clientInfo?.clientName || dd.storeName || "品牌";

    // 整改 #006：正式品牌名 / 内部项目名 语义分离（工单 006 3.1 / 5.1）
    // 优先级：client_info.formalBrandName（显式正式名）→ 既有 companyName 解析链。
    // projectDisplayName 仅内部追踪，绝不进入品牌展示位。
    const formalBrandName: string | null = (ci as Record<string, any>)?.formalBrandName || null;
    const projectDisplayName: string | null = (ci as Record<string, any>)?.projectDisplayName || null;
    // 显示用品牌名：优先级 formalBrandName → 既有 companyName
    const displayCompanyName = formalBrandName || companyName;
    const industry = body.clientInfo?.industry || submission?.industry || project?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || dd.brandSpirit || "";
    const coreValues = body.clientInfo?.coreValues || submission?.core_values || dd.brandSpiritCustom || "";
    const targetMarket = body.clientInfo?.targetMarket || submission?.target_market || submission?.targetMarket || "";
    const mainProducts = body.clientInfo?.mainProducts || submission?.main_products || submission?.mainProducts || "";
    let logoPhilosophy = body.clientInfo?.logoPhilosophy || submission?.logo_philosophy || submission?.logoPhilosophy || ci?.logoPhilosophy || dd.signatureItem || "";
    const mascotPhilosophy = body.clientInfo?.mascotPhilosophy || submission?.mascot_philosophy || submission?.mascotPhilosophy || "";

    const rawColors = body.brandColors || submission?.existing_brand_color || submission?.brand_colors || submission?.brandColors;
    let realColors = normalizeColors(rawColors, industry);

    const industryType = getIndustryType(industry);
    _DEV && console.log("[generate-pptx] ===== BRAND DATA =====");
    _DEV && console.log("[generate-pptx] Company:", companyName, "| Industry:", industry, "| Type:", industryType);
    _DEV && console.log("[generate-pptx] Colors:", JSON.stringify(realColors));

    sendProgress("analyzing", "正在进行AI品牌分析...", 15);
    // ===== Step 2.5: AI 品牌分析 =====
    // 优化：优先复用已有品牌分析结果，避免重复DeepSeek调用
    const existingBrandProfile = (project?.client_info as Record<string, any>)?.brandProfile;
    let brandProfile: any = null;
    let effectiveBrandVision = brandVision;
    let effectiveCoreValues = coreValues;
    let effectiveTargetMarket = targetMarket;
    let effectiveBrandStory = "";
    let dynamicScenePrompts: Array<{zh: string; en: string}> | null = null;

    if (existingBrandProfile?.brandToneKeywords?.length > 0) {
      // 复用已有分析 — 跳过DeepSeek调用，省20秒+0.04元
      brandProfile = existingBrandProfile;
      if (brandProfile.refinedBrandVision) effectiveBrandVision = brandProfile.refinedBrandVision;
      if (brandProfile.refinedCoreValues) effectiveCoreValues = brandProfile.refinedCoreValues;
      if (brandProfile.refinedTargetMarket) effectiveTargetMarket = brandProfile.refinedTargetMarket;
      if (brandProfile.brandStory) effectiveBrandStory = brandProfile.brandStory;
      if (brandProfile.sceneImageSuggestions?.length >= 5) dynamicScenePrompts = brandProfile.sceneImageSuggestions;

      // V121: Override with DNA pipeline (brand-specific scene templates)
      if (!dynamicScenePrompts || dynamicScenePrompts.length < 5) {
        try {
          const ik = getIndustryKnowledge(getIndustryType(industry));
          const dnaInput = {
            brandName: companyName,
            industry,
            brandVision: effectiveBrandVision,
            coreValues: effectiveCoreValues,
            targetMarket: effectiveTargetMarket,
            brandColors: realColors ? {
              primary: { hex: realColors.primary },
              secondary: { hex: realColors.secondary },
              accent: { hex: realColors.accent }
            } : undefined,
            logoDescription: logoPhilosophy,
            sceneModules: ik.typicalModules,
            visualKeywords: ik.visualKeywords,
            mainProducts: mainProducts,
          };
          const dnaResult = await extractBrandDNA(dnaInput);
          if (dnaResult?.success && dnaResult.scene_atlas) {
            const materials = Object.keys(dnaResult.scene_atlas);
            const dnaContent = dnaResult.logo_pure_prompt!.positive_en;
            const filledPrompts = fillScenePrompts(dnaContent, dnaResult.scene_atlas, materials);
            dynamicScenePrompts = materials.map(m => ({
              zh: m,
              en: filledPrompts[m],
            }));
            _DEV && console.log(`[generate-pptx] DNA pipeline OK: ${materials.length} scenes for ${industry}`);
          }
        } catch (dnaErr) {
          console.warn("[generate-pptx] DNA extraction failed, will fallback:", dnaErr);
        }
      }
      if (brandProfile.logoDesignSuggestions) {
        _DEV && console.log("[generate-pptx] Reusing brand analysis, logo suggestions available:", brandProfile.logoDesignSuggestions.style);
        // V103-fix2: 复用路径也需要logoPhilosophy fallback
        if (!logoPhilosophy && brandProfile.logoDesignSuggestions.concept) {
          const parts = [brandProfile.logoDesignSuggestions.concept];
          if (brandProfile.logoDesignSuggestions.elements) parts.push(`核心元素：${brandProfile.logoDesignSuggestions.elements}`);
          if (brandProfile.logoDesignSuggestions.style) parts.push(`风格：${brandProfile.logoDesignSuggestions.style}`);
          logoPhilosophy = parts.join("。");
        }
        // V115: designPhilosophy补充
        if (logoPhilosophy && logoPhilosophy.length < 30 && brandProfile?.designPhilosophy) {
          logoPhilosophy = brandProfile.designPhilosophy;
        }
      }
      _DEV && console.log("[generate-pptx] Reusing existing brand analysis — skipped DeepSeek call");
      sendProgress("analyzed", "品牌分析完成(复用)", 30);
    } else {
      // 无已有分析 — 执行DeepSeek品牌分析
      await supabaseAdmin.from("projects").update({ status: "brand_analyzing", updated_at: new Date().toISOString() }).eq("id", projectId);
      try {        if ((companyName !== "品牌")) {
          const analysisPrompt = buildBrandAnalysisPrompt({
            companyName, industry, brandVision, coreValues, targetMarket,
            logoPhilosophy, mascotPhilosophy,
            province: body.clientInfo?.province || submission?.province,
            city: body.clientInfo?.city || submission?.city,
            description: body.clientInfo?.description || submission?.description,
            brandColors: realColors,
          });

          const analysisResp = await guardedDeepSeekCall({
      route: "ai/generate-manual-pptx",
      body: {model: DEEPSEEK_MODEL,
              messages: [
                { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
                { role: "user", content: analysisPrompt },
              ],
              temperature: 0.7,
              max_tokens: 4096,},
      timeoutMs: 45000,
    });

          if (analysisResp.ok) {
            const analysisData = await analysisResp.json();
            const analysisContent = analysisData.choices?.[0]?.message?.content || "{}";
            try {
              const cleaned = analysisContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
              brandProfile = JSON.parse(cleaned);
              _DEV && console.log("[generate-pptx] Brand analysis OK:", brandProfile.brandToneKeywords);
              sendProgress("analyzed", "品牌分析完成", 30);

              if (brandProfile.refinedBrandVision) effectiveBrandVision = brandProfile.refinedBrandVision;
              if (brandProfile.refinedCoreValues) effectiveCoreValues = brandProfile.refinedCoreValues;
              if (brandProfile.refinedTargetMarket) effectiveTargetMarket = brandProfile.refinedTargetMarket;
              if (brandProfile.brandStory) effectiveBrandStory = brandProfile.brandStory;
              if (brandProfile.logoDesignSuggestions) {
                _DEV && console.log("[generate-pptx] Logo design suggestions available:", brandProfile.logoDesignSuggestions.style);
                // V103: logoPhilosophy fallback到AI分析的concept+elements+style
                if (!logoPhilosophy && brandProfile.logoDesignSuggestions.concept) {
                  const parts = [brandProfile.logoDesignSuggestions.concept];
                  if (brandProfile.logoDesignSuggestions.elements) parts.push(`核心元素：${brandProfile.logoDesignSuggestions.elements}`);
                  if (brandProfile.logoDesignSuggestions.style) parts.push(`风格：${brandProfile.logoDesignSuggestions.style}`);
                  logoPhilosophy = parts.join("。");
                }
                // V115: designPhilosophy补充
                if (logoPhilosophy && logoPhilosophy.length < 30 && brandProfile?.designPhilosophy) {
                  logoPhilosophy = brandProfile.designPhilosophy;
                }
              }
              if (brandProfile.sceneImageSuggestions?.length >= 5) {
                dynamicScenePrompts = brandProfile.sceneImageSuggestions;
              }
              // V121: Override with DNA pipeline (brand-specific scene templates)
              if (!dynamicScenePrompts || dynamicScenePrompts.length < 5) {
                try {
                  const ik = getIndustryKnowledge(getIndustryType(industry));
                  const dnaInput = {
                    brandName: companyName,
                    industry,
                    brandVision: effectiveBrandVision,
                    coreValues: effectiveCoreValues,
                    targetMarket: effectiveTargetMarket,
                    brandColors: realColors ? {
                      primary: { hex: realColors.primary },
                      secondary: { hex: realColors.secondary },
                      accent: { hex: realColors.accent }
                    } : undefined,
                    logoDescription: logoPhilosophy,
                    sceneModules: ik.typicalModules,
                    visualKeywords: ik.visualKeywords,
                    mainProducts: mainProducts,
                  };
                  const dnaResult = await extractBrandDNA(dnaInput);
                  if (dnaResult?.success && dnaResult.scene_atlas) {
                    const materials = Object.keys(dnaResult.scene_atlas);
                    const dnaContent = dnaResult.logo_pure_prompt!.positive_en;
                    const filledPrompts = fillScenePrompts(dnaContent, dnaResult.scene_atlas, materials);
                    dynamicScenePrompts = materials.map(m => ({
                      zh: m,
                      en: filledPrompts[m],
                    }));
                    _DEV && console.log(`[generate-pptx] DNA pipeline OK: ${materials.length} scenes for ${industry}`);
                  }
                } catch (dnaErr) {
                  console.warn("[generate-pptx] DNA extraction failed, will fallback:", dnaErr);
                }
              }

              // 保存品牌档案到DB（保留selectedLogo和logoGenerationResults）
              const { data: projInfo } = await supabaseAdmin
                .from("projects").select("client_info").eq("id", projectId).single();
              const existingInfo = (projInfo?.client_info as Record<string, any>) || {};
              const existingBP = (existingInfo.brandProfile as Record<string, any>) || {};
              await supabaseAdmin.from("projects").update({
                client_info: {
                  ...existingInfo,
                  brandProfile: {
                    ...brandProfile,
                    analyzedAt: new Date().toISOString(),
                    selectedLogo: existingBP.selectedLogo || null,
                    logoGenerationResults: existingBP.logoGenerationResults || null,
                    logoGeneratedAt: existingBP.logoGeneratedAt || null,
                  }
                },
                updated_at: new Date().toISOString(),
              }).eq("id", projectId);
            } catch (parseErr) {
              console.warn("[generate-pptx] Brand analysis parse failed:", parseErr);
            }
          } else {
            console.warn("[generate-pptx] Brand analysis API failed:", analysisResp.status);
          }
        }
      } catch (analysisErr) {
        console.warn("[generate-pptx] Brand analysis error:", analysisErr);
      }
    }

    // V106: 品牌信息完整性检查——brandProfile为空时阻断生成，要求补充信息
    // 根因：brandProfile为空 → 无sceneImageSuggestions → 走硬编码通用prompt → 实景图完全跑偏
    const hasBrandProfile = brandProfile && brandProfile.brandToneKeywords?.length > 0;
    const hasSceneSuggestions = brandProfile?.sceneImageSuggestions?.length >= 5;
    if (!hasBrandProfile || !hasSceneSuggestions) {
      // 收集缺失字段
      const missingFields: string[] = [];
      const fieldLabels: Record<string, string> = {
        brandVision: "品牌愿景",
        coreValues: "核心价值",
        targetMarket: "目标客群",
        industry: "行业类别",
      };
      if (!industry) missingFields.push("industry");
      if (!brandVision && !effectiveBrandVision) missingFields.push("brandVision");
      if (!coreValues && !effectiveCoreValues) missingFields.push("coreValues");
      if (!targetMarket && !effectiveTargetMarket) missingFields.push("targetMarket");

      // 如果没有缺失字段但brandProfile仍然为空，说明是AI分析失败
      const analysisFailed = missingFields.length === 0 && !hasBrandProfile;
      
      // analysisFailed时提供可选补充字段，帮助AI更好分析
      const optionalFields = analysisFailed ? ["brandVision", "coreValues", "targetMarket", "logoPhilosophy"] : [];
      const optionalLabels: Record<string, string> = { brandVision: "品牌愿景", coreValues: "核心价值", targetMarket: "目标客群", logoPhilosophy: "Logo理念" };

      console.warn("[generate-pptx] V106: Brand info incomplete — brandProfile:", !!hasBrandProfile, "sceneSuggestions:", hasSceneSuggestions, "missingFields:", missingFields, "analysisFailed:", analysisFailed);

      // 更新DB状态为failed，附带缺失信息
      await supabaseAdmin.from("projects").update({
        status: "failed",
        updated_at: new Date().toISOString(),
        client_info: {
          ...prev,
          generationStatus: "failed",
          generationMessage: analysisFailed
            ? "AI品牌分析失败，请重试或补充品牌信息"
            : `还需补充${missingFields.length}项：${missingFields.map(k => fieldLabels[k] || k).join("、")}`,
          generationPercent: 0,
          infoIncomplete: {
            missingFields,
            analysisFailed,
            fieldLabels: Object.fromEntries(missingFields.map(k => [k, fieldLabels[k]])),
          },
        },
      }).eq("id", projectId!);

      return NextResponse.json({
        error: analysisFailed ? "AI品牌分析失败，请重试" : "品牌信息不完整",
        status: "info_incomplete",
        missingFields,
        fieldLabels: Object.fromEntries(missingFields.map(k => [k, fieldLabels[k]])),
        analysisFailed,
        optionalFields: analysisFailed ? optionalFields.map(k => ({ key: k, label: optionalLabels[k] })) : [],
      }, { status: 400 });
    }

    // V103: 如果brandProfile有colorPalette，用它覆盖行业默认色
    if (brandProfile?.colorPalette && Array.isArray(brandProfile.colorPalette) && brandProfile.colorPalette.length >= 3) {
      const cp = brandProfile.colorPalette;
      const cpPri = cp[0]?.hex;
      const cpSec = cp[1]?.hex;
      const cpAcc = cp[2]?.hex;
      if (cpPri) realColors.primary = cpPri.replace('#', '');
      if (cpSec) realColors.secondary = cpSec.replace('#', '');
      if (cpAcc) realColors.accent = cpAcc.replace('#', '');
      _DEV && console.log("[generate-pptx] V103: Using AI colorPalette:", JSON.stringify(realColors));
    }

    sendProgress("loading_assets", "正在加载品牌素材...", 40);
    // ===== Step 3: 加载 Logo/Mascot =====
    // V12: 场景图渲染中
    await supabaseAdmin.from("projects").update({ status: "scene_rendering", updated_at: new Date().toISOString() }).eq("id", projectId);
    let logoData: string | null = null;
    let mascotData: string | null = null;
    let mascotSplitViews: string[] | null = null;

    // V28: Logo加载优先级: body.logoUrl > selectedLogo(客人已选) > submission.logo_assets > 本地/Storage
    if (body.logoUrl) logoData = await loadImg(body.logoUrl);
    // V28: 优先从brandProfile.selectedLogo加载（客人已选择的Logo）
    if (!logoData && project?.client_info) {
      try {
        const savedProfile = ((project.client_info as Record<string, any>)?.brandProfile) as Record<string, any> | undefined;
        if (savedProfile?.selectedLogo?.imageUrl) {
          _DEV && console.log("[generate-pptx] Using customer-selected logo from brandProfile.selectedLogo");
          logoData = await loadImg(savedProfile.selectedLogo.imageUrl);
        }
        // V105: 客户未选Logo时，使用第一个生成的Logo
        if (!logoData && savedProfile && savedProfile.logoGenerationResults && savedProfile.logoGenerationResults.length > 0) {
          const firstLogoUrl = savedProfile.logoGenerationResults[0].imageUrl;
          if (firstLogoUrl) {
            _DEV && console.log("[generate-pptx] No selectedLogo, using first generated logo");
            logoData = await loadImg(firstLogoUrl);
          }
        }
      } catch (e) {
        console.warn("[generate-pptx] Could not load selectedLogo:", e);
      }
    }
    // V28: 从submission.logo_assets加载（客人上传或AI选择后保存的Logo）
    if (!logoData && submission) {
      const logoAssets = (submission as any).logo_assets || [];
      if (logoAssets.length > 0) {
        const lastLogo = logoAssets[logoAssets.length - 1];
        _DEV && console.log("[generate-pptx] Using logo from submission.logo_assets:", lastLogo.fileName);
        logoData = await loadImg(lastLogo.url);
      }
    }
    if (!logoData) logoData = await findAsset(projectId, "logo");
    if (!logoData) logoData = await findFromStorage(projectId, "logo");

    if (body.mascotUrl) mascotData = await loadImg(body.mascotUrl);
    if (body.mascotFiles?.length > 0) {
      for (const mf of body.mascotFiles) {
        const url = typeof mf === "string" ? mf : mf.url;
        mascotData = await loadImg(url);
        if (mascotData) break;
      }
    }
    if (!mascotData) mascotData = await findAsset(projectId, "mascot");
    if (!mascotData) mascotData = await findFromStorage(projectId, "mascot");
    if (mascotData) mascotSplitViews = await findSplitViews(projectId);

    // V2026-07-27: Read mascot metadata from client_info
    const mascotName = (project?.client_info as Record<string, any>)?.mascotName || (submission as any)?.mascot_name || '品牌公仔';
    const ciPrefs = (project?.client_info as Record<string, any>) || {};
    const mascotStyle = ((ciPrefs.mascotStylePref || [])[0] || '').replace(/_/g, ' ');
    const mascotPersonality = ((ciPrefs.mascotPersonalityPref || [])[0] || (ciPrefs.brandPersona || [])[0] || '');
    const mascotAssets = ciPrefs.mascotAssets as Record<string, any> | undefined;

    // V1.1: 生成前备份项目状态（非阻塞）
    try {
      const { execSync } = require("child_process");
      execSync(`node "D:\\disk\\BrandBrain\\scripts\\backup-project.js" ${projectId} manual`, { timeout: 15000 });
    } catch (e) {
      console.warn("[backup] 备份失败（非阻塞）:", String(e));
    }

    // [FIX 2026-07-27] Zeabur 无本地磁盘，findAsset/findFromStorage 取不到云端公仔图。
    // PART 8 公仔章节使用 client_info.mascotAssets 的云端 public URL（emotions/scenes/threeView），
    // 不依赖 mascotData（mascotData 走 compressImage 在云函数环境易崩，且 PART 8 渲染不需要它）。
    if (!mascotSplitViews && mascotAssets?.front && mascotAssets?.side && mascotAssets?.back) {
      try {
        const [f, s, b] = await Promise.all([
          loadImg(mascotAssets.front), loadImg(mascotAssets.side), loadImg(mascotAssets.back),
        ]);
        if (f && s && b) mascotSplitViews = [f, s, b];
      } catch { /* ignore */ }
    }

    // Load emotion images from mascotAssets
    let mascotEmotions: Record<string, string> | null = null;
    let mascotScenes: Record<string, string> | null = null;
    let mascotThreeViewData: string | null = null;
    if (mascotAssets) {
      if (mascotAssets.threeView) {
        mascotThreeViewData = await loadImg(mascotAssets.threeView);
      }
      if (mascotAssets.emotions && Array.isArray(mascotAssets.emotions)) {
        const loaded: Record<string, string> = {};
        for (const em of mascotAssets.emotions) {
          if (em.url) { const b64 = await loadImg(em.url); if (b64) loaded[em.name] = b64; }
        }
        if (Object.keys(loaded).length > 0) mascotEmotions = loaded;
      }
      if (mascotAssets.scenes && Array.isArray(mascotAssets.scenes)) {
        const loaded: Record<string, string> = {};
        for (const sc of mascotAssets.scenes) {
          if (sc.url) { const b64 = await loadImg(sc.url); if (b64) loaded[sc.name] = b64; }
        }
        if (Object.keys(loaded).length > 0) mascotScenes = loaded;
      }
    }

    _DEV && console.log("[generate-pptx] Logo:", logoData ? "OK" : "null", "| Mascot:", mascotData ? "OK" : "null", "| Emotions:", mascotEmotions ? Object.keys(mascotEmotions).length : 0, "| Scenes:", mascotScenes ? Object.keys(mascotScenes).length : 0);

    // [DIAG 2026-07-27] 把公仔资源加载结果写回 client_info，便于排查 Zeabur 环境下 loadImg 是否取到图
    try {
      const { data: dbgInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const dbgPrev = (dbgInfo?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...dbgPrev, mascotDebug: {
          ciHasMascotAssets: !!ciPrefs.mascotAssets,
          assetsFront: !!(ciPrefs.mascotAssets && ciPrefs.mascotAssets.front),
          threeView: !!mascotThreeViewData,
          emotionsCount: mascotEmotions ? Object.keys(mascotEmotions).length : 0,
          scenesCount: mascotScenes ? Object.keys(mascotScenes).length : 0,
          ts: new Date().toISOString(),
        } },
      }).eq("id", projectId!);
    } catch (e: any) { console.warn("[generate-pptx] mascotDebug write error:", e.message); }

    // V83: 保存checkpoint — 品牌分析+Logo加载完成，如果后续超时可从此续传
    try {
      const { data: ckInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const ckPrev = (ckInfo?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...ckPrev, generationCheckpoint: 'assets_loaded', generationPercent: 45 },
      }).eq("id", projectId!);
      _DEV && console.log("[generate-pptx] Checkpoint saved: assets_loaded");
    } catch (e: any) { console.warn("[generate-pptx] Checkpoint save error:", e.message); }

    // V29: 用视觉AI读取Logo图片，生成英文描述用于场景图prompt
    let logoVisualDesc = "";
    if (logoData) {
      logoVisualDesc = await describeLogoForScene(logoData);
      if (logoVisualDesc) arkUsageLog.push({ model: 'qwen-vl-max', type: 'vision', cost: 0.01, timestamp: new Date().toISOString() });
      _DEV && console.log("[generate-pptx] Logo visual desc:", logoVisualDesc ? "OK" : "EMPTY");
    }

    // V17: 无Logo时用通义万相AI生图Logo（替代DeepSeek SVG）
    let aiLogoData: string | null = null;
    if (!logoData && companyName !== "品牌") {
      try {
        _DEV && console.log("[generate-pptx] Generating AI logo via 通义万相 for", companyName);
        sendProgress("ai_logo", "正在用AI生成Logo方案...", 45);
        const industryLabel: Record<string, string> = {
          beauty: "beauty salon / nail art", restaurant: "Chinese restaurant / noodle shop", fastfood: "fast food burger shop / snack stall", beverage: "bubble tea / coffee shop",
          fashion: "fashion boutique / clothing brand", mother_baby: "maternity & baby brand", wedding: "wedding planning / photography studio",
          fitness: "gym / fitness center", pharmacy: "pharmacy / wellness", pet: "pet care / pet shop",
          retail: "retail shop", education: "education center", fresh_food: "fruit and fresh produce shop", floral: "flower shop / florist", home: "home decor store", nail: "nail salon", tea: "tea house / tea brand", general: "lifestyle brand"
        };
        const industryEn = industryLabel[industryType] || "lifestyle brand";
        // 优先使用brand-analysis的logoDesignSuggestions
        let logoPrompt = "";
        if (brandProfile?.logoDesignSuggestions?.prompts?.length > 0) {
          logoPrompt = brandProfile.logoDesignSuggestions.prompts[0];
          _DEV && console.log("[generate-pptx] Using brand-analysis logo prompt:", logoPrompt.substring(0, 80));
        } else {
          // Fallback: 根据行业和品牌信息构建高质量prompt
          logoPrompt = `Professional minimalist logo icon design for "${companyName}", a ${industryEn}. ` +
            `Target audience: ${targetMarket || "urban professionals"}. ` +
            `Color palette: primary ${realColors.primary}, secondary ${realColors.secondary}. ` +
            `Design style: elegant, refined, modern luxury, clean lines, symmetrical composition. ` +
            `The icon should be a single cohesive abstract symbol that suggests the brand identity, ` +
            `using flowing curves or geometric shapes, NOT literal objects. ` +
            `Reference the design philosophy of brands like Chanel, Dior, Tiffany - iconic, timeless, instantly recognizable.`;
        }
        aiLogoData = await generateLogoImage(logoPrompt, realColors);
        if (aiLogoData) {
          // V120: Free ComfyUI, no cost tracking needed
          _DEV && console.log("[generate-pptx] AI logo generated OK! base64 length:", aiLogoData.length);
        } else {
          console.warn("[generate-pptx] AI logo generation failed, will use fallback icon");
        }
      } catch (logoErr) {
        console.warn("[generate-pptx] AI logo generation error:", logoErr);
      }
    }

    // ===== Step 4: 生成 AI 写实场景图（5张，异步并行） =====
    // V83: 声明场景图变量（resume逻辑需要先声明）
    const sceneImages: Record<string, string> = {};
    const sceneLabels: Record<string, string> = {};
    let goto_rendering = false;
    let imgSuccess = 0;

    // 动态场景图prompt（AI分析结果 > 硬编码fallback）
    let imgDefs = SCENE_IMG_DEFS[industryType] || SCENE_IMG_DEFS.general;
    if (dynamicScenePrompts && dynamicScenePrompts.length >= 5) {
      // V96: 恢复使用AI生成的sceneImageSuggestions.en作为rawPrompt
      // V95时因brand-analysis生成美食摄影而弃用，但V95已修复brand-analysis prompt为VI mockup
      // AI生成的prompt含品牌名、配色、具体产品细节，比硬编码通用prompt效果好得多
      // V97: 根据场景物料中文名动态归类到 stationery/packaging/marketing
      const pageCounts: Record<string, number> = { stationery: 0, packaging: 0, marketing: 0 };
      imgDefs = dynamicScenePrompts.map((suggestion: any, i: number) => {
        const page = mapSceneToPage(suggestion.zh || "");
        pageCounts[page] = (pageCounts[page] || 0) + 1;
        const key = `${page}-${pageCounts[page]}`;
        return {
          key,
          page,
          rawPrompt: suggestion.en + ", the exact same brand logo from the reference image must be clearly printed/embossed on the product surface, professional product photography, studio lighting, product fully visible, no text, no Chinese characters",
          label: suggestion.zh || "",
        };
      });
    }

    // V83: 如果checkpoint=scenes_done且有sceneStorageUrls，尝试从Storage恢复场景图
    const existingSceneUrls = ((prev as any)?.sceneStorageUrls) as Record<string, string> | undefined;
    if (existingSceneUrls && Object.keys(existingSceneUrls).length >= 3 && step === 'resume') {
      _DEV && console.log("[generate-pptx] Resuming: loading scene images from Storage...");
      let restoredCount = 0;
      for (const [key, url] of Object.entries(existingSceneUrls)) {
        try {
          const imgResp = await fetch(url);
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            sceneImages[key] = "data:image/png;base64," + imgBuf.toString("base64");
            restoredCount++;
          }
        } catch {}
      }
      if (restoredCount >= 3) {
        imgSuccess = restoredCount;
        _DEV && console.log(`[generate-pptx] Restored ${restoredCount} scene images from Storage, skipping generation`);
        sendProgress("rendering", `场景图已恢复(${restoredCount}张)，正在渲染PPTX...`, 75);
        // Skip to rendering
        goto_rendering = true;
      }
    }

    if (!goto_rendering) {
    sendProgress("images", "正在生成场景图...", 50);
    _DEV && console.log("[generate-pptx] ===== AI IMAGE GENERATION =====");
    _DEV && console.log("[generate-pptx] Industry:", industryType, "| Images:", imgDefs.length, "| Dynamic:", !!dynamicScenePrompts);


    // V29: 场景图用文生图（不是图生图），把Logo外观描述写进prompt
    // 旧版成功的原因：品牌分析AI把Logo外观详细写进sceneImageSuggestions prompt
    // 图生图(img2img)只是风格参考，不能精确还原Logo图案
    // V120: ARK API key check removed

    // V29: 把Logo视觉描述追加到场景图prompt，让AI文生图时精确画出Logo
    // 优先用视觉AI直接读Logo图生成的描述，比品牌分析AI的推测更准确
    const logoDesc = logoVisualDesc || (brandProfile as any)?.logoDesignSuggestions?.prompts?.[0] || "";
    const logoConcept = logoVisualDesc ? "" : ((brandProfile as any)?.logoDesignSuggestions?.concept || "");
    if (logoDesc && !goto_rendering) {
      _DEV && console.log(`[generate-pptx] Logo description available (source: ${logoVisualDesc ? "visual AI" : "brand analysis"}), injecting into scene prompts`);
      // V29c: 把"company logo"等模糊词替换为精确的Logo视觉描述
      const descSnippet = logoDesc.substring(0, 300);
      for (const def of imgDefs) {
        // 替换模糊的"company logo"/"brand logo"为精确描述
        def.rawPrompt = def.rawPrompt.replace(/company logo/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/brand logo/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/brand emblem/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/branded/gi, descSnippet);
        // 如果prompt里没有logo相关词，在开头插入描述
        if (!def.rawPrompt.includes(descSnippet.substring(0, 50))) {
          def.rawPrompt = `Product featuring the brand mascot/logo: ${descSnippet}. ${def.rawPrompt}`;
        }
      }
    }

    const provider = await getDefaultRegistry().getActive();
    _DEV && console.log(`[generate-pptx] Engine: ${provider.name}, ${imgDefs.length} images, Logo desc: ${!!logoDesc}`);

    for (let i = 0; i < imgDefs.length; i += 2) {
      const batch = imgDefs.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async (def) => {
          // V121: using provider from registry
          try {
            const result = await provider.generateImage({ brandContext: { brandName: companyName, industry: industryType, brandPositioning: brandProfile?.brandPositioning || "", brandPersona: brandProfile?.brandToneKeywords || [], visualDirection: brandProfile?.visualStyleSuggestion || "" }, ipProfile: { type: "scene", personality: [], visualTraits: [], colorDirection: [] }, step: { stepId: def.key, label: def.page, description: def.rawPrompt }, prompt: def.rawPrompt, negativePrompt: "text, watermark, ugly, distorted, low quality", output: { width: 1024, height: 1024, format: "png" } });
            _DEV && console.log(`[generate-pptx] ${provider.name} OK for ${def.key} (${result.durationMs}ms)`);
            return { def, imgData: result.imageUrl };
          } catch (e: any) {
            console.error(`[generate-pptx] ${provider.name} FAILED for ${def.key}: ${e.message}`);
            throw e;
          }
          return { def, imgData: null };
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.imgData) {
          const { def, imgData } = result.value;
          if (imgData.startsWith("http")) {
            const imgResp = await fetch(imgData);
            if (imgResp.ok) {
              const imgBuf = Buffer.from(await imgResp.arrayBuffer());
              sceneImages[def.key] = "data:image/png;base64," + imgBuf.toString("base64");
            }
          } else {
            sceneImages[def.key] = imgData;
          }
          if ((def as any).label) sceneLabels[def.key] = (def as any).label;
          imgSuccess++;
        } else if (result.status === "rejected") {
          console.error(`[generateImage] Failed:`, result.reason);
        }
      }
      // Batch delay to avoid rate limiting
      if (i + 2 < imgDefs.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    } // end if (!goto_rendering) — V83: skip scene generation on resume
    _DEV && console.log(`[generate-pptx] Images: ${imgSuccess}/${imgDefs.length} success`);
    // V83: 保存场景图到Supabase Storage，防止函数超时后丢失
    const sceneStorageUrls: Record<string, string> = {};
    if (imgSuccess > 0) {
      const sceneSavePromises = Object.entries(sceneImages).map(async ([key, base64]) => {
        try {
          const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!matches) return;
          const buf = Buffer.from(matches[2], 'base64');
          const sp = `${projectId}/scenes/${key}.png`;
          const { error: se } = await supabaseAdmin.storage.from('manuals').upload(sp, buf, { contentType: 'image/png', upsert: true });
          if (!se) { const { data } = supabaseAdmin.storage.from('manuals').getPublicUrl(sp); if (data?.publicUrl) sceneStorageUrls[key] = data.publicUrl; }
        } catch {}
      });
      await Promise.all(sceneSavePromises);
    }
    sendProgress("rendering", `场景图生成完成(${imgSuccess}/${imgDefs.length})，正在渲染PPTX...`, 75);

    // V83: 保存checkpoint — 场景图完成
    try {
      const { data: ckInfo2 } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const ckPrev2 = (ckInfo2?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...ckPrev2, generationCheckpoint: 'scenes_done', generationPercent: 75, sceneStorageUrls },
      }).eq("id", projectId!);
      _DEV && console.log("[generate-pptx] Checkpoint saved: scenes_done");
    } catch (e: any) { console.warn("[generate-pptx] Checkpoint save error:", e.message); }

    // ===== Step 5: 生成蓝图 =====
    // 整改 #006G：API 与 Worker 共用同一个 canonical adapter/validator。
    // 优先使用 client_info.mascotAssets 的 public URL；旧数据无该对象时，
    // 用已加载的 data URL（mascotSplitViews / mascotEmotions / mascotScenes）构造同一结构，
    // 保证「已下载 data URL 与未下载 public URL」遵循同一存在/有效规则。
    const canonicalMascotAssets = normalizeMascotAssetSet(
      mascotAssets
        ? { ...mascotAssets, name: mascotName }
        : {
            name: mascotName,
            front: mascotSplitViews?.[0],
            side: mascotSplitViews?.[1],
            back: mascotSplitViews?.[2],
            emotions: mascotEmotions || undefined,
            scenes: mascotScenes || undefined,
          },
    );
    const blueprints = await planPages({
      clientInfo: { companyName: displayCompanyName, brandVision: effectiveBrandVision, coreValues: effectiveCoreValues, targetMarket: effectiveTargetMarket, logoPhilosophy, mascotPhilosophy, industry },
      // 整改 #006：显式传递正式品牌名与内部项目名（生产实际读取位置）
      formalBrandName: formalBrandName || undefined,
      projectDisplayName: projectDisplayName || undefined,
      // 整改 #006F：requested 以 client_info.wantMascot==="yes" 为唯一真源（与 Worker 共用同一规则，不依赖 !!mascotData 反推）
      wantMascot: ci?.wantMascot || undefined,
      mascotAssets: canonicalMascotAssets,
      brandColors: {
        primary: { hex: realColors.primary },
        secondary: { hex: realColors.secondary },
        accent: { hex: realColors.accent },
      },
      assetAnalysis: {
        // 工单 009：Logo 结构证据只来自显式字段 logoDesignSuggestions.elements，
        // 缺失/为空时保持 []（通用规则，安全默认），不从文案猜测元素。
        logo: { hasLogo: !!logoData, logoUrl: body.logoUrl || "", elements: extractLogoElements(brandProfile?.logoDesignSuggestions?.elements), styleTags: [], meaning: logoPhilosophy },
        mascot: { hasMascot: ci?.wantMascot === "yes", name: canonicalMascotAssets.name || mascotName, style: mascotStyle, personality: mascotPersonality },
      },
    });

    _DEV && console.log("[generate-pptx] Blueprints:", blueprints.length, "pages");

    // 整改 #7：完整 IP 公仔章节（5 段）已由 planPages 在 hasMascot=true 时默认追加，
    // 不再仅在素材存在时塞单页 mascot-gallery。

    // ===== QC Gate: 轻量化内容校验（fire-and-forget，不阻塞管线）=====
    const qcMd = blueprints
      .map((bp: any) => bp.elements?.map((e: any) => e.content || "").join("\n") || "")
      .join("\n\n");
    validateAndBlockAsync(qcMd, "cross", {}, {
      projectId: projectId || "unknown",
      brandName: companyName || "unknown",
      industry: industryType || "general",
    }).catch((e: any) => console.warn("[generate-pptx] QC gate warning:", e.message));

    // 整改 #6：主色叙述幻觉检查（如把深藏青描述成「大面积红色」），非阻塞、仅告警
    try {
      const colorIssues = checkColorNarrativeConsistency(qcMd, realColors.primary, (realColors as any).primaryName);
      if (colorIssues.length > 0) {
        console.warn("[generate-pptx] QC 主色叙述幻觉:", colorIssues.map((i) => i.message).join("; "));
      }
    } catch (e: any) {
      // 非阻塞
    }

    // ===== Step 6: 渲染 PPTX =====
    // V12: PPTX组装中
    await supabaseAdmin.from("projects").update({ status: "pptx_assembling", updated_at: new Date().toISOString() }).eq("id", projectId);
    const buffer = await renderPptxToBuffer(blueprints, {
      projectName: projectId,
      // 整改 #006：渲染期也使用正式/显示品牌名（覆盖所有品牌展示位）
      companyName: displayCompanyName,
      industry,
      logoData,
      mascotData,
      mascotSplitViews,
      brandColors: realColors,
      brandVision: effectiveBrandVision,
      coreValues: effectiveCoreValues,
      targetMarket: effectiveTargetMarket,
      logoPhilosophy,
      logoElements: extractLogoElements(brandProfile?.logoDesignSuggestions?.elements),
      logoColors: resolveLogoColorsFromProfile(brandProfile) || undefined,
      mascotPhilosophy,
      sceneImages,
      sceneLabels,
      aiLogoData: aiLogoData || undefined,
      compressImages: true,  // V30: 压缩图片减小体积
      sceneSectionTitles: brandProfile?.sceneSectionTitles,  // V98: AI场景页标题
      mascotEmotions: mascotEmotions || undefined,
      mascotScenes: mascotScenes || undefined,
      mascotThreeViewData: mascotThreeViewData || undefined,
      auxGraphicsIntro: buildAuxGraphicsIntro(brandProfile, realColors, industry),
      colorMeaning: buildColorMeaning(brandProfile, realColors, industry),
      brandStory: effectiveBrandStory || composeBrandStory(companyName, industry, effectiveBrandVision, effectiveCoreValues, effectiveTargetMarket, brandProfile),
      phone: clientPhone,
      city: clientCity,
      province: clientProvince,
    });

    sendProgress("saving", "正在保存文件...", 90);
    // ===== Step 7: 保存文件 =====
    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });
    const fileName = `vi-manual-${projectId}-${Date.now()}.${generationFormat}`;
    
    // V30: 如果format=pdf，用LibreOffice转PDF
    if (generationFormat === 'pdf') {
      // 先保存PPTX临时文件
      const tempPptxName = `temp-${Date.now()}.pptx`;
      const tempPptxPath = path.join(outputDir, tempPptxName);
      await writeFile(tempPptxPath, buffer);
      
      try {
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const execFileAsync = promisify(execFile);
        
        // LibreOffice headless转换
        await execFileAsync("libreoffice", [
          "--headless", "--convert-to", "pdf",
          "--outdir", outputDir,
          tempPptxPath
        ], { timeout: 60000 });
        
        // 读取生成的PDF
        const pdfName = tempPptxName.replace(".pptx", ".pdf");
        const pdfPath = path.join(outputDir, pdfName);
        const pdfBuffer = await readFile(pdfPath);
        
        // 用正确的文件名重命名
        const finalPdfPath = path.join(outputDir, fileName);
        const { rename } = await import("fs/promises");
        await rename(pdfPath, finalPdfPath);
        
        // 删除临时PPTX
        const { unlink } = await import("fs/promises");
        await unlink(tempPptxPath).catch(() => {});
        
        _DEV && console.log(`[generate-pptx] PDF converted: ${pdfBuffer.length} bytes`);
        
        // Upload PDF to Storage (much smaller, should work)
        let pdfStorageUrl: string | null = null;
        try {
          const storagePath = `${projectId}/${fileName}`;
          const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
            .from("manuals")
            .upload(storagePath, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (uploadErr) {
            console.warn("[generate-pptx] PDF Storage upload failed:", uploadErr.message);
          } else {
            const { data: urlData } = supabaseAdmin.storage.from("manuals").getPublicUrl(storagePath);
            pdfStorageUrl = urlData?.publicUrl || null;
            _DEV && console.log("[generate-pptx] PDF Storage upload OK:", pdfStorageUrl);
          }
        } catch (e: any) { console.warn("[generate-pptx] PDF Storage error:", e.message); }

        // V85-fix: PDF路径合并写入，包含history+arkUsageLog+pptxResult
        try {
          const { data: pdfInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
          const pdfPrev = (pdfInfo?.client_info as Record<string, any>) || {};
          const pdfHistory = (pdfPrev.viGenerationHistory || []).map((h: any) =>
            h.id === generationId
              ? { ...h, status: 'completed', completedAt: new Date().toISOString(), fileName, fileSize: pdfBuffer.length, pageCount: blueprints.length, sceneImageCount: imgSuccess, downloadUrl: `/api/ai/download-pptx/${fileName}`, storageUrl: pdfStorageUrl }
              : h
          );
          await supabaseAdmin.from("projects").update({
            client_info: {
              ...pdfPrev,
              viGenerationHistory: pdfHistory,
              arkUsageLog: [...(pdfPrev.arkUsageLog || []), ...arkUsageLog],
              generationStatus: "completed",
              generationMessage: "生成完成！",
              generationPercent: 100,
              pptxResult: { url: `/api/ai/download-pptx/${fileName}`, storageUrl: pdfStorageUrl, pageCount: blueprints.length, fileName },
            },
            status: "completed",
            updated_at: new Date().toISOString(),
          }).eq("id", projectId!);
        flushArkUsageToLog(projectId!, companyName);
        } catch (e: any) { console.warn("[generate-pptx] PDF final update error:", e.message); }
        return; // PDF path done, skip PPTX storage
      } catch (convertErr: any) {
        console.warn("[generate-pptx] PDF conversion failed, falling back to PPTX:", convertErr.message);
        // Fall through to save as PPTX
        await writeFile(path.join(outputDir, fileName.replace(".pdf", ".pptx")), buffer);
      }
    } else {
      await writeFile(path.join(outputDir, fileName), buffer);
    }

    // ===== Step 7.5: async upload to Supabase Storage (fire-and-forget, does not block download) =====
    let storageUrl: string | null = null;
    void (async () => {
      try {
        const sp = `${projectId}/${fileName}`;
        const { error: ue } = await supabaseAdmin.storage
          .from("manuals")
          .upload(sp, buffer, {
            contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            upsert: true,
          });
        if (ue) { console.warn("[generate-pptx] Storage upload failed:", ue.message); return; }
        const { data: ud } = supabaseAdmin.storage.from("manuals").getPublicUrl(sp);
        const url = ud?.publicUrl || null;
        _DEV && console.log("[generate-pptx] Storage upload OK:", url);
        if (url) {
          await supabaseAdmin.from("projects").update({
            client_info: { pptxResult: { url: `/api/ai/download-pptx/${fileName}`, storageUrl: url, pageCount: blueprints.length, fileName } }
          }).eq("id", projectId!);
        }
      } catch (e: any) { console.warn("[generate-pptx] Storage upload error:", e?.message); }
    })();

    _DEV && console.log("[generate-pptx] ===== DONE =====", fileName, `(${imgSuccess} images, ${blueprints.length} pages)`);
    // V85-fix: 合并所有DB更新为一次写入，避免竞态覆盖pptxResult
    // 之前sendComplete写pptxResult → history更新用旧快照覆盖 → pptxResult丢失
    try {
      const { data: doneInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const donePrev = (doneInfo?.client_info as Record<string, any>) || {};
      const doneHistory = (donePrev.viGenerationHistory || []).map((h: any) =>
        h.id === generationId
          ? { ...h, status: 'completed', completedAt: new Date().toISOString(), fileName, fileSize: buffer.length, pageCount: blueprints.length, sceneImageCount: imgSuccess, downloadUrl: `/api/ai/download-pptx/${fileName}`, storageUrl }
          : h
      );
      // 一次性写入：pptxResult + history + status + arkUsageLog
      await supabaseAdmin.from("projects").update({
        client_info: {
          ...donePrev,
          viGenerationHistory: doneHistory,
          arkUsageLog: [...(donePrev.arkUsageLog || []), ...arkUsageLog],
          generationStatus: "completed",
          generationMessage: "生成完成！",
          generationPercent: 100,
          pptxResult: { url: `/api/ai/download-pptx/${fileName}`, pageCount: blueprints.length, fileName },
        },
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId!);
    flushArkUsageToLog(projectId!, companyName);
    } catch (e: any) { console.warn("[generate-pptx] Final DB update error:", e.message); }
  } catch (error: any) {
    console.error("[generate-pptx] Error:", error);
    // V30: 更新历史记录为失败
    try {
      const { data: errInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const errPrev = (errInfo?.client_info as Record<string, any>) || {};
      const errHistory = (errPrev.viGenerationHistory || []).map((h: any) =>
        h.id === generationId ? { ...h, status: 'failed', error: error.message, completedAt: new Date().toISOString() } : h
      );
      await supabaseAdmin.from("projects").update({ client_info: { ...errPrev, viGenerationHistory: errHistory } }).eq("id", projectId!);
    } catch (e: any) {}
    sendError(error.message || "PPTX generation failed");
  }
  })();  // end background task

  // Return immediately with 202 Accepted
  return NextResponse.json({
    success: true,
    projectId,
    message: "VI手册生成已启动，请轮询项目状态",
  }, { status: 202 });
}

// ========== Helper Functions ==========
// V29: 用通义万相VL读Logo图，生成英文视觉描述，注入场景图prompt
async function describeLogoForScene(logoBase64: string): Promise<string> {
  try {
    const apiKey = process.env.ALIYUN_API_KEY;
    if (!apiKey) return "";
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: logoBase64 } },
          { type: "text" as const, text: "Describe this brand logo/mascot in detail for an AI image generation prompt. Focus on: 1) Main character/shape 2) Colors 3) Key visual elements 4) Style 5) Any text on it. Output a single paragraph in English, concise but detailed enough that an AI could recreate it on products." }
        ]
      }
    ];
    const body = { model: "qwen-vl-max", messages, max_tokens: 300 };
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const desc = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content.trim() : "";
    _DEV && console.log("[generate-pptx] Logo visual description:", desc.substring(0, 100));
    return desc;
  } catch (e) {
    console.warn("[generate-pptx] Logo description failed:", e);
    return "";
  }
}

async function loadImg(imagePath: string): Promise<string | null> {
  if (!imagePath) return null;
  const candidates = [
    path.join(process.cwd(), "public", imagePath.replace(/^\//, "")),
    path.join(process.cwd(), imagePath),
  ];
  for (const fp of candidates) {
    try {
      const buf = await readFile(fp);
      const ext = path.extname(fp).toLowerCase();
      const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : ext === ".svg" ? "image/svg+xml" : "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch { /* next */ }
  }
  if (imagePath.startsWith("http")) {
    try {
      const resp = await fetch(imagePath);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "image/png";
        return `data:${ct};base64,${buf.toString("base64")}`;
      }
    } catch { /* fail */ }
  }
  return null;
}

async function findAsset(projectId: string, type: "logo" | "mascot"): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), "public", "processed-assets", projectId);
    const files = await readdir(dir);
    const keywords = type === "logo" ? ["logo", "logo-processed"] : ["mascot", "ip", "character"];
    for (const file of files) {
      const lower = file.toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        const buf = await readFile(path.join(dir, file));
        const ext = path.extname(file).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".svg" ? "image/svg+xml" : "image/png";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  } catch { /* dir not found */ }
  return null;
}

async function findFromStorage(projectId: string, type: "logo" | "mascot"): Promise<string | null> {
  try {
    const prefix = `${projectId}/${type}`;
    const { data, error } = await supabaseAdmin.storage.from("processed-assets").list(prefix, { limit: 5 });
    if (error || !data || data.length === 0) return null;
    const file = data[0];
    const filePath = `${prefix}/${file.name}`;
    const { data: urlData } = supabaseAdmin.storage.from("processed-assets").getPublicUrl(filePath);
    if (urlData?.publicUrl) return await loadImg(urlData.publicUrl);
  } catch { /* storage not configured */ }
  return null;
}

async function findSplitViews(projectId: string): Promise<string[] | null> {
  try {
    const dir = path.join(process.cwd(), "public", "processed-assets", projectId);
    const files = await readdir(dir);
    const views: string[] = [];
    for (const suffix of ["-front", "-side", "-back"]) {
      for (const file of files) {
        if (file.toLowerCase().includes(`mascot${suffix}`) || file.toLowerCase().includes(`ip${suffix}`)) {
          const buf = await readFile(path.join(dir, file));
          const ext = path.extname(file).toLowerCase();
          const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
          views.push(`data:${mime};base64,${buf.toString("base64")}`);
          break;
        }
      }
    }
    return views.length === 3 ? views : null;
  } catch { return null; }
}


// ========== AI 品牌分析 Prompt ==========

const BRAND_ANALYSIS_SYSTEM_PROMPT = `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

## 分析框架
1. 行业洞察：市场趋势、痛点与机会
2. 地理环境：所在地的商业环境与资源优势
3. 竞品格局：主要竞品及其定位
4. 品牌定位：差异化定位方向、品牌调性关键词
5. 文案补全：客户没写的AI代写，已写的润色保留原意
6. 视觉方向：推荐视觉风格 + 5个写实场景图描述（中英文对照）
7. Logo设计建议：为没有Logo的客户提供4个不同方向的Logo设计方案

## 输出格式（严格JSON，不要markdown包裹）
{
  "industryInsight": "行业洞察，2-3句话",
  "geoEnvironment": "地理环境分析，2-3句话",
  "competitiveLandscape": "竞品格局，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场",
  "brandStory": "品牌故事，3-5句话，融合品牌起源、核心价值和愿景，语言有感染力",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议",
  "sceneImageSuggestions": [
    {"zh": "名片", "en": "Professional product photography of branded business cards with company logo printed on them, arranged on wooden desk, studio lighting, angled view"},
    {"zh": "手提袋", "en": "Professional product photography of a branded paper tote bag with company logo printed on front, standing upright, studio lighting"},
    {"zh": "产品瓶装", "en": "Professional product photography of a branded beverage bottle with company logo label, on clean surface, studio lighting, product fully visible"},
    {"zh": "促销海报", "en": "Professional product photography of a branded promotional poster standee in store, with company branding visible, studio setting"},
    {"zh": "会员卡", "en": "Professional product photography of a branded VIP membership card with company logo, clean studio background"}
  ],
  "logoSpecs": {
    "note": "logoColors 必须来自客户提供的真实品牌色或已有Logo色证据；证据不足输出空数组 []，禁止虚构或套用其他品牌色板。",
    "logoColors": [
      {"name": "Logo专属色1（如：深空蓝）", "hex": "#RRGGBB", "rgb": "R, G, B", "cmyk": "C, M, Y, K"},
      {"name": "Logo专属色2（如：暖金）", "hex": "#RRGGBB", "rgb": "R, G, B", "cmyk": "C, M, Y, K"}
    ]
  },
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
    "brandVision": "客户没写则AI代写，已写则留空",
    "coreValues": "客户没写则AI代写，已写则留空",
    "targetMarket": "客户没写则AI代写，已写则留空"
  }
}`;


// V12: 品牌故事合成 — AI未输出brandStory时从已有数据组合
function composeBrandStory(
  companyName: string, industry: string,
  vision: string, values: string, market: string,
  profile: any,
): string {
  if (!companyName || companyName === "品牌") return "";
  const parts: string[] = [];
  const insight = profile?.industryInsight || "";
  const positioning = profile?.brandPositioning || "";
  // 清洗每段末尾标点，避免拼接出双句号
  function clean(s: string): string {
    return s.replace(/[。，,]+$/, "").replace(/。。/g, "。");
  }
  if (insight) parts.push(clean(insight));
  parts.push(`${companyName}扎根${industry || "本土"}行业`);
  if (values) parts.push(`以"${values}"为核心价值`);
  if (market) parts.push(`致力于为${market}提供优质服务`);
  if (vision) parts.push(clean(vision));
  if (positioning) parts.push(clean(positioning));
  let result = parts.join("，");
  result = result.replace(/。。/g, "。");
  return result + "。";
}

function buildBrandAnalysisPrompt(info: {
  companyName: string; industry: string;
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
  if (info.province || info.city) {
    parts.push("所在地：" + (info.province || "") + (info.city || ""));
  }
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
  parts.push("重要：sceneImageSuggestions必须是VI应用效果图（mockup），不是品牌故事场景或美食摄影！每个场景必须描述品牌Logo/视觉元素印在具体产品上的效果。5个场景必须根据客户行业动态决定物料类型。行业→物料映射示例：餐饮/快餐/茶餐厅→筷子套、餐巾纸包、外卖袋、菜单、员工围裙；水果/生鲜→水果贴纸、果篮包装、价格标签、手提袋、促销立牌；美甲/美业→色板卡、甲油瓶贴、预约卡、会员卡、店铺招牌；零售/百货→手提袋、价格标签、购物袋、店面招牌、促销海报；饮品/奶茶→外卖杯、杯套、手提袋、菜单灯箱、会员卡；教育/培训→课程表、学员证、文件夹、招生海报、书包挂件；通用/其他→名片、手提袋、产品包装、店面招牌、营销海报。请根据客户实际行业选择最贴合的5种物料，不要输出与行业无关的品类。每个场景的zh字段是产品名称（如\u2018名片\u2019、\u2018手提袋\u2019），en字段是英文生图prompt，必须以\u2018Professional product photography of a branded [产品] with company logo clearly printed\u2019开头。**严禁输出美食摄影、人物场景、品牌故事场景**——这是VI手册应用效果图，不是品牌故事绘本！");
  parts.push("");
  parts.push("重要：logoDesignSuggestions是为没有Logo的客户设计的。请根据品牌名称、行业特征、地域文化特色，设计4个不同方向的Logo方案。每个prompt需要是完整的英文AI生图指令，详细描述设计风格、核心图形元素、配色方案、排版布局。Logo需要简洁、辨识度高、适合各种尺寸应用（名片、招牌、包装等）。");
  return parts.join("\n");
}

