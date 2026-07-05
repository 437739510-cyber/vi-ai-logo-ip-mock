// Quality Check Engine — Validation Packages A/B/C/D
// Source: Hermes handoff 2026-07-04 Part 2
// V2: Added blocking (throw on high risk), CMYK/HEX check, integration hooks

import { IndustryDict, getIndustryIsolation, type IndustryIsolation } from "./category-dict";
import { ParamPackage } from "./parameter-extract";
import type { UnifiedParamPackage } from "./param-package";

export interface ValidationIssue {
  id: string;
  name: string;
  message: string;
  risk: "high" | "medium" | "low";
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  risk: "high" | "medium" | "low" | "none";
}

export interface FlowResult {
  passed: boolean;
  needsRetry: boolean;
  result: ValidationResult;
}

// M3.1: Error class for blocking failures
export class ValidationBlockedError extends Error {
  public result: ValidationResult;
  constructor(result: ValidationResult) {
    super(`[QualityCheck] Pipeline blocked: ${result.issues.filter(i => i.risk === "high").length} high-risk issues`);
    this.name = "ValidationBlockedError";
    this.result = result;
  }
}

// ==================== Package A: Basic Format Check ====================

const RULES_A = {
  A01: {
    name: "HEX非法格式",
    re: /#(?![A-Fa-f0-9]{6}\b)[A-Za-z0-9]{3,8}/g,
    risk: "high" as const,
  },
  A02: {
    name: "字段残留",
    re: /\b(字段|内容|所在城市|行业类别|店铺类型|经营年限|主营产品|上传张数|其他丽人|其他餐饮|其他零售)\b/g,
    risk: "high" as const,
  },
  A03: {
    name: "章节编号断裂",
    risk: "medium" as const,
  },
  A04: {
    name: "极限词",
    re: /\b(100%|绝对|根治|唯一|第一|顶级|最佳)\b/g,
    risk: "low" as const,
  },
  // M3.2: CMYK value sanity check
  A05: {
    name: "CMYK色值越界",
    re: /CMYK[：:\s]*(\d{3,}|[2-9]\d{2,})/gi,
    risk: "medium" as const,
  },
};

function checkPackageA(md: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // A01
  const hexMatches = md.match(RULES_A.A01.re);
  if (hexMatches) {
    issues.push({ id: "A01", name: RULES_A.A01.name, message: `Found ${hexMatches.length} illegal HEX: ${hexMatches.join(", ")}`, risk: "high" });
  }

  // A02
  const fieldMatches = md.match(RULES_A.A02.re);
  if (fieldMatches) {
    issues.push({ id: "A02", name: RULES_A.A02.name, message: `Residual field names: ${fieldMatches.join(", ")}`, risk: "high" });
  }

  // A03: chapter number continuity
  const chRe = /^##\s*(\d+)\s+/gm;
  const chapters: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = chRe.exec(md)) !== null) {
    chapters.push(parseInt(m[1], 10));
  }
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i] !== chapters[i - 1] + 1) {
      issues.push({ id: "A03", name: RULES_A.A03.name, message: `Chapter number gap between ${String(chapters[i - 1]).padStart(2, "0")} and ${String(chapters[i]).padStart(2, "0")}`, risk: "medium" });
    }
  }

  // A04
  const extremeMatches = md.match(RULES_A.A04.re);
  if (extremeMatches) {
    issues.push({ id: "A04", name: RULES_A.A04.name, message: `Extreme words found: ${extremeMatches.join(", ")}`, risk: "low" });
  }

  return issues;
}

// ==================== Package B: Foundation Quality Check ====================

const UNAUTHORIZED_FONTS = /\b(微软雅黑|方正[\u4e00-\u9fa5]{0,4}|汉仪[\u4e00-\u9fa5]{0,4}|造字工房|站酷(?!.*免费))\b/g;

