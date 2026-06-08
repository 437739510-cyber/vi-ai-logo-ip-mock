/**
 * Brand Brain — Mascot Designer Agent
 *
 * Analyzes whether a brand needs an IP mascot character.
 *
 * Three modes:
 *   protect_existing   — client already has a mascot, protect it
 *   create_new         — client has no mascot, strong recommendation to create IP
 *   optional_recommend — client may benefit from IP but not essential
 *   not_needed         — brand does not benefit from a mascot
 *
 * Input:  BrandProfile + BusinessProfile + clientInfo (hasMascot)
 * Output: MascotProfile
 *
 * Inserted in pipeline: Brand Planner → Mascot Designer → Design Director
 */

import type { Agent, AgentResult, AgentContext } from "./types";
import { AGENT_IDENTITIES } from "./types";

// ========== Types ==========

export type MascotDesignMode =
  | "protect_existing"
  | "create_new"
  | "optional_recommend"
  | "not_needed";

export interface MascotProfile {
  /** Design mode */
  mode: MascotDesignMode;
  /** Confidence 0-1 */
  confidence: number;

  /** Whether client already has a mascot */
  hasMascot: boolean;

  // === protect_existing ===
  /** Existing mascot name (from clientInfo) */
  existingMascotName?: string;
  /** Number of existing mascot assets */
  existingMascotCount?: number;

  // === create_new / optional_recommend ===
  /** Suggested mascot name */
  suggestedName?: string;
  /** Suggested mascot type */
  suggestedType?: MascotType;
  /** Suggested mascot role in the brand */
  suggestedRole?: string;
  /** Personality traits the mascot should convey */
  personality: string[];
  /** Visual style traits */
  visualTraits: string[];
  /** Color direction for the mascot */
  colorDirection: string[];
  /** Short backstory or concept */
  storySummary?: string;
  /** Recommended usage scenarios */
  usageScenarios: string[];

  /** Human-readable explanation */
  reason: string;
  /** Recommended modules to add if creating new mascot */
  recommendedModules?: string[];
}

export type MascotType =
  | "animal"          // 动物
  | "character"       // 人物角色
  | "object"          // 物体拟人
  | "plant"           // 植物
  | "abstract"        // 抽象图形
  | "food"            // 食物拟人
  | "hybrid";         // 混合元素

// ========== Industry → mascot tendency ==========

interface MascotTendency {
  needsMascot: boolean;       // 行业是否需要 IP
  confidence: number;         // 置信度 0-1
  preferredTypes: MascotType[];
  reason: string;
}

const INDUSTRY_MASCOT_MAP: Record<string, MascotTendency> = {
  food_beverage: {
    needsMascot: true,
    confidence: 0.9,
    preferredTypes: ["food", "animal", "character"],
    reason: "食品饮料品牌非常适合通过IP公仔增强品牌亲和力和产品记忆点",
  },
  hospitality_tourism: {
    needsMascot: true,
    confidence: 0.85,
    preferredTypes: ["animal", "character", "plant"],
    reason: "酒店/文旅品牌通过IP公仔传递目的地文化和品牌温度",
  },
  retail_ecommerce: {
    needsMascot: true,
    confidence: 0.8,
    preferredTypes: ["animal", "character", "object"],
    reason: "零售/电商品牌通过IP公仔提升社交媒体传播力和用户粘性",
  },
  culture_media: {
    needsMascot: true,
    confidence: 0.85,
    preferredTypes: ["character", "abstract", "animal"],
    reason: "文化/传媒品牌的IP公仔是内容创作的核心资产",
  },
  education_training: {
    needsMascot: true,
    confidence: 0.75,
    preferredTypes: ["animal", "character"],
    reason: "教育品牌通过IP公仔降低距离感，增强品牌亲密度",
  },
  healthcare_medical: {
    needsMascot: false,
    confidence: 0.6,
    preferredTypes: ["animal", "character"],
    reason: "医疗健康品牌IP需求较低，但儿童/健康食品方向可考虑",
  },
  technology_it: {
    needsMascot: false,  // 默认不需要，后续根据 businessGoal/persona 提升
    confidence: 0.4,
    preferredTypes: ["abstract", "character"],
    reason: "科技品牌通常不需要IP公仔，但面向消费者或营销传播时可考虑轻量IP",
  },
  finance_legal: {
    needsMascot: false,
    confidence: 0.3,
    preferredTypes: ["abstract"],
    reason: "金融法律品牌通常不适合IP公仔，除非品牌年轻化战略需要",
  },
  manufacturing: {
    needsMascot: false,
    confidence: 0.3,
    preferredTypes: ["object", "abstract"],
    reason: "制造企业通常不需要IP公仔，B2B品牌以专业形象为主",
  },
  real_estate: {
    needsMascot: false,
    confidence: 0.4,
    preferredTypes: ["character", "animal"],
    reason: "房地产行业IP需求较低，商业地产/社区项目可考虑",
  },
};

