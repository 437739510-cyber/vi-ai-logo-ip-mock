/**
 * DeepSeek DNA Extractor
 *
 * Step 1 of DNA workflow: extract brand DNA (logo_pure_prompt + scene_atlas) from brand data.
 * Also provides fillScenePrompts for Step 3 string replacement.
 *
 * V60: Added generateVIPrompts — Doubao-enhanced System Prompt with 4 Logo types, 8 scene categories,
 * industry-specific style rules, color constraint enforcement, and response_format: json_object.
 *
 * Uses guardedDeepSeekCall (budget tracking + usage logging) like plan-layout-engine.ts.
 */

import { guardedDeepSeekCall } from "@/lib/core/billing/deepseek-guard";
import type { SceneAtlasEntry } from "./scene-prompt-filler";

// ── Types ──────────────────────────────────────────────

export interface BrandDNAInput {
  brandName: string;
  industry: string;
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  brandColors?: {
    primary: { hex: string; name?: string };
    secondary: { hex: string; name?: string };
    accent: { hex: string; name?: string };
  };
  logoDescription?: string;
  logoStyle?: string;
  /** Industry VI application modules for dynamic scene template selection */
  sceneModules?: string[];
  /** English visual keywords for ComfyUI prompt styling */
  visualKeywords?: string[];
}

// ── Doubao VI Prompt Engine types (from doubao_deepseek_pipeline.py) ──

export interface LogoPromptEntry {
  id: string;
  name: string;
  positive: string;
  negative: string;
  color_main: string;
  color_accent: string;
}

export interface ScenePromptEntry {
  id: string;
  vi_module: string;
  name: string;
  positive: string;
  negative: string;
  controlnet: string[];
  priority: "required" | "optional";
}

export interface VIPromptsResult {
  success: boolean;
  brandName: string;
  industry: string;
  brand_tags: string[];
  logo_prompts: LogoPromptEntry[];
  scene_prompts: ScenePromptEntry[];
  // backward-compat for existing pipeline
  logo_pure_prompt: LogoPurePrompt;
  scene_atlas: Record<string, SceneAtlasEntry>;
  error?: string;
}

// ── Legacy types ──────────────────────────────────────

export interface LogoPurePrompt {
  positive_en: string;
  negative_en: string;
}



export interface BrandDNAResult {
  success: boolean;
  brandName: string;
  industry: string;
  logo_pure_prompt: LogoPurePrompt | null;
  scene_atlas: Record<string, SceneAtlasEntry> | null;
  error?: string;
}

// ── Default scene templates (fallback) ─────────────────

const DEFAULT_SCENE_TEMPLATES: Record<string, SceneAtlasEntry> = {
  "手提袋": {
    template_en: "{{DNA}} embossed as a hot-stamped gold foil emblem on a natural kraft paper tote bag, sitting on a wooden counter, warm sunlight, shallow depth of field, photorealistic, 8k."
  },
  "招牌": {
    template_en: "{{DNA}} designed as a backlit illuminated acrylic sign on a traditional brick wall storefront, dusk atmosphere, neon glow reflecting on wet pavement, cinematic, 8k."
  },
  "工服": {
    template_en: "{{DNA}} meticulously embroidered as a patch on the left chest of a simple linen apron, studio lighting, fabric texture close-up, 8k."
  },
  "名片": {
    template_en: "{{DNA}} debossed with subtle letterpress texture on premium cotton paper business card, angled on a marble surface, soft natural lighting, macro shot, 8k."
  },
  "纸杯": {
    template_en: "{{DNA}} printed as a wraparound design on a kraft paper coffee cup, held by a barista in warm cafe lighting, shallow depth of field, photorealistic, 8k."
  }
};

// ── Legacy system prompt for DeepSeek ─────────────────

