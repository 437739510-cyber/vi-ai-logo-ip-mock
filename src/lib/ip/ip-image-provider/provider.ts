/**
 * IP Image Provider Layer 鈥?Provider Registry
 *
 * Manages available image providers and selects the best one.
 * Fallback chain: Wanxiang 鈫?Flux 鈫?Midjourney 鈫?Mock (guaranteed)
 *
 * All registered providers are automatically wrapped with
 * MetricsProvider for transparent call statistics.
 */

import type { ImageProvider, ProviderMetrics, ProviderCallLog } from "./types";
import { MockProvider } from "./mock-provider";
import { WanxiangProvider } from "./wanxiang-provider";
import { ArkSeedreamProvider } from "./ark-seedream-provider";
import {
  MetricsProvider,
  getProviderMetrics,
  getAllProviderMetrics,
  getRecentCalls,
  getProviderCalls,
} from "./metrics-provider";

export class ProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();
  private priorityOrder: string[] = [];

  /**
   * Register a provider with optional priority.
   * Higher priority = checked first.
   * Automatically wrapped with MetricsProvider.
   */
  register(provider: ImageProvider, priority: number = 0): void {
    const wrapped = new MetricsProvider(provider);
    this.providers.set(provider.name, wrapped);
    if (!this.priorityOrder.includes(provider.name)) {
      this.priorityOrder.push(provider.name);
    }
  }

  /**
   * Get a provider by name (returns the MetricsProvider wrapper).
   */
  get(name: string): ImageProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the currently active (first available) provider.
   * Falls back to MockProvider if nothing else is available.
   */
  async getActive(): Promise<ImageProvider> {
    for (const name of this.priorityOrder) {
      const provider = this.providers.get(name);
      if (provider && (await provider.isAvailable())) {
        return provider;
      }
    }

    if (this.providers.has("mock")) {
      return this.providers.get("mock")!;
    }

    const mock = new MockProvider();
    const wrapped = new MetricsProvider(mock);
    this.providers.set("mock", wrapped);
    this.priorityOrder.push("mock");
    return wrapped;
  }

  /**
   * List all available providers.
   */
  async listAvailable(): Promise<ImageProvider[]> {
    const available: ImageProvider[] = [];
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        available.push(provider);
      }
    }
    return available;
  }

  /**
   * Check if a specific provider is available.
   */
  async isAvailable(name: string): Promise<boolean> {
    const provider = this.providers.get(name);
    if (!provider) return false;
    return provider.isAvailable();
  }

  /**
   * Get metrics for a specific provider.
   */
  getMetrics(providerName: string): ProviderMetrics | undefined {
    return getProviderMetrics(providerName);
  }

  /**
   * Get metrics for all registered providers.
   */
  getAllMetrics(): ProviderMetrics[] {
    return getAllProviderMetrics();
  }

  /**
   * Get recent call log.
   */
  getRecentCalls(limit?: number): ProviderCallLog[] {
    return getRecentCalls(limit);
  }
}

// ========== Global Singleton ==========

let _defaultRegistry: ProviderRegistry | null = null;

/**
 * Get the default provider registry.
 * Auto-registers MockProvider on first access.
 */
export function getDefaultRegistry(): ProviderRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new ProviderRegistry();
    _defaultRegistry.register(new MockProvider(), 0);
    // Register WanxiangProvider with higher priority
    // If WANXIANG_API_KEY is configured, it will be selected over Mock
    _defaultRegistry.register(new WanxiangProvider(), 10);
    // Ark Seedream: higher priority, free quota first
    _defaultRegistry.register(new ArkSeedreamProvider(), 20);
  }
  return _defaultRegistry;
}

/**
 * Reset the default registry (useful for testing).
 */
export function resetDefaultRegistry(): void {
  _defaultRegistry = null;
}
