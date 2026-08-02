/**
 * Shared brand-visual rules (工单 007).
 *
 * 1. Logo 专属色：没有真实输入时不虚构默认色板；只有 HEX 时由真实 HEX
 *    计算 RGB/CMYK，并使用中性语义名。
 * 2. Logo 误用规范：无 Logo 结构证据时只输出适用于所有 Logo 的通用规则，
 *    不得默认声称 Logo 含祥云、圆环纹样或任何具体图形。
 */

export interface LogoColor {
  name?: string;
  hex?: string;
  rgb?: string;
  cmyk?: string;
}

export interface LogoColorSet {
  navy?: LogoColor | null;
  gold?: LogoColor | null;
}

export interface LogoMisuseRule {
  title: string;
  desc: string;
  distortion: string;
}

export const GENERIC_LOGO_MISUSE_RULES: LogoMisuseRule[] = [
  { title: "禁止拉伸", desc: "不得对Logo进行\n非等比缩放", distortion: "stretch" },
  { title: "禁止旋转", desc: "不得旋转\nLogo角度", distortion: "rotate" },
  { title: "禁止换色", desc: "不得使用非标准色\n替换Logo颜色", distortion: "recolor" },
  { title: "禁止描边", desc: "不得给Logo\n添加描边效果", distortion: "outline" },
  { title: "禁止加阴影", desc: "不得添加非规范\n投影效果", distortion: "shadow" },
  { title: "禁止改字体", desc: "不得更改Logo\n中的字体样式", distortion: "font" },
  { title: "禁止裁切LOGO", desc: "不得裁掉LOGO任何部分，\n须完整呈现", distortion: "crop" },
  { title: "禁止拆分局部元素", desc: "不得单独抽出或拆分\nLogo局部元素使用", distortion: "split" },
  { title: "禁止改造图形结构", desc: "不得替换、加粗、旋转或\n重新绘制Logo图形结构", distortion: "restructure" },
];

/**
 * 工单 007-R1：消费真实 Logo 结构证据（logoElements，来自
 * assetAnalysis.logo.elements SSOT）。
 * - 无结构证据：只返回通用规则；
 * - 有明确结构证据：把「拆分局部元素/改造图形结构」两条通用规则升级为
 *   引用真实元素的具体规则；规则数量保持 9 条（3×3 布局不变），
 *   不恢复祥云/圆环等固定默认词。
 */
export function getLogoMisuseRules(logoElements?: string[] | null): LogoMisuseRule[] {
  const rules = GENERIC_LOGO_MISUSE_RULES.map((rule) => ({ ...rule }));
  const elements = (logoElements || [])
    .map((e) => (typeof e === "string" ? e.trim() : ""))
    .filter((e) => e.length > 0);
  if (elements.length === 0) return rules;

  const unique = [...new Set(elements)];
  const elementText = unique.map((e) => `「${e}」`).join("");
  const splitIndex = rules.findIndex((r) => r.distortion === "split");
  const restructureIndex = rules.findIndex((r) => r.distortion === "restructure");
  if (splitIndex >= 0) {
    rules[splitIndex] = {
      ...rules[splitIndex],
      desc: `不得单独抽出或拆分Logo中的${elementText}元素使用`,
    };
  }
  if (restructureIndex >= 0) {
    rules[restructureIndex] = {
      ...rules[restructureIndex],
      desc: `不得替换、加粗、旋转或重新绘制Logo中的${elementText}元素`,
    };
  }
  return rules;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToCmyk(r: number, g: number, b: number): { c: number; m: number; y: number; k: number } {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r / 255 - k) / (1 - k)) * 100),
    m: Math.round(((1 - g / 255 - k) / (1 - k)) * 100),
    y: Math.round(((1 - b / 255 - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

const NEUTRAL_LOGO_COLOR_NAMES: Record<"navy" | "gold", string> = {
  navy: "品牌专属色 1",
  gold: "品牌专属色 2",
};

export function normalizeLogoColor(raw: LogoColor | null | undefined, slot: "navy" | "gold"): LogoColor | null {
  if (!raw || typeof raw.hex !== "string" || !raw.hex.trim()) return null;
  const hex = raw.hex.trim();
  const rgb =
    typeof raw.rgb === "string" && raw.rgb.trim()
      ? raw.rgb.trim()
      : (() => {
          const c = hexToRgb(hex);
          return c ? `${c.r}, ${c.g}, ${c.b}` : "";
        })();
  const cmyk =
    typeof raw.cmyk === "string" && raw.cmyk.trim()
      ? raw.cmyk.trim()
      : (() => {
          const c = hexToRgb(hex);
          if (!c) return "";
          const k = rgbToCmyk(c.r, c.g, c.b);
          return `${k.c}, ${k.m}, ${k.y}, ${k.k}`;
        })();
  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : NEUTRAL_LOGO_COLOR_NAMES[slot];
  return { name, hex, rgb, cmyk };
}

export function normalizeLogoColorSet(raw?: LogoColorSet | null): LogoColorSet | null {
  if (!raw) return null;
  const navy = normalizeLogoColor(raw.navy, "navy");
  const gold = normalizeLogoColor(raw.gold, "gold");
  if (!navy && !gold) return null;
  return { navy: navy || undefined, gold: gold || undefined };
}
