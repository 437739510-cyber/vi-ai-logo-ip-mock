// @ts-nocheck
/**
 * Page Planner — 设计决策引擎
 *
 * 核心大脑：
 * 输入客户资料 + 素材认知 + 设计规则 + 参考模板
 * 输出每页的 PageBlueprint（施工图）
 *
 * 数据流：
 *   clientInfo + assetAnalysis + designRules + referenceTemplate
 *   → Rule Matching → Conflict Resolution → Page Orchestration
 *   → PageBlueprint[]
 */
import { getRulesForPage, sortRulesByPriority, applyRuleConstraints, validateBlueprintAgainstRules, type DesignRule } from "./design-rules";
import { getTemplate, findBestMatchingTemplates, type Template, type PageAnalysis } from "./template-library";
import { planLayoutWithAI, type AILayoutContext } from "./ai-layout-planner";

// ========== 类型定义 ==========

/** 页面元素 */
export type PageElementType =
  | "logo"
  | "text"
  | "ip-mascot"
  | "color-swatch"
  | "decoration"
  | "image"
  | "table"
  | "divider"
  | "threeview";

/** 单个页面元素 */
export interface PageElement {
  type: PageElementType;
  /** 唯一标识 */
  id: string;
  /** 内容（文本、图片URL等） */
  content?: string;
  /** 位置 & 尺寸 */
  position: "top-center" | "center" | "bottom-center" | "bottom-right" | "left" | "right";
  /** X 百分比 (0-100) */
  xPct?: number;
  /** Y 百分比 (0-100) */
  yPct?: number;
  /** 宽度百分比 (0-100) */
  widthPct?: number;
  /** 高度百分比 (0-100) */
  heightPct?: number;
  /** 上边距 (px) */
  marginTop?: number;
  /** 下边距 */
  marginBottom?: number;
  /** 左边距 */
  marginLeft?: number;
  /** 右边距 */
  marginRight?: number;
  /** 字体大小 */
  fontSize?: number;
  /** 字重 */
  fontWeight?: number;
  /** 颜色 */
  color?: string;
  /** 不透明度 */
  opacity?: number;
  /** 是否带阴影 */
  shadow?: boolean;
  /** 子元素列表（用于复合元素） */
  children?: PageElement[];
  /** 扩展参数 */
  params?: Record<string, any>;
}

/** 背景定义 */
export interface PageBackground {
  type: "solid" | "gradient" | "image" | "pattern";
  primaryColor: string;
  secondaryColor?: string;
  generatePrompt?: string;
  decorations?: string[];
}

/** 页面施工图 */
export interface PageBlueprint {
  pageId: string;
  label: string;
  background: PageBackground;
  elements: PageElement[];
  /** 引用的设计规则 */
  appliedRules: string[];
  /** 引用的模板信息 */
  templateRef?: string;
  /** 质量阈值 */
  qualityThreshold: number;
}

/** Page Planner 输入 */
export interface PagePlannerInput {
  /** 客户资料 */
  clientInfo: {
    companyName: string;
    brandVision: string;
    coreValues: string;
    targetMarket: string;
    logoPhilosophy?: string;
    mascotPhilosophy?: string;
    industry?: string;
  };
  /** 品牌颜色 */
  brandColors: {
    primary: { hex: string; name?: string; cmyk?: string };
    secondary: { hex: string; name?: string; cmyk?: string };
    accent: { hex: string; name?: string; cmyk?: string };
  };
  /** 素材分析 */
  assetAnalysis?: {
    logo?: {
      hasLogo: boolean;
      logoUrl?: string;
      elements?: string[];
      styleTags?: string[];
      meaning?: string;
      extractedColors?: { hex: string; name?: string }[];
    };
    mascot?: {
      hasMascot: boolean;
      mascotUrl?: string;
      isThreeView?: boolean;
      splitViews?: string[];
      name?: string;
      style?: string;
      personality?: string;
      description?: string;
      labels?: string[];
    };
  };
  /** 参考模板 ID（可选） */
  templateId?: string;
  /** 所有页面是否生成 */
  generateAll?: boolean;
  /** 指定生成哪些页 */
  pageIds?: string[];
}

// ========== 11 页默认文案 ==========

const PAGE_LABELS: Record<string, string> = {
  cover: "品牌视觉识别系统 (VI) 规范手册",
  toc: "目录",
  "brand-philosophy": "品牌核心理念",
  "logo-interpretation": "标识诠释",
  "logo-variations": "Logo组合规范",
  "logo-misuse": "Logo误用规范",
  "auxiliary-graphics": "辅助图形",
  "brand-colors": "标准色彩规范",
  typography: "字体系统",
  "basic-spec": "基础规范",
  stationery: "办公应用系统",
  packaging: "产品包装系统",
  marketing: "营销展示系统",
  summary: "总结",
  closing: "感谢观看",
};

// 行业类型映射
function mapIndustryType(industry?: string): string {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  if (/椰|椰子|椰汁|茶|咖啡|饮|奶茶|果汁|酒|酒吧|饮品|奶茶店|气泡|矿泉|纯净水/.test(s)) return "beverage";
  if (/餐|食|面|火锅|烧烤|烘焙|饺子|包子|炒菜|饭店|小吃|饭馆|海鲜|川菜|粤菜|湘菜|鲁菜|馆|外卖/.test(s)) return "restaurant";
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫/.test(s)) return "beauty";
  if (/零售|超市|便利|商店|杂货|服装|鞋|饰品|母婴|数码/.test(s)) return "retail";
  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) return "education";
  return "general";
}

