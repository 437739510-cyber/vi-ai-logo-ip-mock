/**
 * Lightweight test runner for fillScenePrompts.
 * Run: npx tsx src/lib/vi-manual/__tests__/deepseek-dna.test.ts
 */

import { fillScenePrompts } from "../scene-prompt-filler";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.error(`  FAIL: ${name}`); }
}

const dnaContent = "A minimalist flat vector logo of a traditional cloth shoe silhouette, intertwined with auspicious cloud-scroll lines, bold circular emblem, high contrast red (#C23B22) and dark brown, clean white background, sharp edges, high definition, 8k.";

const sceneAtlas: Record<string, {template_en: string}> = {
  "toteBag": {
    template_en: "{{DNA}} embossed as a hot-stamped gold foil emblem on a natural kraft paper tote bag, sitting on a wooden counter, warm sunlight, shallow depth of field, photorealistic, 8k."
  },
  "signboard": {
    template_en: "{{DNA}} designed as a backlit illuminated acrylic sign on a traditional brick wall storefront, dusk atmosphere, neon glow reflecting on wet pavement, cinematic, 8k."
  },
  "uniform": {
    template_en: "{{DNA}} meticulously embroidered as a patch on the left chest of a simple linen apron, studio lighting, fabric texture close-up, 8k."
  }
};

console.log("\n=== fillScenePrompts Tests ===\n");

// Test 1: Normal substitution (3 materials)
console.log("1. Normal substitution (3 materials)");
const r1 = fillScenePrompts(dnaContent, sceneAtlas, ["toteBag", "signboard", "uniform"]);
assert(Object.keys(r1).length === 3, "returns 3 results");
assert(r1["toteBag"].includes(dnaContent), "toteBag contains DNA");
assert(!r1["toteBag"].includes("{{DNA}}"), "toteBag has no {{DNA}} placeholder");
assert(r1["toteBag"].includes("embossed as a hot-stamped gold foil"), "toteBag preserves scene description");
assert(r1["toteBag"].startsWith(dnaContent), "toteBag starts with DNA content");
assert(r1["signboard"].includes(dnaContent), "signboard contains DNA");
assert(r1["uniform"].includes(dnaContent), "uniform contains DNA");

// Test 2: Empty materials list
console.log("\n2. Empty materials list");
const r2 = fillScenePrompts(dnaContent, sceneAtlas, []);
assert(Object.keys(r2).length === 0, "returns empty object");

// Test 3: Special characters in DNA
console.log("\n3. Special characters in DNA");
const specialDNA = "Logo design with red (#C23B22) color, pricing from $5.99, (registered) trademark";
const r3 = fillScenePrompts(specialDNA, sceneAtlas, ["uniform"]);
assert(r3["uniform"].includes(specialDNA), "handles regex-special chars ($, parens)");
assert(!r3["uniform"].includes("{{DNA}}"), "no leftover placeholder");

// Test 4: Backslashes and quotes
console.log("\n4. Backslashes and quotes");
const trickyDNA = `Logo with "bold" typography and path\\to\\asset`;
const r4 = fillScenePrompts(trickyDNA, sceneAtlas, ["signboard"]);
assert(r4["signboard"].includes(trickyDNA), "handles backslashes and quotes");
assert(!r4["signboard"].includes("{{DNA}}"), "no leftover placeholder");

// Test 5: Missing material in atlas
console.log("\n5. Missing material in atlas");
const r5 = fillScenePrompts(dnaContent, sceneAtlas, ["toteBag", "nonexistent", "uniform"]);
assert(Object.keys(r5).length === 2, "skips unknown material, returns 2");
assert(r5["toteBag"] !== undefined, "toteBag present");
assert(r5["uniform"] !== undefined, "uniform present");
assert(r5["nonexistent"] === undefined, "nonexistent absent");

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

