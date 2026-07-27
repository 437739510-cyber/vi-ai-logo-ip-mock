/**
 * IP公仔生成优化模块 - 全行业通用
 * 版本：v1.0 | 日期：2026-07-27
 * 功能：三级物种打分算法、主题化姿态表情体系、分行业负面词模板、分段式Prompt拼装
 * 说明：全量自包含单文件，可直接接入现有管线，向后兼容原有 MascotProfile 结构
 */

// ==========================================
// 一、基础枚举定义
// ==========================================

/** 行业大类（可按需无限扩展） */
export enum IndustryCategory {
  BEAUTY = 'beauty',
  FOOD_BEVERAGE = 'food_beverage',
  EDUCATION_TRAINING = 'education_training',
  TECHNOLOGY_IT = 'technology_it',
  HEALTHCARE_MEDICAL = 'healthcare_medical',
  MATERNAL_CHILD = 'maternal_child',
  RETAIL = 'retail',
  CULTURAL_CREATIVE = 'cultural_creative',
  FINANCIAL_SERVICE = 'financial_service',
}

/** 品牌原型（与 BrandProfile 对齐） */
export enum BrandArchetype {
  CAREGIVER = 'Caregiver',
  INNOCENT = 'Innocent',
  WARRIOR = 'Warrior',
  CREATOR = 'Creator',
  EVERYMAN = 'Everyman',
  SAGE = 'Sage',
}

/** 通用风格档位（全行业5档） */
export enum StyleTier {
  SOFT_HEALING = 'soft_healing',
  PIXAR_CARTOON = 'pixar_cartoon',
  PREMIUM_LUXURY = 'premium_luxury',
  FLAT_VECTOR = 'flat_vector',
  CHINESE_AESTHETIC = 'chinese_aesthetic',
}

/** 主题标签（用于符号插件与姿态匹配） */
export enum ThemeTag {
  HEALING = 'healing',
  ORIENTAL = 'oriental',
  TECH_FUTURE = 'tech_future',
  CUTE_PLAYFUL = 'cute_playful',
  DELICIOUS_FOOD = 'delicious_food',
  PROFESSIONAL_RIGOROUS = 'professional_rigorous',
}

/** 视角类型 */
export enum ViewType {
  FRONT = 'front',
  SIDE = 'side',
  BACK = 'back',
  BUST = 'bust',
}

/** 表情类型 */
export enum ExpressionType {
  SMILE = 'smile',
  HAPPY = 'happy',
  SHY = 'shy',
  RELAXED = 'relaxed',
  SURPRISED = 'surprised',
  HEALING = 'healing',
  FOCUSED = 'focused',
}

/** 姿态类型 */
export enum PoseType {
  HEALING_PRAYER = 'healing_prayer',
  FRIENDLY_WAVING = 'friendly_waving',
  ELEGANT_POISED = 'elegant_poised',
  CUTE_SITTING = 'cute_sitting',
  DYNAMIC_FUTURISTIC = 'dynamic_futuristic',
}

// ==========================================
// 二、核心接口定义
// ==========================================

/** 物种基因项 */
export interface SpeciesGene {
  speciesName: string;
  speciesNameCn: string;
  mentalTags: string[];
  adaptedIndustries: IndustryCategory[];
  adaptedArchetypes: BrandArchetype[];
  baseWeight: number;
  exclusiveIndustries?: IndustryCategory[];
}

/** 姿态模板 */
export interface PoseTemplate {
  poseType: PoseType;
  poseDescription: string;
  adaptedThemes: ThemeTag[];
  adaptedTones: string[];
}

/** 表情模板 */
export interface ExpressionTemplate {
  expressionType: ExpressionType;
  expressionDescription: string;
  adaptedThemes: ThemeTag[];
}

/** 风格档位配置 */
export interface StyleTierConfig {
  tier: StyleTier;
  renderKeywords: string;
  lightingKeywords: string;
  textureKeywords: string;
  adaptedIndustries: IndustryCategory[];
  adaptedModels: string[];
}

/** 主题符号插件 */
export interface ThemeSymbol {
  tag: ThemeTag;
  symbolDescriptions: string[];
}

/** 角色核心锚点（全程固定，保障一致性） */
export interface MascotCoreAnchors {
  species: string;
  bodyColorDesc: string;
  keyAccessories: string[];
  coreTexture: string;
}

/** 扩展版视觉细节 */
export interface VisualDetailsV2 {
  // 兼容原有字段
  species: string;
  pose: string;
  expression: string;
  atmosphere: string[];
  accessories: string[];

  // 新增结构化字段
  poseType: PoseType;
  expressionType: ExpressionType;
  viewType: ViewType;
}