// 行业定制场景页标题
const INDUSTRY_SCENE_LABELS: Record<string, { stationery: string; packaging: string; marketing: string }> = {
  restaurant:  { stationery: "餐饮应用系统", packaging: "餐饮包装系统", marketing: "餐饮营销系统" },
  beverage:    { stationery: "饮品应用系统", packaging: "饮品包装系统", marketing: "饮品营销系统" },
  beauty:      { stationery: "美业应用系统", packaging: "美业包装系统", marketing: "美业营销系统" },
  retail:      { stationery: "零售应用系统", packaging: "零售包装系统", marketing: "零售营销系统" },
  education:   { stationery: "教育应用系统", packaging: "教育包装系统", marketing: "教育营销系统" },
  general:     { stationery: "办公应用系统", packaging: "产品包装系统", marketing: "营销展示系统" },
};

// 行业定制场景页描述
const INDUSTRY_SCENE_DESCS: Record<string, { stationery: string; packaging: string; marketing: string }> = {
  restaurant:  { stationery: "品牌在餐饮场景中的标准化应用", packaging: "餐饮食具与外带物料的品牌化呈现", marketing: "门店宣传与促销物料" },
  beverage:    { stationery: "品牌在饮品场景中的标准化应用", packaging: "饮品杯具与外带物料的品牌化呈现", marketing: "门店宣传与促销物料" },
  beauty:      { stationery: "品牌在美业场景中的标准化应用", packaging: "美业产品与礼盒的品牌化呈现", marketing: "门店宣传与会员招募物料" },
  retail:      { stationery: "品牌在零售场景中的标准化应用", packaging: "商品包装与手提袋的品牌化呈现", marketing: "促销活动与宣传物料" },
  education:   { stationery: "品牌在教育场景中的标准化应用", packaging: "教材与课程物料的品牌化呈现", marketing: "招生宣传与活动物料" },
  general:     { stationery: "品牌在商务场景中的标准化应用", packaging: "产品包装与物料的品牌化呈现", marketing: "宣传与促销物料" },
};

// ========== 核心引擎 ==========

/**
 * 主入口：根据输入生成所有页面的 PageBlueprint
 */
export async function planPages(input: PagePlannerInput): Promise<PageBlueprint[]> {
  const pageIds = input.pageIds || [
    "cover", "toc", "brand-philosophy", "logo-interpretation", "logo-variations",
    "logo-misuse", "auxiliary-graphics", "brand-colors",
    "typography", "basic-spec", "stationery", "packaging",
    "marketing", "summary", "closing",
  ];

  // 加载参考模板（如果有）
  let template: Template | null = null;
  let perPageAnalysis: Record<string, PageAnalysis> = {};
  if (input.templateId) {
    template = await getTemplate(input.templateId);
    if (template) {
      perPageAnalysis = template.extractedSystem.perPageMapping;
    }
  } else if (input.clientInfo.industry) {
    // 尝试按行业自动匹配模板
    const matches = await findBestMatchingTemplates(input.clientInfo.industry, [], 1);
    if (matches.length > 0 && matches[0].matchScore >= 40) {
      template = await getTemplate(matches[0].template.templateId);
      if (template) {
        perPageAnalysis = template.extractedSystem.perPageMapping;
      }
    }
  }

  const blueprints: PageBlueprint[] = [];

  for (const pageId of pageIds) {
    const blueprint = await planSinglePage(pageId, input, template, perPageAnalysis);
    blueprints.push(blueprint);
  }

  return blueprints;
}

/**
 * 规划单个页面
 */
