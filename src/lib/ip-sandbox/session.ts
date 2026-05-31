/**
 * IP Sandbox V1 — Session Management
 *
 * Pure functions for creating and advancing sandbox sessions.
 * No side effects — all I/O is handled by billing.ts and memory.ts.
 */

import type {
  IPSandboxSession,
  IPSandboxStep,
  IPSandboxStepStatus,
  IPSandboxSessionStatus,
} from "./types";
import type { IPCreationPlan } from "@/lib/ip-creation-plan";

// ========== Cost Constants ==========

const COST_PER_CREATE_IMAGE = 800; // create_new
const COST_PER_REUSE_IMAGE = 100;  // protect_existing

// ========== Session ID ==========

let counter = 0;
function generateSessionId(): string {
  counter++;
  return `sbx-${Date.now().toString(36)}-${counter}`;
}

// ========== Create Session ==========

export interface CreateSessionParams {
  projectId: string;
  accountId: string;
  plan: IPCreationPlan;
  initialBalance: number;
}

/**
 * Create a sandbox session from an IP Creation Plan.
 * Distributes estimated costs across steps.
 */
export function createSession(params: CreateSessionParams): IPSandboxSession {
  const { projectId, accountId, plan, initialBalance } = params;

  const costPerImage =
    plan.mode === "protect_existing" ? COST_PER_REUSE_IMAGE : COST_PER_CREATE_IMAGE;

  // Map IPAssetStep → IPSandboxStep
  const steps: IPSandboxStep[] = plan.assetSequence.map((assetStep) => ({
    stepId: assetStep.id,
    label: assetStep.label,
    status: "pending" as IPSandboxStepStatus,
    estimatedCost: assetStep.estimatedImages * costPerImage,
    actualCost: null,
    generatedAssetUrl: null,
    approvedAt: null,
    rejectedAt: null,
    attempts: 0,
    dependsOn: assetStep.dependsOn || [],
  }));

  // Mark first step(s) as actionable (no pending dependencies)
  markActionableSteps(steps);

  const totalEstimatedCost = steps.reduce((s, step) => s + step.estimatedCost, 0);

  return {
    sessionId: generateSessionId(),
    projectId,
    accountId,
    sourcePlan: { ...plan },
    steps,
    status: "planning",
    currentStepIndex: 0,
    totalEstimatedCost,
    totalActualCost: 0,
    balanceAtStart: initialBalance,
    balanceCurrent: initialBalance,
    autoAdvance: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

// ========== Advance Step ==========

/**
 * Advance session to the next actionable step.
 * Returns null if no more steps are available.
 */
export function getNextActionableStep(
  session: IPSandboxSession
): IPSandboxStep | null {
  const unresolved = session.steps.filter(
    (s) => s.status === "pending" || s.status === "failed"
  );
  if (unresolved.length === 0) return null;

  // Find the first step whose dependencies are all approved
  for (const step of unresolved) {
    const deps = step.dependsOn || [];
    const allDepsApproved = deps.every((depId) => {
      const dep = session.steps.find((s) => s.stepId === depId);
      return dep && dep.status === "approved";
    });
    if (allDepsApproved) return step;
  }

  return null; // no step ready (shouldn't happen in valid state)
}

/**
 * Mark steps whose dependencies are all resolved as actionable (pending).
 */
function markActionableSteps(steps: IPSandboxStep[]): void {
  for (const step of steps) {
    if (step.status !== "pending") continue;
    const deps = step.dependsOn || [];
    const allApproved = deps.every((depId) => {
      const dep = steps.find((s) => s.stepId === depId);
      return dep && dep.status === "approved";
    });
    if (deps.length === 0 || allApproved) {
      // Already pending and ready — no change needed at creation time
    }
  }
}

// ========== Step Operations ==========

/**
 * Start generating a step (pending → generating).
 */
export function startGenerating(
  session: IPSandboxSession,
  stepId: string
): IPSandboxStep | null {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step || step.status !== "pending") return null;

  step.status = "generating";
  session.status = "in_progress";
  session.updatedAt = new Date().toISOString();
  return step;
}

/**
 * Mark a step as generated (generating → reviewing).
 * Only updates status; actual image data is set by the caller.
 */
export function completeGeneration(
  session: IPSandboxSession,
  stepId: string,
  actualCost: number,
  assetUrl: string
): IPSandboxStep | null {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step || step.status !== "generating") return null;

  step.status = "reviewing";
  step.actualCost = actualCost;
  step.generatedAssetUrl = assetUrl;
  session.updatedAt = new Date().toISOString();
  return step;
}

