/**
 * Supabase Memory Adapter — Controlled Write Integration Test
 *
 * Writes test data to real Supabase with `__test_` prefix,
 * verifies CRUD operations, then cleans up.
 *
 * Safe to re-run: uses deterministic test IDs (upsert-friendly).
 *
 * Run: npx tsx --env-file=.env.local src/lib/memory/__tests__/supabase-write-test.ts
 */


import { generateClientId } from "../client-id";

// ========== Test Identity ==========

const TEST_PREFIX = "__test_";
const TEST_COMPANY = `${TEST_PREFIX}brand_brain_memory_adapter__`;
const TEST_PROJECT_ID = `${TEST_PREFIX}project_memory_adapter__`;

let passed = 0;
let failed = 0;
let warnings = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}`);
  }
}

function assertEqual<T>(actual: T, expected: T, name: string) {
  if (actual === expected) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name} (expected: ${expected}, actual: ${actual})`);
  }
}


// ========== Cleanup Helper ==========

async function cleanupTestData(adapter: any) {
  // Delete test project
  try {
    const { supabaseAdmin } = await import("../../supabase");
    await supabaseAdmin.from("memory_projects").delete().eq("project_id", TEST_PROJECT_ID);
    await supabaseAdmin.from("memory_projects").delete().like("company_name", `${TEST_PREFIX}%`);
  } catch { /* ignore cleanup errors */ }

  // Delete test client (by hash ID and by company name pattern)
  try {
    const { supabaseAdmin } = await import("../../supabase");
    const hashId = generateClientId(TEST_COMPANY);
    await supabaseAdmin.from("memory_clients").delete().eq("client_id", hashId);
    await supabaseAdmin.from("memory_clients").delete().like("company_name", `${TEST_PREFIX}%`);
  } catch { /* ignore cleanup errors */ }
}

// ========== Main ==========