function buildDNASystemPrompt(sceneModules?: string[]): string {
  return `You are a senior brand VI designer and AI prompt engineer.
Your task is to analyze a brand and produce two outputs in strict JSON format.

## Output 1: logo_pure_prompt
A pair of English prompts (positive + negative) for generating a clean, standalone logo on a white background.
- positive_en: 25-35 words describing ONLY the logo shape, visual elements, and colors. Do NOT include any style words — no flat, no vector, no 3d, no photorealistic, no physical, no material. Pure design description. Use concrete visual terms (silhouette, emblem, geometric, line-art, etc.). Do NOT mention scenes or materials — this is for a style-neutral logo mark only (no style adjectives).
- negative_en: standard quality-control terms (deformed, blurry, low quality, distorted, 3d render, gradient, shadow, watermark, extra limbs, bad anatomy).

## Output 2: scene_atlas
A set of scene templates (5 items). Choose concrete physical items that best represent the brands typical VI application modules listed below. Each template MUST contain the placeholder {{DNA}} exactly where the logo description should be inserted.
- template_en: full scene prompt with {{DNA}} as the logo subject
- Describe specific materials chosen for this industry (e.g. restaurant→menu cover, retail→shopping bag, beauty→product box)
- Use photorealistic, 8k, cinematic style
- ALL fields must be in English only

The 5 scene items should be chosen from or inspired by these VI application modules: ${sceneModules ? sceneModules.join(", ") : "手提袋, 招牌, 工服, 名片, 纸杯"}

## Output format (JSON only, no markdown wrapping):
{
  "logo_pure_prompt": {
    "positive_en": "...",
    "negative_en": "..."
  },
  "scene_atlas": {
    "物品名称1": {"template_en": "{{DNA}} ..."},
    "物品名称2": {"template_en": "{{DNA}} ..."},
    "物品名称3": {"template_en": "{{DNA}} ..."},
    "物品名称4": {"template_en": "{{DNA}} ..."},
    "物品名称5": {"template_en": "{{DNA}} ..."}
  }
}`;
}

function buildDNAUserPrompt(input: BrandDNAInput): string {
  const priHex = input.brandColors?.primary?.hex || "#C23B22";
  const secHex = input.brandColors?.secondary?.hex || "#8B4513";
  const accHex = input.brandColors?.accent?.hex || "#D4A574";

  let prompt = `Analyze the following brand and extract its visual DNA:\n\n`;
  prompt += `Brand Name: ${input.brandName}\n`;
  prompt += `Industry: ${input.industry}\n`;
  if (input.brandVision) prompt += `Brand Vision: ${input.brandVision}\n`;
  if (input.coreValues) prompt += `Core Values: ${input.coreValues}\n`;
  if (input.targetMarket) prompt += `Target Market: ${input.targetMarket}\n`;
  prompt += `Brand Colors: primary ${priHex}, secondary ${secHex}, accent ${accHex}\n`;
  if (input.logoDescription) prompt += `Logo Description: ${input.logoDescription}\n`;
  if (input.logoStyle) prompt += `Logo Style: ${input.logoStyle}\n`;

  if (input.visualKeywords && input.visualKeywords.length > 0) {
    prompt += `Visual Keywords: ${input.visualKeywords.join(", ")}\n`;
  }
  return prompt;
}

// ── Doubao VI Prompt Engine (upgraded System Prompt) ──

