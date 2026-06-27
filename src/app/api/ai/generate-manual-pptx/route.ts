/**
 * API: Generate VI Manual PPTX via PptxGenJS Engine V7
 *
 * V7 鏍稿績鏀瑰姩锛堝湪V6鍩虹涓婏級锛?
 * - 淇琛屼笟鍒ゅ畾锛氭ぐ瀛愭按鈫掗ギ鍝?涓嶆槸椁愰ギ)锛屽垹鎺?妞板矝"浠庨楗鍒?
 * - V26: 鍦烘櫙鍥惧弻寮曟搸骞惰 - 閫氫箟3寮?灏忎簯闆€2寮狅紝Promise.all鐪熸骞惰
 * - 淇API绔偣锛歝ompatible-mode涓嶆敮鎸佷竾鐩?鈫?鏀圭敤DashScope鍘熺敓寮傛API
 * - 淇妯″瀷鍚嶏細wanx2.6-image(閿? 鈫?wan2.6-t2i(绾枃鐢熷浘)
 * - 鍦烘櫙鍥句粠7寮犲噺涓?寮狅紙楼0.20脳5=楼1.00/浠斤級
 * - 寮傛璋冪敤娴佺▼锛氭彁浜や换鍔?鈫?杞缁撴灉 鈫?鑾峰彇URL 鈫?涓嬭浇base64
 * - 鏂板analyze-brand鍏变韩閫昏緫
 * - V27: 鍦烘櫙鍥炬柟鑸烝rk Seedream鍥剧敓鍥句紭鍏?Logo鍋氬弬鑰? + DashScope闄嶇骇
 */
import { NextRequest, NextResponse } from "next/server";
import { comfyuiGenerateScene, isComfyUIAvailable } from "@/lib/ip/ip-image-provider/comfyui-provider";
import path from "path";
import { readFile, mkdir, writeFile, readdir } from "fs/promises";
import { planPages } from "@/lib/vi-manual/page-planner";
import { renderPptxToBuffer } from "@/lib/pptx/render-pptx";
import { supabaseAdmin } from "@/lib/core/supabase";
import { type IndustryType, getIndustryType, getIndustryDefaults } from "@/lib/brand/industry-types";
import { guardedDeepSeekCall } from '@/lib/core/billing/deepseek-guard';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ========== 琛屼笟鍒ゅ畾锛堜笌analyze-brand鍏变韩锛?==========

// ========== 琛屼笟鍦烘櫙鍥惧畾涔夛紙5寮?浠斤紝楼1.00锛?==========
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

// V95: 涓枃棰滆壊鍚嶁啋hex鏄犲皠锛堝鎴疯緭鍏?绾㈣壊鍜岄噾鑹?鏃惰兘姝ｇ‘瑙ｆ瀽锛?
const CN_COLOR_MAP: Record<string, string> = {
  "绾?: "#D32F2F", "绾㈣壊": "#D32F2F", "澶х孩": "#D32F2F", "姝ｇ孩": "#D32F2F", "涓浗绾?: "#C62828",
  "鏆楃孩": "#8B0000", "娣辩孩": "#8B0000", "閰掔孩": "#722F37", "鐜孩": "#E91E63",
  "閲?: "#F9A825", "閲戣壊": "#F9A825", "閲戦粍": "#F9A825", "鏆楅噾": "#C9A96E",
  "姗?: "#E65100", "姗欒壊": "#E65100", "姗樿壊": "#E65100", "鏆栨": "#EF6C00",
  "榛?: "#F9A825", "榛勮壊": "#F9A825", "鏄庨粍": "#FFD600", "楣呴粍": "#FFF9C4",
  "缁?: "#2E7D32", "缁胯壊": "#2E7D32", "缈犵豢": "#00695C", "澧ㄧ豢": "#1B5E20",
  "钃?: "#1565C0", "钃濊壊": "#1565C0", "娣辫摑": "#0D47A1", "澶╄摑": "#42A5F5",
  "绱?: "#7B1FA2", "绱壊": "#7B1FA2", "娣辩传": "#4A148C", "钖拌。鑽?: "#9C27B0",
  "绮?: "#E8576C", "绮夎壊": "#E8576C", "绮夌孩": "#E8576C", "妗冪矇": "#F48FB1",
  "妫?: "#5D4037", "妫曡壊": "#5D4037", "鍜栧暋": "#5D4037", "娣辨": "#3E2723",
  "榛?: "#212121", "榛戣壊": "#212121", "澧ㄨ壊": "#1A1A2E",
  "鐧?: "#FFFFFF", "鐧借壊": "#FFFFFF",
  "鐏?: "#78909C", "鐏拌壊": "#78909C", "閾剁伆": "#90A4AE", "閾?: "#90A4AE",
};

function parseChineseColors(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  // 娓呮礂锛氬幓鎺?鑹?閲嶅銆佹彁鍙栭鑹茶瘝
  const results: string[] = [];
  // 鍏堝皾璇曟彁鍙杊ex鑹插€?
  const hexMatches = text.match(/#[0-9a-fA-F]{6}/g);
  if (hexMatches && hexMatches.length > 0) return hexMatches;
  // 閫愯瘝鍖归厤涓枃棰滆壊鍚嶏紙浠庨暱鍒扮煭鍖归厤锛?
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
  
  // V95: 澶勭悊涓枃瀛楃涓插"绾㈣壊鍜岄噾鑹?
  if (typeof colors === 'string') {
    const parsed = parseChineseColors(colors);
    if (parsed.length > 0) {
      return {
        primary: parsed[0] || defaults.primary,
        secondary: parsed[1] || defaults.secondary,
        accent: parsed[2] || defaults.accent,
      };
    }
    // 涓嶆槸棰滆壊鍚嶏紝鍙兘鏄函hex
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

// ========== V103: 鍝佺墝涓撳睘鏂囨鐢熸垚 ==========
function buildAuxGraphicsIntro(bp: any, colors: { primary: string; secondary: string; accent: string }, industry?: string): string | undefined {
  if (!bp) return undefined;
  const parts: string[] = [];
  const colorGuidance = bp.logoDesignSuggestions?.colorGuidance;
  if (colorGuidance) {
    parts.push(colorGuidance);
  }
  const style = bp.logoDesignSuggestions?.style || bp.visualStyleSuggestion;
  if (style) {
    parts.push(`瑙嗚椋庢牸涓?{style}锛岃緟鍔╁浘褰笌鏁翠綋椋庢牸缁熶竴銆俙);
  }
  if (parts.length > 0) {
    return parts.join('銆?) + '銆傛潯绾圭粍鍚堝懠搴斿搧鐗岃妭濂忔劅锛岀偣闃电粍鍚堜紶閫掔簿鑷寸З搴忋€?;
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
    if (primaryMeaning) parts.push(`鍝佺墝涓昏壊#${colors.primary}锛?{primaryMeaning}`);
    if (secondaryMeaning) parts.push(`杈呭姪鑹?${colors.secondary}锛?{secondaryMeaning}`);
    if (accentMeaning) parts.push(`寮鸿皟鑹?${colors.accent}锛?{accentMeaning}`);
    if (parts.length > 0) return parts.join('锛?) + '銆?;
  }
  // fallback: 鐢╟olorGuidance鍜屽搧鐗屽畾浣?
  const colorGuidance = bp.logoDesignSuggestions?.colorGuidance;
  const positioning = bp.brandPositioning;
  const keywords = bp.brandToneKeywords?.join('銆?);
  if (colorGuidance || positioning) {
    const parts: string[] = [];
    if (colorGuidance) parts.push(colorGuidance);
    if (positioning && keywords) parts.push(`鍛煎簲鍝佺墝銆?{keywords}銆嶇殑璋冩€у畾浣峘);
    if (parts.length > 0) return parts.join('锛?) + '銆備笁鑹茬粍鍚堢‘淇濆搧鐗岃瑙夌殑涓撲笟鎬с€佷竴鑷存€т笌璇嗗埆搴︺€?;
  }
  return undefined;
}

// ========== 閫氫箟涓囩浉 寮傛鍥剧墖鐢熸垚 ==========
const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
const DASHSCOPE_TASK = "https://dashscope.aliyuncs.com/api/v1/tasks";

// ========== 灏忎簯闆€(Seedream)鐢熷浘 ==========
const XYQ_BASE = "https://xyq.jianying.com";

async function generateXYQSceneImage(prompt: string): Promise<string | null> {
  const accessKey = process.env.XYQ_ACCESS_KEY;
  if (!accessKey) {
    console.error("[generateXYQ] No XYQ_ACCESS_KEY");
    return null;
  }

  try {
    // Step 1: 鍒涘缓浼氳瘽骞舵彁浜ょ敓鍥句换鍔?
    const submitResp = await fetch(`${XYQ_BASE}/api/biz/v1/skill/submit_run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: prompt }),
    });

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      console.error(`[generateXYQ] Submit failed: ${submitResp.status} ${errText.substring(0, 200)}`);
      return null;
    }

    const submitData = await submitResp.json();
    if (submitData.ret !== "0") {
      console.error(`[generateXYQ] API error: ${submitData.ret} ${submitData.errmsg}`);
      return null;
    }

    const threadId = submitData.data?.thread_id;
    const runId = submitData.data?.run_id;
    if (!threadId || !runId) {
      console.error(`[generateXYQ] No thread_id/run_id:`, JSON.stringify(submitData).substring(0, 200));
      return null;
    }

    console.log(`[generateXYQ] Task submitted: thread=${threadId} run=${runId}`);

    // Step 2: 杞缁撴灉锛堟渶澶氱瓑120绉掞紝姣?0绉掓煡涓€娆★級
    for (let poll = 0; poll < 12; poll++) {
      await new Promise(r => setTimeout(r, 10000));

      const pollResp = await fetch(`${XYQ_BASE}/api/biz/v1/skill/get_thread`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ thread_id: threadId, run_id: runId, after_seq: 0 }),
      });

      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      if (pollData.ret !== "0") continue;

      const runList = pollData.data?.thread?.run_list;
      if (!runList || runList.length === 0) continue;

      const run = runList[0];
      const runState = run.state;

      // state: 1=pending, 2=running, 3=success, 4=failed, 5=cancelled
      if (runState === 4 || runState === 5) {
        console.error(`[generateXYQ] Task failed/cancelled: state=${runState} reason=${run.fail_reason || ""}`);
        return null;
      }

      if (runState === 3) {
        // 鎴愬姛锛氫粠entry_list涓彁鍙栧浘鐗嘦RL
        const entries = run.entry_list || [];
        for (const entry of entries) {
          const message = entry.message;
          if (message?.content) {
            for (const c of message.content) {
              if (c.sub_type === "biz/x_data_image") {
                try {
                  const imgData = JSON.parse(c.data);
                  const imageUrl = imgData?.image?.url;
                  if (imageUrl) {
                    console.log(`[generateXYQ] Got image URL, downloading...`);
                    const imgResp = await fetch(imageUrl);
                    if (imgResp.ok) {
                      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                      const base64 = imgBuf.toString("base64");
                      console.log(`[generateXYQ] OK! base64 length=${base64.length}`);
                      return `data:image/png;base64,${base64}`;
                    }
                    console.error(`[generateXYQ] Failed to download image`);
                  }
                } catch (e) {
                  // 缁х画鏌ユ壘
                }
              }
            }
          }
        }
        console.error(`[generateXYQ] Task succeeded but no image URL found`);
        return null;
      }

      // 浠嶅湪杩涜涓?
      console.log(`[generateXYQ] Polling... state=${runState}`);
    }

    console.error(`[generateXYQ] Timeout after 120s`);
    return null;
  } catch (err: any) {
    console.error(`[generateXYQ] Error: ${err.message}`);
    return null;
  }
}



