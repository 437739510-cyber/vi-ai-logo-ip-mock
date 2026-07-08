/**
 * Knowledge Base Injector — KM-008
 * Builds industry-aware prompt context from knowledge modules
 * for injection into the VI manual generation pipeline.
 */
import { getIndustryConfig } from "./industries";
import { PRINT_STANDARD_DEFAULT } from "./print-standard";
import { FONT_STANDARDS } from "./vi-standard";
import { APP_SYSTEM_STANDARDS } from "./vi-standard";
import type { FontEntry } from "./font-library";

export interface KBInjection {
  /** Prompt fragment for color tendencies & material preferences */
  colorAndMaterial: string;
  /** Prompt fragment for scene-specific application specs */
  sceneSpecs: string;
  /** Prompt fragment for word pack (recommended + forbidden) */
  wordConstraints: string;
  /** Prompt fragment for print production standards */
  printStandards: string;
  /** Full combined injection string for appending to AI prompts */
  combined: string;
}

const FALLBACK_INDUSTRY = {
  colorTendency: {
    palette: "通用行业配色方案",
    primaryTones: ["品牌主色由AI根据品牌定位自动选取"],
    materialPreference: ["铜版纸157-300g — 通用印刷", "白卡纸250-350g — 包装/名片"],
  },
  materialSpecs: {
    required: ["名片", "信纸", "手提袋", "宣传单页"],
    optional: ["包装盒", "海报", "纸杯", "员工服装"],
  },
  sceneSpecs: [] as any[],
  wordPack: {
    forbidden: ["最", "第一", "唯一", "顶级", "国家级"],
    recommended: ["专业", "品质", "信赖", "创新"],
  },
};

/**
 * Build knowledge injection for a given industry.
 * Falls back to generic config for unrecognized industries.
 */
export function buildKBInjection(industryName: string): KBInjection {
  const cfg = getIndustryConfig(industryName) || FALLBACK_INDUSTRY;

  // Color & material guidance
  const colorAndMaterial = [
    "【行业配色倾向】",
    cfg.colorTendency?.palette || "通用行业配色",
    ...(cfg.colorTendency?.primaryTones || []).map((t: string) => "  - " + t),
    "【推荐材质偏好】",
    ...(cfg.colorTendency?.materialPreference || []).map((m: string) => "  - " + m),
  ].join("\n");

  // Scene specs
  const sceneSpecs = cfg.sceneSpecs?.length
    ? [
        "【行业场景物料规范】",
        ...cfg.sceneSpecs.map((s: any) => `  - ${s.scene}: ${s.materials?.join("、")} | ${s.notes || ""}`),
      ].join("\n")
    : "";

  // Word constraints
  const wordConstraints = [
    "【用语约束】",
    "推荐用语：" + (cfg.wordPack?.recommended || []).join("、"),
    "禁用词：" + (cfg.wordPack?.forbidden || []).join("、"),
  ].join("\n");

  // Print standards
  const printStandards = [
    "【印刷生产标准】",
    `出血位: ${PRINT_STANDARD_DEFAULT.bleed}`,
    `Logo边距: ${PRINT_STANDARD_DEFAULT.logoMargin}`,
    "必做物料规格:",
    ...APP_SYSTEM_STANDARDS.filter(m => ["名片","信纸","手提袋(中号)","宣传单页","海报"].includes(m.material))
      .map(m => `  - ${m.material} ${m.size} | ${m.material_recommendation} | ${m.process} | bleed:${m.bleed}`),
  ].join("\n");

  const combined = [
    "=== 行业知识注入（以下规范为生成参考，确保输出与行业匹配） ===",
    colorAndMaterial,
    sceneSpecs,
    wordConstraints,
    printStandards,
  ].filter(Boolean).join("\n\n");

  return { colorAndMaterial, sceneSpecs, wordConstraints, printStandards, combined };
}

/**
 * Quick lookup: get recommended fonts for an industry context.
 * Returns top 3 Chinese + 2 English fonts from SAFE_FONTS.
 */
export function getIndustryFontContext(_industryName: string): string {
  // Generic font guidance (industry-specific mapping is P3 work)
  const lines = [
    "【推荐商用安全字体】",
    "中文字体: Source Han Sans (思源黑体) / Alibaba PuHuiTi (阿里巴巴普惠体) / Noto Sans SC",
    "英文字体: Montserrat / Inter / Open Sans",
    "装饰字体(谨慎使用): ZCOOL KuaiLe (站酷快乐体) / LXGW WenKai (霞鹜文楷)",
    "注意: 仅使用SIL OFL或阿里免费商用授权字体，禁止使用微软雅黑/方正等需授权字体",
  ];
  return lines.join("\n");
}