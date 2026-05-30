/**
 * 模板库管理模块 (Template Library)
 *
 * 管理从参考 VI 手册中提取的结构化设计系统。
 * 支持跨项目复用：上传参考 PDF → 结构化提取 → 存入模板库 → 新项目自动推荐匹配模板。
 */

import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import path from "path";
import fs from "fs";

// ========== 类型定义 ==========

/** 单页分析结果（结构化） */
export interface PageAnalysis {
  /** 参考页码 */
  refPages: number[];
  /** 从该页提取的文本 */
  pageText?: string;
  /** 布局描述 */
  layout: string;
  /** 颜色列表 [name (#hex), ...] */
  colors: string[];
  /** 字体信息 */
  typography: string;
  /** 视觉层次 */
  visualHierarchy: string;
  /** 色彩氛围描述 */
  colorPalette: string;
  /** 视觉情绪 */
  visualMood: string;
  /** 关键元素 */
  keyElements: string[];
  /** 内容结构 */
  contentStructure: string;
  /** 设计笔记 */
  designNotes: string;
}

/** 提取的设计系统 */
export interface ExtractedDesignSystem {
  colors: {
    primary: { hex: string; name: string };
    secondary: { hex: string; name: string };
    accent: { hex: string; name: string };
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    sizeHierarchy: Record<string, string>;
    fontMood: string;
  };
  layoutPattern: {
    cover: string;
    innerPage: string;
    gridSystem?: string;
  };
  moodKeywords: string[];
  perPageMapping: Record<string, PageAnalysis>;
}

/** 完整模板 */
export interface Template {
  templateId: string;
  sourceFile: string;
  industry: string;
  styleTags: string[];
  /** 模板质量评分 (0-100)，基于参考手册的完整度和细节丰富度 */
  qualityScore: number;
  extractedSystem: ExtractedDesignSystem;
  createdAt: string;
  updatedAt: string;
  /** 来自哪个项目，可为空 */
  sourceProjectId?: string;
}

/** 模板列表条目（摘要） */
export interface TemplateSummary {
  templateId: string;
  sourceFile: string;
  industry: string;
  styleTags: string[];
  qualityScore: number;
  moodSummary: string;
  createdAt: string;
}

// ========== 路径常量 ==========

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");
const INDEX_PATH = path.join(TEMPLATES_DIR, "index.json");

// ========== 内部辅助 ==========

interface TemplateIndex {
  version: number;
  templates: TemplateSummary[];
}

async function loadIndex(): Promise<TemplateIndex> {
  try {
    const content = await readFile(INDEX_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: 1, templates: [] };
  }
}

