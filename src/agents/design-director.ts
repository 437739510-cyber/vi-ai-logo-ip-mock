/**
 * Brand Brain — Design Director Agent
 *
 * Determines the visual direction, color strategy, typography,
 * and overall design language based on the BrandProfile and
 * IndustryProfile.
 *
 * This is the agent that says "this brand should look like X,
 * not like Y" — bridging brand analysis to visual execution.
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";
import { getProfileForBrand } from "@/lib/industry-knowledge";

export const designDirectorIdentity = AGENT_IDENTITIES["design-director"];

/** Visual design direction output */
export interface DesignDirection {
  /** Primary visual style keywords */
  styleKeywords: string[];

  /** Color strategy */
  colorStrategy: {
    primary: string;
    secondary: string;
    accent: string;
    rationale: string;
  };

  /** Typography recommendation */
  typography: {
    headingFont: string;
    bodyFont: string;
    accentFont?: string;
    rationale: string;
  };

  /** Image style guide */
  imageStyle: {
    photography: string[];
    illustration: string[];
    iconography: string[];
  };

  /** Layout principles */
  layoutPrinciples: string[];

  /** Mood board keywords for AI prompt generation */
  moodKeywords: string[];

  /** Reference style (if any) */
  referenceStyle?: {
    used: boolean;
    influenceLevel: "strong" | "moderate" | "minimal";
    aspects: string[];
  };
}