/**
 * Mark generation as failed (generating → failed).
 */
export function failGeneration(
  session: IPSandboxSession,
  stepId: string,
  reason?: string
): IPSandboxStep | null {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step) return null;

  step.status = "failed";
  step.rejectionReason = reason || "Generation failed";
  session.updatedAt = new Date().toISOString();
  return step;
}

/**
 * User approves a step (reviewing → approved).
 * Auto-advances to next step if autoAdvance is enabled.
 */
export function approveStep(
  session: IPSandboxSession,
  stepId: string,
  note?: string
): { step: IPSandboxStep | null; nextStep: IPSandboxStep | null } {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step || step.status !== "reviewing") {
    return { step: null, nextStep: null };
  }

  step.status = "approved";
  step.approvedAt = new Date().toISOString();
  if (note) step.approvalNote = note;
  step.attempts += 1;

  // Update session totals
  session.totalActualCost += step.actualCost || 0;
  session.balanceCurrent -= step.actualCost || 0;
  session.updatedAt = new Date().toISOString();

  // Find current step index
  const idx = session.steps.indexOf(step);
  if (idx >= 0) session.currentStepIndex = idx;

  // Check if all steps resolved
  const allResolved = session.steps.every(
    (s) =>
      s.status === "approved" || s.status === "skipped" || s.status === "cancelled"
  );
  if (allResolved) {
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    return { step, nextStep: null };
  }

  // Auto-advance
  if (session.autoAdvance) {
    const next = getNextActionableStep(session);
    if (next) {
      const nextIdx = session.steps.indexOf(next);
      session.currentStepIndex = nextIdx >= 0 ? nextIdx : session.currentStepIndex;
    }
    return { step, nextStep: next };
  }

  return { step, nextStep: null };
}

/**
 * User skips a step (reviewing → skipped or pending → skipped).
 */
export function skipStep(
  session: IPSandboxSession,
  stepId: string,
  reason?: string
): { step: IPSandboxStep | null; nextStep: IPSandboxStep | null } {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step || (step.status !== "reviewing" && step.status !== "pending")) {
    return { step: null, nextStep: null };
  }

  step.status = "skipped";
  step.rejectionReason = reason;
  step.actualCost = 0; // no cost for skipped
  session.updatedAt = new Date().toISOString();

  // Check if all done
  const allResolved = session.steps.every(
    (s) =>
      s.status === "approved" || s.status === "skipped" || s.status === "cancelled"
  );
  if (allResolved) {
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    return { step, nextStep: null };
  }

  const next = getNextActionableStep(session);
  return { step, nextStep: next };
}

/**
 * User retries a failed/reviewing step (→ generating).
 */
export function retryStep(
  session: IPSandboxSession,
  stepId: string
): IPSandboxStep | null {
  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step || (step.status !== "failed" && step.status !== "reviewing")) {
    return null;
  }

  // Refund previous cost if any was deducted
  if (step.actualCost && step.actualCost > 0) {
    session.totalActualCost -= step.actualCost;
    session.balanceCurrent += step.actualCost;
  }

  step.status = "generating";
  step.actualCost = null;
  step.generatedAssetUrl = null;
  session.updatedAt = new Date().toISOString();
  return step;
}

/**
 * Cancel an entire session.
 */
export function cancelSession(session: IPSandboxSession): void {
  session.status = "cancelled";
  session.updatedAt = new Date().toISOString();
  for (const step of session.steps) {
    if (
      step.status === "pending" ||
      step.status === "generating" ||
      step.status === "reviewing"
    ) {
      step.status = "cancelled";
    }
  }
}

/**
 * Get a summary of the session for display.
 */
export function getSessionSummary(session: IPSandboxSession): {
  totalSteps: number;
  completedSteps: number;
  approvedSteps: number;
  skippedSteps: number;
  failedSteps: number;
  remainingSteps: number;
  progressPercent: number;
  currentStep: IPSandboxStep | null;
} {
  const approvedSteps = session.steps.filter((s) => s.status === "approved").length;
  const skippedSteps = session.steps.filter((s) => s.status === "skipped").length;
  const failedSteps = session.steps.filter((s) => s.status === "failed").length;
  const completedSteps = approvedSteps + skippedSteps;
  const totalSteps = session.steps.length;
  const remainingSteps = totalSteps - completedSteps;
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const currentStep = getNextActionableStep(session);

  return {
    totalSteps,
    completedSteps,
    approvedSteps,
    skippedSteps,
    failedSteps,
    remainingSteps,
    progressPercent,
    currentStep,
  };
}
