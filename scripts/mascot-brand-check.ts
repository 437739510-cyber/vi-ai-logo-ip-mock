/**
 * Mascot Brand Alignment Check
 *
 * Validates generated mascot character against brand industry/product.
 * Calls DeepSeek to score alignment and identify issues.
 *
 * Usage (standalone):
 *   npx tsx scripts/mascot-brand-check.ts
 */

import { guardedDeepSeekCall } from "../src/lib/core/billing/deepseek-guard";

// ── Types ──────────────────────────────────────────────

export interface MascotCharacterBrief {
  name: string;
  setting: string;
  personality: string;
}

export interface BrandAlignmentInput {
  companyName: string;
  industry: string;
  mainProduct: string;
  brandTone: string[];
}

export interface BrandAlignmentResult {
  passed: boolean;
  score: number;
  issues: string[];
}

// ── System Prompt ──────────────────────────────────────

const ALIGNMENT_SYSTEM_PROMPT = `You are a brand IP quality inspector. Your job is to evaluate whether a proposed mascot character is well-aligned with a brand's industry, product, and tone.

Evaluate the character against the brand info and output JSON:
{
  "passed": true/false,
  "score": 0-100 (alignment score, 70+ is passing),
  "issues": ["List of specific issues if score < 70, otherwise empty array"]
}

Scoring criteria:
- Industry relevance (30 points): Does the character fit the brand's industry?
- Product connection (25 points): Does the character relate to the main product?
- Tone match (25 points): Does the character's personality match the brand tone?
- Originality (20 points): Is the character distinctive and not generic?

Return pure JSON only.`;

// ── Alignment Threshold ────────────────────────────────

const ALIGNMENT_THRESHOLD = 70;

// ── Validator ──────────────────────────────────────────

export async function validateMascotBrandAlignment(
  character: MascotCharacterBrief,
  brandInfo: BrandAlignmentInput
): Promise<BrandAlignmentResult> {
  const response = await guardedDeepSeekCall({
    route: "mascot-brand-alignment",
    requestSummary: `Validate mascot alignment for ${brandInfo.companyName} (${brandInfo.industry})`,
    body: {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: ALIGNMENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            character: {
              name: character.name,
              setting: character.setting,
              personality: character.personality,
            },
            brand: {
              companyName: brandInfo.companyName,
              industry: brandInfo.industry,
              mainProduct: brandInfo.mainProduct,
              brandTone: brandInfo.brandTone,
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

  const result: BrandAlignmentResult = JSON.parse(content);

  // Validate and normalize
  if (typeof result.score !== "number") result.score = 0;
  if (!Array.isArray(result.issues)) result.issues = [];
  result.passed = result.score >= ALIGNMENT_THRESHOLD;

  return result;
}

// ── Standalone Test ────────────────────────────────────

async function main() {
  const testCharacter: MascotCharacterBrief = {
    name: "小焙",
    setting: "一个戴着厨师帽的卡通面包形象，温暖米色系外观",
    personality: "温暖、亲切、专注手作",
  };

  const testBrand: BrandAlignmentInput = {
    companyName: "TestBrand",
    industry: "food_beverage",
    mainProduct: "Handmade bakery pastries",
    brandTone: ["warm", "traditional", "artisan"],
  };

  try {
    const result = await validateMascotBrandAlignment(testCharacter, testBrand);
    console.log("=== Alignment Check ===");
    console.log(`Score: ${result.score}/100`);
    console.log(`Passed: ${result.passed}`);
    if (result.issues.length > 0) {
      console.log("Issues:");
      result.issues.forEach((i) => console.log(`  - ${i}`));
    }
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const isMainModule = typeof require !== "undefined" && require.main === module;
if (isMainModule) {
  main();
}