/** 扩展版 MascotProfile（完全向后兼容） */
export interface MascotProfileV2 {
  // === 原有字段（完全兼容）===
  mode: 'create_new' | 'protect_existing' | 'not_needed';
  confidence: number;
  hasMascot: boolean;
  suggestedName: string;
  suggestedType: string;
  suggestedRole: string;
  personality: string[];
  visualTraits: string[];
  colorDirection: string[];
  storySummary: string;
  usageScenarios: string[];
  visualDetails: VisualDetailsV2;

  // === 新增扩展字段 ===
  styleTier: StyleTier;
  themeTags: ThemeTag[];
  coreAnchors: MascotCoreAnchors;
  industry: IndustryCategory;
  archetype: BrandArchetype;
}

/** 扩展版 Prompt 输出结构 */
export interface MascotPromptSetV2 {
  // === 原有字段（完全兼容）===
  mode: string;
  strategyPrompt: string;
  imagePrompt: string;
  negativePrompt: string;
  usageNotes: string[];
  restrictions: string[];

  // === 新增分模块片段（批量生成时复用）===
  promptSegments: {
    baseQuality: string;
    styleRender: string;
    coreAnchors: string;
    pose: string;
    expression: string;
    viewComposition: string;
    atmosphere: string;
    sceneContext?: string;
    colorAnchor: string;
    consistencyConstraint: string;
  };
}

/** 物种打分入参 */
export interface SpeciesScoringInput {
  industry: IndustryCategory;
  brandArchetype: BrandArchetype;
  personalityKeywords: string[];
  typePreferences: string[];
}

/** 物种打结果 */
export interface SpeciesScoringResult {
  speciesId: string;
  speciesName: string;
  speciesNameCn: string;
  totalScore: number;
  confidence: number;
  dimensionScores: {
    industry: number;
    archetype: number;
    keywords: number;
    preferenceBonus: number;
  };
}

// ==========================================
// 三、全行业通用映射表（常量数据）
// ==========================================

/** 1. 全行业物种基因库 */
export const SPECIES_GENE_POOL: Record<string, SpeciesGene> = {
  oriental_deer: {
    speciesName: 'elegant oriental deer',
    speciesNameCn: '东方灵鹿',
    mentalTags: ['温柔', '守护', '疗愈', '高贵', '东方灵性'],
    adaptedIndustries: [
      IndustryCategory.BEAUTY,
      IndustryCategory.HEALTHCARE_MEDICAL,
      IndustryCategory.CULTURAL_CREATIVE,
    ],
    adaptedArchetypes: [BrandArchetype.CAREGIVER, BrandArchetype.SAGE],
    baseWeight: 0.9,
  },
  soft_rabbit: {
    speciesName: 'soft fluffy rabbit',
    speciesNameCn: '软萌白兔',
    mentalTags: ['可爱', '治愈', '温柔', '亲和'],
    adaptedIndustries: [
      IndustryCategory.BEAUTY,
      IndustryCategory.MATERNAL_CHILD,
      IndustryCategory.FOOD_BEVERAGE,
    ],
    adaptedArchetypes: [BrandArchetype.CAREGIVER, BrandArchetype.INNOCENT],
    baseWeight: 0.85,
  },
  flower_fairy: {
    speciesName: 'delicate flower fairy',
    speciesNameCn: '花精灵',
    mentalTags: ['精致', '柔美', '自然', '灵动'],
    adaptedIndustries: [
      IndustryCategory.BEAUTY,
      IndustryCategory.RETAIL,
      IndustryCategory.CULTURAL_CREATIVE,
    ],
    adaptedArchetypes: [BrandArchetype.CREATOR, BrandArchetype.INNOCENT],
    baseWeight: 0.8,
  },
  cute_bear: {
    speciesName: 'chubby cute bear',
    speciesNameCn: '萌熊',
    mentalTags: ['憨厚', '亲民', '治愈', '可靠'],
    adaptedIndustries: [
      IndustryCategory.FOOD_BEVERAGE,
      IndustryCategory.MATERNAL_CHILD,
      IndustryCategory.RETAIL,
    ],
    adaptedArchetypes: [BrandArchetype.EVERYMAN, BrandArchetype.CAREGIVER],
    baseWeight: 0.88,
  },
  wise_owl: {
    speciesName: 'wise friendly owl',
    speciesNameCn: '智慧猫头鹰',
    mentalTags: ['智慧', '专业', '可靠', '陪伴'],
    adaptedIndustries: [
      IndustryCategory.EDUCATION_TRAINING,
      IndustryCategory.FINANCIAL_SERVICE,
    ],
    adaptedArchetypes: [BrandArchetype.SAGE, BrandArchetype.WARRIOR],
    baseWeight: 0.85,
  },
  tech_fox: {
    speciesName: 'sleek futuristic fox',
    speciesNameCn: '科技灵狐',
    mentalTags: ['敏捷', '智能', '前沿', '创新'],
    adaptedIndustries: [
      IndustryCategory.TECHNOLOGY_IT,
      IndustryCategory.CULTURAL_CREATIVE,
    ],
    adaptedArchetypes: [BrandArchetype.CREATOR, BrandArchetype.WARRIOR],
    baseWeight: 0.82,
  },
};

