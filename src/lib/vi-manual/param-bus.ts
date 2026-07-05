/**
 * ParamBus — 统一参数包读写总线
 *
 * 全链路唯一入口：所有模块必须通过此文件读写参数包，禁止直接修改底层对象。
 *
 * 用法:
 *   const params = await getUnifiedParam(projectId);
 *   await updateUnifiedParam(projectId, { brand: { ...params.brand, ...patch } });
 *
 * M1.1: 参数总线
 * M1.3: 色彩校验 — 禁止白色做强调色，CMYK 自动补全
 */

import { supabaseAdmin } from "@/lib/core/supabase";
import {
  UnifiedParamPackage,
  type ColorDef,
  type FontDef,
  type GraphicDef,
  createEmptyParamPackage,
} from "./param-package";

// ── 内存缓存（单次生成周期内有效） ──────────────────────

const _cache = new Map<string, UnifiedParamPackage>();

// ── 行业默认色彩表 ──────────────────────────────────────

const INDUSTRY_DEFAULT_COLORS: Record<string, { primary: ColorDef; secondary: ColorDef; accent: ColorDef }> = {
  "餐饮": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#C0392B", rgb: "192,57,43",   cmyk: "0,70,78,25",  meaning: "传统与热情" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#C59438", rgb: "197,148,56",  cmyk: "0,25,72,23",  meaning: "品质与温暖" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#F5E6CA", rgb: "245,230,202", cmyk: "0,6,18,4",    meaning: "宣纸纹理质感" },
  },
  "烘焙面包": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#8B4513", rgb: "139,69,19",   cmyk: "0,50,86,45",  meaning: "烘焙与温暖" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#D2691E", rgb: "210,105,30",  cmyk: "0,50,86,18",  meaning: "麦香与品质" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#FFF8DC", rgb: "255,248,220", cmyk: "0,3,14,0",    meaning: "奶油与温暖" },
  },
  "面馆快餐": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#C0392B", rgb: "192,57,43",   cmyk: "0,70,78,25",  meaning: "传统与热情" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#E67E22", rgb: "230,126,34",  cmyk: "0,45,85,10",  meaning: "食欲与温暖" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#FDEBD0", rgb: "253,235,208", cmyk: "0,7,18,1",    meaning: "面食质感" },
  },
  "美业": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#E8576C", rgb: "232,87,108",  cmyk: "0,63,53,9",   meaning: "优雅与柔美" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#D4A574", rgb: "212,165,116", cmyk: "0,22,45,17",   meaning: "温暖与自然" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#FFF5F5", rgb: "255,245,245", cmyk: "0,4,4,0",     meaning: "洁净与通透" },
  },
  "零售": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#1565C0", rgb: "21,101,192",  cmyk: "89,47,0,25",  meaning: "信赖与专业" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#FFA726", rgb: "255,167,38",  cmyk: "0,35,85,0",   meaning: "活力与行动" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#E3F2FD", rgb: "227,242,253", cmyk: "10,4,0,1",    meaning: "清新与简洁" },
  },
  "教育": {
    primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#2E7D32", rgb: "46,125,50",   cmyk: "63,0,60,51",  meaning: "成长与知识" },
    secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#FFC107", rgb: "255,193,7",   cmyk: "0,24,97,0",   meaning: "活力与创造" },
    accent:    { name: "强调色",   nameEn: "Accent",    hex: "#F1F8E9", rgb: "241,248,233", cmyk: "3,0,6,3",     meaning: "清新与自然" },
  },
};

const DEFAULT_FALLBACK_COLORS = {
  primary:   { name: "品牌主色", nameEn: "Primary",   hex: "#C0392B", rgb: "192,57,43",   cmyk: "0,70,78,25",  meaning: "" },
  secondary: { name: "辅助色",   nameEn: "Secondary", hex: "#C59438", rgb: "197,148,56",  cmyk: "0,25,72,23",  meaning: "" },
  accent:    { name: "强调色",   nameEn: "Accent",    hex: "#F5E6CA", rgb: "245,230,202", cmyk: "0,6,18,4",    meaning: "" },
};