async function planSinglePage(
  pageId: string,
  input: PagePlannerInput,
  template: Template | null,
  perPageAnalysis: Record<string, PageAnalysis>
): Promise<PageBlueprint> {
  const companyName = input.clientInfo.companyName || "品牌名称";
  const pri = input.brandColors.primary;
  const sec = input.brandColors.secondary;
  const acc = input.brandColors.accent;
  const hasLogo = input.assetAnalysis?.logo?.hasLogo ?? false;
  const hasMascot = input.assetAnalysis?.mascot?.hasMascot ?? false;
  const isThreeView = input.assetAnalysis?.mascot?.isThreeView ?? false;
  const mascotName = input.assetAnalysis?.mascot?.name || "";
  const mascotStyle = input.assetAnalysis?.mascot?.style || "";
  const mascotPersonality = input.assetAnalysis?.mascot?.personality || "";
  const logoElements = input.assetAnalysis?.logo?.elements || [];
  const logoMeaning = input.assetAnalysis?.logo?.meaning || "";
  const logoStyleTags = input.assetAnalysis?.logo?.styleTags || [];

  // 获取参考模板该页分析
  const pageRef: PageAnalysis | undefined = perPageAnalysis[pageId];

  // 获取设计规则
  const rules = getRulesForPage(pageId);
  const sortedRules = sortRulesByPriority(rules);

  // Phase 10: 尝试 AI 布局优先（仅关键页面，其余走硬编码fallback以节省时间）
  const AI_LAYOUT_PAGES = new Set(["cover", "brand-philosophy", "logo-interpretation", "summary"]);
  let aiElements = null;
  if (AI_LAYOUT_PAGES.has(pageId)) {
    try {
      // 8秒超时，避免单页卡太久
      aiElements = await Promise.race([
        planLayoutWithAI(pageId, {
          companyName,
          brandVision: input.clientInfo.brandVision,
          coreValues: input.clientInfo.coreValues,
          targetMarket: input.clientInfo.targetMarket,
          hasLogo,
          logoElements,
          logoMeaning,
          logoStyleTags,
          hasMascot,
          mascotName,
          mascotStyle,
          mascotPersonality,
          brandColors: input.brandColors,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      // AI 失败，走 fallback
    }
  }

  // 构建蓝图
  const blueprint = buildBlueprint(pageId, {
    companyName, pri, sec, acc, hasLogo, hasMascot,
    isThreeView, mascotName, mascotStyle, mascotPersonality,
    logoElements, logoMeaning, logoStyleTags,
    clientInfo: input.clientInfo,
    rules: sortedRules,
    pageRef,
    aiElements,
    industryType: mapIndustryType(input.clientInfo.industry),
  });

  return blueprint;
}

// ========== 蓝图构建 ==========

interface BuildContext {
  companyName: string;
  pri: { hex: string; name?: string };
  sec: { hex: string; name?: string };
  acc: { hex: string; name?: string };
  hasLogo: boolean;
  hasMascot: boolean;
  isThreeView: boolean;
  mascotName: string;
  mascotStyle: string;
  mascotPersonality: string;
  logoElements: string[];
  logoMeaning: string;
  logoStyleTags: string[];
  clientInfo: PagePlannerInput["clientInfo"];
  rules: DesignRule[];
  pageRef?: PageAnalysis;
  aiElements?: PageElement[] | null;
}

function buildBlueprint(pageId: string, ctx: BuildContext): PageBlueprint {
  const label = PAGE_LABELS[pageId] || pageId;
  const appliedRules = ctx.rules.map(r => r.id);
  const qualityThreshold = 70;

  const background = buildBackground(pageId, ctx);
  let elements: PageElement[];
  if (ctx.aiElements && ctx.aiElements.length > 0) {
    elements = ctx.aiElements;
  } else {
    elements = buildElements(pageId, ctx);
  }

  // Phase 9: Apply rule constraints to elements (clamp sizes, enforce colors, etc.)
  const constrainedElements = applyRuleConstraints(elements, ctx.rules);


  return {
    pageId,
    label,
    background,
    elements: constrainedElements,
    appliedRules,
    qualityThreshold,
  };
}

// ========== 背景生成 ==========

function buildBackground(pageId: string, ctx: BuildContext): PageBackground {
  const { pri, sec, acc, pageRef } = ctx;

  // 参考模板优先：如果模板有分析，直接使用模板布局风格
  if (pageRef?.layout) {
    return {
      type: "gradient",
      primaryColor: pri.hex,
      secondaryColor: sec.hex,
      generatePrompt: buildBackgroundPrompt(pageId, ctx),
      decorations: extractDecorations(pageRef),
    };
  }

  // 默认按页面类型构建背景
  switch (pageId) {
    case "cover":
      return {
        type: "gradient",
        primaryColor: pri.hex,
        secondaryColor: sec.hex,
        generatePrompt: `企业VI手册封面背景，品牌色${pri.hex}渐变，简洁高级感，轻微光晕，无文字无LOGO无人物，商务风格`,
      };
    case "closing":
      return {
        type: "gradient",
        primaryColor: pri.hex,
        secondaryColor: acc.hex,
        generatePrompt: `企业VI手册封底背景，品牌色${pri.hex}渐变，简洁质感，无文字无LOGO`,
      };
    case "brand-philosophy":
    case "summary":
      return {
        type: "solid",
        primaryColor: "#FFFFFF",
        secondaryColor: sec.hex,
        generatePrompt: `企业VI手册内页背景，白色底，轻微品牌色${sec.hex}装饰，简洁商务，无文字无LOGO`,
      };
    case "stationery":
    case "packaging":
    case "marketing":
      return {
        type: "image",
        primaryColor: pri.hex,
        generatePrompt: buildScenePrompt(pageId, ctx),
      };
    default:
      return {
        type: "solid",
        primaryColor: "#FFFFFF",
        generatePrompt: `企业VI手册内页背景，白色底色，简洁商务，无文字无LOGO`,
      };
  }
}

/** 生成场景类页面的 prompt */
function buildScenePrompt(pageId: string, ctx: BuildContext): string {
  const { pri, companyName, pageRef } = ctx;
  let prompt = "";

  if (pageRef?.visualMood) {
    prompt += `风格参考：${pageRef.visualMood}。`;
  }
  if (pageRef?.colorPalette) {
    prompt += `色彩方案：${pageRef.colorPalette}。`;
  }

  switch (pageId) {
    case "stationery":
      prompt += `企业VI办公应用场景，品牌色${pri.hex}，包含名片、信封、信纸，商务专业摄影风格，高清，无文字无LOGO`;
      break;
    case "packaging":
      prompt += `企业产品包装场景，品牌色${pri.hex}为主色调，产品展示，专业产品摄影风格，高清，无文字无LOGO`;
      break;
    case "marketing":
      prompt += `品牌营销海报场景，品牌色${pri.hex}，${companyName}品牌调性，现代设计感，高清，无文字`;
      break;
  }
  return prompt;
}

/** 生成背景图的 DeepSeek prompt */
function buildBackgroundPrompt(pageId: string, ctx: BuildContext): string {
  const { pri, sec, companyName, pageRef } = ctx;
  let prompt = `企业VI手册${PAGE_LABELS[pageId]}页面背景`;

  if (pageRef) {
    if (pageRef.visualMood) prompt += `，视觉风格：${pageRef.visualMood}`;
    if (pageRef.colorPalette) prompt += `，色彩方案：${pageRef.colorPalette}`;
  }

  prompt += `，品牌色${pri.hex}${sec.hex}，简洁商务质感，无文字无LOGO无人物`;
  return prompt;
}

/** 从参考分析中提取装饰元素类型 */
function extractDecorations(pageRef?: PageAnalysis): string[] {
  if (!pageRef) return ["corner-accents", "thin-divider"];
  const decons: string[] = [];
  const layout = (pageRef.layout || "").toLowerCase();
  if (layout.includes("线条") || layout.includes("line")) decons.push("thin-divider");
  if (layout.includes("角标") || layout.includes("corner")) decons.push("corner-accents");
  if (layout.includes("底纹") || layout.includes("纹理")) decons.push("subtle-texture");
  if (layout.includes("渐变")) decons.push("gradient-overlay");
  if (decons.length === 0) decons.push("thin-divider", "corner-accents");
  return decons;
}

// ========== 元素生成 ==========

function buildElements(pageId: string, ctx: BuildContext): PageElement[] {
  switch (pageId) {
    case "cover": return buildCoverElements(ctx);
    case "brand-philosophy": return buildPhilosophyElements(ctx);
    case "logo-interpretation": return buildLogoInterpElements(ctx);
    case "logo-variations": return buildLogoVariationsElements(ctx);
    case "logo-misuse": return buildLogoMisuseElements(ctx);
    case "auxiliary-graphics": return buildAuxiliaryGraphicsElements(ctx);
    case "brand-colors": return buildColorElements(ctx);
    case "typography": return buildTypographyElements(ctx);
    case "basic-spec": return buildBasicSpecElements(ctx);
    case "stationery": return buildStationeryElements(ctx);
    case "packaging": return buildPackagingElements(ctx);
    case "marketing": return buildMarketingElements(ctx);
    case "summary": return buildSummaryElements(ctx);
    case "closing": return buildClosingElements(ctx);
    default: return [];
  }
}

// ---- 封面 ----

function buildCoverElements(ctx: BuildContext): PageElement[] {
  const { companyName, hasLogo, hasMascot, isThreeView } = ctx;
  const elements: PageElement[] = [];
  let yOffset = 60;

  // 顶部装饰条
  elements.push({
    type: "decoration", id: "cover-top-bar",
    position: "top-center", widthPct: 100, heightPct: 1,
    color: ctx.acc.hex, params: { barType: "thin" },
  });

  // LOGO
  if (hasLogo) {
    elements.push({
      type: "logo", id: "cover-logo",
      position: "top-center", widthPct: 40, heightPct: 18,
      marginTop: yOffset, shadow: true,
    });
    yOffset = 60 + 180 + 30;
  } else {
    yOffset = 120;
  }

  // 分隔线
  elements.push({
    type: "divider", id: "cover-divider-1",
    position: "center",
    color: ctx.acc.hex, opacity: 0.4,
    marginTop: yOffset, widthPct: 50,
    params: { lineWidth: 1 },
  });
  yOffset += 30;

  // 公司名
  const nameSize = companyName.length > 8 ? 40 : 48;
  elements.push({
    type: "text", id: "cover-company-name",
    content: companyName,
    position: "center", fontSize: nameSize, fontWeight: 700,
    color: "#FFFFFF", marginTop: yOffset, shadow: true,
  });
  yOffset += nameSize + 20;

  // 副标题
  elements.push({
    type: "text", id: "cover-subtitle",
    content: "品牌视觉识别系统 (VI) 规范手册",
    position: "center", fontSize: 22, fontWeight: 500,
    color: "#FFFFFF", opacity: 0.9, marginTop: yOffset,
  });

  // 英文副标题
  elements.push({
    type: "text", id: "cover-subtitle-en",
    content: "VISUAL IDENTITY GUIDELINES",
    position: "center", fontSize: 14, fontWeight: 300,
    color: "#FFFFFF", opacity: 0.6,
    marginTop: yOffset + 30, params: { letterSpacing: 3 },
  });

  // 底部信息
  elements.push({
    type: "text", id: "cover-bottom-info",
    content: "品牌管理部  ·  v1.0  ·  2026",
    position: "bottom-center", fontSize: 14,
    color: "#FFFFFF", opacity: 0.7, marginBottom: 40,
  });

  // IP 公仔（右下角）
  if (hasMascot) {
    elements.push({
      type: "ip-mascot", id: "cover-mascot",
      position: "bottom-right",
      widthPct: isThreeView ? 15 : 20,
      heightPct: isThreeView ? 18 : 22,
      marginRight: 40, marginBottom: 40, opacity: 0.9,
      params: { view: "front" },
    });
  }

  return elements;
}

// ---- 品牌核心理念 ----

function buildPhilosophyElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, clientInfo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  // 标题
  elements.push({ type: "text", id: "ph-title", content: PAGE_LABELS["brand-philosophy"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  // 分隔线
  elements.push({ type: "divider", id: "ph-divider-top",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 三个板块
  const sections = [
    { id: "vision", label: "品牌愿景", content: clientInfo.brandVision || "待定" },
    { id: "values", label: "核心价值", content: clientInfo.coreValues || "待定" },
    { id: "market", label: "目标市场", content: clientInfo.targetMarket || "待定" },
  ];

  sections.forEach((s, i) => {
    const yBase = 140 + i * 240;

    // 板块标头
    elements.push({ type: "text", id: `ph-${s.id}-label`,
      content: s.label, position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: yBase, marginLeft: 80, params: { align: "left" },
    });

    // 板块内容
    elements.push({ type: "text", id: `ph-${s.id}-content`,
      content: s.content, position: "top-center",
      fontSize: 14, fontWeight: 400, color: "#444",
      marginTop: yBase + 30, marginLeft: 80, marginRight: 80,
      params: { align: "left", lineHeight: 1.5 },
    });

    // 分隔线
    if (i < sections.length - 1) {
      elements.push({ type: "divider", id: `ph-div-${s.id}`,
        position: "center", widthPct: 60, color: acc.hex, opacity: 0.2,
        marginTop: yBase + 180,
      });
    }
  });

  // IP 装饰右下角
  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "ph-mascot",
      position: "bottom-right", widthPct: 12, heightPct: 15,
      marginRight: 30, marginBottom: 30, opacity: 0.6,
    });
  }

  return elements;
}

// ---- 标识诠释 ----

function buildLogoInterpElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, sec, logoElements, logoMeaning, logoStyleTags, hasLogo, hasMascot, mascotName, mascotStyle, mascotPersonality, mascotPhilosophy } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "li-title", content: PAGE_LABELS["logo-interpretation"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "li-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  let yPos = 130;

  // LOGO 设计理念
  if (hasLogo) {
    // LOGO 图
    elements.push({ type: "logo", id: "li-logo-image",
      position: "left", widthPct: 25, heightPct: 20,
      marginTop: yPos, marginLeft: 60, });

    // 元素拆解
    if (logoElements.length > 0) {
      elements.push({ type: "text", id: "li-elements-title",
        content: "设计元素拆解", position: "right",
        fontSize: 14, fontWeight: 700, color: pri.hex,
        marginTop: yPos, marginRight: 80, });

      elements.push({ type: "text", id: "li-elements",
        content: logoElements.map((e, i) => `${i + 1}. ${e}`).join("\n"),
        position: "right", fontSize: 12, fontWeight: 400, color: "#555",
        marginTop: yPos + 25, marginRight: 80,
        params: { align: "left", lineHeight: 1.6 },
      });
    }

    if (logoMeaning) {
      yPos += 60;
      elements.push({ type: "divider", id: "li-div-1",
        position: "center", widthPct: 70, color: sec.hex, opacity: 0.3, marginTop: yPos });

      elements.push({ type: "text", id: "li-meaning-title",
        content: "设计含义", position: "top-center",
        fontSize: 14, fontWeight: 600, color: pri.hex,
        marginTop: yPos + 20, marginLeft: 80 });

      elements.push({ type: "text", id: "li-meaning",
        content: logoMeaning, position: "top-center",
        fontSize: 13, fontWeight: 400, color: "#444",
        marginTop: yPos + 45, marginLeft: 80, marginRight: 80,
        params: { align: "left", lineHeight: 1.5 },
      });
    }

    if (logoStyleTags.length > 0) {
      elements.push({ type: "text", id: "li-styles",
        content: `风格标签：${logoStyleTags.join("、")}`,
        position: "bottom-center", fontSize: 11,
        color: "#888", marginBottom: 120,
      });
    }
  }

  // IP 角色介绍
  if (hasMascot && mascotName) {
    const mascotY = 480;
    elements.push({ type: "divider", id: "li-div-ip",
      position: "center", widthPct: 70, color: acc.hex, opacity: 0.3, marginTop: mascotY });

    elements.push({ type: "text", id: "li-ip-title",
      content: "IP 角色介绍", position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: mascotY + 20 });

    elements.push({ type: "text", id: "li-ip-name",
      content: `角色名称：${mascotName}`,
      position: "top-center", fontSize: 14, fontWeight: 500,
      color: "#333", marginTop: mascotY + 50, marginLeft: 80,
      params: { align: "left" },
    });

    if (mascotStyle || mascotPersonality) {
      elements.push({ type: "text", id: "li-ip-desc",
        content: [mascotStyle, mascotPersonality].filter(Boolean).join(" · "),
        position: "top-center", fontSize: 13,
        color: "#555", marginTop: mascotY + 75, marginLeft: 80,
        params: { align: "left" },
      });
    }

    if (mascotPhilosophy) {
      elements.push({ type: "text", id: "li-ip-philosophy-title",
        content: "设计理念",
        position: "top-center", fontSize: 14, fontWeight: 600, color: pri.hex,
        marginTop: mascotY + 100, marginLeft: 80,
        params: { align: "left" },
      });
      elements.push({ type: "text", id: "li-ip-philosophy",
        content: mascotPhilosophy,
        position: "top-center", fontSize: 12, fontWeight: 400, color: "#555",
        marginTop: mascotY + 125, marginLeft: 80, marginRight: 80,
        params: { align: "left", lineHeight: 1.5 },
      });
    }
  }

  return elements;
}


// ---- Logo组合规范 ----

function buildLogoVariationsElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc, hasLogo } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "lv-title", content: PAGE_LABELS["logo-variations"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "lv-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  if (hasLogo) {
    // 4 variations in 2x2 grid
    const variations = [
      { id: "horizontal", label: "横式组合", col: 0, row: 0, bgDark: false },
      { id: "vertical", label: "竖式组合", col: 1, row: 0, bgDark: false },
      { id: "inverted", label: "反白稿（深底）", col: 0, row: 1, bgDark: true },
      { id: "monochrome", label: "单色稿", col: 1, row: 1, bgDark: false },
    ];

    for (const v of variations) {
      const xBase = v.col === 0 ? 80 : 510;
      const yBase = v.row === 0 ? 120 : 340;

      elements.push({ type: "decoration", id: `lv-bg-${v.id}`,
        position: "absolute", widthPct: 40, heightPct: 25,
        marginLeft: xBase, marginTop: yBase,
        color: v.bgDark ? pri.hex : "#F5F5F5",
        params: { shape: "rounded-rect" },
      });

      elements.push({ type: "logo", id: `lv-${v.id}`,
        position: "absolute", widthPct: 20, heightPct: 14,
        marginLeft: xBase + 100, marginTop: yBase + 30,
        shadow: !v.bgDark,
        params: { variation: v.id, bgDark: v.bgDark },
      });

      elements.push({ type: "text", id: `lv-label-${v.id}`,
        content: v.label, position: "absolute",
        fontSize: 12, fontWeight: 500, color: v.bgDark ? "#FFFFFF" : "#666",
        marginLeft: xBase + 80, marginTop: yBase + 180,
        params: { align: "center" },
      });
    }

    elements.push({ type: "text", id: "lv-note",
      content: "Logo在不同背景和应用场景下应选用合适的组合形式，确保识别性与美观性。",
      position: "bottom-center", fontSize: 11, color: "#888",
      marginBottom: 80, params: { align: "center" },
    });
  } else {
    elements.push({ type: "text", id: "lv-no-logo",
      content: "本品牌使用AI生成Logo，建议后续完善横式/竖式/反白/单色稿。",
      position: "center", fontSize: 13, color: "#888", marginTop: 200,
      params: { align: "center" },
    });
  }

  return elements;
}

// ---- Logo误用规范 ----

function buildLogoMisuseElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "lm-title", content: PAGE_LABELS["logo-misuse"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "lm-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  const misuses = [
    { title: "禁止拉伸", desc: "不得对Logo进行\n非等比缩放" },
    { title: "禁止旋转", desc: "不得旋转\nLogo角度" },
    { title: "禁止换色", desc: "不得使用非标准色\n替换Logo颜色" },
    { title: "禁止描边", desc: "不得给Logo\n添加描边效果" },
    { title: "禁止加阴影", desc: "不得添加非规范\n投影效果" },
    { title: "禁止改字体", desc: "不得更改Logo\n中的字体样式" },
  ];

  for (let i = 0; i < misuses.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const xBase = col === 0 ? 50 : col === 1 ? 310 : 570;
    const yBase = 110 + row * 230;

    // Red X box
    elements.push({ type: "decoration", id: `lm-box-${i}`,
      position: "absolute", widthPct: 28, heightPct: 24,
      marginLeft: xBase, marginTop: yBase,
      color: "#FEF2F2", params: { shape: "rounded-rect", borderColor: "#FECACA" },
    });

    elements.push({ type: "text", id: `lm-x-${i}`,
      content: "\u2715", position: "absolute",
      fontSize: 32, fontWeight: 700, color: "#EF4444",
      marginLeft: xBase + 95, marginTop: yBase + 20,
      params: { align: "center" },
    });

    elements.push({ type: "text", id: `lm-t-${i}`,
      content: misuses[i].title, position: "absolute",
      fontSize: 14, fontWeight: 700, color: "#DC2626",
      marginLeft: xBase + 20, marginTop: yBase + 80,
      params: { align: "center" },
    });

    elements.push({ type: "text", id: `lm-d-${i}`,
      content: misuses[i].desc, position: "absolute",
      fontSize: 11, fontWeight: 400, color: "#888",
      marginLeft: xBase + 10, marginTop: yBase + 110,
      marginRight: 10, params: { align: "center", lineHeight: 1.6 },
    });
  }

  elements.push({ type: "text", id: "lm-footer",
    content: "以上误用方式将严重损害品牌形象，所有应用必须严格遵守本规范。",
    position: "bottom-center", fontSize: 12, fontWeight: 600, color: pri.hex,
    marginBottom: 60, params: { align: "center" },
  });

  return elements;
}

// ---- 辅助图形 ----

function buildAuxiliaryGraphicsElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "ag-title", content: PAGE_LABELS["auxiliary-graphics"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "ag-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // Intro
  elements.push({ type: "text", id: "ag-intro",
    content: "辅助图形是品牌视觉系统的重要组成部分，用于丰富视觉层次、强化品牌识别。",
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 100, marginLeft: 80, marginRight: 80,
    params: { align: "left", lineHeight: 1.6 },
  });

  // Pattern 1: Stripes
  elements.push({ type: "decoration", id: "ag-pattern-1",
    position: "left", widthPct: 42, heightPct: 22,
    marginTop: 160, marginLeft: 50,
    color: pri.hex, params: { patternType: "stripes", secondaryColor: sec.hex, accentColor: acc.hex },
  });
  elements.push({ type: "text", id: "ag-p1-label",
    content: "主辅助图形 \u2014 条纹组合", position: "left",
    fontSize: 12, fontWeight: 500, color: "#444",
    marginTop: 380, marginLeft: 70,
  });

  // Pattern 2: Dots
  elements.push({ type: "decoration", id: "ag-pattern-2",
    position: "right", widthPct: 42, heightPct: 22,
    marginTop: 160, marginRight: 50,
    color: sec.hex, params: { patternType: "dots", secondaryColor: pri.hex, accentColor: acc.hex },
  });
  elements.push({ type: "text", id: "ag-p2-label",
    content: "次辅助图形 \u2014 点阵组合", position: "right",
    fontSize: 12, fontWeight: 500, color: "#444",
    marginTop: 380, marginRight: 70,
  });

  // Usage
  elements.push({ type: "text", id: "ag-usage-title",
    content: "应用场景", position: "top-center",
    fontSize: 16, fontWeight: 700, color: pri.hex, marginTop: 440,
  });

  elements.push({ type: "text", id: "ag-usage-list",
    content: "1. 文档/手册页眉装饰线\n2. 包装袋底部纹样\n3. 名片背面背景\n4. 社交媒体封面装饰\n5. 店铺墙面装饰纹样",
    position: "top-center", fontSize: 12, color: "#555",
    marginTop: 475, marginLeft: 80, marginRight: 80,
    params: { align: "left", lineHeight: 1.8 },
  });

  elements.push({ type: "text", id: "ag-note",
    content: "辅助图形可按比例缩放，但不可改变比例关系或旋转角度。建议透明度使用10%-40%。",
    position: "bottom-center", fontSize: 11, color: "#888",
    marginBottom: 60, params: { align: "center" },
  });

  return elements;
}

// ---- 标准色彩规范 ----

function buildColorElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "bc-title", content: PAGE_LABELS["brand-colors"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "bc-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 三色块
  const colors = [
    { id: "primary", label: "主色", hex: pri.hex, name: pri.name || "品牌主色" },
    { id: "secondary", label: "辅助色", hex: sec.hex, name: sec.name || "辅助色" },
    { id: "accent", label: "强调色", hex: acc.hex, name: acc.name || "强调色" },
  ];

  colors.forEach((c, i) => {
    const xBase = 80 + i * 300;
    elements.push({
      type: "color-swatch", id: `bc-${c.id}`,
      position: "top-center",
      widthPct: 22, heightPct: 18,
      marginTop: 120, marginLeft: xBase,
      color: c.hex,
      params: { label: c.label, name: c.name, hex: c.hex },
    });
  });

  return elements;
}

// ---- 字体系统 ----

function buildTypographyElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "ty-title", content: PAGE_LABELS["typography"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "ty-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  // 中文 / 英文 两块
  const sections = [
    { id: "zh", lang: "中文字体", brand: "思源黑体 / Noto Sans SC", body: "思源宋体 / Noto Serif SC" },
    { id: "en", lang: "英文字体", brand: "Montserrat", body: "Open Sans" },
  ];

  sections.forEach((s, i) => {
    const yBase = 150 + i * 300;
    elements.push({ type: "text", id: `ty-${s.id}-title`,
      content: s.lang, position: "top-center",
      fontSize: 16, fontWeight: 700, color: pri.hex,
      marginTop: yBase, marginLeft: 80, params: { align: "left" },
    });
    elements.push({ type: "text", id: `ty-${s.id}-brand`,
      content: `品牌字体：${s.brand}`,
      position: "top-center", fontSize: 14, color: "#444",
      marginTop: yBase + 30, marginLeft: 80, params: { align: "left" },
    });
    elements.push({ type: "text", id: `ty-${s.id}-body`,
      content: `正文字体：${s.body}`,
      position: "top-center", fontSize: 14, color: "#666",
      marginTop: yBase + 55, marginLeft: 80, params: { align: "left" },
    });
  });

  // 字号层级表
  elements.push({ type: "table", id: "ty-hierarchy",
    position: "bottom-center",
    widthPct: 60, heightPct: 15,
    marginBottom: 40,
    params: {
      headers: ["层级", "字号", "字重", "用途"],
      rows: [
        ["H1 / 标题", "24pt", "Bold 700", "页面主标题"],
        ["H2 / 副标题", "16pt", "Medium 500", "段落标题"],
        ["正文", "12pt", "Regular 400", "正文内容"],
        ["说明", "10pt", "Light 300", "注释说明"],
      ],
    },
  });

  return elements;
}

// ---- 基础规范 ----

function buildBasicSpecElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, hasLogo } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "bs-title", content: PAGE_LABELS["basic-spec"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "bs-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  if (hasLogo) {
    // LOGO 保护空间示意
    elements.push({ type: "logo", id: "bs-logo",
      position: "center", widthPct: 30, heightPct: 20,
      marginTop: 130, shadow: true,
      params: { showClearSpace: true, clearSpaceRatio: 0.15 },
    });
    elements.push({ type: "text", id: "bs-clearspace",
      content: "LOGO 四周保留至少 15% 保护空间，不可被任何元素遮挡或裁切",
      position: "bottom-center", fontSize: 12, color: "#666",
      marginBottom: 200, params: { align: "center" },
    });
  }

  // 最小尺寸
  elements.push({ type: "table", id: "bs-min-sizes",
    position: "bottom-center",
    widthPct: 50, heightPct: 12,
    marginBottom: 80,
    params: {
      headers: ["场景", "最小尺寸"],
      rows: [
        ["印刷", "8mm (0.31 in)"],
        ["屏幕", "24px"],
      ],
    },
  });

  return elements;
}

