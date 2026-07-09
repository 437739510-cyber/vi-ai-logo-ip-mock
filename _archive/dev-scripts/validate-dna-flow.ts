/**
 * validate-dna-flow.ts
 *
 * End-to-end validation of the DNA workflow across 3 industries.
 * Calls DeepSeek (extractBrandDNA) but NOT ComfyUI.
 * Outputs per-industry markdown reports.
 *
 * Run: npx tsx scripts/validate-dna-flow.ts
 */

import { extractBrandDNA, type BrandDNAInput } from "../src/lib/vi-manual/deepseek-dna";
import { fillScenePrompts } from "../src/lib/vi-manual/scene-prompt-filler";
import * as fs from "fs";
import * as path from "path";

// ── Brand data for 3 industries ────────────────────────

const brands: BrandDNAInput[] = [
  {
    brandName: "Old Beijing Cloth Shoes",
    industry: "鞋店",
    brandVision: "Revive traditional Chinese footwear craftsmanship for modern urban life",
    coreValues: "Heritage, Craftsmanship, Comfort",
    targetMarket: "25-45 year old culture-conscious urban consumers",
    brandColors: {
      primary: { hex: "#C23B22", name: "Chinese Red" },
      secondary: { hex: "#3C2415", name: "Dark Brown" },
      accent: { hex: "#D4A574", name: "Warm Beige" },
    },
    logoDescription: "Traditional cloth shoe silhouette with auspicious cloud-scroll motifs in a circular emblem",
    logoStyle: "Minimalist flat vector, high contrast, neo-traditional Chinese",
  },
  {
    brandName: "Shu Jiu Xiang Hotpot",
    industry: "火锅店",
    brandVision: "Bring the soul of Sichuan hotpot culture to every table",
    coreValues: "Authenticity, Boldness, Community",
    targetMarket: "18-40 year old food enthusiasts and social diners",
    brandColors: {
      primary: { hex: "#D4213D", name: "Sichuan Chili Red" },
      secondary: { hex: "#1A1A2E", name: "Deep Charcoal" },
      accent: { hex: "#FFB800", name: "Golden Yellow" },
    },
    logoDescription: "Stylized chili pepper and flame forming a hotpot bowl silhouette, bold typography",
    logoStyle: "Bold modern emblem, fiery gradients, dynamic curves",
  },
  {
    brandName: "Floral Time Beauty Salon",
    industry: "美容院",
    brandVision: "Natural beauty enhanced by flowers and time-honored care traditions",
    coreValues: "Elegance, Nature, Rejuvenation",
    targetMarket: "25-50 year old women seeking premium natural skincare",
    brandColors: {
      primary: { hex: "#E8A0BF", name: "Rose Pink" },
      secondary: { hex: "#2D5A27", name: "Forest Green" },
      accent: { hex: "#F5E6CC", name: "Cream White" },
    },
    logoDescription: "Delicate flower petals forming a feminine face profile, soft watercolor texture",
    logoStyle: "Elegant minimalist, watercolor effect, botanical elements",
  },
];

const CHECKED_MATERIALS = ["手提袋", "招牌"];

// ── Validation logic ───────────────────────────────────

interface ValidationResult {
  brandName: string;
  industry: string;
  success: boolean;
  checks: { label: string; pass: boolean; detail?: string }[];
  logoPurePrompt?: { positive_en: string; negative_en: string };
  sceneAtlas?: Record<string, { template_en: string }>;
  finalPrompts?: Record<string, string>;
  error?: string;
}

async function validateBrand(brand: BrandDNAInput): Promise<ValidationResult> {
  const result: ValidationResult = {
    brandName: brand.brandName,
    industry: brand.industry,
    success: false,
    checks: [],
  };

  // Step 1: Call extractBrandDNA
  console.log(`\n[${brand.brandName}] Calling extractBrandDNA...`);
  const dna = await extractBrandDNA(brand);

  // Check 1: extractBrandDNA returned success
  result.checks.push({
    label: "extractBrandDNA success",
    pass: dna.success,
    detail: dna.error,
  });

  if (!dna.success) {
    result.error = dna.error;
    return result;
  }

  // Check 2: logo_pure_prompt has required fields
  const hasPositive = !!(dna.logo_pure_prompt?.positive_en);
  const hasNegative = !!(dna.logo_pure_prompt?.negative_en);
  result.checks.push({
    label: "logo_pure_prompt.positive_en exists",
    pass: hasPositive,
    detail: hasPositive ? `${dna.logo_pure_prompt!.positive_en.length} chars` : "missing",
  });
  result.checks.push({
    label: "logo_pure_prompt.negative_en exists",
    pass: hasNegative,
  });

  result.logoPurePrompt = dna.logo_pure_prompt!;

  // Check 3: scene_atlas has 5+ materials
  const atlasKeys = dna.scene_atlas ? Object.keys(dna.scene_atlas) : [];
  const hasEnoughMaterials = atlasKeys.length >= 5;
  result.checks.push({
    label: "scene_atlas has 5+ materials",
    pass: hasEnoughMaterials,
    detail: `${atlasKeys.length} materials: ${atlasKeys.join(", ")}`,
  });

  result.sceneAtlas = dna.scene_atlas!;

  // Check 4: Each template has {{DNA}} placeholder
  let allHaveDNA = true;
  let missingDNA: string[] = [];
  if (dna.scene_atlas) {
    for (const [key, entry] of Object.entries(dna.scene_atlas)) {
      if (!entry.template_en?.includes("{{DNA}}")) {
        allHaveDNA = false;
        missingDNA.push(key);
      }
    }
  }
  result.checks.push({
    label: "All templates contain {{DNA}}",
    pass: allHaveDNA,
    detail: missingDNA.length > 0 ? `Missing in: ${missingDNA.join(", ")}` : "all OK",
  });

  // Check 5: fillScenePrompts works
  if (dna.logo_pure_prompt?.positive_en && dna.scene_atlas) {
    const prompts = fillScenePrompts(
      dna.logo_pure_prompt.positive_en,
      dna.scene_atlas,
      CHECKED_MATERIALS
    );

    const filledCount = Object.keys(prompts).length;
    const allReplaced = Object.values(prompts).every(p => !p.includes("{{DNA}}"));

    result.checks.push({
      label: `fillScenePrompts (${CHECKED_MATERIALS.join(", ")})`,
      pass: filledCount === CHECKED_MATERIALS.length && allReplaced,
      detail: `${filledCount}/${CHECKED_MATERIALS.length} filled, all DNA replaced: ${allReplaced}`,
    });

    result.finalPrompts = prompts;
  } else {
    result.checks.push({
      label: "fillScenePrompts skipped",
      pass: false,
      detail: "No DNA content or scene_atlas available",
    });
  }

  // Overall
  result.success = result.checks.every(c => c.pass);

  return result;
}