/** 2. 姿态模板映射表 */
export const POSE_TEMPLATE_MAP: Record<PoseType, PoseTemplate> = {
  [PoseType.HEALING_PRAYER]: {
    poseType: PoseType.HEALING_PRAYER,
    poseDescription:
      'palms pressed together in prayer pose at chest level, shoulders relaxed, gentle upright stance, soft body language',
    adaptedThemes: [ThemeTag.HEALING, ThemeTag.ORIENTAL],
    adaptedTones: ['温柔', '治愈', '舒缓', '端庄'],
  },
  [PoseType.FRIENDLY_WAVING]: {
    poseType: PoseType.FRIENDLY_WAVING,
    poseDescription:
      'one hand waving gently, body slightly tilted forward, lively standing posture, approachable demeanor',
    adaptedThemes: [ThemeTag.CUTE_PLAYFUL, ThemeTag.DELICIOUS_FOOD],
    adaptedTones: ['亲民', '活泼', '开朗', '热情'],
  },
  [PoseType.ELEGANT_POISED]: {
    poseType: PoseType.ELEGANT_POISED,
    poseDescription:
      'elegant upright posture, one hand naturally resting by side, calm demeanor, poised and graceful',
    adaptedThemes: [ThemeTag.PROFESSIONAL_RIGOROUS, ThemeTag.ORIENTAL],
    adaptedTones: ['高端', '专业', '精致', '优雅'],
  },
  [PoseType.CUTE_SITTING]: {
    poseType: PoseType.CUTE_SITTING,
    poseDescription:
      'chubby rounded body, sitting pose with knees tucked, cute tilted head, soft rounded silhouette',
    adaptedThemes: [ThemeTag.CUTE_PLAYFUL],
    adaptedTones: ['软萌', '可爱', '童趣', '治愈'],
  },
  [PoseType.DYNAMIC_FUTURISTIC]: {
    poseType: PoseType.DYNAMIC_FUTURISTIC,
    poseDescription:
      'dynamic leaning stance, one hand reaching out, futuristic body language, sharp clean silhouette',
    adaptedThemes: [ThemeTag.TECH_FUTURE],
    adaptedTones: ['科技', '前沿', '创新', '动感'],
  },
};

/** 3. 表情模板映射表 */
export const EXPRESSION_TEMPLATE_MAP: Record<ExpressionType, ExpressionTemplate> = {
  [ExpressionType.SMILE]: {
    expressionType: ExpressionType.SMILE,
    expressionDescription: 'warm gentle smile, slightly curved eyes',
    adaptedThemes: [ThemeTag.HEALING, ThemeTag.CUTE_PLAYFUL, ThemeTag.PROFESSIONAL_RIGOROUS],
  },
  [ExpressionType.HAPPY]: {
    expressionType: ExpressionType.HAPPY,
    expressionDescription: 'big happy smile, crescent shaped eyes, cheerful expression',
    adaptedThemes: [ThemeTag.CUTE_PLAYFUL, ThemeTag.DELICIOUS_FOOD],
  },
  [ExpressionType.HEALING]: {
    expressionType: ExpressionType.HEALING,
    expressionDescription: 'serene healing expression, eyes closed, soft warm aura around face',
    adaptedThemes: [ThemeTag.HEALING, ThemeTag.ORIENTAL],
  },
  [ExpressionType.FOCUSED]: {
    expressionType: ExpressionType.FOCUSED,
    expressionDescription: 'focused confident expression, bright clear eyes, determined demeanor',
    adaptedThemes: [ThemeTag.TECH_FUTURE, ThemeTag.PROFESSIONAL_RIGOROUS],
  },
  [ExpressionType.SHY]: {
    expressionType: ExpressionType.SHY,
    expressionDescription: 'shy expression, slightly tilted head down, gentle blush',
    adaptedThemes: [ThemeTag.CUTE_PLAYFUL, ThemeTag.HEALING],
  },
  [ExpressionType.RELAXED]: {
    expressionType: ExpressionType.RELAXED,
    expressionDescription: 'relaxed peaceful expression, half-closed eyes',
    adaptedThemes: [ThemeTag.HEALING, ThemeTag.CUTE_PLAYFUL],
  },
  [ExpressionType.SURPRISED]: {
    expressionType: ExpressionType.SURPRISED,
    expressionDescription: 'surprised expression, wide round eyes',
    adaptedThemes: [ThemeTag.CUTE_PLAYFUL, ThemeTag.DELICIOUS_FOOD],
  },
};