function checkPackageB(md: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // B01: unauthorized fonts
  const fontMatches = md.match(UNAUTHORIZED_FONTS);
  if (fontMatches) {
    issues.push({ id: "B01", name: "未授权字体", message: `Unlicensed fonts: ${fontMatches.join(", ")}`, risk: "high" });
  }

  // B02: color ratio > 60%
  const ratioMatch = md.match(/(?:主色|标准色).*?占比.*?(\d+)\s*%/i);
  if (ratioMatch) {
    const pct = parseInt(ratioMatch[1], 10);
    if (pct > 60) {
      issues.push({ id: "B02", name: "色彩占比常识", message: `Primary color ratio ${pct}% exceeds 60% limit`, risk: "medium" });
    }
  }

  // B03: logo minimum size
  const logoTbl = md.match(/(?:最小尺寸|印刷.*\|.*数字|数字.*\|.*户外)/i);
  if (logoTbl) {
    const tblStart = logoTbl.index!;
    const tblChunk = md.slice(tblStart, tblStart + 500);
    const printMatch = tblChunk.match(/印刷[品类]*\s*\|?\s*(\d+)\s*(mm|px)/i);
    const digiMatch = tblChunk.match(/数字[媒体屏]*\s*\|?\s*(\d+)\s*(mm|px)/i);
    if (printMatch && parseInt(printMatch[1], 10) < 5) {
      issues.push({ id: "B03", name: "Logo常识", message: `Min print size ${printMatch[1]}${printMatch[2]} below 5mm`, risk: "medium" });
    }
    if (digiMatch && parseInt(digiMatch[1], 10) < 10) {
      issues.push({ id: "B03", name: "Logo常识", message: `Min digital size ${digiMatch[1]}${digiMatch[2]} below 10px`, risk: "medium" });
    }
  }

  // B04: empty chapters (< 50 chars and no table)
  const chSplit = md.split(/^##\s*\d+\s+/gm);
  for (let i = 1; i < chSplit.length; i++) {
    const body = chSplit[i];
    const hasTable = /\|.*\|/.test(body);
    const textLen = body.replace(/\s+/g, "").length;
    if (!hasTable && textLen < 50) {
      issues.push({ id: "B04", name: "空章节", message: `Chapter ${String(i).padStart(2, "0")} has only ${textLen} chars and no table`, risk: "medium" });
    }
  }

  // M3.2: B05 — white accent color detection (should never be #FFFFFF or pure white)
  const accentColorMatch = md.match(/(?:强调色|点缀色|提亮色|accent)[：:\s]*`?#([A-Fa-f0-9]{6})`?/i);
  if (accentColorMatch) {
    const hex = accentColorMatch[1].toUpperCase();
    if (hex === "FFFFFF" || hex === "FFFFFE" || hex === "FEFEFE" || hex === "FDFDFD") {
      issues.push({ id: "B05", name: "白色强调色", message: `Accent color is ${hex} — white is invisible on light backgrounds and violates VI norms`, risk: "high" });
    }
  }

  return issues;
}

// ==================== Package C: Industry Compliance Check ====================

const CROSS_INDUSTRY_KEYWORDS = [
  "美容", "护肤", "医美", "面膜", "精油", "疗程", "美甲", "美睫",
  "旗袍", "面料", "盘扣", "刺绣", "剪裁",
  "火锅", "烧烤", "锅底", "奶茶", "烘焙", "咖啡",
  "猫粮", "狗粮", "宠物", "洗澡",
  "瑜伽", "器械", "健身", "普拉提",
  "教材", "绘本", "课时",
  "烟酒", "注射液", "医疗器械",
  "花盒", "花束", "鲜花", "贺卡",
  "洗车", "镀膜", "施工单",
];

function checkPackageC(md: string, dict: IndustryDict): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Forbidden word check
  const fwRe = new RegExp(`(${dict.forbidden_words.join("|")})`, "gi");
  const fwMatches = md.match(fwRe);
  const forbiddenHits = fwMatches ? [...new Set(fwMatches.map(w => w.toLowerCase()))] : [];

  if (forbiddenHits.length >= 2) {
    issues.push({ id: "C01", name: "违禁词超标", message: `Forbidden words (${forbiddenHits.length}): ${forbiddenHits.join(", ")}`, risk: "high" });
  } else if (forbiddenHits.length === 1) {
    issues.push({ id: "C01", name: "违禁词", message: `Single forbidden word: ${forbiddenHits[0]}`, risk: "medium" });
  }

  // Positive material match rate
  const pmRe = new RegExp(`(${dict.positive_materials.join("|")})`, "gi");
  const pmMatches = md.match(pmRe);
  const matchedMaterials = pmMatches ? [...new Set(pmMatches)] : [];
  const matchRate = dict.positive_materials.length > 0
    ? matchedMaterials.length / dict.positive_materials.length
    : 0;

  if (matchRate < 0.6) {
    issues.push({ id: "C02", name: "正向物料匹配不足", message: `Match rate ${(matchRate * 100).toFixed(0)}% (${matchedMaterials.length}/${dict.positive_materials.length})`, risk: "medium" });
  }

  // C03: cross-industry template residue detection
  const pmSet = new Set(dict.positive_materials);
  const crossHits = CROSS_INDUSTRY_KEYWORDS.filter(kw => {
    return md.includes(kw) && !pmSet.has(kw);
  });
  if (crossHits.length > 2) {
    issues.push({
      id: "C03",
      name: "跨行业模板残留",
      message: `Cross-industry keywords detected (${crossHits.length}): ${crossHits.join(", ")}`,
      risk: "medium",
    });
  }

  return issues;
}