// ========== Ark Seedream 杈呭姪锛歜ase64 鈫?鍏綉URL ==========
async function uploadBase64ToUrl(base64Data: string, label: string): Promise<string | null> {
  try {
    const matches = base64Data.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) return null;
    const mime = matches[1];
    const b64 = matches[2];
    const buf = Buffer.from(b64, 'base64');
    const ext = mime.includes('png') ? 'png' : mime.includes('svg') ? 'svg' : 'jpg';
    const fileName = `ref-${label}-${Date.now()}.${ext}`;
    const filePath = `ref-images/${fileName}`;
    
    const { data, error } = await supabaseAdmin.storage
      .from('brand-brain-generated')
      .upload(filePath, buf, { contentType: mime, upsert: true });
    if (error) { console.warn('[uploadBase64ToUrl] Failed:', error.message); return null; }
    
    const { data: urlData } = supabaseAdmin.storage
      .from('brand-brain-generated')
      .getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.warn('[uploadBase64ToUrl] Error:', String(e));
    return null;
  }
}

async function generateSceneImage(prompt: string, logoBase64?: string): Promise<string | null> {
  const apiKey = process.env.ALIYUN_API_KEY;
  if (!apiKey) {
    console.error("[generateImage] No ALIYUN_API_KEY");
    return null;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // V9: 鏀寔Logo鍙傝€冨浘 - wan2.6-image鍥惧儚缂栬緫妯″紡
      const useRefImage = !!logoBase64;
      const model = useRefImage ? "wan2.6-image" : "wan2.6-t2i";
      let imgContent: Array<{ text?: string; image?: string }>;
      if (useRefImage) {
        imgContent = [{ text: prompt }, { image: logoBase64! }];
      } else {
        imgContent = [{ text: prompt }];
      }
      const requestParams = useRefImage
        ? { size: "1104*1472", n: 1, enable_interleave: false, prompt_extend: true }
        : { size: "1104*1472", n: 1 };
      // Step 1: 鎻愪氦寮傛浠诲姟
      const submitResp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model,
          input: { messages: [{ role: "user", content: imgContent }] },
          parameters: requestParams,
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        console.error(`[generateImage] Submit attempt ${attempt}: ${submitResp.status} ${errText.substring(0, 200)}`);
        if (submitResp.status === 401) break;
        continue;
      }

      const submitData = await submitResp.json();
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        console.error(`[generateImage] No task_id in response:`, JSON.stringify(submitData).substring(0, 200));
        continue;
      }

      console.log(`[generateImage] Task submitted: ${taskId}`);

      // Step 2: 杞浠诲姟缁撴灉锛堟渶澶氱瓑90绉掞級
      for (let poll = 0; poll < 18; poll++) {
        await new Promise(r => setTimeout(r, 5000)); // 绛?绉?

        const pollResp = await fetch(`${DASHSCOPE_TASK}/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!pollResp.ok) continue;
        const pollData = await pollResp.json();
        const status = pollData.output?.task_status;

        if (status === "SUCCEEDED") {
          // 鎻愬彇鍥剧墖URL
          const imageUrl = pollData.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imageUrl) {
            console.error(`[generateImage] No image URL in result`);
            break;
          }

          // Step 3: 涓嬭浇鍥剧墖杞琤ase64
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const base64 = imgBuf.toString("base64");
            console.log(`[generateImage] OK! base64 length=${base64.length}`);
            return `data:image/png;base64,${base64}`;
          }
          console.error(`[generateImage] Failed to download image`);
          break;
        }

        if (status === "FAILED") {
          console.error(`[generateImage] Task failed:`, pollData.output?.message || "unknown");
          break;
        }

        // 浠嶅湪PENDING/RUNNING锛岀户缁疆璇?
      }
    } catch (err: any) {
      console.error(`[generateImage] Attempt ${attempt} error: ${err.message}`);
    }
  }
  return null;
}


// V17: 閫氫箟涓囩浉AI鐢熷浘Logo锛堟浛浠eepSeek SVG鏂规锛?
async function generateLogoImage(
  prompt: string,
  brandColors: { primary: string; secondary: string }
): Promise<string | null> {
  const apiKey = process.env.ALIYUN_API_KEY;
  if (!apiKey) {
    console.error("[generateLogo] No ALIYUN_API_KEY");
    return null;
  }

  // 澧炲己prompt锛氱‘淇滾ogo璁捐鍝佽川
  const enhancedPrompt = `${prompt}, logo design on clean white background, high resolution, professional graphic design, centered composition, suitable for branding applications, clean and scalable`;

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Logo鐢ㄦ鏂瑰舰1024x1024
      const submitResp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: "wan2.6-t2i",
          input: { messages: [{ role: "user", content: [{ text: enhancedPrompt }] }] },
          parameters: { size: "1280*1280", n: 1 },
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        console.error(`[generateLogo] Submit attempt ${attempt}: ${submitResp.status} ${errText.substring(0, 200)}`);
        if (submitResp.status === 401) break;
        continue;
      }

      const submitData = await submitResp.json();
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        console.error(`[generateLogo] No task_id:`, JSON.stringify(submitData).substring(0, 200));
        continue;
      }

      console.log(`[generateLogo] Task submitted: ${taskId}`);

      // 杞缁撴灉锛堟渶澶氱瓑90绉掞級
      for (let poll = 0; poll < 18; poll++) {
        await new Promise(r => setTimeout(r, 5000));

        const pollResp = await fetch(`${DASHSCOPE_TASK}/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!pollResp.ok) continue;
        const pollData = await pollResp.json();
        const status = pollData.output?.task_status;

        if (status === "SUCCEEDED") {
          const imageUrl = pollData.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imageUrl) {
            console.error(`[generateLogo] No image URL in result`);
            break;
          }

          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const base64 = imgBuf.toString("base64");
            console.log(`[generateLogo] OK! base64 length=${base64.length}`);
            return `data:image/png;base64,${base64}`;
          }
          console.error(`[generateLogo] Failed to download image`);
          break;
        }

        if (status === "FAILED") {
          console.error(`[generateLogo] Task failed:`, pollData.output?.message || "unknown");
          break;
        }
      }
    } catch (err: any) {
      console.error(`[generateLogo] Attempt ${attempt} error:`, err.message);
    }
  }
  return null;
}

