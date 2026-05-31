/**
 * IP Sandbox V1 — Billing Integration
 *
 * Handles balance checks, deductions, and refunds for sandbox steps.
 * Thin wrapper over the billing system — no direct file I/O.
 */

import { checkSufficient, deductBalance } from "@/lib/billing/balance";
import { logUsage } from "@/lib/billing/usage-log";
import type { IPSandboxSession, IPSandboxStep } from "./types";

/**
 * Check if the account has sufficient balance for a step.
 */
export async function checkSandboxBalance(
  session: IPSandboxSession,
  step: IPSandboxStep
): Promise<{
  sufficient: boolean;
  balance: number;
  shortfall: number;
}> {
  return checkSufficient(session.accountId, step.estimatedCost);
}

/**
 * Deduct cost for an approved step and log the usage.
 */
export async function deductSandboxCost(
  session: IPSandboxSession,
  step: IPSandboxStep
): Promise<{
  success: boolean;
  error?: string;
}> {
  const cost = step.actualCost ?? step.estimatedCost;

  const result = await deductBalance(session.accountId, cost);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Log usage
  await logUsage({
    projectId: session.projectId,
    accountId: session.accountId,
    action: "future_ip_generate",
    cost,
    balanceBefore: session.balanceCurrent,
    balanceAfter: session.balanceCurrent - cost,
    durationMs: 0,
    status: "success",
    resultId: step.stepId,
  });

  return { success: true };
}

/**
 * Get a human-readable summary of costs for a session.
 */
export function getSandboxCostSummary(session: IPSandboxSession): {
  totalEstimated: number;
  totalActual: number;
  balanceAtStart: number;
  balanceCurrent: number;
  balanceRemaining: number;
  steps: { stepId: string; label: string; estimated: number; actual: number | null }[];
} {
  return {
    totalEstimated: session.totalEstimatedCost,
    totalActual: session.totalActualCost,
    balanceAtStart: session.balanceAtStart,
    balanceCurrent: session.balanceCurrent,
    balanceRemaining: session.balanceCurrent,
    steps: session.steps.map((s) => ({
      stepId: s.stepId,
      label: s.label,
      estimated: s.estimatedCost,
      actual: s.actualCost,
    })),
  };
}
