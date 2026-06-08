/**
 * Mascot Prompt Strategy V1
 *
 * Converts MascotProfile into high-quality IP generation prompts.
 * Two modes:
 *   create_new       — generate detailed imagePrompt from brand data
 *   protect_existing — NO imagePrompt, only strategy/usage notes
 *   optional_recommend — lightweight prompt suggestion
 *   not_needed       — no prompts at all
 *
 * Current phase: Prompt Strategy only.
 * No image generation API calls.
 * No SVG changes.
 * No cover changes.
 * No generation layer changes.
 */

import type { MascotProfile, MascotDesignMode } from "@/agents/mascot-designer";
import type { BrandProfile } from "./brand-analyzer";
import type { BusinessProfile } from "./business-profile";
import type { IndustryProfile } from "./industry-knowledge";

// ========== Output Type ==========

export interface MascotPromptSet {
  /** Design mode */
  mode: MascotDesignMode;

  /** Overall IP strategy description (Chinese) */
  strategyPrompt: string;

  /**
   * Image generation prompt (English, for AI image models).
   * Only populated for create_new mode.
   * MUST be null for protect_existing mode.
   */
  imagePrompt: string | null;

  /** Negative prompt — what the AI must NOT do */
  negativePrompt: string;

  /** Usage notes for the designer */
  usageNotes: string[];

  /** Key restrictions */
  restrictions: string[];
}

// ========== Style Reference ==========

interface MascotStyleReference {
  visualKeywords: string[];
  styleDescriptors: string[];
  colorKeywords: string[];
  avoidKeywords: string[];
}

const MASCOT_STYLE_MAP: Record<string, MascotStyleReference> = {
  animal: {
    visualKeywords: ["cute animal", "soft curves", "furry or smooth texture", "big expressive eyes"],
    styleDescriptors: ["kawaii-inspired", "rounded shapes", "friendly expression", "approachable"],
    colorKeywords: ["warm colors", "brand color palette"],
    avoidKeywords: ["realistic animal", "scary", "ferocious", "detailed fur texture"],
  },
  character: {
    visualKeywords: ["humanoid character", "modern minimalist", "clean lines", "expressive face"],
    styleDescriptors: ["contemporary", "simple silhouette", "youthful", "trendy"],
    colorKeywords: ["brand primary colors", "bold accent colors"],
    avoidKeywords: ["realistic human", "overly detailed face", "photorealistic"],
  },
  food: {
    visualKeywords: ["food character", "cute food personification", "round shapes", "appetizing colors"],
    styleDescriptors: ["kawaii", "playful", "mascot-like", "friendly"],
    colorKeywords: ["brand colors", "natural food colors", "warm tones"],
    avoidKeywords: ["realistic food", "gross", "spoiled", "unappetizing"],
  },
  object: {
    visualKeywords: ["object personification", "simple geometric shapes", "minimal details", "clean"],
    styleDescriptors: ["minimalist", "modern", "abstract-friendly", "professional"],
    colorKeywords: ["brand colors", "monochrome or duo-tone"],
    avoidKeywords: ["complex details", "organic shapes", "realistic texture"],
  },
  plant: {
    visualKeywords: ["plant character", "leaf shapes", "organic curves", "nature-inspired"],
    styleDescriptors: ["natural", "organic", "earthy", "gentle"],
    colorKeywords: ["green tones", "earthy colors", "brand colors"],
    avoidKeywords: ["wilted", "dark colors", "sharp thorns"],
  },
  abstract: {
    visualKeywords: ["abstract shape character", "geometric", "modern art style", "minimal"],
    styleDescriptors: ["contemporary", "abstract", "sophisticated", "clean"],
    colorKeywords: ["brand colors", "gradient effects"],
    avoidKeywords: ["representational", "complex", "messy shapes"],
  },
  hybrid: {
    visualKeywords: ["hybrid character", "mix of animal and object", "unique design", "creative"],
    styleDescriptors: ["innovative", "unique", "memorable", "versatile"],
    colorKeywords: ["brand colors", "complementary colors"],
    avoidKeywords: ["generic", "boring", "too simple"],
  },
};