// ========== 娴佸紡杩涘害鎺ㄩ€佽緟鍔╁嚱鏁?==========
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
      await updateDb("completed", "鐢熸垚瀹屾垚锛?, 100, {
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

// ========== 涓绘祦绋嬶紙寮傛鍚庡彴锛?==========
// V97: 鏍规嵁鍦烘櫙鐗╂枡涓枃鍚嶅姩鎬佸綊绫诲埌PPTX椤甸潰鍒嗙被
function mapSceneToPage(zhLabel: string): "stationery" | "packaging" | "marketing" {
  const label = zhLabel.toLowerCase();
  // 鍖呰绫伙細琚嬨€佺洅銆佽创绾搞€佹澂銆佺摱銆佸鍗栥€佹灉绡€佺瀛愬銆侀宸剧瓑
  if (/鍖呰|琚媩鐩抾璐寸焊|鏉|鏉瘄鐡秥澶栧崠|鏋滅|绛峰瓙濂梶椁愬肪/.test(label)) return "packaging";
  // 鏂囧叿/鍗¤瘉绫伙細鍚嶇墖銆佷俊灏併€佸崱銆佽瘉銆佹枃浠跺す銆佽绋嬭〃銆佽壊鏉裤€佹爣绛剧瓑
  if (/鍚嶇墖|淇″皝|淇＄焊|鏂囧叿|璇亅鍗鏂囦欢澶箌璇剧▼琛▅鑹叉澘|鏍囩/.test(label)) return "stationery";
  // 榛樿褰抦arketing锛氭嫑鐗屻€佹捣鎶ャ€佸睍鏋躲€佸洿瑁欍€佽彍鍗曘€佺珛鐗岀瓑
  return "marketing";
}

export async function POST(req: NextRequest) {
  // Parse request body first
  let projectId: string | null = null;
  let body: any = {};
  let prev: Record<string, any> = {};  // cached client_info for reducing DB queries
  let step = 'full';  // V83: 'full' = 鍏ㄦ祦绋? 'resume' = 鏂偣缁紶
  try {
    body = await req.json();
    projectId = body.projectId || null;
    step = body.step || 'full';
    if (!['full', 'resume'].includes(step)) step = 'full';
  } catch { /* ignore parse error */ }

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // V88: 宸叉湁瀹屾垚缁撴灉涓旈潪寮哄埗閲嶆柊鐢熸垚 鈫?鐩存帴杩斿洖锛岄伩鍏嶉噸澶嶇儳閽?
  const forceRegenerate = body.force === true;
  if (!forceRegenerate && step === 'full') {
    try {
      const { data: existingProject } = await supabaseAdmin.from("projects").select("status, client_info").eq("id", projectId).single();
      const existingCi = (existingProject?.client_info as Record<string, any>) || {};
      const existingResult = existingCi.pptxResult;
      if (existingProject?.status === 'completed' && existingResult?.url && existingResult?.storageUrl) {
        console.log(`[generate-pptx] V88: Project ${projectId} already has completed result, skipping. Use force=true to override.`);
        return NextResponse.json({
          status: "already_completed",
          message: "璇ラ」鐩凡鏈夊畬鎴愮殑VI鎵嬪唽锛屾棤闇€閲嶅鐢熸垚",
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
      client_info: { ...prev, generationStatus: "pptx_assembling", generationMessage: isResume ? "姝ｅ湪缁紶鐢熸垚..." : "姝ｅ湪鍑嗗鐢熸垚VI鎵嬪唽...", generationPercent: resumePercent },
    }).eq("id", projectId);
  } catch (e: any) {
    console.warn("[generate-pptx] Initial status update error:", e.message);
  }

  // Run generation in background (fire-and-forget)
  void (async () => {
    const { sendProgress, sendComplete, sendError } = createDbProgressHelpers(projectId!, prev);
    const generationId = `gen-${Date.now()}`;
    const arkUsageLog: { model: string; type: string; cost: number; timestamp: string }[] = [];  // V32: 鏂硅垷鐢ㄩ噺杩借釜
    // V91: 鍥剧墖鎴愭湰鍚屾鍐欏叆api_usage_log
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
    // V30: 璁板綍鐢熸垚鍘嗗彶鍒皏iGenerationHistory
    sendProgress("loading", "姝ｅ湪鍔犺浇椤圭洰鏁版嵁...", 5);
    try {
      // Use cached prev instead of redundant select
      const history = prev.viGenerationHistory || [];
      history.push({ id: generationId, format: generationFormat, status: 'generating', createdAt: new Date().toISOString(), fileName: '', fileSize: 0, pageCount: 0, selectedLogoUrl: '', sceneImageCount: 0, downloadUrl: '' });
      prev.viGenerationHistory = history;
      await supabaseAdmin.from("projects").update({ client_info: { ...prev } }).eq("id", projectId!);
    } catch (e: any) { console.warn("[generate-pptx] History record error:", e.message); }
    // ===== Step 1: 浠?Supabase 鏌?project + submission =====
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

    sendProgress("extracting", "姝ｅ湪鎻愬彇鍝佺墝鏁版嵁...", 10);
    // ===== Step 2: 鎻愬彇鎵€鏈夋暟鎹?=====
    // V83: 浠巆lient_info.discoveryData琛ュ厖鏁版嵁锛屼笉鍐嶄涪澶?
    const ci = (project?.client_info as Record<string, any>) || {};
    const dd = (ci?.discoveryData) as Record<string, any> || {};
    // V105: companyName鍙栧€奸摼 鈥?鍔燾lient_info.companyName鍏滃簳
    const companyName = body.clientInfo?.companyName || submission?.company_name || submission?.companyName || project?.client_name || ci?.companyName || body.clientInfo?.clientName || dd.storeName || "鍝佺墝";
    const industry = body.clientInfo?.industry || submission?.industry || project?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || dd.brandSpirit || "";
    const coreValues = body.clientInfo?.coreValues || submission?.core_values || dd.brandSpiritCustom || "";
    const targetMarket = body.clientInfo?.targetMarket || submission?.target_market || submission?.targetMarket || "";
    let logoPhilosophy = body.clientInfo?.logoPhilosophy || submission?.logo_philosophy || submission?.logoPhilosophy || ci?.logoPhilosophy || dd.signatureItem || "";
    const mascotPhilosophy = body.clientInfo?.mascotPhilosophy || submission?.mascot_philosophy || submission?.mascotPhilosophy || "";

    const rawColors = body.brandColors || submission?.existing_brand_color || submission?.brand_colors || submission?.brandColors;
    let realColors = normalizeColors(rawColors, industry);

    const industryType = getIndustryType(industry);
    console.log("[generate-pptx] ===== BRAND DATA =====");
    console.log("[generate-pptx] Company:", companyName, "| Industry:", industry, "| Type:", industryType);
    console.log("[generate-pptx] Colors:", JSON.stringify(realColors));

    sendProgress("analyzing", "姝ｅ湪杩涜AI鍝佺墝鍒嗘瀽...", 15);
    // ===== Step 2.5: AI 鍝佺墝鍒嗘瀽 =====
    // 浼樺寲锛氫紭鍏堝鐢ㄥ凡鏈夊搧鐗屽垎鏋愮粨鏋滐紝閬垮厤閲嶅DeepSeek璋冪敤
    const existingBrandProfile = (project?.client_info as Record<string, any>)?.brandProfile;
    let brandProfile: any = null;
    let effectiveBrandVision = brandVision;
    let effectiveCoreValues = coreValues;
    let effectiveTargetMarket = targetMarket;
    let effectiveBrandStory = "";
    let dynamicScenePrompts: Array<{zh: string; en: string}> | null = null;

    if (existingBrandProfile?.brandToneKeywords?.length > 0) {
      // 澶嶇敤宸叉湁鍒嗘瀽 鈥?璺宠繃DeepSeek璋冪敤锛岀渷20绉?0.04鍏?
      brandProfile = existingBrandProfile;
      if (brandProfile.refinedBrandVision) effectiveBrandVision = brandProfile.refinedBrandVision;
      if (brandProfile.refinedCoreValues) effectiveCoreValues = brandProfile.refinedCoreValues;
      if (brandProfile.refinedTargetMarket) effectiveTargetMarket = brandProfile.refinedTargetMarket;
      if (brandProfile.brandStory) effectiveBrandStory = brandProfile.brandStory;
      if (brandProfile.sceneImageSuggestions?.length >= 5) dynamicScenePrompts = brandProfile.sceneImageSuggestions;
      if (brandProfile.logoDesignSuggestions) {
        console.log("[generate-pptx] Reusing brand analysis, logo suggestions available:", brandProfile.logoDesignSuggestions.style);
        // V103-fix2: 澶嶇敤璺緞涔熼渶瑕乴ogoPhilosophy fallback
        if (!logoPhilosophy && brandProfile.logoDesignSuggestions.concept) {
          const parts = [brandProfile.logoDesignSuggestions.concept];
          if (brandProfile.logoDesignSuggestions.elements) parts.push(`鏍稿績鍏冪礌锛?{brandProfile.logoDesignSuggestions.elements}`);
          if (brandProfile.logoDesignSuggestions.style) parts.push(`椋庢牸锛?{brandProfile.logoDesignSuggestions.style}`);
          logoPhilosophy = parts.join("銆?);
        }
        // V115: designPhilosophy琛ュ厖
        if (logoPhilosophy && logoPhilosophy.length < 30 && brandProfile?.designPhilosophy) {
          logoPhilosophy = brandProfile.designPhilosophy;
        }
      }
      console.log("[generate-pptx] Reusing existing brand analysis 鈥?skipped DeepSeek call");
      sendProgress("analyzed", "鍝佺墝鍒嗘瀽瀹屾垚(澶嶇敤)", 30);
    } else {
      // 鏃犲凡鏈夊垎鏋?鈥?鎵цDeepSeek鍝佺墝鍒嗘瀽
      await supabaseAdmin.from("projects").update({ status: "brand_analyzing", updated_at: new Date().toISOString() }).eq("id", projectId);
      try {        if ((companyName !== "鍝佺墝")) {
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
      body: {model: "deepseek-v4-flash",
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
              console.log("[generate-pptx] Brand analysis OK:", brandProfile.brandToneKeywords);
              sendProgress("analyzed", "鍝佺墝鍒嗘瀽瀹屾垚", 30);

              if (brandProfile.refinedBrandVision) effectiveBrandVision = brandProfile.refinedBrandVision;
              if (brandProfile.refinedCoreValues) effectiveCoreValues = brandProfile.refinedCoreValues;
              if (brandProfile.refinedTargetMarket) effectiveTargetMarket = brandProfile.refinedTargetMarket;
              if (brandProfile.brandStory) effectiveBrandStory = brandProfile.brandStory;
              if (brandProfile.logoDesignSuggestions) {
                console.log("[generate-pptx] Logo design suggestions available:", brandProfile.logoDesignSuggestions.style);
                // V103: logoPhilosophy fallback鍒癆I鍒嗘瀽鐨刢oncept+elements+style
                if (!logoPhilosophy && brandProfile.logoDesignSuggestions.concept) {
                  const parts = [brandProfile.logoDesignSuggestions.concept];
                  if (brandProfile.logoDesignSuggestions.elements) parts.push(`鏍稿績鍏冪礌锛?{brandProfile.logoDesignSuggestions.elements}`);
                  if (brandProfile.logoDesignSuggestions.style) parts.push(`椋庢牸锛?{brandProfile.logoDesignSuggestions.style}`);
                  logoPhilosophy = parts.join("銆?);
                }
                // V115: designPhilosophy琛ュ厖
                if (logoPhilosophy && logoPhilosophy.length < 30 && brandProfile?.designPhilosophy) {
                  logoPhilosophy = brandProfile.designPhilosophy;
                }
              }
              if (brandProfile.sceneImageSuggestions?.length >= 5) {
                dynamicScenePrompts = brandProfile.sceneImageSuggestions;
              }

              // 淇濆瓨鍝佺墝妗ｆ鍒癉B锛堜繚鐣檚electedLogo鍜宭ogoGenerationResults锛?
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

    // V106: 鍝佺墝淇℃伅瀹屾暣鎬ф鏌モ€斺€攂randProfile涓虹┖鏃堕樆鏂敓鎴愶紝瑕佹眰琛ュ厖淇℃伅
    // 鏍瑰洜锛歜randProfile涓虹┖ 鈫?鏃爏ceneImageSuggestions 鈫?璧扮‖缂栫爜閫氱敤prompt 鈫?瀹炴櫙鍥惧畬鍏ㄨ窇鍋?
    const hasBrandProfile = brandProfile && brandProfile.brandToneKeywords?.length > 0;
    const hasSceneSuggestions = brandProfile?.sceneImageSuggestions?.length >= 5;
    if (!hasBrandProfile || !hasSceneSuggestions) {
      // 鏀堕泦缂哄け瀛楁
      const missingFields: string[] = [];
      const fieldLabels: Record<string, string> = {
        brandVision: "鍝佺墝鎰挎櫙",
        coreValues: "鏍稿績浠峰€?,
        targetMarket: "鐩爣瀹㈢兢",
        industry: "琛屼笟绫诲埆",
      };
      if (!industry) missingFields.push("industry");
      if (!brandVision && !effectiveBrandVision) missingFields.push("brandVision");
      if (!coreValues && !effectiveCoreValues) missingFields.push("coreValues");
      if (!targetMarket && !effectiveTargetMarket) missingFields.push("targetMarket");

      // 濡傛灉娌℃湁缂哄け瀛楁浣哹randProfile浠嶇劧涓虹┖锛岃鏄庢槸AI鍒嗘瀽澶辫触
      const analysisFailed = missingFields.length === 0 && !hasBrandProfile;
      
      // analysisFailed鏃舵彁渚涘彲閫夎ˉ鍏呭瓧娈碉紝甯姪AI鏇村ソ鍒嗘瀽
      const optionalFields = analysisFailed ? ["brandVision", "coreValues", "targetMarket", "logoPhilosophy"] : [];
      const optionalLabels: Record<string, string> = { brandVision: "鍝佺墝鎰挎櫙", coreValues: "鏍稿績浠峰€?, targetMarket: "鐩爣瀹㈢兢", logoPhilosophy: "Logo鐞嗗康" };

      console.warn("[generate-pptx] V106: Brand info incomplete 鈥?brandProfile:", !!hasBrandProfile, "sceneSuggestions:", hasSceneSuggestions, "missingFields:", missingFields, "analysisFailed:", analysisFailed);

      // 鏇存柊DB鐘舵€佷负failed锛岄檮甯︾己澶变俊鎭?
      await supabaseAdmin.from("projects").update({
        status: "failed",
        updated_at: new Date().toISOString(),
        client_info: {
          ...prev,
          generationStatus: "failed",
          generationMessage: analysisFailed
            ? "AI鍝佺墝鍒嗘瀽澶辫触锛岃閲嶈瘯鎴栬ˉ鍏呭搧鐗屼俊鎭?
            : `杩橀渶琛ュ厖${missingFields.length}椤癸細${missingFields.map(k => fieldLabels[k] || k).join("銆?)}`,
          generationPercent: 0,
          infoIncomplete: {
            missingFields,
            analysisFailed,
            fieldLabels: Object.fromEntries(missingFields.map(k => [k, fieldLabels[k]])),
          },
        },
      }).eq("id", projectId!);

      return NextResponse.json({
        error: analysisFailed ? "AI鍝佺墝鍒嗘瀽澶辫触锛岃閲嶈瘯" : "鍝佺墝淇℃伅涓嶅畬鏁?,
        status: "info_incomplete",
        missingFields,
        fieldLabels: Object.fromEntries(missingFields.map(k => [k, fieldLabels[k]])),
        analysisFailed,
        optionalFields: analysisFailed ? optionalFields.map(k => ({ key: k, label: optionalLabels[k] })) : [],
      }, { status: 400 });
    }

    // V103: 濡傛灉brandProfile鏈塩olorPalette锛岀敤瀹冭鐩栬涓氶粯璁よ壊
    if (brandProfile?.colorPalette && Array.isArray(brandProfile.colorPalette) && brandProfile.colorPalette.length >= 3) {
      const cp = brandProfile.colorPalette;
      const cpPri = cp[0]?.hex;
      const cpSec = cp[1]?.hex;
      const cpAcc = cp[2]?.hex;
      if (cpPri) realColors.primary = cpPri.replace('#', '');
      if (cpSec) realColors.secondary = cpSec.replace('#', '');
      if (cpAcc) realColors.accent = cpAcc.replace('#', '');
      console.log("[generate-pptx] V103: Using AI colorPalette:", JSON.stringify(realColors));
    }

    sendProgress("loading_assets", "姝ｅ湪鍔犺浇鍝佺墝绱犳潗...", 40);
    // ===== Step 3: 鍔犺浇 Logo/Mascot =====
    // V12: 鍦烘櫙鍥炬覆鏌撲腑
    await supabaseAdmin.from("projects").update({ status: "scene_rendering", updated_at: new Date().toISOString() }).eq("id", projectId);
    let logoData: string | null = null;
    let mascotData: string | null = null;
    let mascotSplitViews: string[] | null = null;

    // V28: Logo鍔犺浇浼樺厛绾? body.logoUrl > selectedLogo(瀹汉宸查€? > submission.logo_assets > 鏈湴/Storage
    if (body.logoUrl) logoData = await loadImg(body.logoUrl);
    // V28: 浼樺厛浠巄randProfile.selectedLogo鍔犺浇锛堝浜哄凡閫夋嫨鐨凩ogo锛?
    if (!logoData && project?.client_info) {
      try {
        const savedProfile = ((project.client_info as Record<string, any>)?.brandProfile) as Record<string, any> | undefined;
        if (savedProfile?.selectedLogo?.imageUrl) {
          console.log("[generate-pptx] Using customer-selected logo from brandProfile.selectedLogo");
          logoData = await loadImg(savedProfile.selectedLogo.imageUrl);
        }
        // V105: 瀹㈡埛鏈€塋ogo鏃讹紝浣跨敤绗竴涓敓鎴愮殑Logo
        if (!logoData && savedProfile && savedProfile.logoGenerationResults && savedProfile.logoGenerationResults.length > 0) {
          const firstLogoUrl = savedProfile.logoGenerationResults[0].imageUrl;
          if (firstLogoUrl) {
            console.log("[generate-pptx] No selectedLogo, using first generated logo");
            logoData = await loadImg(firstLogoUrl);
          }
        }
      } catch (e) {
        console.warn("[generate-pptx] Could not load selectedLogo:", e);
      }
    }
    // V28: 浠巗ubmission.logo_assets鍔犺浇锛堝浜轰笂浼犳垨AI閫夋嫨鍚庝繚瀛樼殑Logo锛?
    if (!logoData && submission) {
      const logoAssets = (submission as any).logo_assets || [];
      if (logoAssets.length > 0) {
        const lastLogo = logoAssets[logoAssets.length - 1];
        console.log("[generate-pptx] Using logo from submission.logo_assets:", lastLogo.fileName);
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

    console.log("[generate-pptx] Logo:", logoData ? "OK" : "null", "| Mascot:", mascotData ? "OK" : "null");

    // V83: 淇濆瓨checkpoint 鈥?鍝佺墝鍒嗘瀽+Logo鍔犺浇瀹屾垚锛屽鏋滃悗缁秴鏃跺彲浠庢缁紶
    try {
      const { data: ckInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const ckPrev = (ckInfo?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...ckPrev, generationCheckpoint: 'assets_loaded', generationPercent: 45 },
      }).eq("id", projectId!);
      console.log("[generate-pptx] Checkpoint saved: assets_loaded");
    } catch (e: any) { console.warn("[generate-pptx] Checkpoint save error:", e.message); }

    // V29: 鐢ㄨ瑙堿I璇诲彇Logo鍥剧墖锛岀敓鎴愯嫳鏂囨弿杩扮敤浜庡満鏅浘prompt
    let logoVisualDesc = "";
    if (logoData) {
      logoVisualDesc = await describeLogoForScene(logoData);
      if (logoVisualDesc) arkUsageLog.push({ model: 'qwen-vl-max', type: 'vision', cost: 0.01, timestamp: new Date().toISOString() });
      console.log("[generate-pptx] Logo visual desc:", logoVisualDesc ? "OK" : "EMPTY");
    }

    // V17: 鏃燣ogo鏃剁敤閫氫箟涓囩浉AI鐢熷浘Logo锛堟浛浠eepSeek SVG锛?
    let aiLogoData: string | null = null;
    if (!logoData && companyName !== "鍝佺墝") {
      try {
        console.log("[generate-pptx] Generating AI logo via 閫氫箟涓囩浉 for", companyName);
        sendProgress("ai_logo", "姝ｅ湪鐢ˋI鐢熸垚Logo鏂规...", 45);
        const industryLabel: Record<string, string> = {
          beauty: "beauty salon / nail art", restaurant: "Chinese restaurant / noodle shop", fastfood: "fast food burger shop / snack stall", beverage: "bubble tea / coffee shop",
          fashion: "fashion boutique / clothing brand", mother_baby: "maternity & baby brand", wedding: "wedding planning / photography studio",
          fitness: "gym / fitness center", pharmacy: "pharmacy / wellness", pet: "pet care / pet shop",
          retail: "retail shop", education: "education center", fresh_food: "fruit and fresh produce shop", floral: "flower shop / florist", home: "home decor store", nail: "nail salon", tea: "tea house / tea brand", general: "lifestyle brand"
        };
        const industryEn = industryLabel[industryType] || "lifestyle brand";
        // 浼樺厛浣跨敤brand-analysis鐨刲ogoDesignSuggestions
        let logoPrompt = "";
        if (brandProfile?.logoDesignSuggestions?.prompts?.length > 0) {
          logoPrompt = brandProfile.logoDesignSuggestions.prompts[0];
          console.log("[generate-pptx] Using brand-analysis logo prompt:", logoPrompt.substring(0, 80));
        } else {
          // Fallback: 鏍规嵁琛屼笟鍜屽搧鐗屼俊鎭瀯寤洪珮璐ㄩ噺prompt
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
          arkUsageLog.push({ model: 'wan2.6-t2i', type: 'logo', cost: 0.20, timestamp: new Date().toISOString() });
          console.log("[generate-pptx] AI logo via 閫氫箟涓囩浉 OK! base64 length:", aiLogoData.length);
        } else {
          console.warn("[generate-pptx] AI logo generation failed, will use fallback icon");
        }
      } catch (logoErr) {
        console.warn("[generate-pptx] AI logo generation error:", logoErr);
      }
    }

    // ===== Step 4: 鐢熸垚 AI 鍐欏疄鍦烘櫙鍥撅紙5寮狅紝寮傛骞惰锛?=====
    // V83: 澹版槑鍦烘櫙鍥惧彉閲忥紙resume閫昏緫闇€瑕佸厛澹版槑锛?
    const sceneImages: Record<string, string> = {};
    const sceneLabels: Record<string, string> = {};
    let goto_rendering = false;
    let imgSuccess = 0;

    // 鍔ㄦ€佸満鏅浘prompt锛圓I鍒嗘瀽缁撴灉 > 纭紪鐮乫allback锛?
    let imgDefs = SCENE_IMG_DEFS[industryType] || SCENE_IMG_DEFS.general;
    if (dynamicScenePrompts && dynamicScenePrompts.length >= 5) {
      // V96: 鎭㈠浣跨敤AI鐢熸垚鐨剆ceneImageSuggestions.en浣滀负rawPrompt
      // V95鏃跺洜brand-analysis鐢熸垚缇庨鎽勫奖鑰屽純鐢紝浣哣95宸蹭慨澶峛rand-analysis prompt涓篤I mockup
      // AI鐢熸垚鐨刾rompt鍚搧鐗屽悕銆侀厤鑹层€佸叿浣撲骇鍝佺粏鑺傦紝姣旂‖缂栫爜閫氱敤prompt鏁堟灉濂藉緱澶?
      // V97: 鏍规嵁鍦烘櫙鐗╂枡涓枃鍚嶅姩鎬佸綊绫诲埌 stationery/packaging/marketing
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

    // V83: 濡傛灉checkpoint=scenes_done涓旀湁sceneStorageUrls锛屽皾璇曚粠Storage鎭㈠鍦烘櫙鍥?
    const existingSceneUrls = ((prev as any)?.sceneStorageUrls) as Record<string, string> | undefined;
    if (existingSceneUrls && Object.keys(existingSceneUrls).length >= 3 && step === 'resume') {
      console.log("[generate-pptx] Resuming: loading scene images from Storage...");
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
        console.log(`[generate-pptx] Restored ${restoredCount} scene images from Storage, skipping generation`);
        sendProgress("rendering", `鍦烘櫙鍥惧凡鎭㈠(${restoredCount}寮?锛屾鍦ㄦ覆鏌揚PTX...`, 75);
        // Skip to rendering
        goto_rendering = true;
      }
    }

    if (!goto_rendering) {
    sendProgress("images", "姝ｅ湪鐢熸垚鍦烘櫙鍥?..", 50);
    console.log("[generate-pptx] ===== AI IMAGE GENERATION =====");
    console.log("[generate-pptx] Industry:", industryType, "| Images:", imgDefs.length, "| Dynamic:", !!dynamicScenePrompts);


    // V29: 鍦烘櫙鍥剧敤鏂囩敓鍥撅紙涓嶆槸鍥剧敓鍥撅級锛屾妸Logo澶栬鎻忚堪鍐欒繘prompt
    // 鏃х増鎴愬姛鐨勫師鍥狅細鍝佺墝鍒嗘瀽AI鎶奓ogo澶栬璇︾粏鍐欒繘sceneImageSuggestions prompt
    // 鍥剧敓鍥?img2img)鍙槸椋庢牸鍙傝€冿紝涓嶈兘绮剧‘杩樺師Logo鍥炬
    const arkKey = process.env.ARK_API_KEY;


    // V29: 鎶奓ogo瑙嗚鎻忚堪杩藉姞鍒板満鏅浘prompt锛岃AI鏂囩敓鍥炬椂绮剧‘鐢诲嚭Logo
    // 浼樺厛鐢ㄨ瑙堿I鐩存帴璇籐ogo鍥剧敓鎴愮殑鎻忚堪锛屾瘮鍝佺墝鍒嗘瀽AI鐨勬帹娴嬫洿鍑嗙‘
    const logoDesc = logoVisualDesc || (brandProfile as any)?.logoDesignSuggestions?.prompts?.[0] || "";
    const logoConcept = logoVisualDesc ? "" : ((brandProfile as any)?.logoDesignSuggestions?.concept || "");
    if (logoDesc && !goto_rendering) {
      console.log(`[generate-pptx] Logo description available (source: ${logoVisualDesc ? "visual AI" : "brand analysis"}), injecting into scene prompts`);
      // V29c: 鎶?company logo"绛夋ā绯婅瘝鏇挎崲涓虹簿纭殑Logo瑙嗚鎻忚堪
      const descSnippet = logoDesc.substring(0, 300);
      for (const def of imgDefs) {
        // 鏇挎崲妯＄硦鐨?company logo"/"brand logo"涓虹簿纭弿杩?
        def.rawPrompt = def.rawPrompt.replace(/company logo/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/brand logo/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/brand emblem/gi, descSnippet);
        def.rawPrompt = def.rawPrompt.replace(/branded/gi, descSnippet);
        // 濡傛灉prompt閲屾病鏈塴ogo鐩稿叧璇嶏紝鍦ㄥ紑澶存彃鍏ユ弿杩?
        if (!def.rawPrompt.includes(descSnippet.substring(0, 50))) {
          def.rawPrompt = `Product featuring the brand mascot/logo: ${descSnippet}. ${def.rawPrompt}`;
        }
      }
    }

    console.log(`[generate-pptx] Engine: DashScope(浼樺厛) + Ark Seedream(闄嶇骇), ${imgDefs.length} images, Logo desc: ${!!logoDesc}`);

    for (let i = 0; i < imgDefs.length; i += 2) {
      const batch = imgDefs.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async (def) => {
          // V41: ComfyUI鏈湴鐢熷浘浼樺厛锛堝厤璐广€佹棤棰濆害闄愬埗锛?          try {
            const comfyOk = await isComfyUIAvailable();
            if (comfyOk) {
              const comfyResult = await comfyuiGenerateScene({ prompt: def.rawPrompt, width: 2048, height: 2048 });
              console.log(`[generate-pptx] ComfyUI OK for ${def.key} (${comfyResult.durationMs}ms)`);
              return { def, imgData: comfyResult.imageUrl };
            }
          } catch (e: any) {
            console.warn(`[generate-pptx] ComfyUI failed for ${def.key}: ${e.message}`);
          }
          // V29b: DashScope鏂囩敓鍥鹃檷绾?          try {
            // V29b: 涓嶄紶鍙傝€冨浘锛岃蛋绾枃鐢熷浘锛坧rompt閲屽凡鏈塋ogo瑙嗚鎻忚堪锛屾枃鐢熷浘姣斿浘鐢熷浘鏇磋兘绮剧‘杩樺師Logo锛?            const imgData = await generateSceneImage(def.rawPrompt);
            if (imgData) {
              console.log([generate-pptx] DashScope OK for );
              arkUsageLog.push({ model: 'wan2.6-t2i', type: 'scene', cost: 0.20, timestamp: new Date().toISOString() });
              return { def, imgData };
            }
          } catch (e: any) {
            console.warn([generate-pptx] DashScope failed for :, e.message);
          }
          // 闄嶇骇: Ark Seedream鏂囩敓鍥?
          if (arkKey) {
            try {
              const arkResult = await arkGenerateScene({ prompt: def.rawPrompt });  // V32: 浣跨敤榛樿2048x2048锛屽吋瀹?.5/5.0Lite
              const imgResp = await fetch(arkResult.imageUrl);
              if (imgResp.ok) {
                const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                console.log(`[generate-pptx] Ark Seedream fallback OK (${arkResult.model}) for ${def.key}`);
                // V32: 璁板綍鏂硅垷鐢ㄩ噺
                arkUsageLog.push({ model: arkResult.model, type: 'scene', cost: getArkUnitCost(arkResult.model), timestamp: new Date().toISOString() });
                return { def, imgData: "data:image/png;base64," + imgBuf.toString("base64") };
              }
            } catch (e: any) {
              console.warn(`[generate-pptx] Ark Seedream fallback failed for ${def.key}:`, e.message);
            }
          }
          return { def, imgData: null };
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.imgData) {
          const { def, imgData } = result.value;
          sceneImages[def.key] = imgData;
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
    } // end if (!goto_rendering) 鈥?V83: skip scene generation on resume
    console.log(`[generate-pptx] Images: ${imgSuccess}/${imgDefs.length} success`);
    // V83: 淇濆瓨鍦烘櫙鍥惧埌Supabase Storage锛岄槻姝㈠嚱鏁拌秴鏃跺悗涓㈠け
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
    sendProgress("rendering", `鍦烘櫙鍥剧敓鎴愬畬鎴?${imgSuccess}/${imgDefs.length})锛屾鍦ㄦ覆鏌揚PTX...`, 75);

    // V83: 淇濆瓨checkpoint 鈥?鍦烘櫙鍥惧畬鎴?
    try {
      const { data: ckInfo2 } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const ckPrev2 = (ckInfo2?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...ckPrev2, generationCheckpoint: 'scenes_done', generationPercent: 75, sceneStorageUrls },
      }).eq("id", projectId!);
      console.log("[generate-pptx] Checkpoint saved: scenes_done");
    } catch (e: any) { console.warn("[generate-pptx] Checkpoint save error:", e.message); }

    // ===== Step 5: 鐢熸垚钃濆浘 =====
    const blueprints = await planPages({
      clientInfo: { companyName, brandVision: effectiveBrandVision, coreValues: effectiveCoreValues, targetMarket: effectiveTargetMarket, logoPhilosophy, mascotPhilosophy, industry },
      brandColors: {
        primary: { hex: realColors.primary },
        secondary: { hex: realColors.secondary },
        accent: { hex: realColors.accent },
      },
      assetAnalysis: {
        logo: { hasLogo: !!logoData, logoUrl: body.logoUrl || "", elements: [], styleTags: [], meaning: logoPhilosophy },
        mascot: { hasMascot: !!mascotData, mascotUrl: body.mascotUrl || "", isThreeView: !!(mascotSplitViews?.length === 3), splitViews: mascotSplitViews || [], name: "", style: "", personality: "" },
      },
    });

    console.log("[generate-pptx] Blueprints:", blueprints.length, "pages");

    // ===== Step 6: 娓叉煋 PPTX =====
    // V12: PPTX缁勮涓?
    await supabaseAdmin.from("projects").update({ status: "pptx_assembling", updated_at: new Date().toISOString() }).eq("id", projectId);
    const buffer = await renderPptxToBuffer(blueprints, {
      projectName: projectId,
      companyName,
      industry,
      logoData,
      mascotData,
      mascotSplitViews,
      brandColors: realColors,
      brandVision: effectiveBrandVision,
      coreValues: effectiveCoreValues,
      targetMarket: effectiveTargetMarket,
      logoPhilosophy,
      mascotPhilosophy,
      sceneImages,
      sceneLabels,
      aiLogoData: aiLogoData || undefined,
      compressImages: true,  // V30: 鍘嬬缉鍥剧墖鍑忓皬浣撶Н
      sceneSectionTitles: brandProfile?.sceneSectionTitles,  // V98: AI鍦烘櫙椤垫爣棰?
      auxGraphicsIntro: buildAuxGraphicsIntro(brandProfile, realColors, industry),
      colorMeaning: buildColorMeaning(brandProfile, realColors, industry),
      brandStory: effectiveBrandStory || composeBrandStory(companyName, industry, effectiveBrandVision, effectiveCoreValues, effectiveTargetMarket, brandProfile),
    });

    sendProgress("saving", "姝ｅ湪淇濆瓨鏂囦欢...", 90);
    // ===== Step 7: 淇濆瓨鏂囦欢 =====
    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });
    const fileName = `vi-manual-${projectId}-${Date.now()}.${generationFormat}`;
    
    // V30: 濡傛灉format=pdf锛岀敤LibreOffice杞琍DF
    if (generationFormat === 'pdf') {
      // 鍏堜繚瀛楶PTX涓存椂鏂囦欢
      const tempPptxName = `temp-${Date.now()}.pptx`;
      const tempPptxPath = path.join(outputDir, tempPptxName);
      await writeFile(tempPptxPath, buffer);
      
      try {
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const execFileAsync = promisify(execFile);
        
        // LibreOffice headless杞崲
        await execFileAsync("libreoffice", [
          "--headless", "--convert-to", "pdf",
          "--outdir", outputDir,
          tempPptxPath
        ], { timeout: 60000 });
        
        // 璇诲彇鐢熸垚鐨凱DF
        const pdfName = tempPptxName.replace(".pptx", ".pdf");
        const pdfPath = path.join(outputDir, pdfName);
        const pdfBuffer = await readFile(pdfPath);
        
        // 鐢ㄦ纭殑鏂囦欢鍚嶉噸鍛藉悕
        const finalPdfPath = path.join(outputDir, fileName);
        const { rename } = await import("fs/promises");
        await rename(pdfPath, finalPdfPath);
        
        // 鍒犻櫎涓存椂PPTX
        const { unlink } = await import("fs/promises");
        await unlink(tempPptxPath).catch(() => {});
        
        console.log(`[generate-pptx] PDF converted: ${pdfBuffer.length} bytes`);
        
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
            console.log("[generate-pptx] PDF Storage upload OK:", pdfStorageUrl);
          }
        } catch (e: any) { console.warn("[generate-pptx] PDF Storage error:", e.message); }

        // V85-fix: PDF璺緞鍚堝苟鍐欏叆锛屽寘鍚玥istory+arkUsageLog+pptxResult
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
              generationMessage: "鐢熸垚瀹屾垚锛?,
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

    // ===== Step 7.5: 涓婁紶鍒癝upabase Storage瀛樻。 =====
    let storageUrl: string | null = null;
    try {
      const storagePath = `${projectId}/${fileName}`;
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("manuals")
        .upload(storagePath, buffer, {
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          upsert: true,
        });
      if (uploadErr) {
        console.warn("[generate-pptx] Storage upload failed:", uploadErr.message);
      } else {
        const { data: urlData } = supabaseAdmin.storage.from("manuals").getPublicUrl(storagePath);
        storageUrl = urlData?.publicUrl || null;
        console.log("[generate-pptx] Storage upload OK:", storageUrl);
      }
    } catch (storageErr: any) {
      console.warn("[generate-pptx] Storage upload error:", storageErr?.message);
    }

    console.log("[generate-pptx] ===== DONE =====", fileName, `(${imgSuccess} images, ${blueprints.length} pages)`);
    // V85-fix: 鍚堝苟鎵€鏈塂B鏇存柊涓轰竴娆″啓鍏ワ紝閬垮厤绔炴€佽鐩杙ptxResult
    // 涔嬪墠sendComplete鍐檖ptxResult 鈫?history鏇存柊鐢ㄦ棫蹇収瑕嗙洊 鈫?pptxResult涓㈠け
    try {
      const { data: doneInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId!).single();
      const donePrev = (doneInfo?.client_info as Record<string, any>) || {};
      const doneHistory = (donePrev.viGenerationHistory || []).map((h: any) =>
        h.id === generationId
          ? { ...h, status: 'completed', completedAt: new Date().toISOString(), fileName, fileSize: buffer.length, pageCount: blueprints.length, sceneImageCount: imgSuccess, downloadUrl: `/api/ai/download-pptx/${fileName}`, storageUrl }
          : h
      );
      // 涓€娆℃€у啓鍏ワ細pptxResult + history + status + arkUsageLog
      await supabaseAdmin.from("projects").update({
        client_info: {
          ...donePrev,
          viGenerationHistory: doneHistory,
          arkUsageLog: [...(donePrev.arkUsageLog || []), ...arkUsageLog],
          generationStatus: "completed",
          generationMessage: "鐢熸垚瀹屾垚锛?,
          generationPercent: 100,
          pptxResult: { url: `/api/ai/download-pptx/${fileName}`, storageUrl, pageCount: blueprints.length, fileName },
        },
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId!);
    flushArkUsageToLog(projectId!, companyName);
    } catch (e: any) { console.warn("[generate-pptx] Final DB update error:", e.message); }
  } catch (error: any) {
    console.error("[generate-pptx] Error:", error);
    // V30: 鏇存柊鍘嗗彶璁板綍涓哄け璐?
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
    message: "VI鎵嬪唽鐢熸垚宸插惎鍔紝璇疯疆璇㈤」鐩姸鎬?,
  }, { status: 202 });
}

// ========== Helper Functions ==========
// V29: 鐢ㄩ€氫箟涓囩浉VL璇籐ogo鍥撅紝鐢熸垚鑻辨枃瑙嗚鎻忚堪锛屾敞鍏ュ満鏅浘prompt
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
    console.log("[generate-pptx] Logo visual description:", desc.substring(0, 100));
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


// ========== AI 鍝佺墝鍒嗘瀽 Prompt ==========

const BRAND_ANALYSIS_SYSTEM_PROMPT = `浣犳槸涓€浣嶈祫娣辩殑鍝佺墝鎴樼暐鍒嗘瀽甯堬紝绮鹃€氫腑鍥芥湰鍦熷競鍦虹殑鍝佺墝瀹氫綅涓嶸I绛栫暐銆?

浣犵殑浠诲姟鏄細鏍规嵁瀹㈡埛鎻愪緵鐨勫搧鐗屽熀纭€淇℃伅锛岃繘琛屾繁搴﹀垎鏋愶紝杈撳嚭鍝佺墝妗ｆ銆?

## 鍒嗘瀽妗嗘灦
1. 琛屼笟娲炲療锛氬競鍦鸿秼鍔裤€佺棝鐐逛笌鏈轰細
2. 鍦扮悊鐜锛氭墍鍦ㄥ湴鐨勫晢涓氱幆澧冧笌璧勬簮浼樺娍
3. 绔炲搧鏍煎眬锛氫富瑕佺珵鍝佸強鍏跺畾浣?
4. 鍝佺墝瀹氫綅锛氬樊寮傚寲瀹氫綅鏂瑰悜銆佸搧鐗岃皟鎬у叧閿瘝
5. 鏂囨琛ュ叏锛氬鎴锋病鍐欑殑AI浠ｅ啓锛屽凡鍐欑殑娑﹁壊淇濈暀鍘熸剰
6. 瑙嗚鏂瑰悜锛氭帹鑽愯瑙夐鏍?+ 5涓啓瀹炲満鏅浘鎻忚堪锛堜腑鑻辨枃瀵圭収锛?
7. Logo璁捐寤鸿锛氫负娌℃湁Logo鐨勫鎴锋彁渚?涓笉鍚屾柟鍚戠殑Logo璁捐鏂规

## 杈撳嚭鏍煎紡锛堜弗鏍糐SON锛屼笉瑕乵arkdown鍖呰９锛?
{
  "industryInsight": "琛屼笟娲炲療锛?-3鍙ヨ瘽",
  "geoEnvironment": "鍦扮悊鐜鍒嗘瀽锛?-3鍙ヨ瘽",
  "competitiveLandscape": "绔炲搧鏍煎眬锛?-3鍙ヨ瘽",
  "brandPositioning": "鍝佺墝瀹氫綅寤鸿锛?-3鍙ヨ瘽",
  "refinedBrandVision": "AI鎻愮偧/琛ュ厖鐨勫搧鐗屾効鏅?,
  "refinedCoreValues": "AI鎻愮偧/琛ュ厖鐨勬牳蹇冧环鍊硷紝閫楀彿鍒嗛殧",
  "refinedTargetMarket": "AI缁嗗寲/琛ュ厖鐨勭洰鏍囧競鍦?,
  "brandStory": "鍝佺墝鏁呬簨锛?-5鍙ヨ瘽锛岃瀺鍚堝搧鐗岃捣婧愩€佹牳蹇冧环鍊煎拰鎰挎櫙锛岃瑷€鏈夋劅鏌撳姏",
  "brandToneKeywords": ["鍏抽敭璇?", "鍏抽敭璇?", "鍏抽敭璇?"],
  "visualStyleSuggestion": "瑙嗚椋庢牸寤鸿",
  "sceneImageSuggestions": [
    {"zh": "鍚嶇墖", "en": "Professional product photography of branded business cards with company logo printed on them, arranged on wooden desk, studio lighting, angled view"},
    {"zh": "鎵嬫彁琚?, "en": "Professional product photography of a branded paper tote bag with company logo printed on front, standing upright, studio lighting"},
    {"zh": "浜у搧鐡惰", "en": "Professional product photography of a branded beverage bottle with company logo label, on clean surface, studio lighting, product fully visible"},
    {"zh": "淇冮攢娴锋姤", "en": "Professional product photography of a branded promotional poster standee in store, with company branding visible, studio setting"},
    {"zh": "浼氬憳鍗?, "en": "Professional product photography of a branded VIP membership card with company logo, clean studio background"}
  ],
  "logoDesignSuggestions": {
    "concept": "Logo璁捐鏍稿績姒傚康锛?-2鍙ヨ瘽",
    "style": "璁捐椋庢牸锛堝锛氫紶缁熶功娉曘€佺幇浠ｇ畝绾︺€佸浗娼€佹墜缁樼瓑锛?,
    "elements": "寤鸿鍖呭惈鐨勮璁″厓绱狅紙鍥惧舰銆佺鍙枫€佸瓧浣撻鏍硷級",
    "colorGuidance": "閰嶈壊寤鸿锛岄渶涓庡搧鐗岃壊鍗忚皟",
    "prompts": [
      "鑻辨枃prompt1锛氱敤浜嶢I鐢熷浘鐨勮缁嗘弿杩帮紝闇€鍖呭惈璁捐椋庢牸銆佹牳蹇冨浘褰㈠厓绱犮€侀厤鑹叉柟妗堛€佸竷灞€鏂瑰紡",
      "鑻辨枃prompt2锛氬悓涓€姒傚康鐨勯鏍煎彉浣?,
      "鑻辨枃prompt3锛氫笉鍚屾柟鍚戠殑鍙樹綋",
      "鑻辨枃prompt4锛氬彟涓€涓垱鎰忔柟鍚?
    ]
  },
  "aiGeneratedFields": {
    "brandVision": "瀹㈡埛娌″啓鍒橝I浠ｅ啓锛屽凡鍐欏垯鐣欑┖",
    "coreValues": "瀹㈡埛娌″啓鍒橝I浠ｅ啓锛屽凡鍐欏垯鐣欑┖",
    "targetMarket": "瀹㈡埛娌″啓鍒橝I浠ｅ啓锛屽凡鍐欏垯鐣欑┖"
  }
}`;


// V12: 鍝佺墝鏁呬簨鍚堟垚 鈥?AI鏈緭鍑篵randStory鏃朵粠宸叉湁鏁版嵁缁勫悎
function composeBrandStory(
  companyName: string, industry: string,
  vision: string, values: string, market: string,
  profile: any,
): string {
  if (!companyName || companyName === "鍝佺墝") return "";
  const parts: string[] = [];
  const insight = profile?.industryInsight || "";
  const positioning = profile?.brandPositioning || "";
  // 娓呮礂姣忔鏈熬鏍囩偣锛岄伩鍏嶆嫾鎺ュ嚭鍙屽彞鍙?
  function clean(s: string): string {
    return s.replace(/[銆傦紝,]+$/, "").replace(/銆傘€?g, "銆?);
  }
  if (insight) parts.push(clean(insight));
  parts.push(`${companyName}鎵庢牴${industry || "鏈湡"}琛屼笟`);
  if (values) parts.push(`浠?${values}"涓烘牳蹇冧环鍊糮);
  if (market) parts.push(`鑷村姏浜庝负${market}鎻愪緵浼樿川鏈嶅姟`);
  if (vision) parts.push(clean(vision));
  if (positioning) parts.push(clean(positioning));
  let result = parts.join("锛?);
  result = result.replace(/銆傘€?g, "銆?);
  return result + "銆?;
}

function buildBrandAnalysisPrompt(info: {
  companyName: string; industry: string;
  brandVision?: string; coreValues?: string; targetMarket?: string;
  logoPhilosophy?: string; mascotPhilosophy?: string;
  province?: string; city?: string; description?: string;
  brandColors?: { primary: string; secondary: string; accent: string };
}): string {
  const parts: string[] = [];
  parts.push("## 瀹㈡埛鍝佺墝鍩虹淇℃伅");
  parts.push("");
  parts.push("鍏徃鍚嶇О锛? + (info.companyName || "鏈彁渚?));
  parts.push("鎵€灞炶涓氾細" + (info.industry || "鏈彁渚?));
  if (info.province || info.city) {
    parts.push("鎵€鍦ㄥ湴锛? + (info.province || "") + (info.city || ""));
  }
  parts.push("");
  parts.push("### 瀹㈡埛宸插～鍐欑殑鍝佺墝淇℃伅锛堟湁鍒欎繚鐣欐鼎鑹诧紝鏃犲垯AI浠ｅ啓锛夛細");
  parts.push("鍝佺墝鎰挎櫙锛? + (info.brandVision || "锛堝鎴锋湭濉啓锛岃AI浠ｅ啓锛?));
  parts.push("鏍稿績浠峰€硷細" + (info.coreValues || "锛堝鎴锋湭濉啓锛岃AI浠ｅ啓锛?));
  parts.push("鐩爣甯傚満锛? + (info.targetMarket || "锛堝鎴锋湭濉啓锛岃AI浠ｅ啓锛?));
  if (info.logoPhilosophy) parts.push("LOGO璁捐鐞嗗康锛? + info.logoPhilosophy);
  if (info.mascotPhilosophy) parts.push("IP鍏粩璁捐鐞嗗康锛? + info.mascotPhilosophy);
  if (info.brandColors) parts.push("鍝佺墝鑹诧細" + info.brandColors.primary + " / " + info.brandColors.secondary + " / " + info.brandColors.accent);
  if (info.description) parts.push("琛ュ厖鎻忚堪锛? + info.description);
  parts.push("");
  parts.push("璇峰熀浜庝互涓婁俊鎭繘琛屾繁搴﹀搧鐗屽垎鏋愩€?);
  parts.push("");
  parts.push("閲嶈锛歴ceneImageSuggestions蹇呴』鏄疺I搴旂敤鏁堟灉鍥撅紙mockup锛夛紝涓嶆槸鍝佺墝鏁呬簨鍦烘櫙鎴栫編椋熸憚褰憋紒姣忎釜鍦烘櫙蹇呴』鎻忚堪鍝佺墝Logo/瑙嗚鍏冪礌鍗板湪鍏蜂綋浜у搧涓婄殑鏁堟灉銆?涓満鏅繀椤绘牴鎹鎴疯涓氬姩鎬佸喅瀹氱墿鏂欑被鍨嬨€傝涓氣啋鐗╂枡鏄犲皠绀轰緥锛氶楗?蹇/鑼堕鍘呪啋绛峰瓙濂椼€侀宸剧焊鍖呫€佸鍗栬銆佽彍鍗曘€佸憳宸ュ洿瑁欙紱姘存灉/鐢熼矞鈫掓按鏋滆创绾搞€佹灉绡寘瑁呫€佷环鏍兼爣绛俱€佹墜鎻愯銆佷績閿€绔嬬墝锛涚編鐢?缇庝笟鈫掕壊鏉垮崱銆佺敳娌圭摱璐淬€侀绾﹀崱銆佷細鍛樺崱銆佸簵閾烘嫑鐗岋紱闆跺敭/鐧捐揣鈫掓墜鎻愯銆佷环鏍兼爣绛俱€佽喘鐗╄銆佸簵闈㈡嫑鐗屻€佷績閿€娴锋姤锛涢ギ鍝?濂惰尪鈫掑鍗栨澂銆佹澂濂椼€佹墜鎻愯銆佽彍鍗曠伅绠便€佷細鍛樺崱锛涙暀鑲?鍩硅鈫掕绋嬭〃銆佸鍛樿瘉銆佹枃浠跺す銆佹嫑鐢熸捣鎶ャ€佷功鍖呮寕浠讹紱閫氱敤/鍏朵粬鈫掑悕鐗囥€佹墜鎻愯銆佷骇鍝佸寘瑁呫€佸簵闈㈡嫑鐗屻€佽惀閿€娴锋姤銆傝鏍规嵁瀹㈡埛瀹為檯琛屼笟閫夋嫨鏈€璐村悎鐨?绉嶇墿鏂欙紝涓嶈杈撳嚭涓庤涓氭棤鍏崇殑鍝佺被銆傛瘡涓満鏅殑zh瀛楁鏄骇鍝佸悕绉帮紙濡俓u2018鍚嶇墖\u2019銆乗u2018鎵嬫彁琚媆u2019锛夛紝en瀛楁鏄嫳鏂囩敓鍥緋rompt锛屽繀椤讳互\u2018Professional product photography of a branded [浜у搧] with company logo clearly printed\u2019寮€澶淬€?*涓ョ杈撳嚭缇庨鎽勫奖銆佷汉鐗╁満鏅€佸搧鐗屾晠浜嬪満鏅?*鈥斺€旇繖鏄疺I鎵嬪唽搴旂敤鏁堟灉鍥撅紝涓嶆槸鍝佺墝鏁呬簨缁樻湰锛?);
  parts.push("");
  parts.push("閲嶈锛歭ogoDesignSuggestions鏄负娌℃湁Logo鐨勫鎴疯璁＄殑銆傝鏍规嵁鍝佺墝鍚嶇О銆佽涓氱壒寰併€佸湴鍩熸枃鍖栫壒鑹诧紝璁捐4涓笉鍚屾柟鍚戠殑Logo鏂规銆傛瘡涓猵rompt闇€瑕佹槸瀹屾暣鐨勮嫳鏂嘇I鐢熷浘鎸囦护锛岃缁嗘弿杩拌璁￠鏍笺€佹牳蹇冨浘褰㈠厓绱犮€侀厤鑹叉柟妗堛€佹帓鐗堝竷灞€銆侺ogo闇€瑕佺畝娲併€佽鲸璇嗗害楂樸€侀€傚悎鍚勭灏哄搴旂敤锛堝悕鐗囥€佹嫑鐗屻€佸寘瑁呯瓑锛夈€?);
  return parts.join("\n");
}