function buildVIPromptSystem(): string {
  return `You are a senior VI visual prompt engineer, expert in SDXL image-generation prompt logic.
Your task: based on the client brand info, produce high-quality Logo prompts + scene image prompts ready for ComfyUI SDXL generation.
Output MUST be strict JSON only — no markdown, no preamble, no explanation, no code fences. Pure JSON.

【Logo Generation — Mandatory Rules】
Generate exactly 4 differentiated Logos, each for a different application scenario.

1. Universal constraints (ALL Logo positive prompts MUST include):
   - 2D flat vector, clean outlines, no gradient, no 3D effects, no shadows, high contrast, white background, sharp crisp edges
   - Chinese text strokes complete, no distortion, no garbled characters

2. 4-Logo fixed structure:
   Logo 1 (id: "logo_1", name: "Horizontal wordmark"): Left-graphic right-text layout for storefront/signage
   Logo 2 (id: "logo_2", name: "Circle badge"): Circular emblem style for packaging/uniforms/membership cards
   Logo 3 (id: "logo_3", name: "Minimal icon mark"): Pure graphic icon, no text, for small-format collateral
   Logo 4 (id: "logo_4", name: "Stylized wordmark"): Creative typography treatment for posters/marketing materials

3. Industry style matching (CRITICAL — match the client industry):
   * seafood/night-market: rugged fishing-port style, hand-drawn brush strokes, woodcut texture, lively market feel
   * tea-drink/light-food: fresh minimalist, youthful warm, clean flowing lines
   * chinese-fast-food: homey warmth, down-to-earth, grounded
   * beauty/wellness: elegant soft, oriental zen, premium texture
   * hair-salon: fashion-forward, minimalist cool
   * retail/fresh-produce: friendly approachable, healthy vibrant
   * cultural-creative/gifts: artistic refined, vintage texture
   * pet: cute warm, round soft shapes
   * construction/custom: professional rugged, minimalist business

4. IMPORTANT: Replace the brand name with its PINYIN (romanized) form, NOT Chinese characters. Example: '梧桐咖啡' → 'Wutong Coffee'. Chinese characters will NOT render correctly in AI image generation.


5. Universal negative prompt (ALL Logos MUST include):
   blurry, distorted text, garbled characters, 3d render, gradient, shadow, glow effect, delicate ornament, watermark

5. Color constraint (CRITICAL — READ CAREFULLY):
   You MUST use the exact brand colors provided in the user prompt.
   color_main MUST be the primary hex color from the user input. Do NOT substitute with other colors.
   color_accent MUST be the accent hex color from the user input.
   Never output generic colors like #FF6600 or #1A73E8. Use ONLY the hex values given to you.
   If the user says primary=#1B4965, then EVERY logo_prompt color_main MUST be "#1B4965".

【Scene Image Generation — Mandatory Rules】
Generate exactly 8 scene images, strictly mapped to VI manual four modules.

1. 8 scenes fixed categories:
   - Application System (3): storefront signage real scene, core operational materials, staff uniforms
   - Packaging System (2): main product packaging, tote/shopping bag
   - Marketing System (2): in-store promotional materials, membership card/payment vouchers
   - Wayfinding System (1): in-store signage/directional signs

2. Scene naming:
   id: "scene_1" through "scene_8"
   vi_module: one of "application", "packaging", "marketing", "wayfinding"
   name: descriptive name
   priority: "required" for scenes 1-5, "optional" for scenes 6-8

3. Universal negative prompt (ALL scene images MUST include):
   blurry, low quality, distorted logo, garbled text, clean studio, white background, 3d render, cartoon, watermark

4. Scene prompts must describe brand logo/design applied to real-world physical items in photorealistic settings.
   Use "Professional product photography" style, 8k, cinematic lighting.

【Output JSON — Fixed Structure】
{
  "brand_tags": ["tag1", "tag2", "tag3"],
  "logo_prompts": [
    {"id": "logo_1", "name": "Horizontal wordmark", "positive": "...", "negative": "...", "color_main": "#...", "color_accent": "#..."},
    {"id": "logo_2", "name": "Circle badge", "positive": "...", "negative": "...", "color_main": "#...", "color_accent": "#..."},
    {"id": "logo_3", "name": "Minimal icon mark", "positive": "...", "negative": "...", "color_main": "#...", "color_accent": "#..."},
    {"id": "logo_4", "name": "Stylized wordmark", "positive": "...", "negative": "...", "color_main": "#...", "color_accent": "#..."}
  ],
  "scene_prompts": [
    {"id": "scene_1", "vi_module": "application", "name": "Storefront signage", "positive": "...", "negative": "...", "controlnet": [], "priority": "required"},
    {"id": "scene_2", "vi_module": "application", "name": "Operational materials", "positive": "...", "negative": "...", "controlnet": [], "priority": "required"},
    {"id": "scene_3", "vi_module": "application", "name": "Staff uniform", "positive": "...", "negative": "...", "controlnet": [], "priority": "required"},
    {"id": "scene_4", "vi_module": "packaging", "name": "Product packaging", "positive": "...", "negative": "...", "controlnet": [], "priority": "required"},
    {"id": "scene_5", "vi_module": "packaging", "name": "Shopping bag", "positive": "...", "negative": "...", "controlnet": [], "priority": "required"},
    {"id": "scene_6", "vi_module": "marketing", "name": "Promotional poster", "positive": "...", "negative": "...", "controlnet": [], "priority": "optional"},
    {"id": "scene_7", "vi_module": "marketing", "name": "Membership card", "positive": "...", "negative": "...", "controlnet": [], "priority": "optional"},
    {"id": "scene_8", "vi_module": "wayfinding", "name": "In-store signage", "positive": "...", "negative": "...", "controlnet": [], "priority": "optional"}
  ]
}`;
}