// ==================== Package D: Cross-Round Consistency ====================

function checkPackageD(round2Md: string, params: ParamPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // D01: color consistency
  const r2Hexes = new Set(round2Md.match(/#[A-Fa-f0-9]{6}/g)?.map(h => h.toUpperCase()) || []);
  const paramHexes = new Set(params.colors.map(c => `#${c.hex}`));
  paramHexes.add("#000000");
  paramHexes.add("#FFFFFF");
  for (const h of r2Hexes) {
    if (!paramHexes.has(h)) {
      issues.push({ id: "D01", name: "色值不一致", message: `HEX ${h} in Round2 not in param package`, risk: "high" });
      break;
    }
  }

  // D02: font consistency
  if (params.fonts.length > 0) {
    const paramFonts = new Set(params.fonts.map(f => f.name));
    for (const f of paramFonts) {
      if (!round2Md.includes(f)) {
        issues.push({ id: "D02", name: "字体不一致", message: `Font "${f}" not found in Round2`, risk: "high" });
        break;
      }
    }
  }

  // D03: logo rule consistency
  if (params.logoRules?.safeArea) {
    const safePct = params.logoRules.safeArea.match(/(\d+)%/);
    if (safePct) {
      const r2SafeRe = new RegExp(`保留\\s*至少\\s*${safePct[1]}%`, "i");
      if (!r2SafeRe.test(round2Md)) {
        issues.push({ id: "D03", name: "Logo规则不一致", message: `Safe area ${safePct[1]}% not found in Round2`, risk: "medium" });
      }
    }
  }

  // D04: slogan consistency
  if (params.brandSlogan && !round2Md.includes(params.brandSlogan.slice(0, 6))) {
    issues.push({ id: "D04", name: "术语不一致", message: "Brand slogan not present in Round2", risk: "low" });
  }

  return issues;
}

// ==================== Main Validation Flow ====================

function makeResult(issues: ValidationIssue[]): ValidationResult {
  const highIssues = issues.filter(i => i.risk === "high");
  return {
    passed: highIssues.length === 0,
    issues,
    risk: highIssues.length > 0 ? "high" : issues.length > 0 ? "medium" : "none",
  };
}

export function validateRound1(md: string): FlowResult {
  const issues = [...checkPackageA(md), ...checkPackageB(md)];
  const result = makeResult(issues);
  return { passed: result.passed, needsRetry: !result.passed, result };
}

export function validateRound2(md: string, dict: IndustryDict | null): FlowResult {
  const issues = [...checkPackageA(md)];
  if (dict) { issues.push(...checkPackageC(md, dict)); }
  const result = makeResult(issues);
  return { passed: result.passed, needsRetry: !result.passed, result };
}

export function validateCrossRound(round2Md: string, params: ParamPackage): FlowResult {
  const issues = checkPackageD(round2Md, params);
  const result = makeResult(issues);
  return { passed: result.passed, needsRetry: false, result };
}

/** M3.1: Validate and throw if high-risk issues found — use this at pipeline gate points */
export function validateAndBlock(md: string, stage: "round1" | "round2" | "cross", extra: { dict?: IndustryDict | null; params?: ParamPackage }): void {
  let result: FlowResult;
  switch (stage) {
    case "round1":
      result = validateRound1(md);
      break;
    case "round2":
      result = validateRound2(md, extra.dict || null);
      break;
    case "cross":
      result = validateCrossRound(md, extra.params!);
      break;
  }

  if (!result.passed) {
    throw new ValidationBlockedError(result.result);
  }

  // Log warnings for medium/low issues (non-blocking)
  const warnings = result.result.issues.filter(i => i.risk !== "high");
  if (warnings.length > 0) {
    console.warn(`[QualityCheck] ${stage} warnings (${warnings.length}):`, warnings.map(i => `[${i.id}] ${i.message}`).join("; "));
  }
}

/** Full validation flow with retry logic (non-blocking, returns result) */
export async function runValidationFlow(
  md: string,
  stage: "round1" | "round2" | "cross",
  extra: { dict?: IndustryDict | null; params?: ParamPackage },
): Promise<FlowResult> {
  let result: FlowResult;
  switch (stage) {
    case "round1":
      result = validateRound1(md);
      break;
    case "round2":
      result = validateRound2(md, extra.dict || null);
      break;
    case "cross":
      result = validateCrossRound(md, extra.params!);
      break;
  }
  return result;
}

// M1.7: Validate param-package integrity
export function checkCrossIndustryContamination(
  markdown: string,
  industry: string,
  mainProducts?: string,
): { passed: boolean; risk: "low" | "medium" | "high"; dirtyWords: string[] } {
  const isolation = getIndustryIsolation(industry, mainProducts);
  const forbiddenWords = isolation.forbiddenWords;
  const dirtyWords: string[] = [];

  for (const word of forbiddenWords) {
    if (markdown.includes(word)) {
      dirtyWords.push(word);
    }
  }

  let risk: "low" | "medium" | "high" = "low";
  if (dirtyWords.length >= 2) { risk = "high"; }
  else if (dirtyWords.length === 1) { risk = "medium"; }

  return { passed: risk !== "high", risk, dirtyWords };
}

export function validateParamPackageIntegrity(params: UnifiedParamPackage): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!params.colors.primary.hex || !/^#[0-9A-Fa-f]{6}$/.test(params.colors.primary.hex)) {
    issues.push("Primary color hex missing or invalid: " + params.colors.primary.hex);
  }
  if (!params.colors.secondary.hex || !/^#[0-9A-Fa-f]{6}$/.test(params.colors.secondary.hex)) {
    issues.push("Secondary color hex missing or invalid: " + params.colors.secondary.hex);
  }
  // M3.2: accent color must exist AND not be white
  if (!params.colors.accent.hex || !/^#[0-9A-Fa-f]{6}$/.test(params.colors.accent.hex)) {
    issues.push("Accent color hex missing or invalid: " + params.colors.accent.hex);
  } else if (params.colors.accent.hex.toUpperCase() === "#FFFFFF") {
    issues.push("Accent color is #FFFFFF — white is invisible and violates VI norms");
  }
  if (!params.brand.companyName || params.brand.companyName === "品牌") {
    issues.push("Brand companyName missing or default placeholder");
  }
  if (!params.brand.industry) {
    issues.push("Industry not set");
  }
  if (!params.fonts.heading.name) {
    issues.push("Heading font name not set");
  }
  if (!params.logo.selectedUrl) {
    issues.push("Logo selectedUrl not set — logo generation may not have completed");
  }

  const passed = issues.length === 0;
  return { passed, issues };
}