/** 4. 风格档位配置表（含多模型适配） */
export const STYLE_TIER_CONFIG: Record<StyleTier, StyleTierConfig> = {
  [StyleTier.SOFT_HEALING]: {
    tier: StyleTier.SOFT_HEALING,
    renderKeywords: 'soft ethereal 3D render, matte clay texture',
    lightingKeywords: 'soft diffused studio lighting, dreamy warm ambient glow',
    textureKeywords: 'smooth matte surface, soft delicate details',
    adaptedIndustries: [
      IndustryCategory.BEAUTY,
      IndustryCategory.HEALTHCARE_MEDICAL,
      IndustryCategory.MATERNAL_CHILD,
    ],
    adaptedModels: ['ark-seedream', 'sdxl', 'doubao-image'],
  },
  [StyleTier.PIXAR_CARTOON]: {
    tier: StyleTier.PIXAR_CARTOON,
    renderKeywords: 'Pixar 3D style, C4D render, octane render',
    lightingKeywords: 'bright clean studio lighting, vivid clear shadows',
    textureKeywords: 'smooth rounded shapes, glossy cartoon texture',
    adaptedIndustries: [
      IndustryCategory.FOOD_BEVERAGE,
      IndustryCategory.EDUCATION_TRAINING,
      IndustryCategory.MATERNAL_CHILD,
    ],
    adaptedModels: ['sdxl', 'midjourney', 'doubao-image'],
  },
  [StyleTier.PREMIUM_LUXURY]: {
    tier: StyleTier.PREMIUM_LUXURY,
    renderKeywords: 'premium 3D render, metallic and matte mixed texture',
    lightingKeywords: 'studio key lighting, subtle rim light, minimalist clean lighting',
    textureKeywords: 'high-end texture, fine details, premium material feel',
    adaptedIndustries: [
      IndustryCategory.FINANCIAL_SERVICE,
      IndustryCategory.RETAIL,
      IndustryCategory.CULTURAL_CREATIVE,
    ],
    adaptedModels: ['ark-seedream', 'sdxl', 'doubao-image'],
  },
  [StyleTier.FLAT_VECTOR]: {
    tier: StyleTier.FLAT_VECTOR,
    renderKeywords: 'flat vector illustration, clean lines, solid color blocks',
    lightingKeywords: 'flat lighting, no shadows, uniform brightness',
    textureKeywords: 'clean graphic style, minimalist vector design',
    adaptedIndustries: [
      IndustryCategory.TECHNOLOGY_IT,
      IndustryCategory.CULTURAL_CREATIVE,
      IndustryCategory.RETAIL,
    ],
    adaptedModels: ['sdxl', 'doubao-image'],
  },
  [StyleTier.CHINESE_AESTHETIC]: {
    tier: StyleTier.CHINESE_AESTHETIC,
    renderKeywords: 'Chinese aesthetic 3D render, elegant ink charm texture',
    lightingKeywords: 'soft oriental lighting, gentle atmospheric perspective',
    textureKeywords: 'traditional pattern details, oriental delicate texture',
    adaptedIndustries: [
      IndustryCategory.CULTURAL_CREATIVE,
      IndustryCategory.FOOD_BEVERAGE,
      IndustryCategory.BEAUTY,
    ],
    adaptedModels: ['ark-seedream', 'sdxl', 'doubao-image'],
  },
};

/** 5. 主题符号插件库 */
export const THEME_SYMBOL_LIBRARY: Record<ThemeTag, ThemeSymbol> = {
  [ThemeTag.HEALING]: {
    tag: ThemeTag.HEALING,
    symbolDescriptions: [
      'soft warm aura glow around the character',
      'five-petal flower crown on head',
      'floating tiny warm light particles',
    ],
  },
  [ThemeTag.ORIENTAL]: {
    tag: ThemeTag.ORIENTAL,
    symbolDescriptions: [
      'subtle auspicious cloud details',
      'traditional ribbon accessory with Chinese pattern',
    ],
  },
  [ThemeTag.TECH_FUTURE]: {
    tag: ThemeTag.TECH_FUTURE,
    symbolDescriptions: [
      'glowing circuit lines on body',
      'floating data particles around character',
    ],
  },
  [ThemeTag.CUTE_PLAYFUL]: {
    tag: ThemeTag.CUTE_PLAYFUL,
    symbolDescriptions: [
      'cute little bow on head',
      'round blush on cheeks',
    ],
  },
  [ThemeTag.DELICIOUS_FOOD]: {
    tag: ThemeTag.DELICIOUS_FOOD,
    symbolDescriptions: [
      'holding a tiny food prop',
      'floating small ingredient elements',
    ],
  },
  [ThemeTag.PROFESSIONAL_RIGOROUS]: {
    tag: ThemeTag.PROFESSIONAL_RIGOROUS,
    symbolDescriptions: [
      'delicate small tie accessory',
      'holding a tiny notebook or tool',
    ],
  },
};