const VISUAL_DIRECTION_STYLE: Record<string, string> = {
  natural_organic: "natural, organic, earthy textures, soft lighting",
  minimal_modern: "minimal, modern, clean lines, plenty of negative space",
  bold_energetic: "bold, energetic, vibrant colors, dynamic poses",
  luxury_premium: "luxurious, premium, refined details, elegant proportions",
  tech_futuristic: "tech-forward, futuristic, sleek surfaces, geometric precision",
  warm_friendly: "warm, friendly, soft rounded shapes, inviting expression",
  professional_trust: "professional, trustworthy, balanced proportions, confident stance",
  cultural_heritage: "heritage-inspired, cultural motifs, handcrafted feel",
  playful_youthful: "playful, youthful, whimsical details, bright personality",
};

// ========== Helper: Build negative prompt ==========

function buildNegativePrompt(
  mode: MascotDesignMode,
  mascotProfile: MascotProfile,
  brandProfile?: BrandProfile
): string {
  const parts: string[] = [];

  // Universal prohibitions
  parts.push("no photorealistic rendering");
  parts.push("no realistic human faces");
  parts.push("no complex backgrounds");
  parts.push("no text or typography in the image");
  parts.push("no watermarks");
  parts.push("no copyright symbols");

  // Mode-specific
  if (mode === "protect_existing") {
    // For protect_existing, we don't generate imagePrompt, but if somehow used:
    parts.push("do not change existing mascot design");
    parts.push("do not alter mascot proportions");
    parts.push("do not change mascot expression to something unrecognizable");
  }

  if (mode === "create_new") {
    parts.push("no generic clipart style");
    parts.push("no flat vector icon style unless specified");
    parts.push("no complex shading");

    // Specific avoid keywords based on type
    const typeRef = MASCOT_STYLE_MAP[mascotProfile.suggestedType || "character"];
    if (typeRef) {
      typeRef.avoidKeywords.forEach((k) => parts.push(`no ${k}`));
    }
  }

  return [...new Set(parts)].join("; ");
}

// ========== Helper: Build image prompt for create_new ==========

function buildCreateNewImagePrompt(
  mascotProfile: MascotProfile,
  brandProfile: BrandProfile,
  industryProfile?: IndustryProfile
): string {
  const parts: string[] = [];

  // 1. Brand context
  const brandName = mascotProfile.suggestedName || "brand mascot";
  parts.push(`A brand mascot character named "${brandName}"`);

  // 2. Mascot type and concept
  const typeLabel = getMascotTypeLabel(mascotProfile.suggestedType);
  parts.push(`designed as a ${typeLabel}`);

  // 3. Brand + industry context
  parts.push(`for ${brandProfile.brandPositioning || brandProfile.industry}`);
  parts.push(`brand personality: ${mascotProfile.personality.join(", ")}`);

  // 4. Visual traits
  if (mascotProfile.visualTraits.length > 0) {
    parts.push(`visual style: ${mascotProfile.visualTraits.join(", ")}`);
  }

  // 5. Color direction
  const brandColorInfo = brandProfile.brandPersona?.length
    ? `brand color scheme: ${mascotProfile.colorDirection.join(", ")}`
    : "brand color scheme";
  parts.push(brandColorInfo);

  // 6. Style reference from visual direction
  const visualStyle = VISUAL_DIRECTION_STYLE[brandProfile.visualDirection];
  if (visualStyle) {
    parts.push(`style direction: ${visualStyle}`);
  }

  // 7. Industry visual keywords
  if (industryProfile?.visualKeywords?.length) {
    const keywords = industryProfile.visualKeywords.slice(0, 5).join(", ");
    parts.push(`industry visual cues: ${keywords}`);
  }

  // 8. Type-specific style reference
  const typeRef = MASCOT_STYLE_MAP[mascotProfile.suggestedType || "character"];
  if (typeRef) {
    parts.push(`style descriptors: ${typeRef.styleDescriptors.join(", ")}`);
    parts.push(`visual details: ${typeRef.visualKeywords.join(", ")}`);
  }

  // 9. Character role
  if (mascotProfile.suggestedRole) {
    parts.push(`role: ${mascotProfile.suggestedRole}`);
  }

  // 10. Story concept
  if (mascotProfile.storySummary) {
    parts.push(`character concept: ${mascotProfile.storySummary}`);
  }

  // 11. Usage context
  if (mascotProfile.usageScenarios.length > 0) {
    parts.push(`designed for: ${mascotProfile.usageScenarios.slice(0, 4).join(", ")}`);
  }

  // 12. Format constraints
  parts.push("full body character");
  parts.push("isolated on white background");
  parts.push("flat vector illustration style");
  parts.push("clean scalable design");
  parts.push("ready for print and digital use");

  return parts.join(". ") + ".";
}