function buildVIPromptUserPrompt(input: BrandDNAInput): string {
  const priHex = input.brandColors?.primary?.hex || "#1B4965";
  const secHex = input.brandColors?.secondary?.hex || "#5FA8D3";
  const accHex = input.brandColors?.accent?.hex || "#CAE9FF";

  let prompt = `Brand Name: ${input.brandName}\n`;
  prompt += `Industry: ${input.industry}\n`;
  if (input.brandVision) prompt += `Brand Vision: ${input.brandVision}\n`;
  if (input.coreValues) prompt += `Core Values: ${input.coreValues}\n`;
  if (input.targetMarket) prompt += `Target Market: ${input.targetMarket}\n`;
  prompt += `Brand Colors (MUST use these exact hex values): primary=${priHex}, secondary=${secHex}, accent=${accHex}\n`;
  if (input.logoDescription) prompt += `Logo Description: ${input.logoDescription}\n`;
  if (input.logoStyle) prompt += `Logo Style: ${input.logoStyle}\n`;

  if (input.visualKeywords && input.visualKeywords.length > 0) {
    prompt += `Visual Keywords: ${input.visualKeywords.join(", ")}\n`;
  }

  prompt += `\nCRITICAL: All Logo color_main must be "${priHex}" and color_accent must be "${accHex}". Do not use any other colors.`;
  return prompt;
}

// ── Main API ───────────────────────────────────────────

/**
 * Step 1: Extract brand DNA from DeepSeek (legacy prompt).
 * Returns logo_pure_prompt + scene_atlas.
 */
export async function extractBrandDNA(input: BrandDNAInput): Promise<BrandDNAResult> {
  try {
    const resp = await guardedDeepSeekCall({
      route: "extract-brand-dna",
      body: {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: buildDNASystemPrompt(input.sceneModules) },
          { role: "user", content: buildDNAUserPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      },
      timeoutMs: 30000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        logo_pure_prompt: null,
        scene_atlas: null,
        error: `DeepSeek error: ${resp.status} ${errText.substring(0, 200)}`,
      };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        logo_pure_prompt: null,
        scene_atlas: null,
        error: "Failed to parse DeepSeek JSON response",
      };
    }

    // Validate required fields
    const logoPrompt = parsed.logo_pure_prompt;
    if (!logoPrompt?.positive_en || !logoPrompt?.negative_en) {
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        logo_pure_prompt: logoPrompt || null,
        scene_atlas: parsed.scene_atlas || null,
        error: "Missing logo_pure_prompt.positive_en or negative_en",
      };
    }

    // Validate scene_atlas has {{DNA}} placeholder
    const atlas = parsed.scene_atlas;
    if (atlas && typeof atlas === "object") {
      for (const [key, entry] of Object.entries(atlas)) {
        const e = entry as SceneAtlasEntry;
        if (!e.template_en || !e.template_en.includes("{{DNA}}")) {
          console.warn(`[extractBrandDNA] scene_atlas.${key} missing {{DNA}} placeholder`);
        }
      }
    }

    return {
      success: true,
      brandName: input.brandName,
      industry: input.industry,
      logo_pure_prompt: {
        positive_en: logoPrompt.positive_en,
        negative_en: logoPrompt.negative_en,
      },
      scene_atlas: atlas || DEFAULT_SCENE_TEMPLATES,
    };
  } catch (error) {
    return {
      success: false,
      brandName: input.brandName,
      industry: input.industry,
      logo_pure_prompt: null,
      scene_atlas: null,
      error: error instanceof Error ? error.message : "extractBrandDNA failed",
    };
  }
}

/**
 * Generate VI prompts using Doubao enhanced System Prompt (new).
 * Returns 4 Logo prompts + 8 Scene prompts with industry-specific styling.
 * Also provides backward-compatible logo_pure_prompt and scene_atlas.
 */
