// Quality Check Engine — Validation Packages A/B/C/D
// Source: Hermes handoff 2026-07-04 Part 2
// V2: Added blocking (throw on high risk), CMYK/HEX check, integration hooks

import { IndustryDict, getIndustryIsolation, type IndustryIsolation } from "./category-dict";
import { ParamPackage } from "./parameter-extract";
import type { UnifiedParamPackage } from "./param-package";

import { supabaseAdmin } from "@/lib/core/supabase";

import { ANTI_PATTERNS, incrementErrorCount, autoLogError, type AutoLogParams } from "../quality-check/anti-patterns";
import { COLOR_NAME_MAP } from "./color-name-map";
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


// ==================== QC Constants ====================

// COLOR_NAME_MAP moved to ./color-name-map.ts (shared module)

/** QC-04: Standard open-source font name library (key = common mis-spelling target) */
const FONT_NAME_SET = new Set([
  "思源黑体",
  "思源宋体",
  "Montserrat",
  "Open Sans",
  "Noto Sans",
  "Noto Sans SC",
  "Noto Serif",
  "Noto Serif SC",
  "Roboto",
  "Roboto Slab",
  "Lato",
  "Raleway",
  "Oswald",
  "Poppins",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "Inter",
  "DM Sans",
  "Work Sans",
  "Source Han Sans SC",
  "Source Han Serif SC",
  "HarmonyOS Sans SC",
  "LXGW WenKai",
  "ZCOOL QingKe HuangYou",
  "Ma Shan Zheng",
  "Zhi Mang Xing",
  "Liu Jian Mao Cao",
  "Noto Sans JP",
  "Noto Sans KR",
]);

// ==================== Package A: Basic Format Check ====================