// ========== Brand type → mascot boost ==========

const BRAND_TYPE_MASCOT_BOOST: Record<string, number> = {
  consumer: 0.9,
  hospitality: 0.85,
  retail: 0.8,
  lifestyle: 0.75,
  cultural: 0.8,
  healthcare: 0.5,
  education: 0.7,
  technology: 0.3,   // 降低基础分，由 persona + goal 决定是否提升
  service: 0.2,
  industrial: 0.15,
};

// ========== Business goal → mascot boost ==========

const BUSINESS_GOAL_MASCOT_BOOST: Record<string, number> = {
  franchise: 0.9,   // 招商加盟 → 强烈需要IP
  marketing: 0.85,  // 营销推广 → 需要IP
  packaging: 0.7,   // 包装升级 → 可以需要IP
  branding: 0.4,    // 建立品牌基础 → 不一定需要
};

// ========== Business stage → mascot module depth ==========

const BUSINESS_STAGE_IP_DEPTH: Record<string, "full" | "light" | "minimal"> = {
  startup: "minimal",    // 初创：仅 IP 方向
  growth: "light",       // 成长：基础 IP 规范
  chain: "full",         // 连锁：完整 IP 手册
  enterprise: "full",    // 企业级：完整 IP 手册
};

// ========== Persona that boost mascot need for tech/legal industries ==========

const MASCOT_FRIENDLY_PERSONAS = new Set([
  "亲和", "年轻", "活泼", "陪伴", "社群", "温暖", "阳光", "潮流", "自然", "健康", "创新",
]);

// ========== Personality → mascot trait mapping ==========

const PERSONA_TO_MASCOT_TRAITS: Record<string, { personality: string[]; visualTraits: string[] }> = {
  自然: {
    personality: ["纯真", "亲切", "温暖"],
    visualTraits: ["圆润线条", "柔和色块", "自然材质感"],
  },
  阳光: {
    personality: ["活力", "快乐", "热情"],
    visualTraits: ["明快色彩", "动态姿态", "微笑表情"],
  },
  健康: {
    personality: ["活力", "积极", "可靠"],
    visualTraits: ["清爽色系", "简洁造型", "运动感"],
  },
  专业: {
    personality: ["可靠", "沉稳", "自信"],
    visualTraits: ["利落线条", "稳重比例", "专业姿态"],
  },
  创新: {
    personality: ["前卫", "大胆", "有趣"],
    visualTraits: ["几何造型", "撞色设计", "未来感"],
  },
  精致: {
    personality: ["优雅", "从容", "品味"],
    visualTraits: ["修长比例", "细腻纹理", "高级色调"],
  },
  温暖: {
    personality: ["友善", "包容", "治愈"],
    visualTraits: ["圆润造型", "柔和色彩", "微笑表情"],
  },
  潮流: {
    personality: ["个性", "酷", "前卫"],
    visualTraits: ["街头风格", "撞色", "大胆图案"],
  },
  匠心: {
    personality: ["专注", "沉稳", "可靠"],
    visualTraits: ["手作质感", "细腻纹理", "自然色调"],
  },
};

// ========== Industry → suggested mascot style ==========

const INDUSTRY_VISUAL_SUGGESTIONS: Record<string, { type: MascotType; traits: string[]; colors: string[] }> = {
  food_beverage: {
    type: "food",
    traits: ["拟食物化", "圆润可爱", "品牌色为主"],
    colors: ["品牌主色", "自然绿色系", "暖橙色系"],
  },
  hospitality_tourism: {
    type: "animal",
    traits: ["地域特色动物", "亲和力强", "文化元素"],
    colors: ["品牌主色", "大地色系", "阳光色系"],
  },
  retail_ecommerce: {
    type: "character",
    traits: ["时尚简约", "年轻化", "易于延展"],
    colors: ["品牌主色", "潮流色系"],
  },
};

// ========== Module depth per business stage for create_new ==========

