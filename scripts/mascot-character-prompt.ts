/**
 * Mascot Character Prompt Generator
 *
 * Calls DeepSeek API to generate industry-aligned IP mascot character descriptions.
 * Designed to be imported by page-planner.ts (buildMascotChapter) or run standalone.
 *
 * Usage (standalone):
 *   npx tsx scripts/mascot-character-prompt.ts
 */

import { guardedDeepSeekCall } from "../src/lib/core/billing/deepseek-guard";

// ── Types ──────────────────────────────────────────────

export interface BrandMascotInfo {
  companyName: string;
  industry: string;
  mainProduct: string;
  brandTone: string[];
  brandColors: {
    primary: { hex: string; name?: string };
    secondary: { hex: string; name?: string };
    accent: { hex: string; name?: string };
  };
}

export interface MascotCharacter {
  name: string;
  setting: string;
  personality: string;
  usageScenes: string;
}

// ── System Prompt ──────────────────────────────────────

const MASCOT_CHARACTER_SYSTEM_PROMPT = `You are a senior brand IP designer specializing in generating mascot character settings based on brand information.

Generate an IP mascot character that matches the brand's industry, based on company name, industry, main product, brand tone, and brand colors.

Output JSON format:
{
  "name": "Mascot name (Chinese, 2-4 characters, memorable and industry-relevant)",
  "setting": "Character setting description (50-100 chars, describing appearance, style direction; keep industry-relevant, avoid overly specific clothing details)",
  "personality": "Personality and tone (30-60 chars, character traits consistent with brand core)",
  "usageScenes": "Applicable scenes (30-60 chars, e.g. manual cover, store signage, social media avatar, packaging)"
}

Constraints:
1. Character must be relevant to the brand's industry and main product
2. Do not use existing IP from other brands
3. Color direction should reference brand color palette
4. Name must be memorable and easy to spread
5. Keep setting generic and reasonable, avoid overly specific costume details
6. Return pure JSON only, no additional text`;

// ── Generator ──────────────────────────────────────────

