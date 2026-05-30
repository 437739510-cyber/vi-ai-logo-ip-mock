/**
 * Brand Brain — Agents Index
 *
 * Central export point for all agents and the orchestrator.
 */

export { type Agent, type AgentResult, type AgentContext, type AgentId, type OrchestratorMode } from "./types";
export { AGENT_IDENTITIES, DEFAULT_AGENT_SEQUENCE } from "./types";

export { brandAnalystAgent, brandAnalystIdentity } from "./brand-analyst";
export { brandPlannerAgent, brandPlannerIdentity } from "./brand-planner";
export { designDirectorAgent, designDirectorIdentity, type DesignDirection } from "./design-director";
export { assetGuardianAgent, assetGuardianIdentity, type AssetGuardianOutput } from "./asset-guardian-agent";
export { manualComposerAgent, manualComposerIdentity } from "./manual-composer";

export {
  executeBrandBrainPipeline,
  type OrchestratorEvent,
  type OrchestratorEventType,
  type OrchestratorCallback,
} from "./orchestrator";
