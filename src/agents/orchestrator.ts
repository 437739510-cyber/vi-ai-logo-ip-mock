/**
 * Brand Brain — Orchestrator
 *
 * The central coordinator that manages the agent pipeline.
 *
 * Flow:
 *   clientInfo
 *     → Brand Analyst → brandProfile
 *       → Brand Planner → modulePlan
 *         → Mascot Designer → mascotProfile
 *           → Design Director → designDirection
 *             → Asset Guardian → assetGuardResult
 *               → Manual Composer → generationResult
 *
 * Each agent runs sequentially, passing context to the next.
 * The orchestrator handles errors, tracks progress, and
 * provides a unified interface for the frontend to consume.
 */

// ========== Quality Score Calculation (Phase 1: Logging Only) ==========

interface PhaseScore {
  score: number;
  gate: "PASS" | "WARN" | "FAIL";
  flags: string[];
  dimensions: Record<string, number>;
}

function calculatePhaseA(context: AgentContext): PhaseScore {
  const bp = context.brandProfile;
  if (!bp) {
    return { score: 0, gate: "FAIL", flags: ["no_brand_profile"], dimensions: {} };
  }

  let score = 0;
  const dims: Record<string, number> = {};

  const confScore = Math.round(bp.confidence * 40);
  score += confScore;
  dims.confidence = confScore;

  const typeScore = (bp.brandType !== "unknown" && bp.brandType !== undefined) ? 15 : 0;
  score += typeScore;
  dims.brandType = typeScore;

  const personaScore = Math.min(Math.round(((bp.brandPersona?.length || 0) / 6) * 15), 15);
  score += personaScore;
  dims.brandPersona = personaScore;

  const stageScore = (bp.brandStage !== "unknown" && bp.brandStage !== undefined) ? 10 : 0;
  score += stageScore;
  dims.brandStage = stageScore;

  const diffScore = Math.min((bp.differentiators?.length || 0) * 2, 10);
  score += diffScore;
  dims.differentiators = diffScore;

  const visScore = (bp.visualDirection && bp.visualDirection !== "unknown") ? 10 : 0;
  score += visScore;
  dims.visualDirection = visScore;

  score = Math.min(100, Math.round(score));
  let gate: "PASS" | "WARN" | "FAIL" = "PASS";
  const flags: string[] = [];
  if (score < 40) { gate = "FAIL"; flags.push("brand_analysis_failed"); }
  else if (score < 70) { gate = "WARN"; flags.push("brand_analysis_low_confidence"); }

  return { score, gate, flags, dimensions: dims };
}

function calculatePhaseB(context: AgentContext): PhaseScore {
  const mp = context.modulePlan;
  if (!mp) {
    return { score: 0, gate: "FAIL", flags: ["no_module_plan"], dimensions: {} };
  }

  const plan = mp.modulePlan || mp;
  const modules = plan.modules || [];

  let score = 0;
  const dims: Record<string, number> = {};

  dims.planExists = 20;
  score += 20;

  const essentialCount = modules.filter((m: any) => m.priority === "essential").length;
  const essScore = Math.min(essentialCount * 5, 25);
  score += essScore;
  dims.essentialModules = essScore;

  const totalScore = Math.min(modules.length * 1.5, 15);
  score += totalScore;
  dims.totalModules = Math.round(totalScore);

  const pkgScore = plan.packageRecommendation ? 20 : 0;
  score += pkgScore;
  dims.packageRecommendation = pkgScore;

  const pages = plan.totalEstimatedPages || 0;
  const pageScore = (pages >= 10 && pages <= 50) ? 20 : (pages > 0 ? 10 : 0);
  score += pageScore;
  dims.totalEstimatedPages = pageScore;

  score = Math.min(100, Math.round(score));
  let gate: "PASS" | "WARN" | "FAIL" = "PASS";
  const flags: string[] = [];
  if (score < 50) { gate = "FAIL"; flags.push("module_plan_failed"); }
  else if (score < 70) { gate = "WARN"; flags.push("module_plan_low_quality"); }

  return { score, gate, flags, dimensions: dims };
}