// ---- 办公应用系统 ----

function buildStationeryElements(ctx: BuildContext): PageElement[] {
  const { pri, sec, hasLogo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "st-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.stationery || PAGE_LABELS["stationery"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "st-divider",
    position: "center", widthPct: 30, color: sec.hex, opacity: 0.6, marginTop: 15 });

  // 设计规范说明
  elements.push({ type: "text", id: "st-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.stationery || "品牌在商务场景中的标准化应用"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left", lineHeight: 1.5 },
  });

  // 场景图区域（由通义万相生成）
  elements.push({ type: "image", id: "st-scene",
    position: "center", widthPct: 70, heightPct: 35,
    marginTop: 180,
    params: { sceneType: "stationery" },
  });

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "st-mascot",
      position: "bottom-right", widthPct: 10, heightPct: 12,
      marginRight: 30, marginBottom: 30, opacity: 0.7,
      params: { view: "front" },
    });
  }

  return elements;
}

// ---- 产品包装系统 ----

function buildPackagingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "pk-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.packaging || PAGE_LABELS["packaging"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "pk-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "pk-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.packaging || "产品包装与物料的品牌化呈现"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left" },
  });

  // 场景区
  elements.push({ type: "image", id: "pk-scene",
    position: "center", widthPct: 65, heightPct: 35,
    marginTop: 180,
    params: { sceneType: "packaging" },
  });

  return elements;
}

