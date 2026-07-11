/**
 * Brand Brain — Harness Layer
 * 
 * Applies Harness Engineering patterns from 2026-07-11 video study.
 * Core principle: agent = model + harness. The harness determines stability.
 *
 * Six-layer model:
 *   1. Context — progressive disclosure, structured boundaries
 *   2. Tools — capability registry, result filtering
 *   3. Orchestration — retry, checkpoint, circuit breaker
 *   4. Memory/State — snapshot on failure, state isolation
 *   5. Evaluation — independent evaluator, gate before delivery
 *   6. Recovery — exponential backoff, fallback, context reset
 */

// ========== Harness Configuration ==========

export interface HarnessConfig {
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  saveFailureSnapshots: boolean;
  phaseAMinScore: number;
  phaseBMinScore: number;
  circuitBreakerThreshold: number;
  retryableAgents: string[];
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  maxRetries: 3,
  retryBaseDelayMs: 2000,
  retryMaxDelayMs: 30000,
  saveFailureSnapshots: true,
  phaseAMinScore: 40,
  phaseBMinScore: 50,
  circuitBreakerThreshold: 5,
  retryableAgents: ["brand-analyst", "brand-planner", "design-director", "manual-composer"],
};

// ========== Circuit Breaker ==========

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = { failures: 0, lastFailureTime: 0, isOpen: false };
  private threshold: number;
  private resetTimeoutMs: number;

  constructor(threshold: number, resetTimeoutMs = 60000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  allowRequest(): boolean {
    if (this.state.isOpen) {
      if (Date.now() - this.state.lastFailureTime > this.resetTimeoutMs) {
        this.state.isOpen = false;
        this.state.failures = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void { this.state.failures = 0; }

  recordFailure(): boolean {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    if (this.state.failures >= this.threshold) {
      this.state.isOpen = true;
      return true;
    }
    return false;
  }
}

// ========== Retry with Exponential Backoff ==========

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: HarnessConfig,
  agentId: string,
): Promise<{ result: T; retries: number }> {
  let lastError: Error | null = null;
  const maxRetries = config.retryableAgents.includes(agentId) ? config.maxRetries : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retries: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = Math.min(
          config.retryBaseDelayMs * Math.pow(2, attempt),
          config.retryMaxDelayMs,
        );
        console.warn("[harness] Retry", agentId, attempt + 1, "/", maxRetries + 1, delay + "ms", lastError.message);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ========== Failure Snapshot ==========

export interface FailureSnapshot {
  timestamp: string;
  agentId: string;
  projectId: string;
  error: string;
  contextSnapshot: Record<string, unknown>;
  retries: number;
}

export function saveFailureSnapshot(snapshot: FailureSnapshot): void {
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.cwd(), "data", "failure-snapshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = path.join(
      dir,
      "failure-" + snapshot.projectId + "-" + snapshot.agentId + "-" + Date.now() + ".json",
    );
    fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2));
    console.log("[harness] Snapshot saved:", filename);
  } catch (e) {
    console.warn("[harness] Snapshot save failed:", e);
  }
}

// ========== Quality Gate ==========

export interface QualityGateResult {
  passed: boolean;
  phase: string;
  score: number;
  threshold: number;
  reason?: string;
}

export function qualityGate(
  phase: string,
  score: number,
  config: HarnessConfig,
): QualityGateResult {
  const threshold = phase === "A" ? config.phaseAMinScore : config.phaseBMinScore;
  const passed = score >= threshold;
  return { passed, phase, score, threshold, reason: passed ? undefined : "Below threshold" };
}