// ==========================================
// 四、三级物种打分算法实现
// ==========================================

/**
 * 三级加权物种打分主函数
 * @param input 打分入参
 * @param genePool 物种基因池（默认使用内置库）
 */
export function scoreAndSelectSpecies(
  input: SpeciesScoringInput,
  genePool: Record<string, SpeciesGene> = SPECIES_GENE_POOL
): SpeciesScoringResult {
  // 第一步：过滤禁忌行业的物种
  const validCandidates = Object.entries(genePool).filter(([, gene]) => {
    return !gene.exclusiveIndustries?.includes(input.industry);
  });

  if (validCandidates.length === 0) {
    return getFallbackSpecies(input.industry);
  }

  // 第二步：逐物种计算三维度得分 + 偏好加成
  const scoredList = validCandidates.map(([speciesId, gene]) => {
    const industryScore = calcIndustryScore(gene, input.industry);
    const archetypeScore = calcArchetypeScore(gene, input.brandArchetype);
    const keywordScore = calcKeywordScore(gene, input.personalityKeywords);
    const preferenceBonus = calcTypePreferenceBonus(gene, input.typePreferences);

    const totalScore = industryScore + archetypeScore + keywordScore + preferenceBonus;
    const confidence = Math.min(totalScore / 100, 1);

    return {
      speciesId,
      speciesName: gene.speciesName,
      speciesNameCn: gene.speciesNameCn,
      totalScore,
      confidence,
      dimensionScores: {
        industry: industryScore,
        archetype: archetypeScore,
        keywords: keywordScore,
        preferenceBonus,
      },
    };
  });

  // 第三步：按得分降序排序，取最高分
  scoredList.sort((a, b) => b.totalScore - a.totalScore);
  const bestMatch = scoredList[0];

  // 低于合格阈值，触发 fallback
  if (bestMatch.totalScore < 50) {
    return getFallbackSpecies(input.industry);
  }

  return bestMatch;
}

/** 行业适配度打分（满分40） */
function calcIndustryScore(gene: SpeciesGene, industry: IndustryCategory): number {
  if (gene.adaptedIndustries.includes(industry)) {
    return 40;
  }
  return 0;
}

/** 品牌原型匹配度打分（满分30） */
function calcArchetypeScore(gene: SpeciesGene, archetype: BrandArchetype): number {
  if (gene.adaptedArchetypes.includes(archetype)) {
    return 30;
  }
  return 0;
}

/** 关键词命中度打分（满分30） */
function calcKeywordScore(gene: SpeciesGene, keywords: string[]): number {
  if (!keywords || keywords.length === 0) {
    return 15; // 无关键词时给中立基础分
  }

  const mentalTags = gene.mentalTags.map((tag) => tag.toLowerCase());
  const inputKeywords = keywords.map((k) => k.toLowerCase());

  const hitCount = inputKeywords.filter((keyword) =>
    mentalTags.some((tag) => tag.includes(keyword) || keyword.includes(tag))
  ).length;

  const ratio = hitCount / inputKeywords.length;
  return Math.round(ratio * 30);
}

/** 客户类型偏好加成（上限10分） */
function calcTypePreferenceBonus(gene: SpeciesGene, typePreferences: string[]): number {
  if (!typePreferences || typePreferences.length === 0) {
    return 0;
  }

  const speciesType = detectSpeciesType(gene.speciesName);
  if (typePreferences.includes(speciesType)) {
    return 10;
  }
  return 0;
}

/** 简易物种类型识别 */
function detectSpeciesType(speciesName: string): string {
  if (/(deer|rabbit|bear|owl|fox|cat|dog)/i.test(speciesName)) return 'animal';
  if (/(fairy|spirit|elf)/i.test(speciesName)) return 'fairy';
  if (/(robot|mecha|android)/i.test(speciesName)) return 'character';
  return 'character';
}

/** Fallback 兜底机制：按行业返回默认物种 */
function getFallbackSpecies(industry: IndustryCategory): SpeciesScoringResult {
  const fallbackMap: Record<IndustryCategory, string> = {
    [IndustryCategory.BEAUTY]: 'soft_rabbit',
    [IndustryCategory.FOOD_BEVERAGE]: 'cute_bear',
    [IndustryCategory.EDUCATION_TRAINING]: 'wise_owl',
    [IndustryCategory.TECHNOLOGY_IT]: 'tech_fox',
    [IndustryCategory.HEALTHCARE_MEDICAL]: 'soft_rabbit',
    [IndustryCategory.MATERNAL_CHILD]: 'cute_bear',
    [IndustryCategory.RETAIL]: 'cute_bear',
    [IndustryCategory.CULTURAL_CREATIVE]: 'flower_fairy',
    [IndustryCategory.FINANCIAL_SERVICE]: 'wise_owl',
  };

  const fallbackId = fallbackMap[industry] || 'cute_bear';
  const gene = SPECIES_GENE_POOL[fallbackId];

  return {
    speciesId: fallbackId,
    speciesName: gene.speciesName,
    speciesNameCn: gene.speciesNameCn,
    totalScore: 60,
    confidence: 0.6,
    dimensionScores: {
      industry: 20,
      archetype: 15,
      keywords: 15,
      preferenceBonus: 10,
    },
  };
}

