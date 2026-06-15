/**
 * 椰岛工坊 Phase 1 验证 — Brand Analysis
 *
 * 使用真实 Pipeline + Supabase Memory 执行椰岛工坊品牌分析。
 * 不修改代码，不开发新功能。
 *
 * Run: npx tsx --env-file=.env.local src/lib/memory/__tests__/yedao-validation.ts
 */

const PROJECT_ID = "VI-20260528-NDKW";
const COMPANY_NAME = "椰岛工坊";
const TEST_PREFIX = "__test_vercel_";

import type { IndustryMemory } from "../types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log("  \u2713 " + name); }
  else { failed++; console.log("  \u2717 " + name); }
}

function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) { passed++; console.log("  \u2713 " + name); }
  else { failed++; console.log("  \u2717 " + name + " (expected: " + expected + ", actual: " + actual + ")"); }
}

async function main() {
  console.log("=== 椰岛工坊 Phase 1 Validation ===");
  console.log("Project: " + PROJECT_ID);
  console.log("Brand: " + COMPANY_NAME);
  console.log("Mode: plan-only (real AI, real Supabase)\n");

  // --- Setup ---
  process.env.NEXT_PUBLIC_MEMORY_ADAPTER = "supabase";
  const { executeBrandBrainPipeline } = await import("../../../agents/orchestrator");
  const { getMemoryAdapter, initializeMemorySystem } = await import("../../memory");
  const { supabaseAdmin } = await import("../../supabase");

  // Clean up any test data from previous runs
  for (const tbl of ["memory_projects", "memory_clients"]) {
    await supabaseAdmin.from(tbl).delete().like("company_name", TEST_PREFIX + "%");
  }

  // Initialize memory system (pre-loads industry knowledge)
  await initializeMemorySystem();
  const adapter = getMemoryAdapter();

  // Verify industry knowledge is loaded
  const industries = await adapter.getAllIndustries();
  const foodBev = industries.find((i: IndustryMemory) => i.category === "food_beverage");
  assert(!!foodBev, "food_beverage industry knowledge exists");
  if (foodBev) {
    console.log("  Industry: " + foodBev.category);
    console.log("  Design styles: " + JSON.stringify(foodBev.designStyle));
    console.log("  Color tendencies: " + JSON.stringify(foodBev.colorTendency));
    console.log("  Visual keywords: " + JSON.stringify(foodBev.visualKeywords));
    console.log("  Sample brands: " + JSON.stringify(foodBev.sampleBrands));
  }
  console.log("");

  // --- Run Pipeline ---
  console.log("--- Running Pipeline (plan-only) ---");
  const clientInfo = {
    companyName: COMPANY_NAME,
    industry: "food_beverage",
    brandDescription: "北纬18度黄金产区的椰子水定制专家，主打健康热带饮品",
    businessProfile: {
      productCategory: "coconut_water",
      targetAudience: "高端酒店采购、健身博主、健康生活方式消费者",
      brandPersonality: "自然、健康、匠心、热带、阳光、专业",
    },
    logoAssets: [{ type: "logo", label: "主Logo", url: "uploaded" }],
    mascotAssets: [{ type: "mascot", label: "IP公仔", url: "uploaded" }],
    industryCategory: "food_beverage",
  };

  console.log("  Calling executeBrandBrainPipeline (AI API)...");
  try {
    const result = await executeBrandBrainPipeline(clientInfo, PROJECT_ID, {
      mode: "plan-only",
    });

    assert(result.success, "Pipeline executed successfully");
    if (!result.success) {
      console.log("  Errors: " + JSON.stringify(result.errors));
    }
    console.log("");

    if (result.success) {
      const ctx = result.context;

      // ==== Section: Brand Profile ====
      console.log("=== Brand Profile ===");
      const bp = ctx.brandProfile;
      assert(!!bp, "brandProfile exists");
      if (bp) {
        assertEqual(bp.industryCategory, "food_beverage", "industryCategory = food_beverage");
        assert(!!bp.brandType, "brandType defined");
        assert(bp.confidence >= 0.5, "confidence >= 0.5 (got: " + bp.confidence + ")");
        assert(bp.brandPersona.length >= 3, "brandPersona has >= 3 traits");
        assert(bp.visualDirection !== "unknown", "visualDirection is determined");
        assert(bp.brandStage !== "unknown", "brandStage is determined (not unknown)");
        console.log("  Brand Type: " + bp.brandType);
        console.log("  Confidence: " + bp.confidence);
        console.log("  Brand Stage: " + bp.brandStage);
        console.log("  Brand Persona: " + JSON.stringify(bp.brandPersona));
        console.log("  Visual Direction: " + bp.visualDirection);
        console.log("  Brand Archetype: " + bp.brandArchetype);
        console.log("  Brand Positioning: " + bp.brandPositioning);
        console.log("  Target Audience: " + bp.targetAudience);
        console.log("  Differentiators: " + JSON.stringify(bp.differentiators));
        console.log("  Brand Voice: " + JSON.stringify(bp.brandVoice));
      }
      console.log("");

      // ==== Section: Visual Direction ====
      console.log("=== Visual Direction ===");
      const dd = ctx.designDirection;
      assert(!!dd, "designDirection exists");
      if (dd) {
        console.log("  Design Direction: " + JSON.stringify(dd));
      }
      console.log("");

      // ==== Section: Module Plan ====
      console.log("=== Module Plan ===");
      const mp = ctx.modulePlan;
      assert(!!mp, "modulePlan exists");
      if (mp) {
        const plan = mp.modulePlan || mp;
        assert(!!plan.modules, "modules list exists");
        assert(plan.modules.length >= 5, "at least 5 modules recommended");
        console.log("  Total modules: " + plan.modules.length);
        console.log("  Total pages: " + (plan.totalEstimatedPages || "N/A"));
        console.log("  Package: " + (plan.packageRecommendation?.recommended?.name || "N/A"));

        const essentialMods = plan.modules.filter((m: any) => m.priority === "essential");
        const recommendedMods = plan.modules.filter((m: any) => m.priority === "recommended");
        const optionalMods = plan.modules.filter((m: any) => m.priority === "optional");
        console.log("  Essential: " + essentialMods.length + ", Recommended: " + recommendedMods.length + ", Optional: " + optionalMods.length);

        console.log("  Module list:");
        for (const m of plan.modules) {
          console.log("    [" + m.priority + "] " + m.label + " (" + m.estimatedPages + "p, score:" + m.score + ")");
        }
      }
      console.log("");

      // ==== Section: Asset Guardian ====
      console.log("=== Asset Guardian ===");
      const ag = ctx.assetGuardResult;
      assert(!!ag, "assetGuardResult exists");
      if (ag) {
        console.log("  Asset Guard: " + JSON.stringify(ag).substring(0, 200));
      }
      console.log("");

      // ==== Section: Memory Verification ====
      console.log("=== Memory Write Verification ===");
      const savedClient = await adapter.findClientByCompany(COMPANY_NAME);
      assert(savedClient !== null, "ClientMemory saved to Supabase");
      if (savedClient) {
        assertEqual(savedClient.companyName, COMPANY_NAME, "companyName = " + COMPANY_NAME);
        assert(savedClient.projectIds.includes(PROJECT_ID), "projectIds includes " + PROJECT_ID);
        assert(!!savedClient.createdAt, "createdAt timestamp set");
        assert(!!savedClient.updatedAt, "updatedAt timestamp set");
        console.log("  Client ID: " + savedClient.clientId);
        console.log("  Industry: " + savedClient.industry);
        console.log("  Project Count: " + savedClient.projectCount);
        console.log("  Has Logo: " + savedClient.hasLogo);
        console.log("  Has Mascot: " + savedClient.hasMascot);
      }

      const savedProject = await adapter.getProject(PROJECT_ID);
      assert(savedProject !== null, "ProjectMemory saved to Supabase");
      if (savedProject) {
        assertEqual(savedProject.companyName, COMPANY_NAME, "project companyName = " + COMPANY_NAME);
        assert(savedProject.brainResults.length >= 1, "brainResults has >= 1 snapshot");
        const latest = savedProject.brainResults[savedProject.brainResults.length - 1];
        assert(!!latest.brandProfile, "latest snapshot has brandProfile");
        assert(!!latest.modulePlan, "latest snapshot has modulePlan");
        assert(!!latest.designDirection, "latest snapshot has designDirection");
        console.log("  Brain results count: " + savedProject.brainResults.length);
        console.log("  Latest timestamp: " + latest.timestamp);
      }
      console.log("");

      // ==== Section: Quality Score ====
      console.log("=== Quality Score (Current) ===");
      if (savedProject && savedProject.qualityScore) {
        const qs = savedProject.qualityScore;
        console.log("  Total: " + qs.total + "/100");
        console.log("  Dimensions: " + JSON.stringify(qs.dimensions));
        assert(qs.total >= 50, "Quality Score >= 50 (baseline)");
        if (qs.total >= 70) {
          console.log("  Status: PASS (threshold >= 70)");
        } else if (qs.total >= 50) {
          console.log("  Status: REVIEW (threshold 50-69)");
        } else {
          console.log("  Status: FAIL (< 50)");
        }
      } else {
        console.log("  Quality Score not set in this snapshot");
        console.log("  (Quality Score integration is a V1.1 backlog item)");
      }
      console.log("");

      // ==== Section: Issues Found ====
      console.log("=== Issues Found ===");
      const issues = [];
      if (bp) {
        if (bp.brandStage === "unknown") issues.push("brandStage not determined");
        if (bp.confidence < 0.6) issues.push("low confidence: " + bp.confidence);
        if (!bp.visualDirection || bp.visualDirection === "unknown") issues.push("visualDirection not determined");
        const personaUnique = new Set(bp.brandPersona);
        if (personaUnique.size < 3) issues.push("brandPersona too few: " + bp.brandPersona.length);
      }
      if (mp) {
        const plan = mp.modulePlan || mp;
        if (!plan.packageRecommendation) issues.push("no package recommendation");
      }
      if (issues.length === 0) {
        console.log("  No critical issues found");
      } else {
        for (const issue of issues) {
          console.log("  - " + issue);
        }
      }
      console.log("");

      // ==== Section: Recommendations ====
      console.log("=== Recommendations ===");
      console.log("  1. Re-run with full mode for generation validation");
      console.log("  2. Manual review of brand profile accuracy");
      console.log("  3. Review module plan for food_beverage completeness");
      console.log("  4. Quality Score < 70 -> flag for manual review");
      console.log("  5. coconut sub-category not in industry-knowledge.ts");
      console.log("     - Current: food_beverage / beverage");
      console.log("     - Yedao specific: coconut water");
      console.log("     - Consider adding if repeated analyses show drift");
    }
  } catch (e: any) {
    console.error("Pipeline error: " + e.message);
    assert(false, "pipeline execution: " + e.message);
  }

  // --- Cleanup test data (not Yedao data) ---
  for (const tbl of ["memory_projects", "memory_clients"]) {
    await supabaseAdmin.from(tbl).delete().like("company_name", TEST_PREFIX + "%");
  }

  // --- Results ---
  console.log("========================================");
  console.log("Results: " + passed + " passed, " + failed + " failed");
  console.log("========================================");

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Validation error:", e);
  process.exit(1);
});