// ---- 营销展示系统 ----

function buildMarketingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "mk-title", content: (INDUSTRY_SCENE_LABELS[ctx.industryType || "general"]?.marketing || PAGE_LABELS["marketing"]),
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "mk-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "mk-desc",
    content: (INDUSTRY_SCENE_DESCS[ctx.industryType || "general"]?.marketing || "宣传与促销物料"),
    position: "top-center", fontSize: 13, color: "#666",
    marginTop: 120, marginLeft: 60, marginRight: 60,
    params: { align: "left" },
  });

  elements.push({ type: "image", id: "mk-scene",
    position: "center", widthPct: 65, heightPct: 35,
    marginTop: 180,
    params: { sceneType: "marketing" },
  });

  return elements;
}

// ---- 总结 ----

function buildSummaryElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, sec, clientInfo, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "su-title", content: PAGE_LABELS["summary"],
    position: "top-center", fontSize: 24, fontWeight: 700, color: pri.hex, marginTop: 30 });

  elements.push({ type: "divider", id: "su-divider",
    position: "center", widthPct: 30, color: acc.hex, opacity: 0.6, marginTop: 15 });

  elements.push({ type: "text", id: "su-vision",
    content: clientInfo.brandVision || "构建统一的品牌视觉资产",
    position: "center", fontSize: 16, fontWeight: 500, color: "#333",
    marginTop: 130, marginLeft: 60, marginRight: 60,
    params: { align: "center", lineHeight: 1.6, italic: true },
  });

  // 三大原则
  const principles = [
    { label: "一致性", desc: "所有媒介输出必须严格遵守本手册规范，确保品牌在任何触点下都能被精准识别" },
    { label: "专业性", desc: "通过标准化的视觉语言建立客户信任，展现品牌作为行业专家的专业形象" },
    { label: "持续性", desc: "VI 系统是品牌长期发展的核心无形资产，是品牌价值持续积累的视觉载体" },
  ];

  principles.forEach((p, i) => {
    const yBase = 250 + i * 180;
    elements.push({ type: "decoration", id: `su-prin-${i}-icon`,
      position: "top-center",
      widthPct: 4, heightPct: 6,
      marginTop: yBase, marginLeft: 80,
      color: [pri.hex, sec.hex, acc.hex][i],
      params: { shape: "circle" },
    });
    elements.push({ type: "text", id: `su-prin-${i}-label`,
      content: p.label, position: "top-center",
      fontSize: 15, fontWeight: 700, color: [pri.hex, sec.hex, acc.hex][i],
      marginTop: yBase, marginLeft: 130, params: { align: "left" },
    });
    elements.push({ type: "text", id: `su-prin-${i}-desc`,
      content: p.desc, position: "top-center",
      fontSize: 12, color: "#555",
      marginTop: yBase + 25, marginLeft: 130, marginRight: 80,
      params: { align: "left", lineHeight: 1.4 },
    });
  });

  // 核心价值回顾
  if (clientInfo.coreValues) {
    elements.push({ type: "text", id: "su-corevalues",
      content: `核心价值：${clientInfo.coreValues}`,
      position: "bottom-center", fontSize: 13,
      color: "#888", marginBottom: 100,
    });
  }

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "su-mascot",
      position: "bottom-right", widthPct: 10, heightPct: 12,
      marginRight: 30, marginBottom: 30, opacity: 0.5,
    });
  }

  return elements;
}

