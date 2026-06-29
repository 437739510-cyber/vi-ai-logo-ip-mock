/**
 * DeepSeek DNA Extractor
 *
 * Step 1 of DNA workflow: extract brand DNA (logo_pure_prompt + scene_atlas) from brand data.
 * Also provides fillScenePrompts for Step 3 string replacement.
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
}

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

// ── System prompt for DeepSeek ─────────────────────────

function buildDNASystemPrompt(): string {
  return `You are a senior brand VI designer and AI prompt engineer.
Your task is to analyze a brand and produce two outputs in strict JSON format.

## Output 1: logo_pure_prompt
A pair of English prompts (positive + negative) for generating a clean, standalone logo on a white background.
- positive_en: 50-80 words describing the exact logo shape, elements, style, colors. Use concrete visual terms (silhouette, emblem, geometric, line-art, etc.). Do NOT mention scenes or materials — this is for a flat vector logo only.
- negative_en: standard quality-control terms (deformed, blurry, low quality, text, watermark, 3d, shadow, complex background).

## Output 2: scene_atlas
A set of scene templates (5 materials minimum: 手提袋, 招牌, 工服, 名片, 纸杯).
Each template MUST contain the placeholder {{DNA}} exactly where the logo description should be inserted.
- template_en: full scene prompt with {{DNA}} as the logo subject
- Describe specific materials (hot-stamped gold foil, embroidered patch, backlit acrylic, etc.)
- Use photorealistic, 8k, cinematic style
- ALL fields must be in English only

## Output format (JSON only, no markdown wrapping):
{
  "logo_pure_prompt": {
    "positive_en": "...",
    "negative_en": "..."
  },
  "scene_atlas": {
    "手提袋": {"template_en": "{{DNA}} ..."},
    "招牌": {"template_en": "{{DNA}} ..."},
    "工服": {"template_en": "{{DNA}} ..."},
    "名片": {"template_en": "{{DNA}} ..."},
    "纸杯": {"template_en": "{{DNA}} ..."}
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

  return prompt;
}

// ── Main API ───────────────────────────────────────────

/**
 * Step 1: Extract brand DNA from DeepSeek.
 * Returns logo_pure_prompt + scene_atlas.
 */
export async function extractBrandDNA(input: BrandDNAInput): Promise<BrandDNAResult> {
  try {
    const resp = await guardedDeepSeekCall({
      route: "extract-brand-dna",
      body: {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: buildDNASystemPrompt() },
          { role: "user", content: buildDNAUserPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 4096,
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