// ========== Helper: Build strategy prompt ==========

function buildStrategyPrompt(
  mascotProfile: MascotProfile,
  brandProfile: BrandProfile
): string {
  const mode = mascotProfile.mode;

  if (mode === "protect_existing") {
    return (
      `品牌《${brandProfile.industry}》已有IP公仔"${mascotProfile.existingMascotName || "品牌IP"}"。\n` +
      `当前策略：保护原始形象，不做任何AI重绘、改色、改材质。\n` +
      `IP角色性格：${mascotProfile.personality.join("、")}。\n` +
      `建议应用场景：${mascotProfile.usageScenarios.join("、")}。\n` +
      `禁止：AI重绘IP形象、改变IP比例、改变IP表情、更换角色设定。`
    );
  }

  if (mode === "create_new") {
    return (
      `品牌《${brandProfile.brandPositioning || brandProfile.industry}》需要创建IP公仔。\n` +
      `建议名称："${mascotProfile.suggestedName || "品牌IP"}"\n` +
      `角色类型：${getMascotTypeLabel(mascotProfile.suggestedType)}\n` +
      `性格特征：${mascotProfile.personality.join("、")}\n` +
      `视觉方向：${mascotProfile.visualTraits.join("、")}\n` +
      `色彩方向：${mascotProfile.colorDirection.join("、")}\n` +
      `适用场景：${mascotProfile.usageScenarios.join("、")}\n` +
      `建议优先创建正向表情（微笑/欢迎），后续扩展表情包。`
    );
  }

  if (mode === "optional_recommend") {
    return (
      `品牌《${brandProfile.brandPositioning || brandProfile.industry}》可以考虑创建轻量IP。\n` +
      `建议名称："${mascotProfile.suggestedName || "品牌IP"}"\n` +
      `性格特征：${mascotProfile.personality.join("、")}\n` +
      `视觉方向：${mascotProfile.visualTraits.join("、")}\n` +
      `建议先创建IP形象方向稿，确认后再进入完整设计。`
    );
  }

  return "当前品牌不适合创建IP公仔，建议优先完善基础VI规范。";
}

// ========== Helper: Build usage notes ==========

function buildUsageNotes(mascotProfile: MascotProfile): string[] {
  if (mascotProfile.mode === "protect_existing") {
    return [
      "保持原始IP形象，不做任何AI修改",
      "IP比例、表情、颜色严格遵循原始设计",
      "应用延展时使用原图嵌入，非AI重新生成",
      "所有IP使用场景需经过品牌方确认",
    ];
  }

  if (mascotProfile.mode === "create_new") {
    return [
      "生成IP前请确认品牌方同意IP方向和类型",
      "建议先生成3个风格方向供品牌方选择",
      "确认方向后再扩展三视图、表情包",
      "IP设计完成后建议注册商标保护",
    ];
  }

  if (mascotProfile.mode === "optional_recommend") {
    return [
      "建议先与客户沟通是否需要IP公仔",
      "如客户有兴趣，先从IP方向稿开始",
      "避免在未确认需求前投入完整IP设计",
    ];
  }

  return [];
}