// ==========================================
// 五、分行业负面词体系
// ==========================================

/** 通用基础负面词（所有场景必带） */
const COMMON_NEGATIVE_PROMPT = [
  'nsfw',
  'naked',
  'violent',
  'bloody',
  'pornographic',
  'offensive',
  'low quality',
  'blurry',
  'pixelated',
  'distorted',
  'deformed',
  'bad anatomy',
  'extra limbs',
  'missing fingers',
  'mutated',
  'ugly',
  'text',
  'watermark',
  'logo',
  'signature',
  'username',
  'frame',
  'border',
  'extra objects',
  'cropped',
  'out of frame',
].join(', ');

/** 分行业专属负面词 */
const INDUSTRY_NEGATIVE_MAP: Record<IndustryCategory, string> = {
  [IndustryCategory.BEAUTY]: [
    'harsh colors',
    'sharp edges',
    'rough texture',
    'masculine features',
    'medical instruments',
    'wounds',
    'acne',
    'scars',
    'heavy makeup',
    'hard lighting',
    'glaring',
  ].join(', '),

  [IndustryCategory.FOOD_BEVERAGE]: [
    'rotten',
    'moldy',
    'dirty',
    'disgusting',
    'uncooked',
    'raw meat',
    'garbage',
    'insects',
    'stale',
    'burnt',
    'greasy',
  ].join(', '),

  [IndustryCategory.EDUCATION_TRAINING]: [
    'scary',
    'fierce',
    'aggressive',
    'sharp teeth',
    'weapons',
    'dark atmosphere',
    'gloomy',
  ].join(', '),

  [IndustryCategory.TECHNOLOGY_IT]: [
    'retro',
    'vintage',
    'old-fashioned',
    'bulky',
    'messy wires',
    'rusty',
    'analog',
    'paper documents',
  ].join(', '),

  [IndustryCategory.HEALTHCARE_MEDICAL]: [
    'bloody',
    'wounds',
    'needles',
    'syringes',
    'sick appearance',
    'pale skin',
    'bandages',
    'surgical tools',
  ].join(', '),

  [IndustryCategory.MATERNAL_CHILD]: [
    'scary',
    'sharp',
    'dark colors',
    'fierce expression',
    'rough surface',
    'hard edges',
    'gloomy atmosphere',
  ].join(', '),

  [IndustryCategory.RETAIL]: [
    'cheap texture',
    'plastic look',
    'messy background',
    'tacky',
    'overcrowded',
    'noisy composition',
  ].join(', '),

  [IndustryCategory.CULTURAL_CREATIVE]: [
    'western style',
    'industrial',
    'tech heavy',
    'mechanical parts',
    'modern streetwear',
  ].join(', '),

  [IndustryCategory.FINANCIAL_SERVICE]: [
    'cartoon exaggeration',
    'chibi',
    'silly expression',
    'cheap texture',
    'plastic',
    'gimmicky',
  ].join(', '),
};

/** 分风格负面词 */
const STYLE_NEGATIVE_MAP: Record<StyleTier, string> = {
  [StyleTier.SOFT_HEALING]: [
    'flat 2d',
    'vector art',
    'chibi',
    'cartoon exaggeration',
    'hard edges',
    'sharp lines',
    'high contrast',
  ].join(', '),

  [StyleTier.PIXAR_CARTOON]: [
    'realistic',
    'photorealistic',
    'photo',
    'human face',
    'live action',
    'complex realistic details',
  ].join(', '),

  [StyleTier.PREMIUM_LUXURY]: [
    'cartoon',
    'chibi',
    'cute exaggeration',
    'cheap plastic texture',
    'matte dull finish',
    'tacky decorations',
  ].join(', '),

  [StyleTier.FLAT_VECTOR]: [
    '3d render',
    'realistic',
    'photo',
    'depth of field',
    'shadows',
    'gradients',
    'lighting effects',
  ].join(', '),

  [StyleTier.CHINESE_AESTHETIC]: [
    'western style',
    'futuristic tech',
    'streetwear',
    'modern minimalist',
    'industrial',
  ].join(', '),
};