const RULES_A = {
  A01: {
    name: "HEX非法格式",
    re: /#(?![A-Fa-f0-9]{6}\b)[A-Za-z0-9]{3,8}/g,
    risk: "high" as const,
  },
  A02: {
    name: "字段残留",
    re: /\b(字段|内容|所在城市|行业类别|店铺类型|经营年限|主营产品|上传张数|其他丽人|其他餐饮|其他零售|自定义填写|待补充|占位符|示例文本|请替换|请填写|此处输入|template|placeholder|其他[:：]?)\b/gi,
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


function checkQC01(md: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Match pattern: ChineseColorWord optional-# HEX (e.g. "玫瑰红 #37474F" or "深灰蓝 37474F")
  const re = /([一-龥]{2,5}(?:色)?)\s*#?([A-Fa-f0-9]{6})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(md)) !== null) {
    const claimedName = match[1];
    const hex = match[2].toUpperCase();
    const standardName = COLOR_NAME_MAP[hex];
    if (standardName && claimedName !== standardName) {
      issues.push({
        id: "QC01",
        name: "色值-颜色名称不一致",
        message: `"“${claimedName}” 与色值 #${hex} 不匹配，应为：${standardName}"`,
        risk: "high",
      });
    }
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

  // B02: color ratio check (context-aware per QC-05)
  // Iterate all ratio mentions to support multi-ratio documents
  const ratioRe = /(?:主色|标准色).*?占比.*?(\d+)\s*%/gi;
  let ratioMatch: RegExpExecArray | null;
  while ((ratioMatch = ratioRe.exec(md)) !== null) {
    const pct = parseInt(ratioMatch[1], 10);
    const ctxStart = Math.max(0, ratioMatch.index - 80);
    const ctxEnd = Math.min(md.length, ratioMatch.index + 120);
    const context = md.slice(ctxStart, ctxEnd);
    // QC-05: spatial signage (storefront, wall, signboard) allows full-bleed >= 80%
    const isSpatial = /(?:门头|招牌|空间|墙面|背景墙|店招|店面|立牌|灯箱|户外|广告牌)/i.test(context);
    if (isSpatial) {
      // Spatial materials: high ratio is normal, skip
      continue;
    }
    if (pct > 60) {
      issues.push({ id: "B02", name: "色彩占比常识", message: `Primary color ratio ${pct}% exceeds 60% limit (平面印刷物料上下文)`, risk: "medium" });
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


// ==================== QC-03: TOC-Heading Consistency ====================

function checkQC03(md: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Extract TOC entries: | N | title text |
  const tocRe = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|/gm;
  const tocEntries: Map<number, string> = new Map();
  let m1: RegExpExecArray | null;
  while ((m1 = tocRe.exec(md)) !== null) {
    const num = parseInt(m1[1], 10);
    const title = m1[2].trim();
    if (title && !tocEntries.has(num)) tocEntries.set(num, title);
  }
  if (tocEntries.size === 0) return issues;

  // Extract body headings: ## N. title or ### N. title
  const headingRe = /^#{2,3}\s*(\d+)\.?\s+(.+)$/gm;
  const bodyHeadings: Map<number, string> = new Map();
  let m2: RegExpExecArray | null;
  while ((m2 = headingRe.exec(md)) !== null) {
    const num = parseInt(m2[1], 10);
    const title = m2[2].trim();
    if (title && !bodyHeadings.has(num)) bodyHeadings.set(num, title);
  }

  // Compare TOC vs body headings by chapter number
  for (const [num, tocTitle] of tocEntries) {
    const bodyTitle = bodyHeadings.get(num);
    if (!bodyTitle) {
      issues.push({
        id: "QC03",
        name: "目录-正文标题不一致",
        message: `目录第${num}项“${tocTitle}”在正文中未找到对应标题`,
        risk: "medium",
      });
      continue;
    }
    // Simple diff: exact match check + length diff as proxy for Levenshtein
    if (tocTitle !== bodyTitle) {
      const lenDiff = Math.abs(tocTitle.length - bodyTitle.length);
      // Count differing characters by simple position comparison
      let charDiff = 0;
      const maxLen = Math.max(tocTitle.length, bodyTitle.length);
      for (let i = 0; i < maxLen; i++) {
        if (tocTitle[i] !== bodyTitle[i]) charDiff++;
      }
      if (charDiff > 2 || lenDiff > 2) {
        issues.push({
          id: "QC03",
          name: "目录-正文标题不一致",
          message: `目录“${tocTitle}” ≠ 正文“${bodyTitle}” (第${num}项，差异${charDiff}字符)`,
          risk: "medium",
        });
      }
    }
  }
  return issues;
}

// ==================== QC-04: Font Name Spelling ====================

function checkQC04(md: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Scan for potential font name mentions (quoted, after "字体：" or standalone capitalized words)
  const fontRe = /(?:字体[：:\s]*|font[：:\s]*|["\u201c])([A-Za-z\u4e00-\u9fa5][A-Za-z\u4e00-\u9fa5\s-]{2,30}?)(?:["\u201d]|$|[,;\u3001])/gi;
  let match: RegExpExecArray | null;
  while ((match = fontRe.exec(md)) !== null) {
    const found = match[1].trim();
    if (found.length < 3) continue;
    // Check if it is an exact match in the font set
    if (FONT_NAME_SET.has(found)) continue;
    // Approximate match: check if similar to any standard name
    for (const stdName of FONT_NAME_SET) {
      const lenDiff = Math.abs(found.length - stdName.length);
      if (lenDiff > 2) continue;
      // Simple similarity: if one is substring of the other, or share most chars
      if (stdName.toLowerCase().includes(found.toLowerCase()) || found.toLowerCase().includes(stdName.toLowerCase())) {
        issues.push({
          id: "QC04",
          name: "字体名称拼写偏差",
          message: `“${found}” 可能为拼写错误，正确名称：“${stdName}”`,
          risk: "medium",
        });
        break;
      }
      // Character overlap ratio for Chinese font names
      if (/[一-龥]/.test(found)) {
        const overlap = [...found].filter(ch => stdName.includes(ch)).length;
        if (overlap >= found.length - 1 && overlap >= 2) {
          issues.push({
            id: "QC04",
            name: "字体名称拼写偏差",
            message: `“${found}” 可能为拼写错误，正确名称：“${stdName}”`,
            risk: "medium",
          });
          break;
        }
      }
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
  // KM-002: enrich issues with anti-pattern fix guides
  const enrichedIssues = issues.map(issue => {
    const pattern = ANTI_PATTERNS.find(p => p.detectRule === issue.id);
    if (pattern) {
      incrementErrorCount(pattern.errorId);
      return { ...issue, message: `${issue.message} | 修正指引：${pattern.fixGuide}` };
    }
    return issue;
  });

  return {
    passed: highIssues.length === 0,
    issues: enrichedIssues,
    risk: highIssues.length > 0 ? "high" : enrichedIssues.length > 0 ? "medium" : "none",
  };
}

export function validateRound1(md: string): FlowResult {
  const issues = [...checkPackageA(md), ...checkPackageB(md), ...checkQC01(md), ...checkQC03(md), ...checkQC04(md)];
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

/** KM-007: Project context for auto-logging detected errors to case_library */
export interface QCProjectContext {
  projectId: string;
  brandName: string;
  industry: string;
}

/** KM-007: Extended return type with error IDs for caller notification */
export interface ValidateAndBlockResult {
  blocked: boolean;
  errorIds: string[];
}

/** M3.1: Validate and throw if high-risk issues found — use this at pipeline gate points */
export function validateAndBlock(
  md: string,
  stage: "round1" | "round2" | "cross",
  extra: { dict?: IndustryDict | null; params?: ParamPackage },
  projectCtx?: QCProjectContext,
): void {
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

  // KM-007: Auto-log high-risk errors to case_library (fire-and-forget)
  if (projectCtx) {
    const highRiskIssues = result.result.issues.filter(i => i.risk === "high");
    for (const issue of highRiskIssues) {
      const pattern = ANTI_PATTERNS.find(p => p.detectRule === issue.id);
      const errorId = pattern?.errorId || "AUTO_" + issue.id;
      const logParams: AutoLogParams = {
        projectId: projectCtx.projectId,
        brandName: projectCtx.brandName,
        industry: projectCtx.industry,
        errorId,
        mdContext: md.slice(0, 2000),
        detectRule: issue.id,
      };
      autoLogError(logParams).catch(e => console.warn("[QC] autoLogError failed:", e));
    }
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

// ==================== KM-006: QC Enhancement ====================

/** Error distribution by type and severity */
export interface QCErrorStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: { critical: number; warning: number; info: number };
  byRule: Record<string, number>;
}

/** Auto-fix suggestion for simple, correctable errors */
export interface AutoFixSuggestion {
  errorId: string;
  originalValue: string;
  suggestedValue: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

/**
 * Compute error distribution statistics from a validation result.
 */
export function getErrorStats(result: ValidationResult): QCErrorStats {
  const issues = result.issues;
  const byType: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  let critical = 0, warning = 0, info = 0;

  for (const issue of issues) {
    byRule[issue.id] = (byRule[issue.id] || 0) + 1;
    if (issue.risk === "high") critical++;
    else if (issue.risk === "medium") warning++;
    else info++;

    // Extract type from enriched message or use id prefix
    const typeMatch = issue.message.match(/\[(硬错误|假规范|资产风险|内容错配)\]/);
    const typeKey = typeMatch ? typeMatch[1] : "unclassified";
    byType[typeKey] = (byType[typeKey] || 0) + 1;
  }

  return {
    total: issues.length,
    byType,
    bySeverity: { critical, warning, info },
    byRule,
  };
}

/**
 * Generate auto-fix suggestions for simple, deterministic errors.
 * Currently handles: color name mismatch (ERR_COLOR_001), font name typos (ERR_FONT_001).
 */
export function generateFixSuggestions(issues: ValidationIssue[]): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];

  for (const issue of issues) {
    // ERR_COLOR_001: color name mismatch
    if (issue.id === "QC01") {
      const hexMatch = issue.message.match(/#([0-9A-Fa-f]{6})/);
      if (hexMatch) {
        suggestions.push({
          errorId: "ERR_COLOR_001",
          originalValue: hexMatch[0],
          suggestedValue: `核实 ${hexMatch[0]} 对应的标准颜色名称`,
          confidence: "medium",
          reason: "HEX色值需与标准颜色名称一一对应",
        });
      }
    }

    // ERR_FONT_001: font name spelling
    if (issue.id === "QC04") {
      const fontMatch = issue.message.match(/("([^"]+)"|'([^']+)')/);
      if (fontMatch) {
        const fontName = fontMatch[2] || fontMatch[3];
        suggestions.push({
          errorId: "ERR_FONT_001",
          originalValue: fontName,
          suggestedValue: `在 SAFE_FONTS 库中查找 "${fontName}" 的正确拼写`,
          confidence: "high",
          reason: "字体名称拼写错误，需修正为官方标准名称",
        });
      }
    }

    // ERR_PLACEHOLDER_001: residual placeholders
    if (issue.id === "A02") {
      suggestions.push({
        errorId: "ERR_PLACEHOLDER_001",
        originalValue: "模板占位符文本",
        suggestedValue: "删除占位符，替换为实际品牌内容",
        confidence: "high",
        reason: "模板占位符（自定义填写/待补充等）必须替换为实际内容",
      });
    }
  }

  return suggestions;
}

/**
 * Persist QC result to project record in Supabase.
 * Updates projects.qc_result JSONB field.
 */
export async function saveQCResult(
  projectId: string,
  result: ValidationResult,
  stage: "round1" | "round2" | "cross"
): Promise<boolean> {
  try {
    const stats = getErrorStats(result);
    const fixSuggestions = generateFixSuggestions(result.issues);

    const qcResult = {
      stage,
      passed: result.passed,
      risk: result.risk,
      stats,
      fixSuggestions: fixSuggestions.slice(0, 10), // cap at 10
      issueCount: result.issues.length,
      checkedAt: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("projects")
      .update({ qc_result: qcResult, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (error) {
      console.warn("[QC] Failed to save qc_result:", error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn("[QC] saveQCResult error:", e.message);
    return false;
  }
}

/**
 * KM-007: Async variant of validateAndBlock that returns error IDs for caller notification.
 * Auto-logs high-risk errors to case_library and returns { blocked, errorIds }.
 * Does NOT throw -- caller decides whether to abort the pipeline.
 */
export async function validateAndBlockAsync(
  md: string,
  stage: "round1" | "round2" | "cross",
  extra: { dict?: IndustryDict | null; params?: ParamPackage },
  projectCtx: QCProjectContext,
): Promise<ValidateAndBlockResult> {
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

  const highRiskIssues = result.result.issues.filter(i => i.risk === "high");
  const errorIds: string[] = [];

  for (const issue of highRiskIssues) {
    const pattern = ANTI_PATTERNS.find(p => p.detectRule === issue.id);
    const errorId = pattern?.errorId || "AUTO_" + issue.id;
    errorIds.push(errorId);

    const logParams: AutoLogParams = {
      projectId: projectCtx.projectId,
      brandName: projectCtx.brandName,
      industry: projectCtx.industry,
      errorId,
      mdContext: md.slice(0, 2000),
      detectRule: issue.id,
    };
    await autoLogError(logParams).catch(e => console.warn("[QC] autoLogError failed:", e));
  }

  const warnings = result.result.issues.filter(i => i.risk !== "high");
  if (warnings.length > 0) {
    console.warn("[QualityCheck] " + stage + " warnings (" + warnings.length + "):", warnings.map(i => "[" + i.id + "] " + i.message).join("; "));
  }

  return { blocked: !result.passed, errorIds };
}