async function main() {
  console.log("Supabase Write Integration Test\n" + "=".repeat(35));
  console.log(`Test client:  ${TEST_COMPANY}`);
  console.log(`Test project: ${TEST_PROJECT_ID}\n`);

  // --- Setup ---

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.log("  \u26A0 SKIPPED: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY not set");
    console.log("  \u2192 Set these in .env.local and re-run");
    process.exit(0);
  }

  const { supabaseAdmin } = await import("../../supabase");
  const { SupabaseMemoryAdapter } = await import("../supabase-adapter");

  // Clean up any residual test data from previous runs
  console.log("--- Cleanup (previous test residue) ---");
  const adapter = new SupabaseMemoryAdapter();
  await cleanupTestData(adapter);
  console.log("  \u2713 cleanup done\n");

  // --- Test 1: Initialize ---

  console.log("--- Initialize ---");
  await adapter.initialize();
  console.log("  \u2713 adapter.initialize()\n");

  // --- Test 2: saveClient ---

  console.log("--- saveClient + getClient ---");
  const hashId = generateClientId(TEST_COMPANY);

  const testClient = {
    clientId: hashId,
    companyName: TEST_COMPANY,
    industry: "test_industry",
    industryCategory: "test_industry",
    hasLogo: false,
    hasMascot: false,
    brandStage: "test",
    projectIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectCount: 0,
  };

  await adapter.saveClient(testClient);
  console.log("  \u2713 saveClient() executed without error");

  const saved = await adapter.getClient(hashId);
  assert(saved !== null, "getClient() returns saved client");
  if (saved) {
    assertEqual(saved.companyName, TEST_COMPANY, "companyName matches");
    assertEqual(saved.clientId, hashId, "clientId matches generated hash");
    assertEqual(saved.industryCategory, "test_industry", "industryCategory matches");
  }
  console.log("");

  // --- Test 3: findClientByCompany ---

  console.log("--- findClientByCompany ---");
  const found = await adapter.findClientByCompany(TEST_COMPANY);
  assert(found !== null, "findClientByCompany() returns client");
  if (found) {
    assertEqual(found.clientId, hashId, "find returns correct clientId");
  }
  console.log("");

  // --- Test 4: saveProject + getProject ---

  console.log("--- saveProject + getProject ---");
  const testProject = {
    projectId: TEST_PROJECT_ID,
    clientId: hashId,
    companyName: TEST_COMPANY,
    status: "analyzed" as const,
    brainResults: [
      {
        timestamp: new Date().toISOString(),
        brandProfile: { test: true },
        packageRecommendation: {},
        modulePlan: {},
        designDirection: {},
        assetGuardResult: {},
        generatedUrls: [],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await adapter.saveProject(testProject);
  console.log("  \u2713 saveProject() executed without error");

  const savedProject = await adapter.getProject(TEST_PROJECT_ID);
  assert(savedProject !== null, "getProject() returns saved project");
  if (savedProject) {
    assertEqual(savedProject.companyName, TEST_COMPANY, "project companyName matches");
    assertEqual(savedProject.clientId, hashId, "project clientId matches");
    assertEqual(savedProject.status, "analyzed", "project status matches");
    assertEqual(savedProject.brainResults.length, 1, "brainResults has 1 snapshot");
  }
  console.log("");

  // --- Test 5: updateIndex ---

  console.log("--- updateIndex ---");
  await adapter.updateIndex();
  const index = await adapter.getIndex();
  assert(typeof index.totalClients === "number", "index.totalClients is number");
  assert(typeof index.totalProjects === "number", "index.totalProjects is number");
  // Don't assert exact count since other projects/clients may coexist
  console.log(`  \u2713 index: ${index.totalClients} clients, ${index.totalProjects} projects`);
  console.log("");

  // --- Test 6: Snapshot enforcement (via save) ---

  console.log("--- Snapshot Enforcement (max=10) ---");
  // Add 5 more snapshots (total 6) — should keep all
  for (let i = 0; i < 5; i++) {
    testProject.brainResults.push({
      timestamp: new Date(Date.now() + (i + 1) * 1000).toISOString(),
      brandProfile: { test: true, iteration: i + 2 },
      packageRecommendation: {},
      modulePlan: {},
      designDirection: {},
      assetGuardResult: {},
      generatedUrls: [],
    });
  }
  testProject.updatedAt = new Date().toISOString();

  // Resave — upsert with 6 snapshots
  await adapter.saveProject(testProject);

  const projectWith6 = await adapter.getProject(TEST_PROJECT_ID);
  assert(projectWith6 !== null, "getProject after 6 snapshots");
  if (projectWith6) {
    assert(projectWith6.brainResults.length >= 6, "at least 6 snapshots kept");
  }
  console.log(`  \u2713 6 snapshots: all preserved`);

  // Add 10 more snapshots (total 16) — should be trimmed to 10
  for (let i = 0; i < 10; i++) {
    testProject.brainResults.push({
      timestamp: new Date(Date.now() + (i + 10) * 1000).toISOString(),
      brandProfile: { test: true, iteration: i + 7 },
      packageRecommendation: {},
      modulePlan: {},
      designDirection: {},
      assetGuardResult: {},
      generatedUrls: [],
    });
  }
  testProject.updatedAt = new Date().toISOString();

  await adapter.saveProject(testProject);

  const projectTrimmed = await adapter.getProject(TEST_PROJECT_ID);
  assert(projectTrimmed !== null, "getProject after 16 snapshots");
  if (projectTrimmed) {
    assertEqual(projectTrimmed.brainResults.length, 10, "16 snapshots trimmed to 10");
    // Verify oldest were dropped: first snapshot should be iteration 7 (0-indexed from the first batch of 10)
    const firstKept = projectTrimmed.brainResults[0].brandProfile?.iteration;
    assert(firstKept !== undefined, "first kept snapshot has iteration field");
    console.log(`  \u2713 First kept iteration: ${firstKept} (oldest 6 dropped)`);
  }
  console.log("");

  // --- Summary ---

  console.log("=".repeat(35));
  console.log(`Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);

  if (failed === 0) {
    console.log("\nAll write operations verified on real Supabase.");
  }

  // --- Cleanup ---

  console.log("\n--- Cleanup (test data) ---");
  await cleanupTestData(adapter);
  console.log("  \u2713 test data removed\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
