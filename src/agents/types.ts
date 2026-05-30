/**
 * Brand Brain — Agent Architecture
 *
 * Common types for all agents in the Brand Brain system.
 * Each agent is a self-contained unit with a defined input/output contract.
 */

// ========== Agent Identity ==========

export type AgentId =
  | "brand-analyst"
  | "brand-planner"
  | "design-director"
  | "asset-guardian"
  | "manual-composer";

export interface AgentIdentity {
  id: AgentId;
  name: string;
  description: string;
  version: string;
}

// ========== Agent Context ==========

/**
 * Shared context passed through the agent pipeline.
 * Each agent can read from and write to this context.
 */
export interface AgentContext {
  /** The original client submission */
  clientInfo: {
    companyName?: string;
    industry?: string;
    brandVision?: string;
    coreValues?: string;
    targetMarket?: string;
    logoPhilosophy?: string;
    mascotPhilosophy?: string;
    logoAssets?: { url: string; fileName?: string }[];
    mascotAssets?: { files: { url: string; fileName?: string }[]; name?: string }[];
    brandColors?: {
      primary?: { hex: string; name?: string };
      secondary?: { hex: string; name?: string };
      accent?: { hex: string; name?: string };
    };
    referenceManual?: { url: string; fileName?: string };
  };

  /** Project identifier */
  projectId: string;

  /** Reference analysis ID (if reference manual provided) */
  refId?: string;

  // === Agent outputs (populated sequentially) ===

  /** Brand Analyst output */
  brandProfile?: any;

  /** Brand Planner output */
  modulePlan?: any;

  /** Design Director output */
  designDirection?: any;

  /** Asset Guardian output */
  assetGuardResult?: any;

  /** Manual Composer output */
  generationResult?: any;

  /** Orchestrator metadata */
  metadata: {
    startTime: number;
    agentSequence: AgentId[];
    completedAgents: AgentId[];
    errors: { agentId: AgentId; error: string; timestamp: number }[];
  };
}

// ========== Agent Contract ==========

/**
 * Every agent must implement this interface.
 */
export interface Agent<TInput = any, TOutput = any> {
  identity: AgentIdentity;

  /** Execute the agent's core logic */
  execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;

  /** Validate that the agent can run (check prerequisites) */
  canExecute(context: AgentContext): Promise<{ canRun: boolean; reason?: string }>;
}

export interface AgentResult<TOutput = any> {
  success: boolean;
  data?: TOutput;
  error?: string;
  warnings: string[];
  metrics?: {
    durationMs: number;
    tokensUsed?: number;
    apiCalls?: number;
  };
}

// ========== Orchestrator ==========

export type OrchestratorMode =
  | "full"         // Run all agents sequentially
  | "analyze-only" // Only Brand Analyst
  | "plan-only"    // Only Brand Analyst → Brand Planner
  | "generate-only"; // Skip analysis, use existing plan

export interface OrchestratorConfig {
  mode: OrchestratorMode;
  agents: AgentId[];          // Which agents to run (in order)
  stopOnError: boolean;      // Whether to stop if an agent fails
  dryRun: boolean;           // Simulate without side effects
}

export const DEFAULT_AGENT_SEQUENCE: AgentId[] = [
  "brand-analyst",
  "brand-planner",
  "design-director",
  "asset-guardian",
  "manual-composer",
];

export const AGENT_IDENTITIES: Record<AgentId, AgentIdentity> = {
  "brand-analyst": {
    id: "brand-analyst",
    name: "品牌分析师",
    description: "分析品牌资料，生成品牌画像（类型、人格、定位、原型、语气）",
    version: "1.0.0",
  },
  "brand-planner": {
    id: "brand-planner",
    name: "品牌规划师",
    description: "根据品牌画像，规划 VI 手册的模块结构和页面清单",
    version: "1.0.0",
  },
  "design-director": {
    id: "design-director",
    name: "设计总监",
    description: "根据品牌画像和行业特征，确定视觉方向、色彩方案、字体搭配",
    version: "1.0.0",
  },
  "asset-guardian": {
    id: "asset-guardian",
    name: "资产守护者",
    description: "保护品牌资产（Logo/IP），防止 AI 重绘、改色、重新设计",
    version: "1.0.0",
  },
  "manual-composer": {
    id: "manual-composer",
    name: "手册合成师",
    description: "编排页面生成任务，调用通义万相和 SVG 合成输出最终图片",
    version: "1.0.0",
  },
};
