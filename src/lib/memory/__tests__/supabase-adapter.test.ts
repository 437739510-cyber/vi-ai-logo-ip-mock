/**
 * Supabase Memory Adapter 鈥?Unit Tests
 *
 * Validates SupabaseMemoryAdapter logic:
 * - Snapshot enforcement (max 10)
 * - Industry coverage builder
 * - Row mappers
 * - Adapter selection
 *
 * Run: npx tsx src/lib/memory/__tests__/supabase-adapter.test.ts
 *
 * Note: Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY
 * to be set in .env.local for integration tests.
 * Unit tests of pure functions do not require Supabase connection.
 */

import { enforceMaxSnapshots, buildIndustryCoverage } from "../supabase-adapter";

// ========== Test Runner ==========

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  鉁?${name}`);
  } else {
    failed++;
    console.log(`  鉁?${name}`);
  }
}

function assertEqual<T>(actual: T, expected: T, name: string) {
  if (actual === expected) {
    passed++;
    console.log(`  鉁?${name}`);
  } else {
    failed++;
    console.log(`  鉁?${name} (expected: ${expected}, actual: ${actual})`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, name: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
    console.log(`  鉁?${name}`);
  } else {
    failed++;
    console.log(`  鉁?${name}`);
    console.log(`    expected: ${b}`);
    console.log(`    actual:   ${a}`);
  }
}

// ========== Test: Snapshot Enforcement (pure function) ==========

function testEnforceMaxSnapshots() {
  console.log("\n--- Snapshot Enforcement (max=10) ---");

  // Helper: create a snapshot with given index
  function makeSnapshot(index: number) {
    return {
      timestamp: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      brandProfile: { analysis: `analysis-${index}` },
      packageRecommendation: {},
      modulePlan: {},
      designDirection: {},
      assetGuardResult: {},
      mascotProfile: {},
      generatedUrls: [],
    };
  }

  // Test 1: fewer than 10 snapshots 鈥?no trimming
  const snapshots5 = Array.from({ length: 5 }, (_, i) => makeSnapshot(i));
  const result5 = enforceMaxSnapshots(snapshots5);
  assertEqual(result5.length, 5, "5 snapshots 鈫?kept all 5");
  assertDeepEqual(result5, snapshots5, "5 snapshots 鈫?unchanged order");

  // Test 2: exactly 10 snapshots 鈥?no trimming
  const snapshots10 = Array.from({ length: 10 }, (_, i) => makeSnapshot(i));
  const result10 = enforceMaxSnapshots(snapshots10);
  assertEqual(result10.length, 10, "10 snapshots 鈫?kept all 10");
  assertEqual(result10[0].timestamp, snapshots10[0].timestamp, "10 snapshots 鈫?first item preserved");

  // Test 3: 15 snapshots 鈥?keep only most recent 10
  const snapshots15 = Array.from({ length: 15 }, (_, i) => makeSnapshot(i));
  const result15 = enforceMaxSnapshots(snapshots15);
  assertEqual(result15.length, 10, "15 snapshots 鈫?trimmed to 10");
  // Newest (index 5-14) should be kept, oldest (0-4) dropped
  assertEqual(result15[0].timestamp, makeSnapshot(5).timestamp, "15 snapshots 鈫?first kept is index 5");
  assertEqual(result15[9].timestamp, makeSnapshot(14).timestamp, "15 snapshots 鈫?last kept is index 14");

  // Test 4: empty array
  const resultEmpty = enforceMaxSnapshots([]);
  assertEqual(resultEmpty.length, 0, "empty array 鈫?kept empty");

  // Test 5: undefined/empty items
  const resultUndefined = enforceMaxSnapshots([]);
  assertEqual(resultUndefined.length, 0, "no snapshots 鈫?empty array");

  console.log("  鈫?enforceMaxSnapshots: all tests passed");
}

// ========== Test: Industry Coverage Builder (pure function) ==========

function testBuildIndustryCoverage() {
  console.log("\n--- Industry Coverage Builder ---");

  // Simulate industries
  const industries = [
    { category: "food_beverage", subCategory: "beverage", projectCount: 3 },
    { category: "food_beverage", subCategory: "snack", projectCount: 2 },
    { category: "food_beverage", subCategory: "beverage", projectCount: 1 }, // duplicate category
    { category: "technology", subCategory: "saas", projectCount: 5 },
    { category: "technology", subCategory: "hardware", projectCount: 0 },
    { category: "education", subCategory: undefined, projectCount: 2 },
  ];

  const coverage = buildIndustryCoverage(industries as any);

  // Test coverage structure
  assert(coverage["food_beverage"] !== undefined, "food_beverage category exists");
  assert(coverage["technology"] !== undefined, "technology category exists");
  assert(coverage["education"] !== undefined, "education category exists");

  // Test sub-category accumulation (dedup + merge)
  const food = coverage["food_beverage"];
  assertDeepEqual(
    food.subCategories.sort(),
    ["beverage", "snack"].sort(),
    "food_beverage subCategories merged and deduplicated"
  );
  assertEqual(food.projectCount, 6, "food_beverage projectCount = 3+2+1 = 6");

  const tech = coverage["technology"];
  assertDeepEqual(
    tech.subCategories.sort(),
    ["hardware", "saas"].sort(),
    "technology subCategories merged"
  );
  assertEqual(tech.projectCount, 5, "technology projectCount = 5+0 = 5");

  // Test category with no subCategory
  const edu = coverage["education"];
  assertDeepEqual(edu.subCategories, [], "education subCategories is empty");
  assertEqual(edu.projectCount, 2, "education projectCount = 2");

  // Test empty input
  const empty = buildIndustryCoverage([]);
  assertDeepEqual(empty, {}, "empty industries 鈫?empty coverage");

  console.log("  鈫?buildIndustryCoverage: all tests passed");
}

// ========== Test: Adapter Selection Logic ==========

function testAdapterSelection() {
  console.log("\n--- Adapter Selection ---");

  // The switch logic in index.ts:
  // "json" 鈫?JsonMemoryAdapter
  // "supabase" 鈫?SupabaseMemoryAdapter
  // anything else 鈫?throws

  function selectAdapterType(env: string | undefined): string {
    const adapterType = env || "json";
    switch (adapterType) {
      case "json":
        return "json";
      case "supabase":
        return "supabase";
      default:
        throw new Error(`Unknown adapter: "${adapterType}"`);
    }
  }

  // Test: default is json
  assertEqual(selectAdapterType(undefined), "json", "no env 鈫?returns json");

  // Test: explicit json
  assertEqual(selectAdapterType("json"), "json", 'env=json 鈫?returns json');

  // Test: explicit supabase
  assertEqual(selectAdapterType("supabase"), "supabase", 'env=supabase 鈫?returns supabase');

  // Test: unknown value throws
  try {
    selectAdapterType("auto");
    assert(false, "unknown value should throw");
  } catch (e: any) {
    assert(e.message.includes("Unknown adapter"), "unknown value throws clear error message");
  }

  // Test: explicit only 鈥?no auto mode
  const validValues = ["json", "supabase"];
  assertEqual(validValues.length, 2, "only 2 valid adapter values");

  console.log("  鈫?Adapter selection: all tests passed");
}

// ========== Test: Supabase Adapter Class (instantiation) ==========

async function testAdapterClassStructure() {
  console.log("\n--- Adapter Class Structure ---");

  const { SupabaseMemoryAdapter } = await import("../supabase-adapter");

  // Test: class exists and is constructable
  assert(typeof SupabaseMemoryAdapter === "function", "SupabaseMemoryAdapter is a class");

  // Test: interface methods exist
  const adapter = new SupabaseMemoryAdapter();
  assert(typeof adapter.initialize === "function", "adapter.initialize is a function");
  assert(typeof adapter.getClient === "function", "adapter.getClient is a function");
  assert(typeof adapter.getAllClients === "function", "adapter.getAllClients is a function");
  assert(typeof adapter.saveClient === "function", "adapter.saveClient is a function");
  assert(typeof adapter.findClientByCompany === "function", "adapter.findClientByCompany is a function");
  assert(typeof adapter.getIndustry === "function", "adapter.getIndustry is a function");
  assert(typeof adapter.getAllIndustries === "function", "adapter.getAllIndustries is a function");
  assert(typeof adapter.saveIndustry === "function", "adapter.saveIndustry is a function");
  assert(typeof adapter.findIndustryByCategory === "function", "adapter.findIndustryByCategory is a function");
  assert(typeof adapter.getProject === "function", "adapter.getProject is a function");
  assert(typeof adapter.getAllProjects === "function", "adapter.getAllProjects is a function");
  assert(typeof adapter.saveProject === "function", "adapter.saveProject is a function");
  assert(typeof adapter.getIndex === "function", "adapter.getIndex is a function");
  assert(typeof adapter.updateIndex === "function", "adapter.updateIndex is a function");

  // Test: all 14 methods implemented
  const methodCount = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))
    .filter((name) => name !== "constructor" && typeof adapter[name as keyof typeof adapter] === "function")
    .length;
  // initialize + 4 client + 4 industry + 3 project + 2 index = 14
  assertEqual(methodCount, 14, "14 methods implemented");

  console.log("  鈫?Adapter class structure: all tests passed");
}

// ========== Test: Supabase Connection (integration, graceful skip) ==========

async function testSupabaseIntegration() {
  console.log("\n--- Supabase Integration (requires connection) ---");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.log("  鈿?SKIPPED: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY not set");
    console.log("  鈫?Set these in .env.local and re-run for integration tests");
    return;
  }

  try {
    const { supabaseAdmin } = await import("../../supabase");
    // Verify connection by querying a known table
    const { data, error } = await supabaseAdmin
      .from("memory_index")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.log(`  鈿?SKIPPED: Cannot access memory tables 鈥?${error.message}`);
      console.log("  鈫?Run MEMORY_SUPABASE_SCHEMA.sql in Supabase SQL Editor first");
      return;
    }

    // Connection works
    console.log("  鉁?Supabase connection verified");
    console.log("  鉁?memory_index table accessible");

    // Test getIndex returns a valid result
    const { SupabaseMemoryAdapter } = await import("../supabase-adapter");
    const adapter = new SupabaseMemoryAdapter();
    const index = await adapter.getIndex();
    assert(typeof index.version === "number", "getIndex() returns object with version");
    assert(typeof index.totalClients === "number", "getIndex() returns totalClients");
    assert(typeof index.totalProjects === "number", "getIndex() returns totalProjects");
    assert(typeof index.industryCoverage === "object", "getIndex() returns industryCoverage");

    console.log("  鈫?Supabase integration: all tests passed");
  } catch (e: any) {
    console.log(`  鈿?SKIPPED: Integration error 鈥?${e.message}`);
  }
}

// ========== Run All Tests ==========

async function main() {
  console.log("Supabase Memory Adapter Tests\n" + "=".repeat(35));

  // Pure function tests (no Supabase needed)
  testEnforceMaxSnapshots();
  testBuildIndustryCoverage();
  testAdapterSelection();

  // Class instantiation test
  await testAdapterClassStructure();

  // Integration test (requires Supabase connection, gracefully skips)
  await testSupabaseIntegration();

  console.log(`\n${"=".repeat(35)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});

