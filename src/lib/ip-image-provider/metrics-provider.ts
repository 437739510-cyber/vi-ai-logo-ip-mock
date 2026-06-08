/**
 * IP Image Provider Layer — Metrics Decorator
 *
 * Wraps any ImageProvider and records call statistics.
 * Transparent to both the Sandbox and the underlying provider.
 *
 * Usage:
 *   const tracked = new MetricsProvider(mockProvider);
 *   registry.register(tracked);
 *   // Sandbox calls tracked.generateImage() → metrics recorded automatically
 */

import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
  ProviderMetrics,
  ProviderCallLog,
} from "./types";

// ========== In-Memory Store ==========

/** Global metrics store (per-provider) */
const metricsMap = new Map<string, ProviderMetrics>();

/** Recent call log (ring buffer, last 1000 calls) */
const callLog: ProviderCallLog[] = [];
const MAX_CALL_LOG = 1000;

// ========== MetricsProvider ==========

export class MetricsProvider implements ImageProvider {
  name: string;

  private inner: ImageProvider;

  constructor(inner: ImageProvider) {
    this.inner = inner;
    this.name = inner.name;

    // Initialize metrics if not exists
    if (!metricsMap.has(inner.name)) {
      metricsMap.set(inner.name, {
        providerName: inner.name,
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalCost: 0,
        averageLatencyMs: 0,
        totalDurationMs: 0,
        lastCalledAt: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const startTime = Date.now();
    const stepId = params.step?.stepId || "unknown";

    try {
      const result = await this.inner.generateImage(params);
      const durationMs = Date.now() - startTime;

      this.recordCall("generateImage", true, result.actualCost, durationMs, stepId);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.recordCall(
        "generateImage",
        false,
        0,
        durationMs,
        stepId,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    const startTime = Date.now();
    const stepId = params.step?.stepId || "unknown";

    try {
      const result = await this.inner.generateVariant(params);
      const durationMs = Date.now() - startTime;

      this.recordCall("generateVariant", true, result.actualCost, durationMs, stepId);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.recordCall(
        "generateVariant",
        false,
        0,
        durationMs,
        stepId,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  // ========== Private: Record Metrics ==========

  private recordCall(
    method: "generateImage" | "generateVariant",
    success: boolean,
    cost: number,
    durationMs: number,
    stepId: string,
    errorMessage?: string
  ): void {
    // Update metrics
    const metrics = metricsMap.get(this.inner.name);
    if (metrics) {
      metrics.totalCalls++;
      if (success) {
        metrics.successCalls++;
        metrics.totalCost += cost;
        metrics.totalDurationMs += durationMs;
        metrics.averageLatencyMs = Math.round(
          metrics.totalDurationMs / metrics.successCalls
        );
      } else {
        metrics.failedCalls++;
      }
      metrics.lastCalledAt = new Date().toISOString();
    }

    // Append to call log (ring buffer)
    callLog.push({
      providerName: this.inner.name,
      method,
      success,
      cost,
      durationMs,
      stepId,
      errorMessage,
      timestamp: new Date().toISOString(),
    });

    if (callLog.length > MAX_CALL_LOG) {
      callLog.splice(0, callLog.length - MAX_CALL_LOG);
    }
  }
}

// ========== Query API ==========

/** Get metrics snapshot for a single provider */
export function getProviderMetrics(providerName: string): ProviderMetrics | undefined {
  return metricsMap.get(providerName);
}

/** Get metrics for all providers */
export function getAllProviderMetrics(): ProviderMetrics[] {
  return Array.from(metricsMap.values());
}

/** Get recent call log (newest first) */
export function getRecentCalls(limit: number = 50): ProviderCallLog[] {
  return callLog.slice(-limit).reverse();
}

/** Get call log for a specific provider */
export function getProviderCalls(
  providerName: string,
  limit: number = 50
): ProviderCallLog[] {
  return callLog
    .filter((c) => c.providerName === providerName)
    .slice(-limit)
    .reverse();
}

/** Reset all metrics (for testing) */
export function resetMetrics(): void {
  metricsMap.clear();
  callLog.length = 0;
}

/** Get aggregated stats across all providers */
export function getAggregatedMetrics() {
  const all = getAllProviderMetrics();
  return {
    totalCalls: all.reduce((s, m) => s + m.totalCalls, 0),
    totalSuccessCalls: all.reduce((s, m) => s + m.successCalls, 0),
    totalFailedCalls: all.reduce((s, m) => s + m.failedCalls, 0),
    totalCost: all.reduce((s, m) => s + m.totalCost, 0),
    providerCount: all.length,
    providers: all,
  };
}