/** 场景化负面词扩展 */
export const SCENE_NEGATIVE_MAP: Record<string, string> = {
  storefront: 'distorted perspective, messy street, crowded people, blurry text',
  packaging: 'wrinkled box, damaged package, dirty surface, wrong size',
  social_media: 'extra icons, messy interface, crowded elements, watermark',
  membership_card: 'blurry text, distorted layout, cheap printing effect',
  interior_decor: 'messy room, cluttered space, bad perspective',
};

/**
 * 生成对应行业+风格的完整负面词
 * @param industry 行业
 * @param styleTier 风格档位
 * @param extraNegatives 额外追加的负面词
 */
export function buildNegativePrompt(
  industry: IndustryCategory,
  styleTier: StyleTier,
  extraNegatives: string[] = []
): string {
  const parts = [
    COMMON_NEGATIVE_PROMPT,
    INDUSTRY_NEGATIVE_MAP[industry] || '',
    STYLE_NEGATIVE_MAP[styleTier] || '',
    ...extraNegatives,
  ];

  return parts.filter(Boolean).join(', ');
}

// ==========================================
// 六、Prompt 分段拼装工具
// ==========================================

/**
 * 品牌色值转自然语言描述（分部位）
 * @param brandColors 品牌色值对象
 */
export function translateBrandColors(brandColors: {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
}): string {
  const colorNameMap: Record<string, string> = {
    '#E8576C': 'soft rose pink',
    '#9B72CF': 'lavender purple',
    '#F0D5A8': 'champagne gold',
    '#FFF9F5': 'creamy off-white',
    '#D4919E': 'rose gold pink',
  };

  const bodyBase = colorNameMap[brandColors.background || ''] || 'soft light color';
  const detailColor = colorNameMap[brandColors.primary] || 'brand primary color';
  const accentColor = colorNameMap[brandColors.accent || ''] || 'brand accent color';

  return [
    `body main color: ${bodyBase} with matte texture`,
    `facial features and details: ${detailColor}`,
    `decorative accents: ${accentColor} metallic texture`,
    `brand color scheme: ${brandColors.primary}, ${brandColors.secondary || ''}, ${brandColors.accent || ''}`,
  ].join(', ');
}

/** 获取视角描述 */
function getViewDescription(view: ViewType): string {
  const viewMap: Record<ViewType, string> = {
    [ViewType.FRONT]: 'full body front view, standing upright, looking at viewer',
    [ViewType.SIDE]: 'full body right side view profile, standing upright',
    [ViewType.BACK]: 'full body back view, standing upright, back of head visible',
    [ViewType.BUST]: 'bust shot, close-up portrait, centered face',
  };
  return viewMap[view];
}

/**
 * 分段式 Prompt 拼装主函数
 * 固定段全程复用，仅替换表情、视角、场景三个可变段
 * @param profile 公仔配置文件
 * @param view 视角
 * @param expression 表情
 * @param sceneContext 场景描述（可选）
 */
export function buildImagePromptBySegments(
  profile: MascotProfileV2,
  view: ViewType,
  expression: ExpressionType,
  sceneContext?: string
): string {
  const style = STYLE_TIER_CONFIG[profile.styleTier];
  const poseDesc = POSE_TEMPLATE_MAP[profile.visualDetails.poseType].poseDescription;
  const exprDesc = EXPRESSION_TEMPLATE_MAP[expression].expressionDescription;
  const viewDesc = getViewDescription(view);

  const baseQuality =
    'premium quality, highly detailed, professional brand mascot, white background, centered composition';
  const consistencyConstraint =
    'strict character consistency, unified color scheme, complete character design';

  const segments = [
    baseQuality,
    style.renderKeywords,
    style.lightingKeywords,
    profile.coreAnchors.species,
    profile.coreAnchors.bodyColorDesc,
    profile.coreAnchors.keyAccessories.join(', '),
    poseDesc,
    exprDesc,
    viewDesc,
    sceneContext || '',
    consistencyConstraint,
  ];

  return segments.filter(Boolean).join(', ');
}

/**
 * 推导主题标签（辅助函数）
 * @param personality 品牌性格关键词
 * @param industry 行业
 */
export function deriveThemeTags(
  personality: string[],
  industry: IndustryCategory
): ThemeTag[] {
  const tags: ThemeTag[] = [];
  const keywordStr = personality.join(',').toLowerCase();

  if (/疗愈|温柔|舒缓|治愈/.test(keywordStr) || industry === IndustryCategory.HEALTHCARE_MEDICAL) {
    tags.push(ThemeTag.HEALING);
  }
  if (/东方|中式|国风|传统/.test(keywordStr) || industry === IndustryCategory.CULTURAL_CREATIVE) {
    tags.push(ThemeTag.ORIENTAL);
  }
  if (/科技|未来|智能|创新/.test(keywordStr) || industry === IndustryCategory.TECHNOLOGY_IT) {
    tags.push(ThemeTag.TECH_FUTURE);
  }
  if (/可爱|活泼|萌|童趣/.test(keywordStr) || industry === IndustryCategory.MATERNAL_CHILD) {
    tags.push(ThemeTag.CUTE_PLAYFUL);
  }
  if (/美味|好吃|食欲|美食/.test(keywordStr) || industry === IndustryCategory.FOOD_BEVERAGE) {
    tags.push(ThemeTag.DELICIOUS_FOOD);
  }
  if (/专业|严谨|高端|可靠/.test(keywordStr) || industry === IndustryCategory.FINANCIAL_SERVICE) {
    tags.push(ThemeTag.PROFESSIONAL_RIGOROUS);
  }

  return tags.length > 0 ? tags : [ThemeTag.CUTE_PLAYFUL];
}