const MODULES_BY_DEPTH: Record<string, { essential: string[]; recommended: string[]; optional: string[] }> = {
  full: {
    essential: ["mascot-profile", "mascot-three-view", "mascot-colors", "mascot-expression", "mascot-usage"],
    recommended: ["mascot-scene", "mascot-packaging-app", "mascot-social-app"],
    optional: ["mascot-store-app", "mascot-merchandise"],
  },
  light: {
    essential: ["mascot-profile", "mascot-colors"],
    recommended: ["mascot-expression", "mascot-usage"],
    optional: ["mascot-three-view", "mascot-scene"],
  },
  minimal: {
    essential: ["mascot-profile", "mascot-visual-direction"],
    recommended: ["mascot-colors", "mascot-usage"],
    optional: ["mascot-expression", "mascot-three-view"],
  },
};

// ========== Recommendation Logic ==========

export interface MascotRecommendationInput {
  brandType: string;
  industryCategory: string;
  brandPersona: string[];
  brandArchetype: string;
  brandStage: string;
  hasMascot: boolean;
  mascotName?: string;
  mascotAssetsCount?: number;
  businessGoal?: string;
  businessStage?: string;
}

/**
 * Core mascot recommendation logic.
 * Pure function — no side effects.
 */
export function recommendMascot(input: MascotRecommendationInput): MascotProfile {
  const {
    hasMascot, industryCategory, brandPersona, brandType,
    businessGoal, businessStage, mascotName, mascotAssetsCount,
  } = input;

  // === Mode A: Client already has a mascot → protect_existing ===
  if (hasMascot) {
    return {
      mode: "protect_existing",
      confidence: 1.0,
      hasMascot: true,
      existingMascotName: mascotName || "品牌IP",
      existingMascotCount: mascotAssetsCount || 1,
      personality: brandPersona.slice(0, 3),
      visualTraits: ["保持原始形象", "保护品牌资产"],
      colorDirection: ["品牌原色", "不做AI改色"],
      usageScenarios: ["Logo搭配", "产品包装", "社交媒体", "门店展示"],
      reason: `品牌已有IP公仔"${mascotName || "品牌IP"}"，应保护原始形象，禁止AI重绘。建议进入IP规范/场景延展/应用模块，而非重新设计。`,
      recommendedModules: getModulesForDepth(businessStage || "", "protect_existing"),
    };
  }

  // === Mode B: No mascot — decide if needed ===
  let needScore = 0;
  const reasons: string[] = [];

  // Factor 1: Industry tendency (max 35 points)
  const industryTendency = INDUSTRY_MASCOT_MAP[industryCategory];
  if (industryTendency) {
    if (industryTendency.needsMascot) {
      needScore += industryTendency.confidence * 35;
      reasons.push(industryTendency.reason);
    } else {
      // For industries that default to false, give a low base score
      needScore += industryTendency.confidence * 15;
    }
  } else {
    needScore += 5;
  }

  // Factor 2: Brand type (max 25 points)
  const brandTypeBoost = BRAND_TYPE_MASCOT_BOOST[brandType] || 0.3;
  needScore += brandTypeBoost * 25;

  if (brandType === "consumer" || brandType === "hospitality" || brandType === "retail") {
    reasons.push(`${brandType}类品牌通过IP公仔可显著提升品牌辨识度和传播力`);
  }

  // Factor 3: Business goal (max 20 points)
  if (businessGoal) {
    const goalBoost = BUSINESS_GOAL_MASCOT_BOOST[businessGoal] || 0.4;
    needScore += goalBoost * 20;
    if (businessGoal === "franchise") {
      reasons.push("招商加盟品牌需要IP公仔增强品牌故事和加盟吸引力");
    } else if (businessGoal === "marketing") {
      reasons.push("营销推广品牌需要IP公仔作为社交媒体和传播内容的核心");
    }
  }

  // Factor 4: Brand persona (max 15 points)
  const personaBoost = brandPersona.filter((p) =>
    MASCOT_FRIENDLY_PERSONAS.has(p)
  ).length * 5;
  needScore += Math.min(personaBoost, 15);

  // Factor 5: Special override for technology — persona + goal can boost
  if (industryCategory === "technology_it" && !industryTendency?.needsMascot) {
    const techPersonaMatch = brandPersona.filter((p) =>
      ["亲和", "年轻", "活泼", "陪伴", "社群", "温暖", "创新"].includes(p)
    ).length;
    const techPersonaBoost = techPersonaMatch * 8;
    const techGoalBoost = businessGoal === "marketing" ? 10 : 0;
    const techTotalBoost = Math.min(techPersonaBoost + techGoalBoost, 20);
    needScore += techTotalBoost;
    if (techTotalBoost >= 10) {
      reasons.push("科技品牌面向消费者/营销传播时，轻量IP可增强产品亲和力");
    }
  }

  // Normalize to 0-1
  const confidence = Math.min(1, needScore / 100);

  // === Thresholds ===
  if (hasMascot) {
    // already handled above
    throw new Error("unreachable");
  } else if (confidence >= 0.55) {
    return buildCreateNewProfile(input, confidence, reasons);
  } else if (confidence >= 0.4) {
    return buildOptionalProfile(input, confidence, reasons);
  } else {
    return {
      mode: "not_needed",
      confidence,
      hasMascot: false,
      personality: brandPersona.slice(0, 3),
      visualTraits: [],
      colorDirection: [],
      usageScenarios: [],
      reason: `当前品牌类型（${brandType}）和行业（${industryCategory}）不太适合IP公仔，建议优先完善基础VI规范。`,
      recommendedModules: [],
    };
  }
}

