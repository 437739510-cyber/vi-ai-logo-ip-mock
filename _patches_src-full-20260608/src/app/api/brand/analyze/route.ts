/**
 * API Route: POST /api/brand/analyze
 *
 * Brand Brain V1 — analyzes brand data and returns a brand profile
 * with recommended VI manual modules.
 *
 * Uses the Orchestrator to run the agent pipeline, which automatically
 * reads from and writes to the Memory system (ClientMemory + ProjectMemory).
 *
 * This is a pure analysis endpoint:
 * - Does NOT call any image generation API (Tongyi Wanxiang / DeepSeek)
 * - Does NOT generate any images
 * - Does NOT modify any existing data
 * - Only reads clientInfo and returns structured analysis
 */

import { executeBrandBrainPipeline } from "@/agents/orchestrator";
import { initializeMemorySystem } from "@/lib/memory";
import { getProfileForBrand } from "@/lib/industry-knowledge";

let memoryInitialized = false;

export async function POST(req: Request) {
  try {
    // Step 0: Initialize memory system on first request
    // Pre-loads industry knowledge and creates storage directories
    if (!memoryInitialized) {
      await initializeMemorySystem();
      memoryInitialized = true;
      console.log("[brand/analyze] Memory system initialized");
    }

    const body = await req.json();
    const { clientInfo, projectId } = body;

    if (!clientInfo) {
      return new Response(
        JSON.stringify({ error: "clientInfo is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use Orchestrator (plan-only mode: brand-analyst → brand-planner)
    // This automatically reads/writes ClientMemory and ProjectMemory
    const pid = projectId || `tmp-${Date.now()}`;
    const result = await executeBrandBrainPipeline(clientInfo, pid, { mode: "plan-only" });

    if (!result.success) {
      const errorMsg = result.errors.map((e) => e.error).join("; ");
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const profile = result.context.brandProfile;
    // Brand Planner wraps planModules() inside { modulePlan, pagePlan, summary }
const rawPlan = result.context.modulePlan;
const modulePlan = rawPlan?.modulePlan || rawPlan;
    const industryProfile = getProfileForBrand(profile);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          profile,
          industryProfile,
          modulePlan,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[brand/analyze] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
