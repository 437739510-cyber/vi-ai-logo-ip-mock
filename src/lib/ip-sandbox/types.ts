/**
 * IP Sandbox V1 — Types
 *
 * Sandbox allows users to generate IP assets step by step,
 * reviewing and approving each before proceeding to the next.
 *
 * Current phase: Structure + placeholder only.
 * No real image generation. No Tongyi Wanxiang. No SVG changes.
 */

import type { IPCreationPlan } from "@/lib/ip-creation-plan";

// ========== Step Status ==========

export type IPSandboxStepStatus =
  | "pending"      // Waiting for user to trigger generation
  | "generating"   // Generating (future: calling image API)
  | "reviewing"    // Generated, waiting for user approval
  | "approved"     // User approved — cost deducted
  | "skipped"      // User chose to skip this step
  | "failed"       // Generation failed
  | "cancelled";   // User cancelled this specific step

// ========== Session Status ==========

export type IPSandboxSessionStatus =
  | "planning"      // Created from plan, not yet started
  | "in_progress"   // At least one step has been started
  | "completed"     // All steps resolved (approved/skipped)
  | "cancelled";    // User cancelled the entire session

// ========== Step ==========

export interface IPSandboxStep {
  /** Step ID (matches IPAssetStep.id) */
  stepId: string;
  /** Chinese label */
  label: string;
  /** Current status */
  status: IPSandboxStepStatus;
  /** Estimated cost before generation */
  estimatedCost: number;
  /** Actual cost after generation (null if not yet generated) */
  actualCost: number | null;
  /** Generated image URL (future) */
  generatedAssetUrl: string | null;
  /** Seed asset ID for consistency (future) */
  seedAssetId?: string;
  /** User approval timestamp */
  approvedAt: string | null;
  /** User rejection timestamp */
  rejectedAt: string | null;
  /** User rejection reason */
  rejectionReason?: string;
  /** User approval note (e.g. "主形象满意，三视图保持比例") */
  approvalNote?: string;
  /** How many times this step has been retried */
  attempts: number;
  /** Prerequisite step IDs (all must be approved before this starts) */
  dependsOn: string[];
}

// ========== Session ==========

export interface IPSandboxSession {
  /** Session ID */
  sessionId: string;
  /** Associated project */
  projectId: string;
  /** Account ID for billing */
  accountId: string;
  /** Source IP Creation Plan (snapshot) */
  sourcePlan: IPCreationPlan;
  /** Ordered list of steps */
  steps: IPSandboxStep[];
  /** Session-level status */
  status: IPSandboxSessionStatus;
  /** Current step index */
  currentStepIndex: number;
  /** Total estimated cost across all steps */
  totalEstimatedCost: number;
  /** Total actual cost incurred so far */
  totalActualCost: number;
  /** Balance at session start */
  balanceAtStart: number;
  /** Current balance (updates as steps are approved) */
  balanceCurrent: number;
  /** Whether to auto-advance after approval (default true) */
  autoAdvance: boolean;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