function buildQualityScore(context: AgentContext): {
  total: number;
  dimensions: Record<string, number>;
  flags: string[];
  phaseA: PhaseScore;
  phaseB: PhaseScore | null;
  checkedAt: string;
} {
  const phaseA = calculatePhaseA(context);
  const phaseB = calculatePhaseB(context);

  const available = [phaseA];
  if (phaseB.score > 0) available.push(phaseB);
  const total = Math.round(available.reduce((s, p) => s + p.score, 0) / available.length);

  const allFlags = [...phaseA.flags];
  if (phaseB) allFlags.push(...phaseB.flags);

  return {
    total,
    dimensions: { ...phaseA.dimensions, ...(phaseB?.dimensions || {}) },
    flags: allFlags,
    phaseA,
    phaseB: phaseB.score > 0 ? phaseB : null,
    checkedAt: new Date().toISOString(),
  };
}



import type { AgentContext, AgentId, OrchestratorConfig, OrchestratorMode, AgentResult } from "./types";
import { DEFAULT_AGENT_SEQUENCE } from "./types";
import { brandAnalystAgent } from "./brand-analyst";
import { brandPlannerAgent } from "./brand-planner";
import { mascotDesignerAgent } from "./mascot-designer";
import { designDirectorAgent } from "./design-director";
import { assetGuardianAgent } from "./asset-guardian-agent";
import { manualComposerAgent } from "./manual-composer";
import { evaluatorAgent } from "./evaluator";
import { getMemoryAdapter } from "@/lib/core/memory";
import { DEFAULT_HARNESS_CONFIG, withRetry, CircuitBreaker, saveFailureSnapshot, qualityGate } from "@/lib/harness";
import { checkCrossIndustryContamination, validateParamPackageIntegrity, ValidationBlockedError } from "@/lib/vi-manual/quality-check";
import type { ClientMemory, ProjectMemory, BrainResultSnapshot } from "@/lib/core/memory";
import { normalizeLogoTextLanguage } from "@/lib/core/consultation-schema";
/**
 * Reverse mapping: encoded industry value → human-readable label used by brand-analyzer.
 * The analyzer expects labels like "餐饮/食品", but callers may pass "food_beverage".
 */
const ENCODED_INDUSTRY_TO_LABEL: Record<string, string> = {
  "food_beverage": "餐饮/食品",
  "technology_it": "科技/互联网",
  "retail_ecommerce": "零售/电商",
  "education_training": "教育/培训",
  "healthcare_medical": "医疗/健康",
  "finance_legal": "金融/法律",
  "culture_media": "文化/传媒",
  "manufacturing": "制造业",
  "hospitality_tourism": "酒店/旅游",
};

/**
 * Normalize raw clientInfo to match the field names expected by analyzeBrand().
 * Fixes known field mismatches without modifying agent code.
 */
function normalizeClientInfo(raw: any): any {
  return {
    companyName: raw.companyName,
    industry: ENCODED_INDUSTRY_TO_LABEL[raw.industry] || raw.industry || "",
    brandVision: raw.brandVision || raw.brandDescription || "",
    coreValues: raw.coreValues || raw.brandDescription?.slice(0, 50) || "",
    targetMarket: raw.targetMarket || raw.businessProfile?.targetAudience || "",
    logoPhilosophy: raw.logoPhilosophy || "",
    logoTextLanguage: normalizeLogoTextLanguage(raw.logoTextLanguage),
    mascotPhilosophy: raw.mascotPhilosophy || "",
    logoAssets: raw.logoAssets || [],
    mascotAssets: raw.mascotAssets || [],
  };
}


export type OrchestratorEventType =
  | "orchestrator:start"
  | "agent:start"
  | "agent:complete"
  | "agent:error"
  | "orchestrator:complete"
  | "orchestrator:error";

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  agentId?: AgentId;
  timestamp: number;
  data?: any;
  error?: string;
}

export type OrchestratorCallback = (event: OrchestratorEvent) => void;

/**
 * Execute the full agent pipeline for a given client submission.
 */
