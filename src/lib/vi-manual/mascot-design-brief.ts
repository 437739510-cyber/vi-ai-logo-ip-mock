/** 工单 075：把客户公仔偏好编译为可审查、可复用的四方向设计简报。纯函数，无 I/O。 */
import { MASCOT_EMOTION_NAMES, MASCOT_RATIO_RULES, resolveMascotRatioRule } from "./mascot-assets";

export type MascotRoleType = "character" | "animal" | "food" | "plant" | "object" | "abstract" | "hybrid" | "neutral";

export interface MascotDesignBriefInput {
  companyName?: string | null;
  industry?: string | null;
  brandPersonality?: string | string[] | null;
  brandProfile?: {
    brandToneKeywords?: string | string[] | null;
    visualStyleSuggestion?: string | null;
    colorPalette?: Array<{ name?: string | null; hex?: string | null } | string> | null;
  } | null;
  mascotTypePref?: string | string[] | null;
  mascotStylePref?: string | string[] | null;
  mascotPersonalityPref?: string | string[] | null;
  mascotUsageScenes?: string | string[] | null;
  mascotColorHint?: string | null;
  mascotRefIdea?: string | null;
  mascotSceneCount?: number | string | null;
}

export interface MascotSampleDirection {
  id: "a" | "b" | "c" | "d";
  label: string;
  desc: string;
  prompt: string;
}

export interface MascotDesignBrief {
  companyName: string;
  industry: string;
  roleType: MascotRoleType;
  requestedRoleTypes: MascotRoleType[];
  identity: string;
  identityRestrictions: string[];
  visualStyle: string;
  personality: string[];
  colors: string[];
  usageScenes: string[];
  referenceIntent: string;
  sceneCount: number;
  sampleDirections: MascotSampleDirection[];
  sources: {
    roleType: "customer" | "reference" | "fallback";
    visualStyle: "customer" | "brand_profile" | "industry" | "fallback";
    personality: "customer" | "brand_profile" | "brand" | "industry" | "fallback";
    colors: "customer" | "brand_profile" | "industry" | "fallback";
    usageScenes: "customer" | "industry" | "fallback";
  };
}

export interface MascotFullAssetPlanInput {
  brief: MascotDesignBrief;
  styleAnchor?: string | null;
  characterSpec?: string | null;
  /** 工单 086-R4：公仔比例规则（standard | q），默认 standard。 */
  ratioRule?: "standard" | "q" | string | null;
}

export interface MascotFullAssetPrompt {
  name: string;
  prompt: string;
  source: "contract" | "customer" | "industry" | "fallback";
}

export interface MascotFullAssetPlan {
  views: MascotFullAssetPrompt[];
  emotions: MascotFullAssetPrompt[];
  scenes: MascotFullAssetPrompt[];
  colorPalette: Array<{ name: string; hex: string }>;
  counts: { views: number; emotions: number; scenes: number; total: number; minimumScenes: number };
  sources: {
    identity: "character_spec" | "brief";
    styleAnchor: "selected_sample" | "brief";
    colors: MascotDesignBrief["sources"]["colors"];
    scenes: Array<{ name: string; source: "customer" | "industry" | "fallback" }>;
    identityRestrictions: string[];
  };
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
    : fallback;
}

function toList(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/[,，、;；|]/) : []);
  return [...new Set(raw.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8);
}

function normalizeRoleType(value: string): MascotRoleType | null {
  const normalized = value.toLowerCase();
  if (/^(character|human|person)$|人物|人类/.test(normalized)) return "character";
  if (/^animal$|动物/.test(normalized)) return "animal";
  if (/^food$|食物|食品/.test(normalized)) return "food";
  if (/^plant$|植物/.test(normalized)) return "plant";
  if (/^(object|robot)$|物体|物件|机器人/.test(normalized)) return "object";
  if (/^abstract$|抽象/.test(normalized)) return "abstract";
  if (/^hybrid$|混合/.test(normalized)) return "hybrid";
  return null;
}