export async function generateVIPrompts(input: BrandDNAInput): Promise<VIPromptsResult> {
  const priHex = input.brandColors?.primary?.hex || "#1B4965";
  const accHex = input.brandColors?.accent?.hex || "#CAE9FF";

  try {
    const resp = await guardedDeepSeekCall({
      route: "generate-vi-prompts",
      body: {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: buildVIPromptSystem() },
          { role: "user", content: buildVIPromptUserPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      },
      timeoutMs: 60000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        brand_tags: [],
        logo_prompts: [],
        scene_prompts: [],
        logo_pure_prompt: { positive_en: "", negative_en: "" },
        scene_atlas: {},
        error: `DeepSeek error: ${resp.status} ${errText.substring(0, 200)}`,
      };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        brand_tags: [],
        logo_prompts: [],
        scene_prompts: [],
        logo_pure_prompt: { positive_en: "", negative_en: "" },
        scene_atlas: {},
        error: "Failed to parse DeepSeek JSON response",
      };
    }

    // Validate and normalize logo_prompts
    const logoPrompts: LogoPromptEntry[] = (parsed.logo_prompts || []).map((lp: any, i: number) => ({
      id: lp.id || `logo_${i + 1}`,
      name: lp.name || `Logo variant ${i + 1}`,
      positive: lp.positive || "",
      negative: lp.negative || "deformed, blurry, low quality, distorted, 3d render, gradient, shadow, watermark, extra limbs, bad anatomy",
      color_main: lp.color_main || priHex,
      color_accent: lp.color_accent || accHex,
    }));

    // Validate and normalize scene_prompts
    const scenePrompts: ScenePromptEntry[] = (parsed.scene_prompts || []).map((sp: any, i: number) => ({
      id: sp.id || `scene_${i + 1}`,
      vi_module: sp.vi_module || "application",
      name: sp.name || `Scene ${i + 1}`,
      positive: sp.positive || "",
      negative: sp.negative || "deformed, blurry, low quality, distorted, 3d render, gradient, shadow, watermark, extra limbs",
      controlnet: Array.isArray(sp.controlnet) ? sp.controlnet : [],
      priority: sp.priority === "optional" ? "optional" : "required",
    }));

    // Build backward-compat logo_pure_prompt from logo_1 (primary)
    const primaryLogo = logoPrompts[0];
    const logoPurePrompt: LogoPurePrompt = {
      positive_en: primaryLogo?.positive || "",
      negative_en: primaryLogo?.negative || "deformed, blurry, low quality, distorted, 3d render, gradient, shadow, watermark, extra limbs, bad anatomy",
    };

    // Build backward-compat scene_atlas from required scene_prompts
    const sceneAtlas: Record<string, SceneAtlasEntry> = {};
    for (const sp of scenePrompts) {
      if (sp.priority === "required" && sp.positive) {
        sceneAtlas[sp.name] = { template_en: sp.positive };
      }
    }

    // Validate we have at least some results
    if (logoPrompts.length === 0 && scenePrompts.length === 0) {
      return {
        success: false,
        brandName: input.brandName,
        industry: input.industry,
        brand_tags: parsed.brand_tags || [],
        logo_prompts: logoPrompts,
        scene_prompts: scenePrompts,
        logo_pure_prompt: logoPurePrompt,
        scene_atlas: sceneAtlas,
        error: "DeepSeek returned empty logo_prompts and scene_prompts",
      };
    }

    return {
      success: true,
      brandName: input.brandName,
      industry: input.industry,
      brand_tags: parsed.brand_tags || [],
      logo_prompts: logoPrompts,
      scene_prompts: scenePrompts,
      logo_pure_prompt: logoPurePrompt,
      scene_atlas: sceneAtlas,
    };
  } catch (error) {
    return {
      success: false,
      brandName: input.brandName,
      industry: input.industry,
      brand_tags: [],
      logo_prompts: [],
      scene_prompts: [],
      logo_pure_prompt: { positive_en: "", negative_en: "" },
      scene_atlas: {},
      error: error instanceof Error ? error.message : "generateVIPrompts failed",
    };
  }
}

// ── String replacement ─────────────────────────────────

/**
 * Step 3: Fill scene prompts by replacing {{DNA}} with the extracted DNA content.
 * Pure function — no AI call, no side effects.
 *
 * @param dnaContent - The logo_pure_prompt.positive_en string
 * @param sceneAtlas - The scene_atlas object from extractBrandDNA
 * @param checkedMaterials - List of material names the customer selected (e.g., ["手提袋", "招牌"])
 * @returns Record mapping material name → final ComfyUI prompt string
 */
export function fillScenePrompts(
  dnaContent: string,
  sceneAtlas: Record<string, SceneAtlasEntry>,
  checkedMaterials: string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const material of checkedMaterials) {
    const entry = sceneAtlas[material];
    if (!entry) {
      console.warn(`[fillScenePrompts] Material "${material}" not found in scene_atlas, skipping`);
      continue;
    }
    result[material] = entry.template_en.replace("{{DNA}}", dnaContent);
  }

  return result;
}


