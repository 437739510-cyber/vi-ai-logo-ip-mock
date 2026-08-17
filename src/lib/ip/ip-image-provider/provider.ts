/**
 * IP Image Provider Layer — Provider Registry
 *
 * Manages available image providers and selects the configured provider.
 * The default registry is local-only. Paid providers require exact opt-in gates,
 * and Mock is restricted to explicit non-production use.
 *
 * All registered providers are automatically wrapped with
 * MetricsProvider for transparent call statistics.
 */

import type { ImageProvider, ProviderMetrics, ProviderCallLog } from "./types";
import { MockProvider } from "./mock-provider";
import { ComfyUIProvider } from "./comfyui-provider";
import { ArkSeedreamProvider } from "./ark-seedream-provider";
import { LiblibAIProvider } from "./liblibai-provider";
import {
  MetricsProvider,
  getProviderMetrics,
  getAllProviderMetrics,
  getRecentCalls,
  getProviderCalls,
} from "./metrics-provider";

// ========== Priority Configurations ==========

type ProviderSelection = "liblibai" | "comfyui" | "ark" | "mock";

export class ProviderRegistryError extends Error {
  constructor(
    public readonly code:
      | "NO_IMAGE_PROVIDER_AVAILABLE"
      | "UNKNOWN_IMAGE_PROVIDER"
      | "PAID_IMAGE_PROVIDER_DISABLED"
      | "MOCK_IMAGE_PROVIDER_DISABLED",
    message: string,
  ) {
    super(message);
    this.name = "ProviderRegistryError";
  }
}

function getProviderSelection(): ProviderSelection {
  const selected = process.env.IMAGE_PROVIDER;
  if (selected === undefined) return "comfyui";
  if (selected === "comfyui" || selected === "ark" || selected === "liblibai" || selected === "mock") {
    return selected;
  }
  throw new ProviderRegistryError("UNKNOWN_IMAGE_PROVIDER", "Unknown IMAGE_PROVIDER configuration");
}

function assertSelectionEnabled(selected: ProviderSelection): void {
  if (selected === "ark") {
    if (process.env.BB_PAID_IMAGE_PROVIDERS_ENABLED !== "1" || process.env.BB_ARK_IMAGE_PROVIDER_ENABLED !== "1") {
      throw new ProviderRegistryError("PAID_IMAGE_PROVIDER_DISABLED", "Paid image provider is disabled");
    }
  } else if (selected === "liblibai") {
    if (process.env.BB_PAID_IMAGE_PROVIDERS_ENABLED !== "1" || process.env.BB_LIBLIBAI_IMAGE_PROVIDER_ENABLED !== "1") {
      throw new ProviderRegistryError("PAID_IMAGE_PROVIDER_DISABLED", "Paid image provider is disabled");
    }
  } else if (selected === "mock" && process.env.NODE_ENV === "production") {
    throw new ProviderRegistryError("MOCK_IMAGE_PROVIDER_DISABLED", "Mock image provider is disabled in production");
  }
}

// ========== Provider Factory ==========

function createProviderByName(name: string): ImageProvider {
  switch (name) {
    case "liblibai":
      return new LiblibAIProvider();
    case "comfyui":
      return new ComfyUIProvider();
    case "ark-seedream":
      return new ArkSeedreamProvider();
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

// ========== Registry ==========

export class ProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();
  private priorityOrder: string[] = [];
  private priorities: Map<string, number> = new Map();

  /**
   * Register a provider with optional priority.
   * Higher priority = checked first.
   * Automatically wrapped with MetricsProvider.
   */
  register(provider: ImageProvider, priority: number = 0): void {
    const wrapped = new MetricsProvider(provider);
    this.providers.set(provider.name, wrapped);
    this.priorities.set(provider.name, priority);
    if (!this.priorityOrder.includes(provider.name)) {
      this.priorityOrder.push(provider.name);
    }
    this.priorityOrder.sort((a, b) => (this.priorities.get(b) || 0) - (this.priorities.get(a) || 0));
  }

  /**
   * Get a provider by name (returns the MetricsProvider wrapper).
   */
  get(name: string): ImageProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the currently active (first available) provider.
   * Throws explicitly if no registered provider is available.
   */
  async getActive(): Promise<ImageProvider> {
    for (const name of this.priorityOrder) {
      const provider = this.providers.get(name);
      if (provider && (await provider.isAvailable())) {
        return provider;
      }
    }

    throw new ProviderRegistryError("NO_IMAGE_PROVIDER_AVAILABLE", "No image provider is available");
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
 * Reads IMAGE_PROVIDER and registers exactly one explicitly allowed provider.
 */
export function getDefaultRegistry(): ProviderRegistry {
  if (!_defaultRegistry) {
    const selected = getProviderSelection();
    assertSelectionEnabled(selected);
    const providerName = selected === "ark" ? "ark-seedream" : selected;
    const registry = new ProviderRegistry();
    registry.register(createProviderByName(providerName), 10);
    _defaultRegistry = registry;
    console.log(`[ProviderRegistry] selected provider: ${providerName}`);
  }
  return _defaultRegistry;
}

/**
 * Reset the default registry (useful for testing).
 */
export function resetDefaultRegistry(): void {
  _defaultRegistry = null;
}
