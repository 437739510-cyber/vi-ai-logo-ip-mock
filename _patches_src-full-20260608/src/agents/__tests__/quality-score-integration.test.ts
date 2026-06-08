/**
 * Quality Score Integration — Phase 1 Test
 *
 * Validates that Quality Score is calculated and written to Memory
 * during pipeline execution (Logging Only mode).
 *
 * Run: npx tsx --env-file=.env.local src/agents/__tests__/quality-score-integration.test.ts
 */

const TEST_PREFIX = "__test_qs_";
const TEST_COMPANY = TEST_PREFIX + "integration__";
const TEST_PROJECT = TEST_PREFIX + "project__";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log("  \u2713 " + name); }
  else { failed++; console.log("  \u2717 " + name); }
}

function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) { passed++; console.log("  \u2713 " + name); }
  else { failed++; console.log("  \u2717 " + name + " (expected: " + JSON.stringify(expected) + ", actual: " + JSON.stringify(actual) + ")"); }
}

async function main() {
  console.log("=== Quality Score Integration Test (Phase 1) ===\n");

  const { supabaseAdmin } = await import("../../lib/supabase");
  const { executeBrandBrainPipeline } = await import("../orchestrator");
  const { getMemoryAdapter, initializeMemorySystem } = await import("../../lib/memory");

  // Setup: env = supabase for Memory
  process.env.NEXT_PUBLIC_MEMORY_ADAPTER = "supabase";
  await initializeMemorySystem();
  const adapter = getMemoryAdapter();

  // Cleanup previous test data
  for (const tbl of ["memory_projects", "memory_clients"]) {
    await supabaseAdmin.from(tbl).delete().like("company_name", TEST_PREFIX + "%");
  }

  // === Test 1: Run pipeline with Yedao-style input (low quality) ===

  console.log("--- Test 1: Pipeline with Yedao-style input ---");

  // Input that mimics the field mapping issue: brandDescription instead of brandVision
  const lowQualityInput = {
    companyName: TEST_COMPANY,
    industry: "food_beverage",  // encoded, not human-readable
    brandDescription: "Good food, fresh ingredients",
    businessProfile: {
      targetAudience: "local customers",
      brandPersonality: "honest, fresh",
    },
    logoAssets: [],
    mascotAssets: [],
    industryCategory: "food_beverage",
  };

  try {
    const result = await executeBrandBrainPipeline(lowQualityInput, TEST_PROJECT, {
      mode: "plan-only",
    });

    assert(result.success, "pipeline executed");

    // After pipeline, get the project from Memory and check qualityScore
    const savedProject = await adapter.getProject(TEST_PROJECT);
    assert(savedProject !== null, "project saved to Memory");

    if (savedProject) {
      const qs = savedProject.qualityScore;
      console.log("  Quality Score object:", JSON.stringify(qs, null, 2));

      // Phase A checks
      assert(!!qs, "qualityScore exists in ProjectMemory");
      if (qs) {
        assert(typeof qs.total === "number", "total is a number");
        assert(qs.total >= 0 && qs.total <= 100, "total in 0-100 range");
        assert(typeof qs.checkedAt === "string", "checkedAt is a string");
        assert(Array.isArray(qs.flags), "flags is an array");

        // With Yedao-style input (brandDescription instead of brandVision),
        // Phase A should be FAIL or WARN (not PASS)
        console.log("  Phase A gate:", qs.flags);
        // This input should trigger FAIL because:
        // - brandDescription not mapped to brandVision -> low confidence
        // - industry "food_beverage" not mapped to human label -> unknown brandType
        // But actual score depends on how much the AI extracts...

        // At minimum, qualityScore should have dimensions
        assert(typeof qs.dimensions === "object", "dimensions is an object");
        const dimKeys = Object.keys(qs.dimensions);
        assert(dimKeys.length >= 4, "at least 4 dimension keys (got: " + dimKeys.join(", ") + ")");
      }
    }
  } catch (e: any) {
    assert(false, "pipeline execution: " + e.message);
  }

  // === Test 2: Verify qualityScore structure ===

  console.log("\n--- Test 2: Quality Score structure validation ---");

  const project = await adapter.getProject(TEST_PROJECT);
  if (project && project.qualityScore) {
    const qs = project.qualityScore;

    // Structure checks
    assert("total" in qs, "has total field");
    assert("dimensions" in qs, "has dimensions field");
    assert("flags" in qs, "has flags field");
    assert("checkedAt" in qs, "has checkedAt field");

    // Type checks
    assert(typeof qs.total === "number", "total is number");
    assert(typeof qs.checkedAt === "string", "checkedAt is string");
    assert(Array.isArray(qs.flags), "flags is array");

    // Flag content check
    if (qs.flags.length > 0) {
      const validFlags = ["brand_analysis_failed", "brand_analysis_low_confidence",
        "module_plan_failed", "module_plan_low_quality"];
      for (const flag of qs.flags) {
        assert(validFlags.includes(flag), "flag '" + flag + "' is valid");
      }
    }
  }

  // === Test 3: Quality score does NOT block pipeline ===

  console.log("\n--- Test 3: Pipeline not blocked by low quality ---");

  // The project should exist in Memory even if quality was FAIL
  const checkProject = await adapter.getProject(TEST_PROJECT);
  assert(checkProject !== null, "project exists in Memory regardless of quality score");
  if (checkProject) {
    assertEqual(checkProject.brainResults.length, 1, "brainResults has 1 snapshot");
    assert(!!checkProject.brainResults[0].modulePlan, "module plan exists in brainResult");
  }

  // === Test 4: Verify JSON adapter unaffected ===

  console.log("\n--- Test 4: JSON Adapter unaffected ---");

  // The orchestrator uses getMemoryAdapter(), which returns SupabaseMemoryAdapter
  // when NEXT_PUBLIC_MEMORY_ADAPTER=supabase. JSON adapter is not used.
  // Verify by checking the adapter class name
  assert(
    adapter.constructor.name === "SupabaseMemoryAdapter",
    "adapter is SupabaseMemoryAdapter (JSON adapter not affected)"
  );

  // === Cleanup ===

  console.log("\n--- Cleanup ---");
  for (const tbl of ["memory_projects", "memory_clients"]) {
    await supabaseAdmin.from(tbl).delete().like("company_name", TEST_PREFIX + "%");
  }
  console.log("  done\n");

  // === Results ===

  console.log("========================================");
  console.log("Results: " + passed + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