export async function generateMascotCharacter(
  brandInfo: BrandMascotInfo
): Promise<MascotCharacter> {
  const response = await guardedDeepSeekCall({
    route: "mascot-character-generate",
    requestSummary: `Generate mascot character for ${brandInfo.companyName} (${brandInfo.industry})`,
    body: {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: MASCOT_CHARACTER_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            companyName: brandInfo.companyName,
            industry: brandInfo.industry,
            mainProduct: brandInfo.mainProduct,
            brandTone: brandInfo.brandTone,
            brandColors: {
              primary: brandInfo.brandColors.primary?.hex || "",
              secondary: brandInfo.brandColors.secondary?.hex || "",
              accent: brandInfo.brandColors.accent?.hex || "",
            },
          }),
        },
      ],
      response_format: { type: "json_object" },
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned empty response");
  }

  const parsed: MascotCharacter = JSON.parse(content);

  if (!parsed.name || !parsed.setting || !parsed.personality || !parsed.usageScenes) {
    throw new Error(`DeepSeek returned incomplete character: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

// ── Standalone Test ────────────────────────────────────


// ========== DeepSeek Structured Prompt Blueprint ==========

/** DeepSeek output — structured image generation blueprint replacing hardcoded species scoring */
export interface MascotPromptBlueprint {
  name: string;
  setting: string;
  personality: string;
  usageScenes: string;
  species: string;
  speciesCn: string;
  bodyColorDesc: string;
  keyAccessories: string[];
  poseDescription: string;
  expressionDescription: string;
  styleTier: string;
  themeTags: string[];
  sceneContexts: string[];
  negativePrompt: string;
}


// ========== DeepSeek Structured Prompt Blueprint Generator ==========

const MASCOT_BLUEPRINT_SYSTEM_PROMPT: string = [
  "You are a senior brand IP designer. Based on customer brand data, output a complete structured JSON for AI image generation.",
  "",
  "## Input fields",
  "- companyName, industry, mainProduct, brandTone, brandColors (hex)",
  "- mascotRefIdea: customer mascot vision description (if provided)",
  "- mascotTypePref: species preference (animal/character/fairy/etc)",
  "- mascotStylePref: style preference",
  "- mascotPersonalityPref: personality preference",
  "",
  "## Output JSON schema",
  '{  "name": "Chinese mascot name (2-4 chars, memorable, industry-relevant)"  }',
  '{  "setting": "Character setting (50-100 chars, appearance and style)"  }',
  '{  "personality": "Personality and tone (30-60 chars)"  }',
  '{  "usageScenes": "Applicable scenes (30-60 chars)"  }',
  '{  "species": "English species for AI model (e.g. elegant oriental deer)"  }',
  '{  "speciesCn": "Chinese species name"  }',
  '{  "bodyColorDesc": "Per-part color in English, reference brand colors"  }',
  '{  "keyAccessories": ["1-3 English accessory descriptions"]  }',
  '{  "poseDescription": "English pose for AI image model"  }',
  '{  "expressionDescription": "English expression for AI image model"  }',
  '{  "styleTier": "soft_healing | pixar_cartoon | premium_luxury | flat_vector | chinese_aesthetic"  }',
  '{  "themeTags": ["1-3 tags from: healing | oriental | tech_future | cute_playful | delicious_food | professional_rigorous"]  }',
  '{  "sceneContexts": ["English scene descriptions"]  }',
  '{  "negativePrompt": "Industry-specific English negative prompt"  }',
  "Design rules:",
  "1. IP must match customer industry and product",
  "2. Color direction references brand color hex values",
  "3. species/bodyColorDesc/poseDescription/expressionDescription must be English",
  "4. styleTier and themeTags use exact enum values listed above",
  "5. If mascotRefIdea provided, prioritize customer vision",
  "6. Return pure JSON only, no additional text",
  "7. Generate appropriate negative prompt for the industry and style",
  "8. Do NOT copy other brands existing IP designs",
].join("\n");

export async function generateMascotPromptBlueprint(
  brandInfo: BrandMascotInfo & Record<string, unknown>
): Promise<MascotPromptBlueprint> {
  const customerInput: Record<string, unknown> = {
    companyName: brandInfo.companyName,
    industry: brandInfo.industry,
    mainProduct: brandInfo.mainProduct,
    brandTone: brandInfo.brandTone,
    brandColors: {
      primary: brandInfo.brandColors?.primary?.hex || "",
      secondary: brandInfo.brandColors?.secondary?.hex || "",
      accent: brandInfo.brandColors?.accent?.hex || "",
    },
  };

  const optional = ["mascotRefIdea", "mascotTypePref", "mascotStylePref", "mascotPersonalityPref"];
  for (const key of optional) {
    if ((brandInfo as any)[key]) customerInput[key] = (brandInfo as any)[key];
  }

  const response = await guardedDeepSeekCall({
    route: "mascot-blueprint-generate",
    requestSummary: "Generate mascot prompt blueprint for " + brandInfo.companyName + " (" + brandInfo.industry + ")",
    body: {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: MASCOT_BLUEPRINT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(customerInput) },
      ],
      response_format: { type: "json_object" },
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error("DeepSeek API error (" + response.status + "): " + errText);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("DeepSeek returned empty response");

  const parsed: MascotPromptBlueprint = JSON.parse(rawContent);
  if (!parsed.name || !parsed.species || !parsed.setting || !parsed.bodyColorDesc) {
    throw new Error("DeepSeek returned incomplete blueprint: " + JSON.stringify(parsed));
  }
  return parsed;
}
async function main() {
  const testBrand: BrandMascotInfo = {
    companyName: "TestBrand",
    industry: "food_beverage",
    mainProduct: "Handmade bakery pastries",
    brandTone: ["warm", "traditional", "artisan"],
    brandColors: {
      primary: { hex: "#8B4513", name: "brown" },
      secondary: { hex: "#FFD700", name: "gold" },
      accent: { hex: "#FFF8DC", name: "cream" },
    },
  };

  try {
    const character = await generateMascotCharacter(testBrand);
    console.log("=== Generated Character ===");
    console.log(JSON.stringify(character, null, 2));
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Allow standalone execution
const isMainModule = typeof require !== "undefined" && require.main === module;
if (isMainModule) {
  main();
}