export async function executeBrandBrainPipeline(
  clientInfo: any,
  projectId: string,
  options?: {
    mode?: OrchestratorMode;
    onEvent?: OrchestratorCallback;
    input?: any;
  }
): Promise<{
  success: boolean;
  context: AgentContext;
  errors: { agentId: AgentId; error: string }[];
  results: Record<AgentId, AgentResult>;
}> {
  const mode = options?.mode || "full";
  // Normalize clientInfo field names to match what analyzeBrand() expects.
  // This fixes the Yedao brandDescription→brandVision mismatch.
  const normalizedClientInfo = normalizeClientInfo(clientInfo);

  const onEvent = options?.onEvent;

  // Determine agent sequence based on mode
  let agentSequence: AgentId[];
  switch (mode) {
    case "analyze-only":
      agentSequence = ["brand-analyst"];
      break;
    case "plan-only":
      agentSequence = ["brand-analyst", "brand-planner"];
      break;
    case "generate-only":
      agentSequence = ["asset-guardian", "manual-composer"];
      break;
    default:
      agentSequence = [...DEFAULT_AGENT_SEQUENCE];
  }

  // === Memory: Read previous knowledge ===
  const memory = getMemoryAdapter();
  let existingClient: ClientMemory | null = null;
  let existingProject: ProjectMemory | null = null;
  try {
    existingClient = await memory.findClientByCompany(normalizedClientInfo?.companyName || "");
    existingProject = await memory.getProject(projectId);
  } catch (e) {
    console.warn("[orchestrator] Memory read failed:", e);
  }
  if (existingClient) {
    console.log("[orchestrator] Found existing client:", existingClient.companyName, "projects:", existingClient.projectCount);
  }

  // Initialize context
  const context: AgentContext = {
    clientInfo: normalizedClientInfo,
    projectId,
    metadata: {
      startTime: Date.now(),
      agentSequence,
      completedAgents: [],
      errors: [],
    },
  };

  const results: Record<AgentId, AgentResult> = {} as Record<AgentId, AgentResult>;
  let pipelineSuccess = true;

  // Map agent IDs to their implementations
  const agentMap: Record<AgentId, any> = {
    "brand-analyst": brandAnalystAgent,
    "brand-planner": brandPlannerAgent,
    "mascot-designer": mascotDesignerAgent,
    "design-director": designDirectorAgent,
    "asset-guardian": assetGuardianAgent,
    "manual-composer": manualComposerAgent,
    "evaluator": evaluatorAgent,
  };

  // Emit start event
  emitEvent(onEvent, {
    type: "orchestrator:start",
    timestamp: Date.now(),
    data: { mode, agentSequence },
  });

  // Run agents sequentially
  const harness = DEFAULT_HARNESS_CONFIG;
  const breaker = new CircuitBreaker(harness.circuitBreakerThreshold);
  for (const agentId of agentSequence) {
    const agent = agentMap[agentId];

    emitEvent(onEvent, {
      type: "agent:start",
      agentId,
      timestamp: Date.now(),
      data: { name: agent.identity.name },
    });

    try {
      // Check if agent can execute
      const canExec = await agent.canExecute(context);
      if (!canExec.canRun) {
        const error = `Agent ${agent.identity.name} 无法运行: ${canExec.reason}`;
        context.metadata.errors.push({ agentId, error, timestamp: Date.now() });
        results[agentId] = {
          success: false,
          error,
          warnings: [],
          metrics: { durationMs: 0 },
        };
        emitEvent(onEvent, {
          type: "agent:error",
          agentId,
          timestamp: Date.now(),
          error,
        });
        pipelineSuccess = false;
        break;
      }

      // Harness Layer 6: Circuit breaker check
      if (!breaker.allowRequest()) {
        const breakerErr = "Circuit breaker open - too many consecutive failures";
        context.metadata.errors.push({ agentId, error: breakerErr, timestamp: Date.now() });
        pipelineSuccess = false;
        break;
      }

      // Execute agent with Harness Layer 3: retry with exponential backoff
      const { result, retries } = await withRetry<AgentResult>(
        () => agent.execute(options?.input || {}, context),
        harness,
        agentId,
      );
      results[agentId] = result;

      if (result.success && result.data) {
        // Update context with agent's output
        switch (agentId) {
          case "brand-analyst":
                        context.brandProfile = result.data.profile;
            // Harness Layer 5: Quality gate Phase A
            const qa = buildQualityScore(context);
            const gateA = qualityGate("A", qa.phaseA.score, harness);
            if (!gateA.passed) {
              console.warn("[harness] Quality gate A blocked:", gateA.reason);
              pipelineSuccess = false;
              if (harness.saveFailureSnapshots) {
                saveFailureSnapshot({
                  timestamp: new Date().toISOString(),
                  agentId,
                  projectId,
                  error: "Quality gate A: " + (gateA.reason || ""),
                  contextSnapshot: { phaseA: qa.phaseA },
                  retries: 0,
                });
              }
              break;
            }

            // M3: Validate brand analysis for cross-industry contamination
            try {
              const bpText = JSON.stringify(result.data.profile || {});
              const contamination = checkCrossIndustryContamination(
                bpText,
                context.clientInfo.industry || "",
                context.clientInfo.brandVision || context.clientInfo.coreValues || ""
              );
              if (!contamination.passed) {
                console.warn("[orchestrator] Cross-industry contamination:", contamination.dirtyWords);
              }
            } catch (vErr) {
              console.warn("[orchestrator] Validation non-blocking:", vErr);
            }
            break;
          case "brand-planner":
                        context.modulePlan = result.data;
            // Harness Layer 5: Quality gate Phase B
            const qb = buildQualityScore(context);
            const gateB = qualityGate("B", qb.phaseB?.score || 0, harness);
            if (!gateB.passed) {
              console.warn("[harness] Quality gate B blocked:", gateB.reason);
              pipelineSuccess = false;
              break;
            }

            break;
          case "mascot-designer":
            context.mascotProfile = result.data;
            break;
          case "design-director":
            context.designDirection = result.data;
            break;
          case "asset-guardian":
            context.assetGuardResult = result.data;
            break;
          case "manual-composer":
            context.generationResult = result.data;
            break;
        }

        breaker.recordSuccess();
        context.metadata.completedAgents.push(agentId);

        emitEvent(onEvent, {
          type: "agent:complete",
          agentId,
          timestamp: Date.now(),
          data: {
            warnings: result.warnings,
            metrics: result.metrics,
            summary: result.data.summary || undefined,
          },
        });
      } else {
        const error = result.error || `Agent ${agent.identity.name} 执行失败`;
        context.metadata.errors.push({ agentId, error, timestamp: Date.now() });

        emitEvent(onEvent, {
          type: "agent:error",
          agentId,
          timestamp: Date.now(),
          error,
        });

        breaker.recordFailure();
        pipelineSuccess = false;
        if (true) break; // Stop on error by default
      }
    } catch (error) {
      const errorMsg = `Agent ${agentId} 异常: ${error instanceof Error ? error.message : String(error)}`;
      context.metadata.errors.push({ agentId, error: errorMsg, timestamp: Date.now() });

      emitEvent(onEvent, {
        type: "agent:error",
        agentId,
        timestamp: Date.now(),
        error: errorMsg,
      });

        // Harness Layer 4: Save failure snapshot
        if (harness.saveFailureSnapshots) {
          saveFailureSnapshot({
            timestamp: new Date().toISOString(),
            agentId,
            projectId,
            error: errorMsg,
            contextSnapshot: {
              completedAgents: context.metadata.completedAgents,
              brandProfile: context.brandProfile ? "present" : "missing",
            },
            retries: 0,
          });
        }
        breaker.recordFailure();
        pipelineSuccess = false;
        break;
    }
  }

  // === Post-processing: Adjust modules based on Mascot Designer recommendation ===
  if (pipelineSuccess && context.mascotProfile && context.modulePlan) {
    const mascot = context.mascotProfile;
    const modulePlan = context.modulePlan.modulePlan;
    const boostModes = new Set(["create_new", "optional_recommend"]);
    if (boostModes.has(mascot.mode) && mascot.recommendedModules?.length > 0 && modulePlan?.modules) {
      const modules = modulePlan.modules;
      const boostIds = new Set([...mascot.recommendedModules, "ip-specs"]);
      for (const mod of modules) {
        if (boostIds.has(mod.id)) {
          mod.score = Math.min(100, (mod.score || 0) + 25);
          mod.priority = "essential";
          mod.reason = mascot.mode === "create_new"
            ? "Mascot Designer 判定品牌需要IP公仔，自动提升此模块优先级"
            : "Mascot Designer 推荐考虑IP公仔，适度提升此模块优先级";
        }
      }
      modulePlan.totalEstimatedPages = modules.reduce((s: number, m: any) => s + (m.estimatedPages || 0), 0);
    }
  }

  // === Memory: Write project results ===
  if (pipelineSuccess && context.brandProfile) {
    try {
      // Save client memory (including mascot profile)
      const clientMem: ClientMemory = {
        clientId: normalizedClientInfo?.companyName?.replace(/[\s\/]/g, "_") || projectId,
        companyName: normalizedClientInfo?.companyName || "",
        industry: normalizedClientInfo?.industry || "",
        industryCategory: context.brandProfile?.industryCategory || "",
        hasLogo: (normalizedClientInfo?.logoAssets?.length || 0) > 0,
        hasMascot: (normalizedClientInfo?.mascotAssets?.length || 0) > 0,
        brandStage: context.brandProfile?.brandStage || "unknown",
        projectIds: existingClient ? [...new Set([...existingClient.projectIds, projectId])] : [projectId],
        latestBrainResultId: projectId,
        latestBusinessProfile: normalizedClientInfo?.businessProfile || undefined,
        latestMascotProfile: context.mascotProfile || undefined,
        createdAt: existingClient?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectCount: (existingClient?.projectCount || 0) + (existingClient ? 0 : 1),
        targetAudience: context.brandProfile?.targetAudience,
      };
      await memory.saveClient(clientMem);

      // Save project memory (including mascot profile in snapshot)
      const snapshot: BrainResultSnapshot = {
        timestamp: new Date().toISOString(),
        brandProfile: context.brandProfile,
        packageRecommendation: context.modulePlan?.packageRecommendation,
        modulePlan: context.modulePlan,
        mascotProfile: context.mascotProfile || undefined,
        designDirection: context.designDirection,
        assetGuardResult: context.assetGuardResult,
        generatedUrls: [],
        businessProfile: normalizedClientInfo?.businessProfile || undefined,
      };
      const qs = buildQualityScore(context);
      const projMem: ProjectMemory = {
        projectId,
        clientId: clientMem.clientId,
        companyName: normalizedClientInfo?.companyName || "",
        brainResults: existingProject ? [...existingProject.brainResults, snapshot] : [snapshot],
        status: context.generationResult ? "generated" : "analyzed",
        createdAt: existingProject?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        qualityScore: {
          total: qs.total,
          dimensions: qs.dimensions,
          issues: [],
          flags: qs.flags,
          checkedAt: qs.checkedAt,
        },
      };
      await memory.saveProject(projMem);
      console.log("[orchestrator] Memory saved for project:", projectId);
      console.log("[orchestrator] Quality Score:", JSON.stringify({
        total: qs.total,
        phaseA: qs.phaseA.gate + " (" + qs.phaseA.score + ")",
        phaseB: qs.phaseB ? qs.phaseB.gate + " (" + qs.phaseB.score + ")" : "N/A",
        flags: qs.flags,
      }));
    } catch (e) {
      console.warn("[orchestrator] Memory write failed:", e);
    }
  }

  // Emit completion event
  emitEvent(onEvent, {
    type: pipelineSuccess ? "orchestrator:complete" : "orchestrator:error",
    timestamp: Date.now(),
    data: {
      totalDurationMs: Date.now() - context.metadata.startTime,
      completedAgents: context.metadata.completedAgents,
      totalErrors: context.metadata.errors.length,
    },
    error: pipelineSuccess ? undefined : "pipeline 执行中存在错误",
  });

  return {
    success: pipelineSuccess,
    context,
    errors: context.metadata.errors,
    results,
  };
}

function emitEvent(callback: OrchestratorCallback | undefined, event: OrchestratorEvent) {
  if (callback) {
    try {
      callback(event);
    } catch {
      // Ignore callback errors
    }
  }
}