/**
 * 匹配最优姿态（辅助函数）
 */
export function matchBestPose(themeTags: ThemeTag[]): PoseTemplate {
  const poseList = Object.values(POSE_TEMPLATE_MAP);
  const scored = poseList.map((pose) => {
    const hitCount = pose.adaptedThemes.filter((t) => themeTags.includes(t)).length;
    return { pose, score: hitCount };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].pose;
}

/**
 * 匹配默认表情（辅助函数）
 */
export function matchDefaultExpression(themeTags: ThemeTag[]): ExpressionTemplate {
  if (themeTags.includes(ThemeTag.HEALING)) {
    return EXPRESSION_TEMPLATE_MAP[ExpressionType.HEALING];
  }
  if (themeTags.includes(ThemeTag.PROFESSIONAL_RIGOROUS)) {
    return EXPRESSION_TEMPLATE_MAP[ExpressionType.SMILE];
  }
  if (themeTags.includes(ThemeTag.TECH_FUTURE)) {
    return EXPRESSION_TEMPLATE_MAP[ExpressionType.FOCUSED];
  }
  return EXPRESSION_TEMPLATE_MAP[ExpressionType.SMILE];
}

/**
 * 匹配风格档位（辅助函数）
 */
export function matchStyleTier(
  industry: IndustryCategory,
  themeTags: ThemeTag[],
  provider: string = 'ark-seedream'
): StyleTier {
  // 优先按主题标签强匹配
  if (themeTags.includes(ThemeTag.HEALING)) return StyleTier.SOFT_HEALING;
  if (themeTags.includes(ThemeTag.ORIENTAL)) return StyleTier.CHINESE_AESTHETIC;
  if (themeTags.includes(ThemeTag.TECH_FUTURE)) return StyleTier.FLAT_VECTOR;
  if (themeTags.includes(ThemeTag.CUTE_PLAYFUL)) return StyleTier.PIXAR_CARTOON;

  // 按行业兜底
  const industryStyleMap: Record<IndustryCategory, StyleTier> = {
    [IndustryCategory.BEAUTY]: StyleTier.SOFT_HEALING,
    [IndustryCategory.FOOD_BEVERAGE]: StyleTier.PIXAR_CARTOON,
    [IndustryCategory.EDUCATION_TRAINING]: StyleTier.PIXAR_CARTOON,
    [IndustryCategory.TECHNOLOGY_IT]: StyleTier.FLAT_VECTOR,
    [IndustryCategory.HEALTHCARE_MEDICAL]: StyleTier.SOFT_HEALING,
    [IndustryCategory.MATERNAL_CHILD]: StyleTier.PIXAR_CARTOON,
    [IndustryCategory.RETAIL]: StyleTier.PREMIUM_LUXURY,
    [IndustryCategory.CULTURAL_CREATIVE]: StyleTier.CHINESE_AESTHETIC,
    [IndustryCategory.FINANCIAL_SERVICE]: StyleTier.PREMIUM_LUXURY,
  };

  return industryStyleMap[industry] || StyleTier.PIXAR_CARTOON;
}

/**
 * 抽取主题符号（辅助函数）
 */
export function pickDeterministicSymbols(
  themeTags: ThemeTag[],
  brandSeed: string = '',
  count: number = 2
): string[] {
  const allSymbols: string[] = [];
  themeTags.forEach((tag) => {
    const lib = THEME_SYMBOL_LIBRARY[tag];
    if (lib) {
      allSymbols.push(...lib.symbolDescriptions);
    }
  });

  // 数量不够或刚好，直接返回
  if (allSymbols.length <= count) return [...allSymbols];

  // 确定性选择：用品牌名哈希算起始位置，同一品牌永远选同一组
  let hash = 0;
  for (let i = 0; i < brandSeed.length; i++) {
    hash = ((hash << 5) - hash) + brandSeed.charCodeAt(i);
    hash |= 0;
  }
  const startIdx = Math.abs(hash) % allSymbols.length;

  // 从 startIdx 开始顺序取 count 个
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(allSymbols[(startIdx + i) % allSymbols.length]);
  }
  return result;
}