// ========== Profile builders ==========

function buildCreateNewProfile(
  input: MascotRecommendationInput,
  confidence: number,
  reasons: string[]
): MascotProfile {
  const { brandPersona, industryCategory, businessStage, businessGoal } = input;
  const mascotTraits = getSuggestedTraits(brandPersona);
  const industrySuggest = INDUSTRY_VISUAL_SUGGESTIONS[industryCategory] || {
    type: "character" as MascotType,
    traits: ["简约现代", "品牌色为主"],
    colors: ["品牌主色"],
  };
  const suggestedType = mascotTraits.preferredType || industrySuggest.type;
  const scenarios = generateUsageScenarios(input);
  const story = generateStorySummary(brandPersona, industryCategory);
  const depth = determineDepth(businessStage, businessGoal, "create_new");

  return {
    mode: "create_new",
    confidence,
    hasMascot: false,
    suggestedName: generateMascotName(brandPersona, industryCategory),
    suggestedType,
    suggestedRole: "品牌形象代言人",
    personality: mascotTraits.personality,
    visualTraits: [...new Set([...mascotTraits.visualTraits, ...industrySuggest.traits])],
    colorDirection: industrySuggest.colors,
    storySummary: story,
    usageScenarios: scenarios,
    reason: `品牌特征分析显示：${reasons.join("；")}。强烈建议创建品牌IP公仔。`,
    recommendedModules: [...MODULES_BY_DEPTH[depth].essential, ...MODULES_BY_DEPTH[depth].recommended],
  };
}

function buildOptionalProfile(
  input: MascotRecommendationInput,
  confidence: number,
  reasons: string[]
): MascotProfile {
  const { brandPersona, industryCategory } = input;
  const mascotTraits = getSuggestedTraits(brandPersona);
  const scenarios = generateUsageScenarios(input);
  const story = generateStorySummary(brandPersona, industryCategory);

  return {
    mode: "optional_recommend",
    confidence,
    hasMascot: false,
    suggestedName: generateMascotName(brandPersona, industryCategory),
    suggestedType: mascotTraits.preferredType,
    suggestedRole: "品牌形象代言人",
    personality: mascotTraits.personality,
    visualTraits: mascotTraits.visualTraits,
    colorDirection: ["品牌主色"],
    storySummary: story,
    usageScenarios: scenarios,
    reason: `品牌特征显示有一定IP潜力（${reasons.join("；")}），但非必需。建议与客户沟通是否需要IP公仔作为品牌升级选项。`,
    recommendedModules: ["mascot-profile", "mascot-visual-direction", "mascot-colors"],
  };
}

// ========== Module depth calculator ==========

function getModulesForDepth(
  businessStage: string,
  mode: string
): string[] {
  if (mode === "protect_existing") {
    return ["mascot-profile", "mascot-three-view", "mascot-colors", "mascot-expression", "mascot-usage"];
  }
  const depth = determineDepth(businessStage, undefined, mode);
  const modules = MODULES_BY_DEPTH[depth];
  if (!modules) return [];
  return [...modules.essential, ...modules.recommended];
}

function determineDepth(
  businessStage?: string,
  businessGoal?: string,
  mode?: string
): "full" | "light" | "minimal" {
  if (mode === "protect_existing") return "full";
  if (businessGoal === "franchise") return "full";
  if (businessGoal === "packaging") return "light";

  const stageDepth = BUSINESS_STAGE_IP_DEPTH[businessStage || ""];
  if (stageDepth) return stageDepth;

  return "minimal"; // default
}