function industryFamily(industry: string): "food" | "tech" | "beauty" | "retail" | "general" {
  const value = industry.toLowerCase();
  if (/餐|饮|茶|咖啡|烘焙|food|restaurant|beverage/.test(value)) return "food";
  if (/科技|软件|互联网|数码|tech|software|digital/.test(value)) return "tech";
  if (/美业|美容|美甲|时尚|beauty|fashion|nail/.test(value)) return "beauty";
  if (/零售|商店|电商|retail|shop/.test(value)) return "retail";
  return "general";
}

function stripConflictingIdentityTerms(value: string, roleType: MascotRoleType): string {
  if (roleType === "character") {
    return value
      .replace(/deer[- ]?human|deer|antlers?|animal ears?|hybrid|鹿角|鹿耳|兽耳|鹿人|动物神人/gi, " ")
      .replace(/\s+/g, " ").trim();
  }
  if (["animal", "food", "plant", "object", "abstract"].includes(roleType)) {
    return value
      .replace(/adult human woman|adult woman|human goddess|goddess|female goddess|female (?:body|figure)|female|woman|rose gold|robe|女神|成年女性|女性体态|女人|女性|玫瑰金|长袍/gi, " ")
      .replace(/\s+/g, " ").trim();
  }
  return value;
}

function visualPalette(colors: string[]): Array<{ name: string; hex: string }> {
  const result: Array<{ name: string; hex: string }> = [];
  for (const color of colors) {
    const matches = color.match(/#[0-9a-f]{6}\b/gi) || [];
    for (const hex of matches) {
      const normalized = hex.toUpperCase();
      if (!result.some((item) => item.hex === normalized)) {
        result.push({ name: cleanText(color, normalized), hex: normalized });
      }
    }
  }
  return result;
}

function safeSceneDefaults(industry: string): string[] {
  const family = industryFamily(industry);
  if (family === "food") return [
    "restaurant storefront welcome", "takeaway meal packaging", "menu ordering counter",
    "membership service", "social media campaign", "delivery bag", "table service", "food festival booth",
  ];
  if (family === "tech") return [
    "app icon", "digital product interface", "conference display", "customer support screen",
    "product onboarding", "social media campaign", "smart device display", "technology exhibition booth",
  ];
  if (family === "beauty") return [
    "beauty storefront welcome", "product packaging", "membership card", "social media campaign",
    "appointment interface", "service guide", "retail display", "brand event backdrop",
  ];
  if (family === "retail") return [
    "retail storefront welcome", "product packaging", "membership service", "social media campaign",
    "shopping bag", "checkout display", "merchandise", "brand event booth",
  ];
  return [
    "brand storefront welcome", "product packaging", "membership service", "social media campaign",
    "digital product", "customer service guide", "merchandise", "brand event display",
  ];
}

function scenePromptDetail(scene: string, industry: string): string {
  const value = scene.toLowerCase();
  if (/store|shop|门店|店面|迎宾/.test(value)) return `full-body mascot welcoming customers at a ${industry} storefront with a blank signboard`;
  if (/pack|包装|礼盒|袋/.test(value)) return `mascot applied to industry-appropriate ${industry} product packaging`;
  if (/member|vip|会员/.test(value)) return "mascot used in a membership and customer-service touchpoint";
  if (/social|社媒|短视频|直播/.test(value)) return "mascot in a social media campaign and avatar composition";
  if (/app|digital|screen|界面|数字/.test(value)) return "mascot in a clean digital product interface and screen composition";
  if (/conference|exhibition|event|会议|展会|活动/.test(value)) return `mascot at a professional ${industry} event display`;
  if (/menu|order|菜单|点餐/.test(value)) return "mascot supporting a menu and ordering touchpoint";
  if (/delivery|外卖|配送/.test(value)) return "mascot applied to an industry-appropriate delivery touchpoint";
  return `mascot used in the requested brand scene: ${scene}`;
}

function cleanAnchor(value: string | null | undefined, roleType: MascotRoleType, allowSelected3d: boolean): string {
  const identitySafe = stripConflictingIdentityTerms(cleanText(value), roleType);
  if (allowSelected3d) return identitySafe;
  return identitySafe
    .replace(/3d\s+(?:pixar(?:[- ]inspired)?|cartoon|character|render|style)|pixar(?:[- ]inspired)?/gi, " ")
    .replace(/\s+/g, " ").trim();
}

/** 工单 076：由 075 简报编译三视图、8 表情和动态场景。纯函数，无 I/O。 */
export function buildMascotFullAssetPlan(input: MascotFullAssetPlanInput): MascotFullAssetPlan {
  const brief = input.brief;
  const ratio = resolveMascotRatioRule({ mascotRatio: input.ratioRule });
  const ratioText = MASCOT_RATIO_RULES[ratio.id].promptText;
  const rawStyleAnchor = cleanText(input.styleAnchor);
  const allowSelected3d = (brief.sources.visualStyle === "customer" && /3d|pixar/i.test(brief.visualStyle)) || /3d|pixar/i.test(rawStyleAnchor);
  const extractedSpec = cleanAnchor(input.characterSpec, brief.roleType, allowSelected3d);
  const selectedAnchor = cleanAnchor(rawStyleAnchor, brief.roleType, allowSelected3d);
  const identityAnchor = extractedSpec || brief.identity;
  const styleAnchor = selectedAnchor || brief.visualStyle;
  const paletteText = brief.colors.join(", ");
  const personalityText = brief.personality.join(", ");
  const shared = [
    `Brand mascot asset for ${brief.companyName}, ${brief.industry} industry.`,
    `Identity: ${brief.identity}.`,
    `Character consistency anchor: ${identityAnchor}.`,
    `Selected direction: ${styleAnchor}.`,
    `Visual style: ${brief.visualStyle}.`,
    `Personality: ${personalityText}.`,
    `Color system: ${paletteText}.`,
    `Proportions: ${ratioText}.`,
    "Keep the same identity, silhouette, facial design, materials, proportions and colors across the full asset set.",
  ].join(" ");

  const views: MascotFullAssetPrompt[] = [
    { name: "front", source: "contract", prompt: `${shared} Orthographic front view facing camera, neutral full-body stance, white background, clean studio lighting, no text, no watermark.` },
    { name: "side", source: "contract", prompt: `${shared} Orthographic side profile view, neutral full-body stance, white background, clean studio lighting, no text, no watermark.` },
    { name: "back", source: "contract", prompt: `${shared} Orthographic back view seen from behind, full body, preserve rear silhouette and materials, white background, clean studio lighting, no text, no watermark.` },
  ];
  // 工单 086-R4：表情库统一 6 个，名称/顺序来自 MASCOT_EMOTION_NAMES（数据驱动）。
  const EMOTION_DIRECTION: Record<(typeof MASCOT_EMOTION_NAMES)[number], string> = {
    微笑: "a warm smile expressing the brand personality",
    开心: "a confident happy expression",
    安心: "a calm and reassuring expression",
    引导: "a clear guiding gesture toward a customer touchpoint",
    俏皮: "a light distinctive expression appropriate to the stated personality",
    专注: "a focused and attentive expression",
  };
  const emotionDirections = MASCOT_EMOTION_NAMES.map((name) => [name, EMOTION_DIRECTION[name]] as const);
  const emotions: MascotFullAssetPrompt[] = emotionDirections.map(([name, direction]) => ({
    name,
    source: "contract",
    prompt: `${shared} Emotion asset: ${direction}; personality cues: ${personalityText}. Full-body front view, white background, clean studio lighting, no text, no watermark.`,
  }));

  // 工单 083：IP 场景固定 4 张，一页 2×2 完整展示；不再按客户选择生成 5/6/8/12/16 张。
  const targetSceneCount = 4;
  const requested = [...new Set(brief.usageScenes.map((scene) => cleanText(scene)).filter(Boolean))];
  const defaults = safeSceneDefaults(brief.industry);
  const selectedScenes: Array<{ name: string; source: "customer" | "industry" | "fallback" }> = [];
  for (const scene of requested) {
    if (selectedScenes.length >= targetSceneCount) break;
    selectedScenes.push({ name: scene, source: brief.sources.usageScenes });
  }
  for (const scene of defaults) {
    if (selectedScenes.length >= targetSceneCount) break;
    if (!selectedScenes.some((item) => item.name.toLowerCase() === scene.toLowerCase())) {
      selectedScenes.push({ name: scene, source: industryFamily(brief.industry) === "general" ? "fallback" : "industry" });
    }
  }
  while (selectedScenes.length < targetSceneCount) {
    const number = selectedScenes.length + 1;
    selectedScenes.push({ name: `brand touchpoint ${number}`, source: "fallback" });
  }
  const scenes: MascotFullAssetPrompt[] = selectedScenes.map(({ name, source }) => ({
    name,
    source,
    prompt: `${shared} Selected touchpoint: ${name}. Application scene: ${scenePromptDetail(name, brief.industry)}. Show a credible industry-specific environment and material, clear mascot visibility, coherent brand colors, no text, no watermark.`,
  }));
  const counts = {
    views: views.length,
    emotions: emotions.length,
    scenes: scenes.length,
    total: views.length + emotions.length + scenes.length,
    minimumScenes: 4,
  };

  return {
    views,
    emotions,
    scenes,
    colorPalette: visualPalette(brief.colors),
    counts,
    sources: {
      identity: extractedSpec ? "character_spec" : "brief",
      styleAnchor: selectedAnchor ? "selected_sample" : "brief",
      colors: brief.sources.colors,
      scenes: selectedScenes,
      identityRestrictions: [...brief.identityRestrictions],
    },
  };
}

function safeReferenceForType(reference: string, roleType: MascotRoleType): string {
  if (!reference) return "customer supplied no specific reference image concept";
  return stripConflictingIdentityTerms(reference, roleType) || `${roleType} mascot reference`;
}

function paletteWords(input: MascotDesignBriefInput): string[] {
  const palette = input.brandProfile?.colorPalette || [];
  return palette.map((item) => {
    if (typeof item === "string") return cleanText(item);
    return [cleanText(item?.name), cleanText(item?.hex)].filter(Boolean).join(" ");
  }).filter(Boolean).slice(0, 5);
}

function industryDefaults(family: ReturnType<typeof industryFamily>): {
  style: string;
  personality: string[];
  colors: string[];
  scenes: string[];
} {
  if (family === "food") return {
    style: "friendly commercial character design with appetizing, clear shapes",
    personality: ["warm", "approachable", "energetic"],
    colors: ["warm food-inspired colors", "one clear brand accent"],
    scenes: ["storefront", "packaging", "social media"],
  };
  if (family === "tech") return {
    style: "tech_sleek professional design with precise surfaces and clean geometry",
    personality: ["professional", "intelligent", "reliable"],
    colors: ["cool blue", "neutral silver", "one high-contrast accent"],
    scenes: ["app icon", "digital product", "conference display"],
  };
  if (family === "beauty") return {
    style: "refined contemporary design with clean premium detailing",
    personality: ["elegant", "confident", "welcoming"],
    colors: ["neutral premium base", "customer brand accent"],
    scenes: ["storefront", "membership card", "social media"],
  };
  if (family === "retail") return {
    style: "clear modern retail character design with a memorable silhouette",
    personality: ["friendly", "confident", "recognizable"],
    colors: ["balanced neutral base", "one retail accent"],
    scenes: ["storefront", "packaging", "merchandise"],
  };
  return {
    style: "neutral industry-adaptable commercial mascot design",
    personality: ["approachable", "professional", "distinctive"],
    colors: ["balanced neutral base", "one restrained brand accent"],
    scenes: ["brand communication", "packaging", "digital media"],
  };
}

function explicitStyle(styles: string[]): string {
  const mapped: Record<string, string> = {
    pixar_3d: "Pixar-inspired polished stylized 3D cartoon character design with commercial-grade materials",
    flat_cute: "friendly flat illustration with simple readable shapes",
    chinese_trendy: "contemporary Chinese-inspired illustration with controlled decorative detail",
    minimalist: "minimalist modern design with a clean geometric silhouette",
    tech_sleek: "tech_sleek professional design with precise surfaces, clean geometry and restrained details",
  };
  return styles.map((style) => mapped[style] || cleanText(style)).filter(Boolean).join("; ");
}

function roleIdentity(roleType: MascotRoleType, goddessIntent: boolean, industry: string): { identity: string; restrictions: string[] } {
  if (roleType === "character" && goddessIntent) {
    return {
      identity: "adult human woman, fully human goddess character, mature natural human anatomy, 人类成年女性",
      restrictions: ["non-human anatomy", "horn-like appendages", "external creature ears", "mixed-species identity"],
    };
  }
  if (roleType === "character") return {
    identity: "distinctive adult human brand character with natural human anatomy",
    restrictions: ["non-human anatomy", "mixed-species identity", "childlike proportions"],
  };
  if (roleType === "animal") return { identity: `recognizable animal brand mascot adapted to the ${industry} industry`, restrictions: ["human goddess identity", "human fashion skeleton"] };
  if (roleType === "food") return { identity: `recognizable food-inspired brand mascot adapted to the ${industry} industry`, restrictions: ["human goddess identity", "unrelated animal identity"] };
  if (roleType === "plant") return { identity: `recognizable plant-inspired brand mascot adapted to the ${industry} industry`, restrictions: ["human goddess identity", "unrelated animal identity"] };
  if (roleType === "object") return { identity: `recognizable object-based brand mascot adapted to the ${industry} industry`, restrictions: ["human goddess identity", "human fashion skeleton"] };
  if (roleType === "abstract") return { identity: `abstract graphic brand mascot adapted to the ${industry} industry`, restrictions: ["human goddess identity", "literal character anatomy"] };
  if (roleType === "hybrid") return { identity: `coherent customer-requested hybrid brand mascot adapted to the ${industry} industry`, restrictions: ["unexplained mixed anatomy", "inconsistent identity"] };
  return { identity: `neutral industry-adaptable brand mascot for the ${industry} industry`, restrictions: ["customer-specific identity assumptions", "unrelated industry stereotypes"] };
}

export function buildMascotDesignBrief(input: MascotDesignBriefInput): MascotDesignBrief {
  const companyName = cleanText(input.companyName, "Brand") || "Brand";
  const industry = cleanText(input.industry, "general") || "general";
  const family = industryFamily(industry);
  const defaults = industryDefaults(family);
  const typePrefs = toList(input.mascotTypePref);
  const referenceRaw = cleanText(input.mascotRefIdea);
  const goddessIntent = /goddess|女神/i.test(`${typePrefs.join(" ")} ${referenceRaw}`);
  const requestedRoleTypes = [...new Set(typePrefs.map(normalizeRoleType).filter((value): value is MascotRoleType => !!value))];
  const explicitRole = requestedRoleTypes[0];
  const roleType: MascotRoleType = explicitRole || (goddessIntent ? "character" : "neutral");
  const identityResult = roleIdentity(roleType, roleType === "character" && goddessIntent, industry);

  const styles = toList(input.mascotStylePref);
  const brandStyle = cleanText(input.brandProfile?.visualStyleSuggestion);
  const rawVisualStyle = styles.length ? explicitStyle(styles) : (brandStyle || defaults.style);
  const sanitizedVisualStyle = stripConflictingIdentityTerms(rawVisualStyle, roleType);
  const visualStyle = sanitizedVisualStyle || defaults.style;
  const requestedStyleSource: MascotDesignBrief["sources"]["visualStyle"] = styles.length
    ? "customer"
    : brandStyle ? "brand_profile" : family === "general" ? "fallback" : "industry";
  const styleSource: MascotDesignBrief["sources"]["visualStyle"] = sanitizedVisualStyle
    ? requestedStyleSource : family === "general" ? "fallback" : "industry";

  const customerPersonality = toList(input.mascotPersonalityPref);
  const profilePersonality = toList(input.brandProfile?.brandToneKeywords);
  const brandPersonality = toList(input.brandPersonality);
  const selectedPersonality = (customerPersonality.length ? customerPersonality
    : profilePersonality.length ? profilePersonality
      : brandPersonality.length ? brandPersonality : defaults.personality).slice(0, 5);
  const personality = selectedPersonality
    .map((item) => stripConflictingIdentityTerms(item, roleType))
    .filter(Boolean);
  const requestedPersonalitySource: MascotDesignBrief["sources"]["personality"] = customerPersonality.length
    ? "customer" : profilePersonality.length ? "brand_profile" : brandPersonality.length
      ? "brand" : family === "general" ? "fallback" : "industry";
  const personalitySource: MascotDesignBrief["sources"]["personality"] = personality.length
    ? requestedPersonalitySource : family === "general" ? "fallback" : "industry";
  if (personality.length === 0) personality.push(...defaults.personality);

  const customerColors = cleanText(input.mascotColorHint);
  const profileColors = paletteWords(input);
  const colors = customerColors ? [customerColors] : profileColors.length ? profileColors : defaults.colors;
  const colorSource: MascotDesignBrief["sources"]["colors"] = customerColors
    ? "customer" : profileColors.length ? "brand_profile" : family === "general" ? "fallback" : "industry";

  const customerScenes = toList(input.mascotUsageScenes);
  const usageScenes = customerScenes.length ? customerScenes : defaults.scenes;
  const sceneSource: MascotDesignBrief["sources"]["usageScenes"] = customerScenes.length
    ? "customer" : family === "general" ? "fallback" : "industry";
  // 工单 083：客户不再选择 IP 场景图数量，平台固定 4 张；旧订单旧值一律归一化为 4。
  const sceneCount = 4;
  const referenceIntent = safeReferenceForType(referenceRaw, roleType);

  const sharedPrompt = [
    `Brand mascot concept for ${companyName}, ${industry} industry.`,
    `Identity: ${identityResult.identity}.`,
    `Visual style: ${visualStyle}.`,
    `Personality: ${personality.join(", ")}.`,
    `Color system: ${colors.join(", ")}.`,
    `Intended usage: ${usageScenes.join(", ")}.`,
    `Reference intent: ${referenceIntent}.`,
    "Full-body design, clean white background, clear silhouette, coherent materials, commercial-grade presentation, no text, no watermark.",
  ].join(" ");
  const variants: Array<Pick<MascotSampleDirection, "id" | "label" | "desc"> & { direction: string }> = [
    { id: "a", label: "标准识别款", desc: "正面平衡站姿 · 稳定清晰", direction: "front-facing balanced stance, centered composition, calm and trustworthy presence" },
    { id: "b", label: "动态传播款", desc: "轻动态姿态 · 更强传播感", direction: "subtle dynamic pose, three-quarter composition, energetic and confident presence" },
    { id: "c", label: "亲和互动款", desc: "开放手势 · 亲和交流", direction: "open welcoming gesture, medium-full composition, approachable and warm presence" },
    { id: "d", label: "品牌标志款", desc: "标志性姿态 · 强轮廓记忆", direction: "iconic signature pose, strong silhouette composition, distinctive and professional presence" },
  ];
  const sampleDirections = variants.map(({ direction, ...variant }) => ({
    ...variant,
    prompt: `${sharedPrompt} Direction variant: ${direction}.`,
  }));

  return {
    companyName,
    industry,
    roleType,
    requestedRoleTypes,
    identity: identityResult.identity,
    identityRestrictions: identityResult.restrictions,
    visualStyle,
    personality,
    colors,
    usageScenes,
    referenceIntent,
    sceneCount,
    sampleDirections,
    sources: {
      roleType: explicitRole ? "customer" : goddessIntent ? "reference" : "fallback",
      visualStyle: styleSource,
      personality: personalitySource,
      colors: colorSource,
      usageScenes: sceneSource,
    },
  };
}