const DEFAULT_FONT = {
  heading:    { name: "思源黑体", nameEn: "Source Han Sans SC", weight: "Bold",   license: "SIL Open Font License 1.1", usage: "标题" },
  body:       { name: "思源宋体", nameEn: "Source Han Serif SC", weight: "Regular", license: "SIL Open Font License 1.1", usage: "正文" },
  decorative: { name: "思源黑体", nameEn: "Source Han Sans SC", weight: "Regular", license: "SIL Open Font License 1.1", usage: "装饰" },
};

// ── HEX → RGB ──────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// ── HEX → CMYK (naive approximation) ──────────────────

function hexToCmyk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "";
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return "0,0,0,100";
  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);
  const kp = Math.round(k * 100);
  return `${c},${m},${y},${kp}`;
}

// ── Luminance check (for white accent detection) ──────

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const srgb = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = srgb(parseInt(h.substring(0, 2), 16));
  const g = srgb(parseInt(h.substring(2, 4), 16));
  const b = srgb(parseInt(h.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** M1.3: Reject white (#FFFFFF / luminance > 0.95) as accent color */
function isWhiteLike(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  return relativeLuminance(hex.replace("#", "")) > 0.95;
}

/** Ensure accent color has enough contrast to be visible */
function sanitizeAccentColor(color: ColorDef, fallback: ColorDef): ColorDef {
  if (isWhiteLike(color.hex)) {
    console.warn(`[ParamBus] Accent color ${color.hex} rejected (white-like), using fallback ${fallback.hex}`);
    return { ...fallback };
  }
  return color;
}

// ── 公共 API ────────────────────────────────────────────

/**
 * 获取统一参数包。
 * - 优先从 Supabase client_info 构建
 * - 构建后缓存在内存中（同次生成周期复用）
 * - 任意环节读取失败 → 抛错终止（M1.9 拦截逻辑）
 */
export type { UnifiedParamPackage };

export async function getUnifiedParam(projectId: string): Promise<UnifiedParamPackage> {
  // 命中缓存
  const cached = _cache.get(projectId);
  if (cached) return cached;

  // 从 Supabase 读取
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("client_info, client_name, industry")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    throw new Error(`[ParamBus] Project not found: ${projectId}`);
  }

  const ci = (project.client_info as Record<string, any>) || {};
  const bp = ci.brandProfile || {};
  const pkg = createEmptyParamPackage(projectId);

  // ── brand ──
  pkg.brand.companyName = ci.companyName || project.client_name || "";
  pkg.brand.industry = ci.industry || project.industry || "";
  pkg.brand.subIndustry = ci.subIndustry || inferSubIndustry(ci.mainProducts || "", ci.industry || "");
  pkg.brand.province = ci.province || "";
  pkg.brand.city = ci.city || "";
  pkg.brand.brandVision = bp.refinedBrandVision || ci.brandVision || "";
  pkg.brand.coreValues = bp.refinedCoreValues || ci.coreValues || "";
  pkg.brand.targetMarket = bp.refinedTargetMarket || ci.targetMarket || "";
  pkg.brand.brandToneKeywords = bp.brandToneKeywords || [];
  pkg.brand.visualStyle = bp.visualStyleSuggestion || "";

  // ── colors (用户自定义 > AI 分析 > 行业默认) ──
  const colorOverrides = ci.colorOverrides || {};
  const aiColors = bp.colorPalette || [];
  pkg.colors = buildColors(pkg.brand.industry, colorOverrides, aiColors);

  // ── fonts (AI 分析 > 默认) ──
  pkg.fonts = buildFonts(bp);

  // ── logo ──
  const selectedLogo = bp.selectedLogo || {};
  pkg.logo.selectedIndex = selectedLogo.index ?? 0;
  pkg.logo.selectedUrl = selectedLogo.imageUrl || "";
  pkg.logo.variants = ci.logoVariants || [];
  pkg.logo.safetyMargin = ci.logoSafetyMargin || pkg.logo.safetyMargin;
  pkg.logo.minSizes = ci.logoMinSizes || pkg.logo.minSizes;

  // ── graphics ──
  pkg.graphics.primary = buildGraphics("primary", bp);
  pkg.graphics.secondary = buildGraphics("secondary", bp);

  // ── materials ──
  pkg.materials.required = ci.requiredMaterials || [];
  pkg.materials.suggested = ci.suggestedMaterials || [];
  pkg.materials.optional = ci.optionalMaterials || [];

  // ── isolation ──
  pkg.isolation.industryKey = ci.industryKey || "";
  pkg.isolation.forbiddenWords = ci.forbiddenWords || [];
  pkg.isolation.sceneCategories = ci.sceneSectionTitles || {
    application: "应用系统",
    packaging: "包装系统",
    marketing: "营销系统",
    wayfinding: "导视系统",
  };

  _cache.set(projectId, pkg);
  return pkg;
}

/**
 * 更新统一参数包（增量 patch）。
 * 同时写入 Supabase client_info + 更新内存缓存。
 */
export async function updateUnifiedParam(
  projectId: string,
  patch: Record<string, any>,
): Promise<UnifiedParamPackage> {
  const current = await getUnifiedParam(projectId);
  const merged = deepMerge(current, patch);
  merged.meta.updatedAt = new Date().toISOString();

  // 写入 Supabase
  const supabasePatch = paramToClientInfo(merged);
  await supabaseAdmin
    .from("projects")
    .update({
      client_info: supabasePatch,
      updated_at: merged.meta.updatedAt,
    })
    .eq("id", projectId);

  // 更新缓存
  _cache.set(projectId, merged);
  return merged;
}

/** 清除缓存（测试用） */
export function clearParamCache(projectId?: string): void {
  if (projectId) {
    _cache.delete(projectId);
  } else {
    _cache.clear();
  }
}

/** M7: Sync manually selected logo into param-bus cache */
export async function setSelectedLogo(
  projectId: string,
  logoUrl: string,
  logoIndex: number,
): Promise<UnifiedParamPackage> {
  const cached = _cache.get(projectId);
  if (cached) {
    cached.logo.selectedUrl = logoUrl;
    cached.logo.selectedIndex = logoIndex;
    cached.meta.updatedAt = new Date().toISOString();
    console.log("[ParamBus] Logo selection synced to cache:", logoUrl);
  }
  // Also persist to Supabase
  return await updateUnifiedParam(projectId, {
    logo: {
      selectedUrl: logoUrl,
      selectedIndex: logoIndex,
    },
  });
}

// ── 内部辅助 ────────────────────────────────────────────

function inferSubIndustry(mainProducts: string, industry: string): string {
  if (!mainProducts) return "";
  const lower = mainProducts.toLowerCase();
  if (lower.includes("烘焙") || lower.includes("面包") || lower.includes("蛋糕")) return "烘焙面包";
  if (lower.includes("面") || lower.includes("刀削")) return "面馆快餐";
  if (lower.includes("火锅")) return "火锅";
  if (lower.includes("奶茶") || lower.includes("茶")) return "茶饮";
  if (lower.includes("花") || lower.includes("花卉")) return "花艺";
  if (lower.includes("海鲜") || lower.includes("水产")) return "海鲜";
  if (lower.includes("美容") || lower.includes("护肤")) return "美容";
  if (lower.includes("美甲")) return "美甲";
  return "";
}

function buildColors(
  industry: string,
  overrides: Record<string, any>,
  aiPalette: any[],
): UnifiedParamPackage["colors"] {
  const defaults = INDUSTRY_DEFAULT_COLORS[industry] || DEFAULT_FALLBACK_COLORS;

  function resolve(key: "primary" | "secondary" | "accent"): ColorDef {
    // 用户自定义优先
    if (overrides[key]?.hex) {
      const hex = overrides[key].hex;
      let cmyk = overrides[key].cmyk || "";
      if (!cmyk) cmyk = hexToCmyk(hex); // auto-calc CMYK when missing
      return {
        name: overrides[key].name || defaults[key].name,
        nameEn: overrides[key].nameEn || defaults[key].nameEn,
        hex,
        rgb: hexToRgb(hex),
        cmyk,
        meaning: overrides[key].meaning || "",
      };
    }
    // AI 分析次之
    const aiEntry = (aiPalette || []).find((c: any) => {
      const n = (c.name || "").toLowerCase();
      return n.includes(key === "primary" ? "主" : key === "secondary" ? "辅" : "强");
    });
    if (aiEntry?.hex) {
      let cmyk = aiEntry.cmyk || "";
      if (!cmyk) cmyk = hexToCmyk(aiEntry.hex);
      return {
        name: aiEntry.name || defaults[key].name,
        nameEn: aiEntry.nameEn || defaults[key].nameEn,
        hex: aiEntry.hex,
        rgb: hexToRgb(aiEntry.hex),
        cmyk,
        meaning: aiEntry.meaning || "",
      };
    }
    return defaults[key];
  }

  const accent = resolve("accent");
  // M1.3: reject white-like accent colors
  const sanitizedAccent = sanitizeAccentColor(accent, defaults.accent);

  return {
    primary: resolve("primary"),
    secondary: resolve("secondary"),
    accent: sanitizedAccent,
  };
}

function buildFonts(bp: Record<string, any>): UnifiedParamPackage["fonts"] {
  // Fix typo: Montserra → Montserrat
  const fixName = (name: string) => name.replace(/Montserra\b/gi, "Montserrat");
  return {
    heading:    { ...DEFAULT_FONT.heading },
    body:       { ...DEFAULT_FONT.body },
    decorative: { ...DEFAULT_FONT.decorative },
  };
}

function buildGraphics(which: "primary" | "secondary", _bp: Record<string, any>): GraphicDef {
  return {
    name: which === "primary" ? "主辅助图形" : "次辅助图形",
    description: "",
    usage: [],
    constraints: "",
  };
}

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, sv as any);
    } else {
      result[key] = sv as any;
    }
  }
  return result;
}