export const designDirectorAgent: Agent<any, DesignDirection> = {
  identity: designDirectorIdentity,

  canExecute: async (context: AgentContext) => {
    if (!context.brandProfile) {
      return { canRun: false, reason: "缺少品牌画像（brandProfile），请先运行 Brand Analyst" };
    }
    return { canRun: true };
  },

  execute: async (_input: any, context: AgentContext) => {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const profile = context.brandProfile;
      const industryProfile = getProfileForBrand(profile);

      // Derive color strategy from brand persona and industry
      const colorStrategy = deriveColorStrategy(profile, industryProfile);

      // Derive typography from brand type and persona
      const typography = deriveTypography(profile, industryProfile);

      // Derive image style
      const imageStyle = deriveImageStyle(profile);

      // Build mood keywords for AI prompts
      const moodKeywords = buildMoodKeywords(profile, industryProfile);

      // Layout principles
      const layoutPrinciples = deriveLayoutPrinciples(profile);

      const result: DesignDirection = {
        styleKeywords: [
          ...industryProfile.designStyle,
          ...(profile.visualDirection === "natural_organic" ? ["自然质感", "温暖调性"] : []),
          ...(profile.visualDirection === "tech_futuristic" ? ["科技感", "极简"] : []),
          ...(profile.visualDirection === "luxury_premium" ? ["高端质感", "精致细节"] : []),
        ].slice(0, 6),
        colorStrategy,
        typography,
        imageStyle,
        layoutPrinciples,
        moodKeywords,
        referenceStyle: context.refId
          ? {
              used: true,
              influenceLevel: "moderate",
              aspects: ["排版结构", "信息层级", "页面节奏"],
            }
          : undefined,
      };

      return {
        success: true,
        data: result,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: `设计方向决策失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};

// ========== Helper Functions ==========

function deriveColorStrategy(profile: any, industryProfile: any) {
  const brandPersona = profile.brandPersona || [];

  let primary = "#005032"; // Default deep green
  let secondary = "#0078B4"; // Default ocean blue
  let accent = "#FBBC04"; // Default gold
  let rationale = "基于品牌行业特征推荐";

  if (brandPersona.includes("自然")) {
    primary = "#005032";
    secondary = "#3A8D6F";
    accent = "#E8B84B";
    rationale = "自然人格 → 深绿色为主色调，传达天然、有机的品牌调性";
  } else if (brandPersona.includes("创新")) {
    primary = "#1A56DB";
    secondary = "#7C3AED";
    accent = "#06B6D4";
    rationale = "创新人格 → 科技蓝为主色调，传达前沿、智能的品牌调性";
  } else if (brandPersona.includes("精致")) {
    primary = "#1C1917";
    secondary = "#44403C";
    accent = "#D97706";
    rationale = "精致人格 → 深色系为主色调，传达高端、奢华的品牌调性";
  } else if (brandPersona.includes("温暖")) {
    primary = "#B45309";
    secondary = "#D97706";
    accent = "#FCD34D";
    rationale = "温暖人格 → 暖橙色为主色调，传达亲切、友好的品牌调性";
  } else if (brandPersona.includes("专业")) {
    primary = "#1E3A5F";
    secondary = "#3B82F6";
    accent = "#94A3B8";
    rationale = "专业人格 → 深蓝色为主色调，传达信赖、可靠的品牌调性";
  }

  // If client already specified brand colors, respect them
  if (profile.brandPosting?.primary?.hex) {
    primary = profile.brandPosting.primary.hex;
  }

  return { primary, secondary, accent, rationale };
}

function deriveTypography(profile: any, industryProfile: any) {
  const brandType = profile.brandType;
  const persona = profile.brandPersona || [];

  let headingFont = "Noto Sans SC";
  let bodyFont = "Noto Sans SC";
  let rationale = "";

  if (brandType === "consumer" || brandType === "hospitality") {
    if (persona.includes("自然") || persona.includes("阳光")) {
      headingFont = "ZCOOL KuaiLe, Noto Sans SC";
      bodyFont = "Noto Sans SC";
      rationale = "消费品牌 + 自然人格 → 圆润活泼的标题字 + 清晰正文";
    } else if (persona.includes("精致")) {
      headingFont = "Noto Serif SC";
      bodyFont = "Noto Sans SC";
      rationale = "消费品牌 + 精致人格 → 衬线标题体现品质感 + 无衬线正文";
    } else {
      headingFont = "Noto Sans SC";
      bodyFont = "Noto Sans SC";
      rationale = "消费品牌 → 现代无衬线字体，清晰有活力";
    }
  } else if (brandType === "technology") {
    headingFont = "Inter, Noto Sans SC";
    bodyFont = "Inter, Noto Sans SC";
    rationale = "科技品牌 → 现代无衬线字体，字重层次丰富";
  } else if (brandType === "service" || brandType === "finance_legal") {
    headingFont = "Noto Serif SC";
    bodyFont = "Noto Sans SC";
    rationale = "服务/金融品牌 → 衬线标题体现专业感";
  } else {
    headingFont = "Noto Sans SC";
    bodyFont = "Noto Sans SC";
    rationale = "通用 → 清晰易读的无衬线字体";
  }

  return { headingFont, bodyFont, rationale };
}

function deriveImageStyle(profile: any) {
  const persona = profile.brandPersona || [];

  const photography: string[] = [];
  const illustration: string[] = [];
  const iconography: string[] = [];

  if (persona.includes("自然")) {
    photography.push("自然光", "户外场景", "产品与环境融合");
    illustration.push("手绘风格", "水彩质感");
    iconography.push("线性图标", "自然形态轮廓");
  } else if (persona.includes("创新")) {
    photography.push("高对比度", "几何构图", "科技场景");
    illustration.push("矢量扁平", "渐变质感");
    iconography.push("几何图标", "线性+填充组合");
  } else if (persona.includes("精致")) {
    photography.push("暗调", "细节特写", "质感突出");
    illustration.push("精致线条", "金属质感");
    iconography.push("细线图标", "精致简约");
  } else {
    photography.push("明亮清晰", "产品为主");
    illustration.push("简洁现代");
    iconography.push("通用线性图标");
  }

  return { photography, illustration, iconography };
}

function buildMoodKeywords(profile: any, industryProfile: any): string[] {
  const keywords = [
    ...industryProfile.visualKeywords,
    ...(profile.brandPersona || []),
  ];
  return [...new Set(keywords)].slice(0, 8);
}

function deriveLayoutPrinciples(profile: any): string[] {
  const persona = profile.brandPersona || [];
  const principles: string[] = [];

  if (persona.includes("自然")) {
    principles.push("留白充分，呼吸感强");
    principles.push("图文混排灵活");
  } else if (persona.includes("创新")) {
    principles.push("网格系统严谨");
    principles.push("信息层级清晰");
    principles.push("动感构图");
  } else if (persona.includes("精致")) {
    principles.push("对称平衡");
    principles.push("精致细节装饰");
  } else {
    principles.push("清晰的信息层级");
    principles.push("一致的页面节奏");
  }

  principles.push("品牌色在关键信息点使用");
  return principles;
}