// ========== Helper: Build restrictions ==========

function buildRestrictions(mascotProfile: MascotProfile): string[] {
  const base: string[] = ["禁止AI重绘品牌Logo"];

  if (mascotProfile.mode === "protect_existing") {
    base.push("禁止AI重绘现有IP形象");
    base.push("禁止改变IP比例和颜色");
    base.push("禁止更换IP角色设定");
    base.push("禁止AI改表情");
  }

  if (mascotProfile.mode === "create_new") {
    base.push("IP设计风格需与品牌视觉方向一致");
    base.push("IP色彩需使用品牌色系");
    base.push("避免与其他品牌IP高度相似");
    base.push("IP设计完成后不可再AI修改");
  }

  return base;
}

// ========== Main Function ==========

export interface MascotPromptInput {
  mascotProfile: MascotProfile;
  brandProfile: BrandProfile;
  businessProfile?: BusinessProfile;
  industryProfile?: IndustryProfile;
}

/**
 * Generate MascotPromptSet from brand analysis results.
 * Pure function — no side effects, no API calls.
 */
export function generateMascotPromptSet(input: MascotPromptInput): MascotPromptSet {
  const { mascotProfile, brandProfile } = input;

  // Mode: not_needed → no prompts
  if (mascotProfile.mode === "not_needed") {
    return {
      mode: "not_needed",
      strategyPrompt: "当前品牌不适合创建IP公仔，无需生成IP相关提示词。",
      imagePrompt: null,
      negativePrompt: "",
      usageNotes: [],
      restrictions: ["无需生成IP"],
    };
  }

  // Mode: protect_existing → NO imagePrompt, only strategy
  if (mascotProfile.mode === "protect_existing") {
    return {
      mode: "protect_existing",
      strategyPrompt: buildStrategyPrompt(mascotProfile, brandProfile),
      imagePrompt: null,
      negativePrompt: buildNegativePrompt("protect_existing", mascotProfile),
      usageNotes: buildUsageNotes(mascotProfile),
      restrictions: buildRestrictions(mascotProfile),
    };
  }

  // Mode: create_new or optional_recommend → build full prompt set
  const imagePrompt = mascotProfile.mode === "create_new"
    ? buildCreateNewImagePrompt(mascotProfile, brandProfile, input.industryProfile)
    : buildCreateNewImagePrompt(mascotProfile, brandProfile, input.industryProfile);

  return {
    mode: mascotProfile.mode,
    strategyPrompt: buildStrategyPrompt(mascotProfile, brandProfile),
    imagePrompt,
    negativePrompt: buildNegativePrompt(mascotProfile.mode, mascotProfile),
    usageNotes: buildUsageNotes(mascotProfile),
    restrictions: buildRestrictions(mascotProfile),
  };
}

// ========== Utility ==========

function getMascotTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    animal: "可爱动物型角色",
    character: "人物型角色",
    object: "拟物型角色",
    plant: "植物型角色",
    abstract: "抽象图形角色",
    food: "食物拟人型角色",
    hybrid: "混合元素角色",
  };
  return map[type || "character"] || "品牌IP角色";
}

// ========== Test helper: Quick verification without API ==========

export function verifyMascotPromptSet(promptSet: MascotPromptSet): string[] {
  const issues: string[] = [];

  if (promptSet.mode === "create_new") {
    if (!promptSet.imagePrompt) {
      issues.push("create_new 模式必须包含 imagePrompt");
    } else if (promptSet.imagePrompt.length < 50) {
      issues.push("imagePrompt 太短，缺乏品牌上下文细节");
    }
  }

  if (promptSet.mode === "protect_existing") {
    if (promptSet.imagePrompt) {
      issues.push("protect_existing 模式不应包含 imagePrompt");
    }
  }

  if (!promptSet.negativePrompt) {
    issues.push("negativePrompt 不能为空");
  }

  if (promptSet.restrictions.length === 0) {
    issues.push("必须包含 restrictions");
  }

  return issues;
}