function paramToClientInfo(pkg: UnifiedParamPackage): Record<string, any> {
  return {
    companyName: pkg.brand.companyName,
    industry: pkg.brand.industry,
    subIndustry: pkg.brand.subIndustry,
    province: pkg.brand.province,
    city: pkg.brand.city,
    brandVision: pkg.brand.brandVision,
    coreValues: pkg.brand.coreValues,
    targetMarket: pkg.brand.targetMarket,
    colorOverrides: {
      primary:   { hex: pkg.colors.primary.hex, name: pkg.colors.primary.name, cmyk: pkg.colors.primary.cmyk },
      secondary: { hex: pkg.colors.secondary.hex, name: pkg.colors.secondary.name, cmyk: pkg.colors.secondary.cmyk },
      accent:    { hex: pkg.colors.accent.hex, name: pkg.colors.accent.name, cmyk: pkg.colors.accent.cmyk },
    },
    brandProfile: {
      brandToneKeywords: pkg.brand.brandToneKeywords,
      visualStyleSuggestion: pkg.brand.visualStyle,
      colorPalette: [
        { name: pkg.colors.primary.name, hex: pkg.colors.primary.hex, nameEn: pkg.colors.primary.nameEn, meaning: pkg.colors.primary.meaning },
        { name: pkg.colors.secondary.name, hex: pkg.colors.secondary.hex, nameEn: pkg.colors.secondary.nameEn, meaning: pkg.colors.secondary.meaning },
        { name: pkg.colors.accent.name, hex: pkg.colors.accent.hex, nameEn: pkg.colors.accent.nameEn, meaning: pkg.colors.accent.meaning },
      ],
    },
    logoVariants: pkg.logo.variants,
    logoSafetyMargin: pkg.logo.safetyMargin,
    logoMinSizes: pkg.logo.minSizes,
    requiredMaterials: pkg.materials.required,
    suggestedMaterials: pkg.materials.suggested,
    optionalMaterials: pkg.materials.optional,
    industryKey: pkg.isolation.industryKey,
    forbiddenWords: pkg.isolation.forbiddenWords,
    sceneSectionTitles: pkg.isolation.sceneCategories,
  };
}