// ---- 感谢观看 ----

function buildClosingElements(ctx: BuildContext): PageElement[] {
  const { pri, acc, companyName, hasMascot } = ctx;
  const elements: PageElement[] = [];

  elements.push({ type: "text", id: "cl-title", content: PAGE_LABELS["closing"],
    position: "center", fontSize: 36, fontWeight: 700,
    color: "#FFFFFF", marginTop: 300, shadow: true });

  elements.push({ type: "text", id: "cl-subtitle",
    content: `${companyName} · 品牌视觉识别系统 (VI) 规范手册`,
    position: "center", fontSize: 16,
    color: "#FFFFFF", opacity: 0.6, marginTop: 380,
  });

  elements.push({ type: "text", id: "cl-contact",
    content: "如有疑问，请咨询品牌管理部",
    position: "bottom-center", fontSize: 13,
    color: "#FFFFFF", opacity: 0.5, marginBottom: 100,
  });

  // 底部装饰条
  elements.push({ type: "decoration", id: "cl-bottom-bar",
    position: "bottom-center", widthPct: 100, heightPct: 1,
    color: acc.hex, marginBottom: 0,
    params: { barType: "thick" },
  });

  if (hasMascot) {
    elements.push({ type: "ip-mascot", id: "cl-mascot",
      position: "center", widthPct: 14, heightPct: 16,
      marginTop: 440, opacity: 0.8,
    });
  }

  return elements;
}

// ========== 验证工具 ==========

/**
 * 将 PageBlueprint 转为可读文本（用于调试/记录）
 */
export function blueprintToSummary(bp: PageBlueprint): string {
  return [
    `[${bp.pageId}] ${bp.label}`,
    `  背景: ${bp.background.type} (主色: ${bp.background.primaryColor})`,
    `  元素: ${bp.elements.length} 个`,
    `  规则: ${bp.appliedRules.length} 条`,
    `  阈值: ${bp.qualityThreshold}`,
  ].join("\n");
}

/**
 * 检查 Blueprint 是否满足最小质量要求
 */
export function validateBlueprint(bp: PageBlueprint): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 必须有背景
  if (!bp.background.primaryColor) {
    issues.push("缺少背景主色");
  }

  // 必须有元素
  if (bp.elements.length === 0) {
    issues.push("页面没有任何元素");
  }

  // 标题页必须有标题
  const titleElements = bp.elements.filter(e => e.type === "text" && e.id.includes("title"));
  if (titleElements.length === 0 && bp.pageId !== "stationery" && bp.pageId !== "packaging" && bp.pageId !== "marketing") {
    issues.push("缺少标题元素");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