/** M3.2: CMYK/HEX dual consistency check */
export function validateCmykHexConsistency(hex: string, cmyk: string): { passed: boolean; message: string } {
  if (!hex || !cmyk) return { passed: true, message: "Missing values, skip check" };
  // CMYK components should be in 0-100 range
  const parts = cmyk.split(",").map(Number);
  if (parts.length !== 4) return { passed: false, message: `CMYK "${cmyk}" is not 4 components` };
  const [c, m, y, k] = parts;
  if (c < 0 || c > 100 || m < 0 || m > 100 || y < 0 || y > 100 || k < 0 || k > 100) {
    return { passed: false, message: `CMYK (${cmyk}) has out-of-range values` };
  }
  // Pure white should have CMYK 0,0,0,0
  if (hex.toUpperCase() === "#FFFFFF" && cmyk !== "0,0,0,0") {
    return { passed: false, message: `White (#FFFFFF) must have CMYK 0,0,0,0, got ${cmyk}` };
  }
  // Pure black should have CMYK 0,0,0,100
  if (hex.toUpperCase() === "#000000" && cmyk !== "0,0,0,100") {
    return { passed: false, message: `Black (#000000) must have CMYK 0,0,0,100, got ${cmyk}` };
  }
  return { passed: true, message: "OK" };
}
