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
import type { BrandProfile } from "@/lib/brand/brand-analyzer";
import type { BusinessProfile } from "@/lib/brand/business-profile";
import type { IndustryProfile } from "@/lib/brand/industry-knowledge";
import {
  IndustryCategory,
  BrandArchetype,
  ThemeTag,
  StyleTier,
  SpeciesScoringInput,
  SpeciesScoringResult,
  MascotCoreAnchors,
  PoseTemplate,
  ExpressionTemplate,
  ExpressionType,
  ViewType,
  PoseType,
  scoreAndSelectSpecies,
  deriveThemeTags,
  matchStyleTier,
  matchBestPose,
  matchDefaultExpression,
  pickDeterministicSymbols,
  translateBrandColors,
  buildImagePromptBySegments,
  buildNegativePrompt as buildOptimizedNegativePrompt,
} from "./mascot-optimization";

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

  /** Segmented prompt fields for batch regeneration (only for create_new) */
  promptSegments?: {
    baseQuality: string;
    styleRender: string;
    coreAnchors: string;
    pose: string;
    expression: string;
    viewVariant: string;
    sceneContext: string;
    consistencyConstraint: string;
  };
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
  industryProfile?: IndustryProfile,
  brandColors?: { primary?: string | { hex?: string; name?: string }; accent?: string | { hex?: string; name?: string }; secondary?: string | { hex?: string; name?: string } },
  clientPreferences?: { mascotTypePref?: string[]; mascotStylePref?: string[]; mascotPersonalityPref?: string[]; mascotUsageScenes?: string[]; mascotColorHint?: string; mascotRefIdea?: string; mascotSceneCount?: number }
): string {
  const parts: string[] = [];
  const headParts: string[] = [];

  // 1. Brand context
  const brandName = mascotProfile.suggestedName || "brand mascot";
  parts.push(`A brand mascot character named "${brandName}"`);

  // 2. Visual details from MascotProfile
  const vd = mascotProfile.visualDetails;
  if (vd?.species) {
    parts.push(`designed as a ${vd.species}`);
  } else {
    const typeLabel = getMascotTypeLabel(mascotProfile.suggestedType);
    parts.push(`designed as a ${typeLabel}`);
  }
  if (vd?.pose) {
    parts.push(vd.pose);
  }
  if (vd?.expression) {
    parts.push(vd.expression);
  }
  if (vd?.atmosphere && vd.atmosphere.length > 0) {
    parts.push(vd.atmosphere.join(", "));
  }
  if (vd?.accessories && vd.accessories.length > 0) {
    parts.push(`wearing ${vd.accessories.join(", ")}`);
  }

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

  // 9a. Brand color injection (闭环缺口 #6)
  const brandPrimary = brandColors?.primary
    ? typeof brandColors.primary === "string" ? brandColors.primary : (brandColors.primary as any)?.hex || ""
    : undefined;
  const brandAccent = brandColors?.accent
    ? typeof brandColors.accent === "string" ? brandColors.accent : (brandColors.accent as any)?.hex || ""
    : undefined;
  if (brandPrimary) {
    headParts.push("brand primary " + brandPrimary);
  }
  if (brandAccent) {
    headParts.push("brand accent " + brandAccent);
  }
  if (brandPrimary) {
    headParts.push("brand colors: " + [brandPrimary, brandAccent].filter(Boolean).join(", "));
  }

  // 9b. Client preference injection (type/style/personality)
  if (clientPreferences?.mascotTypePref && clientPreferences.mascotTypePref.length > 0) {
    parts.push(`preferred mascot types: ${clientPreferences.mascotTypePref.join(", ")}`);
  }
  if (clientPreferences?.mascotStylePref && clientPreferences.mascotStylePref.length > 0) {
    parts.push(`preferred visual style: ${clientPreferences.mascotStylePref.join(", ")}`);
  }
  if (clientPreferences?.mascotPersonalityPref && clientPreferences.mascotPersonalityPref.length > 0) {
    parts.push(`personality traits: ${clientPreferences.mascotPersonalityPref.join(", ")}`);
  }
  if (clientPreferences?.mascotUsageScenes && clientPreferences.mascotUsageScenes.length > 0) {
    parts.push(`designed for usage: ${clientPreferences.mascotUsageScenes.join(", ")}`);
  }
  if (clientPreferences?.mascotColorHint) {
    parts.push(`color hint from client: ${clientPreferences.mascotColorHint}`);
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

  // 12. 3D style head (replaces flat vector)
  const styleHead = "3D Pixar style, C4D render, octane render, soft studio lighting, professional brand mascot, premium quality, highly detailed, centered composition, white background, full body front view, looking at viewer";
  const colorSection = headParts.length > 0 ? headParts.join(", ") : "";
  const bodyContent = parts.map(p => p.replace(/^[a-zA-Z\s]+: /, "").replace(/^"(.*)"$/, "$1")).join(", ");
  const sceneCon = (brandProfile.industry || "").trim() + " brand mascot";

  return [styleHead, bodyContent, colorSection, "---", sceneCon].filter(Boolean).join(", ") + ".";
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
  /** Brand colors from client submission (primary/accent for prompt injection) */
  brandColors?: {
    primary?: string | { hex?: string; name?: string };
    accent?: string | { hex?: string; name?: string };
    secondary?: string | { hex?: string; name?: string };
  };
  /** Client's mascot preferences from consultation form */
  clientPreferences?: {
    mascotTypePref?: string[];
    mascotStylePref?: string[];
    mascotPersonalityPref?: string[];
    mascotUsageScenes?: string[];
    mascotColorHint?: string;
    mascotRefIdea?: string;
    mascotSceneCount?: number;
  };
}

/**
 * Generate MascotPromptSet from brand analysis results.
 * Pure function — no side effects, no API calls.
 */

// ========== Optimization Pipeline ==========

interface OptimizationResult {
  speciesResult: SpeciesScoringResult;
  themeTags: ThemeTag[];
  styleTier: StyleTier;
  poseTemplate: PoseTemplate;
  expressionTemplate: ExpressionTemplate;
  symbols: string[];
  coreAnchors: MascotCoreAnchors;
}

/**
 * Run full mascot optimization pipeline for create_new mode.
 * Falls back gracefully if any step fails.
 */
function runMascotOptimization(
  mascotProfile: MascotProfile,
  brandProfile: BrandProfile,
  clientPreferences?: MascotPromptInput["clientPreferences"],
  brandName?: string,
  brandColors?: { primary?: string; accent?: string; background?: string }
): OptimizationResult | null {
  try {
    const industry = brandProfile.industryCategory as unknown as IndustryCategory;
    const brandArchetype = brandProfile.brandArchetype as unknown as BrandArchetype;

    const personalityKeywords = clientPreferences?.mascotPersonalityPref?.length
      ? clientPreferences.mascotPersonalityPref
      : mascotProfile.personality;

    const typePreferences = clientPreferences?.mascotTypePref?.length
      ? clientPreferences.mascotTypePref
      : mascotProfile.suggestedType
        ? [mascotProfile.suggestedType]
        : ["character"];

    const speciesResult = scoreAndSelectSpecies({
      industry,
      brandArchetype,
      personalityKeywords,
      typePreferences,
    });

    const themeTags = deriveThemeTags(personalityKeywords, industry);
    const styleTier = matchStyleTier(industry, themeTags);
    const poseTemplate = matchBestPose(themeTags);
    const expressionTemplate = matchDefaultExpression(themeTags);
    const symbols = pickDeterministicSymbols(themeTags, brandName || "default", 2);

    const coreAnchors: MascotCoreAnchors = {
      species: speciesResult.speciesName,
      bodyColorDesc: translateBrandColors({ primary: brandColors?.primary, accent: brandColors?.accent }),
      keyAccessories: symbols,
      coreTexture: "smooth matte texture",
    };

    // Brand-specific enrichment: replace generic "holding handmade craft item" with brand-specific prop
    if (speciesResult.speciesName.includes("human artisan") && clientPreferences?.mascotRefIdea) {
      const refIdea = clientPreferences.mascotRefIdea;
      const holdingMatch = refIdea.match(/手持([^，。]+)/);
      if (holdingMatch) {
        const holdingItem = holdingMatch[1].trim();
        // Chinese to English item translation
        const itemTranslation: Record<string, string> = {
          '一双千层底布鞋': 'a pair of handmade cloth shoes',
          '千层底布鞋': 'handmade cloth shoes',
          '针线': 'needle and thread',
          '布鞋': 'cloth shoes',
          '布鞋鞋底': 'cloth shoe soles',
        };
        const englishItem = itemTranslation[holdingItem] || holdingItem;
        coreAnchors.species = coreAnchors.species.replace('holding handmade craft item', 'holding ' + englishItem);
        const itemKey = 'holding ' + holdingItem;
        if (!coreAnchors.keyAccessories.includes(itemKey)) {
          coreAnchors.keyAccessories.push(itemKey);
        // Change pose to compatible type (not prayer/合掌) when holding items
        poseTemplate.poseType = PoseType.ELEGANT_POISED;
        }
      }
    }

    return { speciesResult, themeTags, styleTier, poseTemplate, expressionTemplate, symbols, coreAnchors };
  } catch (error) {
    console.warn("[MascotPromptStrategy] Optimization pipeline failed, falling back to legacy logic:", error);
    return null;
  }
}

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
  const isCreateNew = mascotProfile.mode === "create_new";
  const brandName = mascotProfile.suggestedName || brandProfile.brandPositioning || "brand";

  const optimizationResult = isCreateNew
    ? runMascotOptimization(mascotProfile, brandProfile, input.clientPreferences, brandName, input.brandColors as any)
    : null;

  let imagePrompt: string | null;
  let negativePrompt: string;
  let promptSegments: MascotPromptSet["promptSegments"] | undefined;

  if (isCreateNew && optimizationResult) {
    const { styleTier, coreAnchors, poseTemplate, expressionTemplate, speciesResult } = optimizationResult;

    // === 角色一致性锚点注入 (2026-07-28 修正) ===
    // 平台/用户已定义的具体角色外观（visualDetails）必须优先于物种打分结果，
    // 否则物种打分会自由发挥帽子/服饰/物种，导致三视图、表情、场景角色不一致。
    const explicitAccessories = mascotProfile.visualDetails?.accessories;
    if (explicitAccessories && explicitAccessories.length > 0) {
      coreAnchors.keyAccessories = [
        ...explicitAccessories,
        ...coreAnchors.keyAccessories.filter(a => !explicitAccessories.includes(a)),
      ];
    }
    if (mascotProfile.visualDetails?.species) {
      coreAnchors.species = mascotProfile.visualDetails.species;
    }

    // === 2026-07-29 李记整改 #1（强化版）：强制传统手工/鞋履品牌角色为「中年男性老北京布鞋匠人」 ===
    // 不再依赖物种动态打分产出「熊」，直接锁定 human artisan 并覆盖打分结果（相当于跳过动物打分）。
    if (isTraditionalCraftBrand(brandProfile, input.clientPreferences)) {
      coreAnchors.species = HUMAN_ARTISAN_SPECIES;
      // 同步覆盖动态打分产出的 speciesName，避免 profileLike.visualDetails.species 仍带动物名泄露到正文
      optimizationResult.speciesResult.speciesName = HUMAN_ARTISAN_SPECIES;
      optimizationResult.speciesResult.speciesNameCn = HUMAN_ARTISAN_SPECIES_CN;
      // 清除优化器默认（CUTE_PLAYFUL 兜底）注入的「萌化/动物化」配件，如 cute little bow on head / round blush on cheeks
      coreAnchors.keyAccessories = coreAnchors.keyAccessories.filter(
        (a) => !/cute|bow|blush|animal|furry|ear|horn|antler|ribbon|knot|panda|bear|deer|fox|rabbit|owl/i.test(a)
      );
      const hasShoe = coreAnchors.keyAccessories.some((a) => /cloth.?shoe|布鞋|千层底/i.test(a));
      if (!hasShoe) {
        coreAnchors.keyAccessories.push("holding a pair of handmade cloth shoes (千层底布鞋)");
      }
      if (!coreAnchors.keyAccessories.some((a) => /melon.?cap|瓜皮帽|gold button|金球/i.test(a))) {
        coreAnchors.keyAccessories.push("black Chinese melon-cap with a single small gold round button on top");
      }
    }

    // Build prompt using segmented builder
    const profileLike = {
      styleTier: styleTier,
      coreAnchors: coreAnchors,
      visualDetails: {
        poseType: poseTemplate.poseType,
        expressionType: expressionTemplate.expressionType,
        species: speciesResult.speciesName,
        pose: poseTemplate.poseDescription,
        expression: expressionTemplate.expressionDescription,
        atmosphere: [],
        accessories: coreAnchors.keyAccessories,
      },
      mode: "create_new",
      confidence: 1,
      hasMascot: false,
      suggestedName: brandName,
      suggestedType: mascotProfile.suggestedType,
      suggestedRole: mascotProfile.suggestedRole,
      personality: mascotProfile.personality,
      visualTraits: mascotProfile.visualTraits,
      colorDirection: mascotProfile.colorDirection,
      storySummary: mascotProfile.storySummary || "",
      usageScenarios: mascotProfile.usageScenarios,
      themeTags: optimizationResult.themeTags,
      industry: brandProfile.industryCategory,
      archetype: brandProfile.brandArchetype,
    };

    const sceneContextEng = (input.clientPreferences?.mascotUsageScenes || [])
      .map(s => ({门店招牌:'storefront',产品包装:'product packaging',会员卡:'membership card',社交媒体:'social media',周边商品:'merchandise',店内装饰:'interior decor',名片:'business card',手提袋:'shopping bag',宣传册:'brochure'})[s] || s)
      .filter(Boolean).join(', ');
    imagePrompt = buildImagePromptBySegments(
      profileLike as any,
      ViewType.FRONT,
      expressionTemplate.expressionType,
      "", // 表情/人像图统一纯白背景，不注入场景上下文（场景图后续单独处理）
      brandProfile.brandPositioning || brandProfile.industry || ''
    );

    negativePrompt = buildOptimizedNegativePrompt(
      brandProfile.industryCategory as unknown as IndustryCategory,
      styleTier,
      []
    );

    promptSegments = {
      baseQuality: "premium quality, highly detailed, professional brand mascot, white background, centered composition",
      styleRender: styleTier + ", " + poseTemplate.poseDescription,
      coreAnchors: coreAnchors.species + ", " + coreAnchors.bodyColorDesc + ", " + coreAnchors.keyAccessories.join(", "),
      pose: poseTemplate.poseDescription,
      expression: expressionTemplate.expressionDescription,
      viewVariant: "full body front view, standing upright, looking at viewer",
      sceneContext: input.clientPreferences?.mascotUsageScenes?.join(", ") || "",
      consistencyConstraint: "strict character consistency, unified color scheme, complete character design",
    };
  } else {
    imagePrompt = buildCreateNewImagePrompt(mascotProfile, brandProfile, input.industryProfile, input.brandColors, input.clientPreferences);
    negativePrompt = buildNegativePrompt(mascotProfile.mode, mascotProfile);
  }

  // === 2026-07-29 李记整改 #1（强化版）：传统手工/鞋履品牌强制「老北京布鞋匠人」角色（两条路径均生效）===
  // 无论物种打分是否成功，统一追加强约束，确保角色=中年男性黑瓜皮帽+帽顶小金球、藏青长衫、香槟金腰带、
  // 手持千层底布鞋、真人（非动物），并清除优化器内残留的 "cute creature mascot" 等动物化/萌化描述，
  // negative 追加 bear/teddy bear/panda/animal/furry/cute animal/cartoon animal/beast/animal ears/ears on top。
  if (isCreateNew && isTraditionalCraftBrand(brandProfile, input.clientPreferences)) {
    // 清除优化器 buildImagePromptBySegments 中硬编码的 "cute creature mascot / humanoid character design" 等动物化描述
    imagePrompt = (imagePrompt || "")
      .replace(/cute creature mascot/gi, "human artisan character")
      .replace(/humanoid character design/gi, "human artisan character design");
    imagePrompt = imagePrompt + CRAFT_HUMAN_ARTISAN_SUFFIX;
    negativePrompt = (negativePrompt || "") + CRAFT_NEGATIVE_APPEND;
  }

  return {
    mode: mascotProfile.mode,
    strategyPrompt: buildStrategyPrompt(mascotProfile, brandProfile),
    imagePrompt,
    negativePrompt,
    usageNotes: buildUsageNotes(mascotProfile),
    restrictions: buildRestrictions(mascotProfile),
    ...(promptSegments ? { promptSegments } : {}),
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

/**
 * 传统手工 / 鞋履品牌的强制「老北京布鞋匠人」角色常量（整改 #1 强化版）。
 * 直接锁定中年男性真人匠人，杜绝 Z-Image Turbo 等模型把 cute creature mascot 渲染成熊/动物。
 */
const HUMAN_ARTISAN_SPECIES =
  "human artisan cloth-shoe craftsman, a middle-aged Chinese male handmade cloth-shoe craftsman";
const HUMAN_ARTISAN_SPECIES_CN = "人物匠人（中年男性老北京布鞋匠人）";

/** 正向强约束后缀：明确「真人、非动物、非熊、非吉祥物动物」并描述完整匠人外观 */
const CRAFT_HUMAN_ARTISAN_SUFFIX =
  ", 3D Pixar human character, a human artisan cloth-shoe craftsman (a human being, NOT an animal, NOT a bear, NOT a mascot animal): " +
  "a middle-aged Chinese male handmade cloth-shoe craftsman, " +
  "plain black Chinese melon-cap (guapi hat) with a single small gold round button on top, " +
  "dark navy changshan robe, champagne-gold waist belt, " +
  "holding a pair of handmade cloth shoes (千层底布鞋), " +
  "friendly artisan expression, full body standing upright, " +
  "pure white background, isolated, no store interior, no shelves, no shop sign, no scenery, no environment, " +
  "NO antlers, NO horns, NO branches, NO animal ears, NO fins, NO deer antlers, NO bow, NO ribbon, " +
  "NO butterfly knot, NO yellow bear, NO pink bow, NO animal, NO furry, NO beast";

/** 负向强约束追加：覆盖熊/熊猫/动物/毛绒/萌动物等所有可能动物化信号 */
const CRAFT_NEGATIVE_APPEND =
  ", antlers, horns, branches, animal ears, fins, deer, bear, teddy bear, panda, yellow bear, " +
  "animal, furry, cute animal, cartoon animal, beast, ears on top, " +
  "store interior, shelves, shop sign, scenery, environment, complex background, " +
  "bow, ribbon, butterfly knot, pink bow, hair bow, bowtie, deer antlers, animal nose, cute creature mascot";

/**
 * 判断品牌是否属于传统手工 / 鞋履类，若是则强制 IP 角色为「老北京布鞋匠人」，
 * 避免物种动态打分产出「熊」等错误角色（整改 #1）。
 */
function isTraditionalCraftBrand(
  brandProfile: BrandProfile,
  clientPreferences?: MascotPromptInput["clientPreferences"]
): boolean {
  const ind = (
    (brandProfile.industry as string) ||
    (brandProfile.industryCategory as unknown as string) ||
    ""
  ).toLowerCase();
  const ref = clientPreferences?.mascotRefIdea || "";
  const keywords = [
    "鞋", "布鞋", "千层底", "手工", "传统", "craft", "shoe", "cloth",
    "artisan", "老北京", "非遗", "匠", "制鞋",
  ];
  return keywords.some((k) => ind.includes(k.toLowerCase()) || ref.includes(k));
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