async function saveIndex(index: TemplateIndex): Promise<void> {
  await mkdir(TEMPLATES_DIR, { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

function generateTemplateId(sourceFile: string): string {
  const base = path.basename(sourceFile, path.extname(sourceFile))
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "")
    .slice(0, 30);
  const ts = Date.now().toString(36);
  return `tpl-${base}-${ts}`;
}

function computeQualityScore(system: ExtractedDesignSystem): number {
  let score = 0;

  // Color completeness (max 25)
  if (system.colors.primary.hex && system.colors.primary.hex !== "#000000") score += 10;
  if (system.colors.secondary.hex && system.colors.secondary.hex !== "#000000") score += 8;
  if (system.colors.accent.hex && system.colors.accent.hex !== "#000000") score += 7;

  // Typography detail (max 20)
  if (system.typography.headingFont && system.typography.headingFont.length > 3) score += 7;
  if (system.typography.bodyFont && system.typography.bodyFont.length > 3) score += 6;
  if (Object.keys(system.typography.sizeHierarchy).length > 0) score += 7;

  // Layout pattern detail (max 20)
  if (system.layoutPattern.cover && system.layoutPattern.cover.length > 10) score += 8;
  if (system.layoutPattern.innerPage && system.layoutPattern.innerPage.length > 10) score += 7;
  if (system.layoutPattern.gridSystem && system.layoutPattern.gridSystem.length > 5) score += 5;

  // Page mapping completeness (max 25)
  const pageCount = Object.keys(system.perPageMapping).length;
  score += Math.min(pageCount * 3, 25);

  // Mood keywords (max 10)
  score += Math.min(system.moodKeywords.length * 2, 10);

  return Math.min(score, 100);
}

// ========== 公开 API ==========

/**
 * 获取所有模板摘要列表
 */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const index = await loadIndex();
  return index.templates;
}

/**
 * 通过 ID 获取完整模板
 */
export async function getTemplate(templateId: string): Promise<Template | null> {
  const templatePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  try {
    const content = await readFile(templatePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 保存模板到模板库
 */
export async function saveTemplate(template: Template): Promise<void> {
  await mkdir(TEMPLATES_DIR, { recursive: true });

  // Write full template
  const templatePath = path.join(TEMPLATES_DIR, `${template.templateId}.json`);
  await writeFile(templatePath, JSON.stringify(template, null, 2), "utf-8");

  // Update index
  const index = await loadIndex();
  const summary: TemplateSummary = {
    templateId: template.templateId,
    sourceFile: template.sourceFile,
    industry: template.industry,
    styleTags: template.styleTags,
    qualityScore: template.qualityScore,
    moodSummary: template.extractedSystem.moodKeywords.slice(0, 5).join("、"),
    createdAt: template.createdAt,
  };

  // Replace if exists, otherwise append
  const existingIdx = index.templates.findIndex(t => t.templateId === template.templateId);
  if (existingIdx >= 0) {
    index.templates[existingIdx] = summary;
  } else {
    index.templates.push(summary);
  }

  await saveIndex(index);
}

/**
 * 从结构化设计系统创建模板并保存
 */
export async function createTemplate(
  sourceFile: string,
  industry: string,
  styleTags: string[],
  extractedSystem: ExtractedDesignSystem,
  sourceProjectId?: string
): Promise<Template> {
  const qualityScore = computeQualityScore(extractedSystem);

  const template: Template = {
    templateId: generateTemplateId(sourceFile),
    sourceFile,
    industry: industry || "其他",
    styleTags,
    qualityScore,
    extractedSystem,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceProjectId,
  };

  await saveTemplate(template);
  return template;
}

/**
 * 删除模板
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  const templatePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  try {
    await import("fs/promises").then(fs => fs.unlink(templatePath));
  } catch {
    // File may not exist, continue
  }

  const index = await loadIndex();
  const before = index.templates.length;
  index.templates = index.templates.filter(t => t.templateId !== templateId);

  if (index.templates.length === before) return false;
  await saveIndex(index);
  return true;
}

/**
 * 按行业和风格匹配模板（返回按匹配度排序的结果）
 */
export async function findBestMatchingTemplates(
  industry: string,
  styleTags?: string[],
  limit: number = 3
): Promise<{ template: TemplateSummary; matchScore: number }[]> {
  const allTemplates = await listTemplates();
  const results: { template: TemplateSummary; matchScore: number }[] = [];

  for (const tpl of allTemplates) {
    let score = 0;

    // Exact industry match → +40
    if (tpl.industry === industry) {
      score += 40;
    } else {
      // Partial industry keyword match → +15
      const indKeywords = industry.replace(/[/]/g, " ").split(/\s+/);
      const tplIndKeywords = tpl.industry.replace(/[/]/g, " ").split(/\s+/);
      for (const kw of indKeywords) {
        if (tplIndKeywords.some(t => t.includes(kw) || kw.includes(t))) {
          score += 10;
          break;
        }
      }
    }

    // Style tag overlap → up to +30
    if (styleTags && styleTags.length > 0) {
      const tplStyles = tpl.styleTags.map(s => s.toLowerCase());
      let matched = 0;
      for (const tag of styleTags) {
        const tagLow = tag.toLowerCase();
        if (tplStyles.some(s => s.includes(tagLow) || tagLow.includes(s))) {
          matched++;
        }
      }
      score += Math.min(matched * 10, 30);
    }

    // Quality bonus → up to +30
    score += (tpl.qualityScore / 100) * 30;

    // Only include if there's at least some match
    if (score > 20) {
      results.push({ template: tpl, matchScore: Math.round(score) });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

/**
 * 将参考分析结果转换为模板所需的 ExtractedDesignSystem 格式
 */
export function analysisToDesignSystem(
  overallStyle: string,
  pageMapping: Record<string, any>,
  perPageText: Record<number, string>
): ExtractedDesignSystem {
  const system: ExtractedDesignSystem = {
    colors: { primary: { hex: "#000000", name: "" }, secondary: { hex: "#000000", name: "" }, accent: { hex: "#000000", name: "" } },
    typography: { headingFont: "", bodyFont: "", sizeHierarchy: {}, fontMood: "" },
    layoutPattern: { cover: "", innerPage: "" },
    moodKeywords: [],
    perPageMapping: {},
  };

  // Collect ALL colors across pages
  const allColors: string[] = [];
  const allFonts: string[] = [];
  const allMoods: Set<string> = new Set();

  for (const [pageId, info] of Object.entries(pageMapping)) {
    const typedInfo = info as any;
    const analysis = typedInfo.analysis || {};

    if (!system.layoutPattern.cover && pageId === "cover") {
      system.layoutPattern.cover = analysis.layout || "";
    }
    if (!system.layoutPattern.innerPage && pageId !== "cover" && pageId !== "closing") {
      system.layoutPattern.innerPage = analysis.layout || "";
      if (!system.layoutPattern.innerPage && pageId === "brand-philosophy") {
        system.layoutPattern.innerPage = analysis.layout || "";
      }
    }

    // Collect colors
    if (Array.isArray(analysis.colors)) {
      allColors.push(...analysis.colors);
    }

    // Collect fonts
    if (analysis.typography) {
      allFonts.push(analysis.typography);
    }

    // Collect mood keywords
    if (analysis.visualMood) {
      analysis.visualMood.split(/[,，、/\s]+/).forEach((w: string) => {
        const t = w.trim();
        if (t.length > 0 && t.length < 10) allMoods.add(t);
      });
    }

    // Build per-page mapping
    system.perPageMapping[pageId] = {
      refPages: Array.isArray(typedInfo.referencePages) ? typedInfo.referencePages : [],
      pageText: typedInfo.pageText || perPageText[Array.isArray(typedInfo.referencePages) ? typedInfo.referencePages[0] : 1] || "",
      layout: analysis.layout || "",
      colors: Array.isArray(analysis.colors) ? analysis.colors : [],
      typography: analysis.typography || "",
      visualHierarchy: analysis.visualHierarchy || "",
      colorPalette: analysis.colorPalette || "",
      visualMood: analysis.visualMood || "",
      keyElements: Array.isArray(analysis.keyElements) ? analysis.keyElements : [],
      contentStructure: analysis.contentStructure || "",
      designNotes: analysis.designNotes || "",
    };
  }

  // Extract primary/secondary/accent from collected colors
  const colorMap = parseColorList(allColors);
  if (colorMap.primary) system.colors.primary = colorMap.primary;
  if (colorMap.secondary) system.colors.secondary = colorMap.secondary;
  if (colorMap.accent) system.colors.accent = colorMap.accent;

  // Extract font info
  const fontInfo = parseFontDescriptions(allFonts);
  if (fontInfo.headingFont) system.typography.headingFont = fontInfo.headingFont;
  if (fontInfo.bodyFont) system.typography.bodyFont = fontInfo.bodyFont;
  if (Object.keys(fontInfo.sizeHierarchy).length > 0) system.typography.sizeHierarchy = fontInfo.sizeHierarchy;

  // Mood keywords
  system.moodKeywords = Array.from(allMoods).slice(0, 10);

  // Grid system from cover layout if available
  if (system.layoutPattern.cover) {
    const gridMatch = system.layoutPattern.cover.match(/(grid|column|分栏|栅格|网格|margin|留白|对齐)/i);
    if (gridMatch) system.layoutPattern.gridSystem = system.layoutPattern.cover.slice(0, 200);
  }

  // Font mood from typography descriptions
  if (allFonts.length > 0) {
    const moodMatch = allFonts.join(" ").match(/(优雅|现代|圆润|手写|几何|衬线|无衬线|粗犷|纤细|稳重|活泼)/g);
    if (moodMatch) system.typography.fontMood = [...new Set(moodMatch)].slice(0, 4).join("、");
  }

  return system;
}

// ========== 内部解析函数 ==========

/**
 * 从颜色描述列表中提取主色/辅助色/强调色
 */
function parseColorList(colors: string[]): {
  primary?: { hex: string; name: string };
  secondary?: { hex: string; name: string };
  accent?: { hex: string; name: string };
} {
  const result: {
    primary?: { hex: string; name: string };
    secondary?: { hex: string; name: string };
    accent?: { hex: string; name: string };
  } = {};

  // Heuristic: look for primary/main/dominant patterns
  const priorityKeywords = [
    { pattern: /primary|主色|主要|dominant|主体/i, key: "primary" as const },
    { pattern: /secondary|辅助色|次要/i, key: "secondary" as const },
    { pattern: /accent|强调色|点缀/i, key: "accent" as const },
  ];

  for (const colorStr of colors) {
    const hexMatch = colorStr.match(/(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/);
    if (!hexMatch) continue;

    const hex = hexMatch[1];
    const name = colorStr.replace(/#[0-9A-Fa-f]{6}/g, "").replace(/#[0-9A-Fa-f]{3}/g, "").replace(/[()]/g, "").trim().split(/[,，、]/)[0].trim() || hex;

    for (const item of priorityKeywords) {
      if (item.pattern.test(colorStr)) {
        if (!result[item.key]) {
          result[item.key] = { hex, name };
        }
        break;
      }
    }
  }

  // Fallback: first detected color = primary
  if (!result.primary && colors.length > 0) {
    const firstHex = colors[0].match(/(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/);
    if (firstHex) {
      result.primary = {
        hex: firstHex[1],
        name: colors[0].replace(/#[0-9A-Fa-f]{6}/g, "").replace(/#[0-9A-Fa-f]{3}/g, "").replace(/[()]/g, "").trim().split(/[,，、]/)[0].trim() || firstHex[1],
      };
    }
  }

  // Fallback: second color = secondary
  if (!result.secondary && colors.length > 1) {
    const secondHex = colors[1].match(/(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/);
    if (secondHex) {
      result.secondary = {
        hex: secondHex[1],
        name: colors[1].replace(/#[0-9A-Fa-f]{6}/g, "").replace(/#[0-9A-Fa-f]{3}/g, "").replace(/[()]/g, "").trim().split(/[,，、]/)[0].trim() || secondHex[1],
      };
    }
  }

  // Fallback: third color = accent
  if (!result.accent && colors.length > 2) {
    const thirdHex = colors[2].match(/(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/);
    if (thirdHex) {
      result.accent = {
        hex: thirdHex[1],
        name: colors[2].replace(/#[0-9A-Fa-f]{6}/g, "").replace(/#[0-9A-Fa-f]{3}/g, "").replace(/[()]/g, "").trim().split(/[,，、]/)[0].trim() || thirdHex[1],
      };
    }
  }

  return result;
}

/**
 * 从字体描述文本中提取标题字体和正文字体
 */
function parseFontDescriptions(descriptions: string[]): {
  headingFont: string;
  bodyFont: string;
  sizeHierarchy: Record<string, string>;
} {
  const result = { headingFont: "", bodyFont: "", sizeHierarchy: {} as Record<string, string> };
  const text = descriptions.join(" ");

  // Look for font family names
  const fontNames = text.match(/([A-Za-z\s]+(?:\s+[A-Za-z]+)*|[\u4e00-\u9fa5]{2,8}(?:字体|体))/g);
  if (fontNames) {
    const unique = [...new Set(fontNames.map(f => f.trim()).filter(f => f.length > 1))];
    if (unique.length > 0) result.headingFont = unique[0];
    if (unique.length > 1) result.bodyFont = unique[unique.length - 1];
  }

  // Look for size hierarchy
  const sizeMatches = text.match(/(heading|title|header|H1|H2|正文|body|说明|caption|标注)[^。，；;]*?(\d+)[-~]?(\d*)\s*(pt|px|号)/gi);
  if (sizeMatches) {
    for (const match of sizeMatches) {
      const parts = match.match(/(heading|title|header|H1|H2|正文|body|说明|caption|标注)/i);
      const size = match.match(/(\d+[-~]?\d*)\s*(pt|px|号)/i);
      if (parts && size) {
        const key = parts[1].toLowerCase();
        const label = key.includes("heading") || key.includes("title") || key.includes("header") || key === "h1" || key === "h2"
          ? `标题${key === "h2" ? "2" : "1"}`
          : key;
        result.sizeHierarchy[label] = size[0];
      }
    }
  }

  return result;
}