// ========== Helpers ==========

function getSuggestedTraits(brandPersona: string[]): {
  personality: string[];
  visualTraits: string[];
  preferredType: MascotType;
} {
  const personality: string[] = [];
  const visualTraits: string[] = [];
  let preferredType: MascotType = "character";

  for (const persona of brandPersona) {
    const mapped = PERSONA_TO_MASCOT_TRAITS[persona];
    if (mapped) {
      personality.push(...mapped.personality);
      visualTraits.push(...mapped.visualTraits);
    }
  }

  // Determine preferred type from personality
  if (brandPersona.includes("自然")) preferredType = "animal";
  else if (brandPersona.includes("阳光") || brandPersona.includes("健康")) preferredType = "food";
  else if (brandPersona.includes("匠心")) preferredType = "object";
  else if (brandPersona.includes("创新")) preferredType = "abstract";

  return {
    personality: [...new Set(personality)].slice(0, 4),
    visualTraits: [...new Set(visualTraits)].slice(0, 4),
    preferredType,
  };
}

function generateMascotName(brandPersona: string[], industryCategory: string): string {
  const namePrefixes: Record<string, string[]> = {
    food_beverage: ["小椰", "果果", "小饮", "味宝"],
    hospitality_tourism: ["小旅", "途途", "风风"],
    retail_ecommerce: ["小购", "袋袋", "淘淘"],
    culture_media: ["小创", "文文", "艺艺"],
    education_training: ["小智", "学学", "知知"],
  };
  const prefixes = namePrefixes[industryCategory] || ["小"];
  return prefixes[0];
}

function generateUsageScenarios(input: MascotRecommendationInput): string[] {
  const { brandType, industryCategory, businessGoal } = input;
  const scenarios: string[] = ["Logo搭配", "社交媒体头像"];

  if (industryCategory === "food_beverage") {
    scenarios.push("产品包装", "门店招牌", "促销物料");
  }
  if (brandType === "consumer" || brandType === "retail") {
    scenarios.push("电商详情页", "广告素材", "线下活动");
  }
  if (businessGoal === "franchise") {
    scenarios.push("加盟手册", "门店空间", "招商物料");
  }
  if (businessGoal === "marketing" || businessGoal === "packaging") {
    scenarios.push("产品包装", "社交媒体内容", "短视频/直播");
  }
  if (brandType === "hospitality") {
    scenarios.push("门店装饰", "菜单/餐具", "员工服饰");
  }

  return [...new Set(scenarios)];
}

function generateStorySummary(brandPersona: string[], _industryCategory: string): string {
  const traits = brandPersona.slice(0, 3).join("、");
  return `一个${traits}的品牌IP角色，诞生于${traits}的品牌理念，代表着品牌与消费者之间的情感连接。`;
}

// ========== Agent Implementation ==========

export const mascotDesignerIdentity = AGENT_IDENTITIES["mascot-designer"];

export const mascotDesignerAgent: Agent<any, MascotProfile> = {
  identity: mascotDesignerIdentity,

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
      const clientInfo = context.clientInfo;

      // Extract mascot info from clientInfo
      const mascotAssets = clientInfo?.mascotAssets || [];
      const hasMascot = mascotAssets.length > 0;
      const mascotName = mascotAssets[0]?.name;
      const mascotAssetsCount = mascotAssets.reduce(
        (sum: number, a: any) => sum + (a.files?.length || 0),
        0
      );

      // Extract business goal + stage from context (set by Decision Layer)
      const businessProfile = clientInfo?.businessProfile;
      const businessGoal = businessProfile?.businessGoal;
      const businessStage = businessProfile?.businessStage;

      const result = recommendMascot({
        brandType: profile.brandType,
        industryCategory: profile.industryCategory,
        brandPersona: profile.brandPersona || [],
        brandArchetype: profile.brandArchetype || "",
        brandStage: profile.brandStage || "unknown",
        hasMascot,
        mascotName,
        mascotAssetsCount,
        businessGoal,
        businessStage,
      });

      if (result.mode === "optional_recommend" && result.confidence < 0.5) {
        warnings.push("IP推荐置信度中等，建议与客户确认是否需要IP公仔");
      }

      return {
        success: true,
        data: result,
        warnings,
        metrics: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `IP形象分析失败: ${error instanceof Error ? error.message : String(error)}`,
        warnings,
        metrics: { durationMs: Date.now() - startTime },
      };
    }
  },
};