function writeReport(results: ValidationResult[], outputDir: string) {
  for (const r of results) {
    const industrySlug = r.industry.replace(/[^\w]/g, "-").toLowerCase();
    const filename = `${industrySlug}-dna-report.md`;
    const filepath = path.join(outputDir, filename);

    const lines: string[] = [];
    lines.push(`# DNA Validation Report: ${r.brandName}`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| Brand | ${r.brandName} |`);
    lines.push(`| Industry | ${r.industry} |`);
    lines.push(`| Overall | ${r.success ? "PASS" : "FAIL"} |`);
    if (r.error) lines.push(`| Error | ${r.error} |`);
    lines.push("");
    lines.push("## Validation Checks");
    lines.push("");
    lines.push("| # | Check | Result | Detail |");
    lines.push("| :--- | :--- | :---: | :--- |");
    r.checks.forEach((c, i) => {
      lines.push(`| ${i + 1} | ${c.label} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail || "-"} |`);
    });
    lines.push("");
    lines.push("## logo_pure_prompt");
    lines.push("");
    if (r.logoPurePrompt) {
      lines.push("### positive_en");
      lines.push("");
      lines.push(r.logoPurePrompt.positive_en);
      lines.push("");
      lines.push("### negative_en");
      lines.push("");
      lines.push(r.logoPurePrompt.negative_en);
    } else {
      lines.push("*(not available)*");
    }
    lines.push("");
    lines.push("## scene_atlas");
    lines.push("");
    if (r.sceneAtlas) {
      for (const [key, entry] of Object.entries(r.sceneAtlas)) {
        lines.push(`### ${key}`);
        lines.push("");
        lines.push(`\`\`\``);
        lines.push(entry.template_en);
        lines.push(`\`\`\``);
        lines.push("");
      }
    } else {
      lines.push("*(not available)*");
    }
    lines.push("");
    lines.push("## Final Prompts (checked materials: 手提袋, 招牌)");
    lines.push("");
    if (r.finalPrompts) {
      for (const [key, prompt] of Object.entries(r.finalPrompts)) {
        lines.push(`### ${key}`);
        lines.push("");
        lines.push(`\`\`\``);
        lines.push(prompt);
        lines.push(`\`\`\``);
        lines.push("");
      }
    } else {
      lines.push("*(not available)*");
    }
    lines.push("");
    lines.push(`## Conclusion: ${r.success ? "PASS" : "FAIL"}`);
    if (!r.success) {
      lines.push("");
      lines.push(`Reason: ${r.error || r.checks.filter(c => !c.pass).map(c => c.label).join(", ")}`);
    }

    fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
    console.log(`  Report: ${filepath}`);
  }
}

// ── Main ────────────────────────────────────────────────

async function main() {
  const outputDir = path.join(process.cwd(), "output", "dna-validation");
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("=== DNA Flow Validation ===\n");
  console.log(`Output: ${outputDir}`);
  console.log(`Brands: ${brands.map(b => b.brandName).join(", ")}`);
  console.log(`Checked materials: ${CHECKED_MATERIALS.join(", ")}`);

  const results: ValidationResult[] = [];

  for (const brand of brands) {
    console.log(`\n--- ${brand.brandName} (${brand.industry}) ---`);
    const result = await validateBrand(brand);
    results.push(result);
    console.log(`  Result: ${result.success ? "PASS" : "FAIL"}`);
    for (const c of result.checks) {
      console.log(`    [${c.pass ? "+" : "x"}] ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
    }
  }

  console.log("\n=== Writing Reports ===\n");
  writeReport(results, outputDir);

  // Summary
  const passed = results.filter(r => r.success).length;
  console.log(`\n=== Summary: ${passed}/${results.length} brands passed ===\n`);

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
