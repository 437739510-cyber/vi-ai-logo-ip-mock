/**
 * Client ID Generator — Unit Tests
 *
 * Validates generateClientId() behavior:
 * - Deterministic output
 * - NFKC normalization
 * - Prefix format
 * - Empty input handling
 *
 * Run: npx tsx src/lib/memory/__tests__/client-id.test.ts
 */

import { generateClientId } from "../client-id";

// ========== Test Runner ==========

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

function assertEqual<T>(actual: T, expected: T, name: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} (expected: ${expected}, actual: ${actual})`);
  }
}

function assertMatch(actual: string, regex: RegExp, name: string) {
  if (regex.test(actual)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} (actual: ${actual}, pattern: ${regex})`);
  }
}

// ========== Tests ==========

function testBasicGeneration() {
  console.log("\n--- Basic Generation ---");

  const id = generateClientId("椰岛工坊");
  assertMatch(id, /^cli_[0-9a-f]{16}$/, "generated ID matches cli_XXXX format");
  assertEqual(id.length, 20, "ID length = 4 (prefix) + 16 (hash) = 20");

  const id2 = generateClientId("YEDAO");
  assertMatch(id2, /^cli_[0-9a-f]{16}$/, "YEDAO ID format");
}

function testDeterministic() {
  console.log("\n--- Deterministic Output ---");

  const id1 = generateClientId("椰岛工坊");
  const id2 = generateClientId("椰岛工坊");
  assertEqual(id1, id2, "same input twice yields same ID");

  const trimmed = generateClientId("  椰岛工坊  ");
  assertEqual(id1, trimmed, "trimmed input yields same ID as untrimmed");

  const upper = generateClientId("YEDAO");
  const lower = generateClientId("yedao");
  assertEqual(upper, lower, "YEDAO and yedao produce same ID (lowercased)");
}

function testUniqueness() {
  console.log("\n--- Uniqueness ---");

  const names = [
    "椰岛工坊",
    "阿里巴巴",
    "腾讯",
    "字节跳动",
    "华为",
    "小米",
    "Apple",
    "Google",
    "Microsoft",
    "Meta",
  ];

  const ids = names.map((n) => generateClientId(n));
  const unique = new Set(ids);
  assertEqual(unique.size, names.length, "all 10 inputs produce unique IDs");
}

function testNFKCNormalization() {
  console.log("\n--- NFKC Normalization ---");

  const cjkNormal = generateClientId("椰島工坊"); // Traditional
  const cjkSimple = generateClientId("椰岛工坊"); // Simplified
  // Under NFKC, 島→岛 is NOT normalized (different characters entirely)
  // But CJK compatibility forms should be normalized
  // Full-width letters → half-width
  const fullWidth = generateClientId("ＹＥＤＡＯ");
  const halfWidth = generateClientId("YEDAO");
  assertEqual(fullWidth, halfWidth, "full-width letters normalized to half-width");
}

function testEdgeCases() {
  console.log("\n--- Edge Cases ---");

  // Empty string
  try {
    generateClientId("");
    assert(false, "empty string should throw");
  } catch {
    assert(true, "empty string throws Error");
  }

  // Whitespace only
  try {
    generateClientId("   ");
    assert(false, "whitespace-only should throw");
  } catch {
    assert(true, "whitespace-only throws Error");
  }

  // Very long company name
  const longName = "A".repeat(1000);
  const longId = generateClientId(longName);
  assertMatch(longId, /^cli_[0-9a-f]{16}$/, "1000-char name produces valid ID");
  assertEqual(longId.length, 20, "1000-char name produces 20-char ID");

  // Special characters
  const specialId = generateClientId("Café & Co. GmbH (2024)");
  assertMatch(specialId, /^cli_[0-9a-f]{16}$/, "name with special chars produces valid ID");
}

function testPrefixConsistency() {
  console.log("\n--- Prefix Consistency ---");

  const ids = [
    generateClientId("a"),
    generateClientId("b"),
    generateClientId("c"),
    generateClientId("1"),
    generateClientId("测试"),
  ];

  for (const id of ids) {
    assert(id.startsWith("cli_"), `ID "${id}" starts with cli_`);
  }
}

// ========== Run All Tests ==========

console.log("Client ID Generator Tests\n" + "=".repeat(30));

testBasicGeneration();
testDeterministic();
testUniqueness();
testNFKCNormalization();
testEdgeCases();
testPrefixConsistency();

console.log(`\n${"=".repeat(30)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
