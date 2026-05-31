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

import type { AgentContext, AgentId, OrchestratorConfig, OrchestratorMode, AgentResult } from "./types";
import { DEFAULT_AGENT_SEQUENCE } from "./types";
import { brandAnalystAgent } from "./brand-analyst";
import { brandPlannerAgent } from "./brand-planner";
import { mascotDesignerAgent } from "./mascot-designer";
import { designDirectorAgent } from "./design-director";
import { assetGuardianAgent } from "./asset-guardian-agent";
import { manualComposerAgent } from "./manual-composer";
import { getMemoryAdapter } from "@/lib/memory";
import type { ClientMemory, ProjectMemory, BrainResultSnapshot } from "@/lib/memory";

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
    existingClient = await memory.findClientByCompany(clientInfo?.companyName || "");
    existingProject = await memory.getProject(projectId);
  } catch (e) {
    console.warn("[orchestrator] Memory read failed:", e);
  }
  if (existingClient) {
    console.log("[orchestrator] Found existing client:", existingClient.companyName, "projects:", existingClient.projectCount);
  }

  // Initialize context
  const context: AgentContext = {
    clientInfo,
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
  };

  // Emit start event
  emitEvent(onEvent, {
    type: "orchestrator:start",
    timestamp: Date.now(),
    data: { mode, agentSequence },
  });

  // Run agents sequentially
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

      // Execute agent
      const result = await agent.execute(options?.input || {}, context);
      results[agentId] = result;

      if (result.success && result.data) {
        // Update context with agent's output
        switch (agentId) {
          case "brand-analyst":
            context.brandProfile = result.data.profile;
            break;
          case "brand-planner":
            context.modulePlan = result.data;
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
        clientId: clientInfo?.companyName?.replace(/[\s\/]/g, "_") || projectId,
        companyName: clientInfo?.companyName || "",
        industry: clientInfo?.industry || "",
        industryCategory: context.brandProfile?.industryCategory || "",
        hasLogo: (clientInfo?.logoAssets?.length || 0) > 0,
        hasMascot: (clientInfo?.mascotAssets?.length || 0) > 0,
        brandStage: context.brandProfile?.brandStage || "unknown",
        projectIds: existingClient ? [...new Set([...existingClient.projectIds, projectId])] : [projectId],
        latestBrainResultId: projectId,
        latestBusinessProfile: clientInfo?.businessProfile || undefined,
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
        businessProfile: clientInfo?.businessProfile || undefined,
      };
      const projMem: ProjectMemory = {
        projectId,
        clientId: clientMem.clientId,
        companyName: clientInfo?.companyName || "",
        brainResults: existingProject ? [...existingProject.brainResults, snapshot] : [snapshot],
        status: context.generationResult ? "generated" : "analyzed",
        createdAt: existingProject?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await memory.saveProject(projMem);
      console.log("[orchestrator] Memory saved for project:", projectId);
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
