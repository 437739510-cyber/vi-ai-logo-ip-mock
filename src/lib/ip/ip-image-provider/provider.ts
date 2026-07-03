/**
 * IP Image Provider Layer — Provider Registry
 *
 * Manages available image providers and selects the best one.
 * Priority chain controlled by IMAGE_PROVIDER env var:
 *   liblibai:  liblibai(10) -> comfyui(5) -> ark(3) -> mock(0)
 *   comfyui:   comfyui(10) -> liblibai(5) -> ark(3) -> mock(0)
 *   ark:       ark(10) -> liblibai(5) -> comfyui(3) -> mock(0)
 *   mock:      mock(10)
 *   default:   comfyui(10) -> liblibai(5) -> ark(3) -> mock(0)
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

type ProviderKey = "liblibai" | "comfyui" | "ark" | "mock";

interface PriorityConfig {
  providers: { name: string; priority: number }[];
}

const PRIORITY_MAP: Record<string, PriorityConfig> = {
  liblibai: {
    providers: [
      { name: "liblibai", priority: 10 },
      { name: "comfyui", priority: 5 },
      { name: "ark-seedream", priority: 3 },
      { name: "mock", priority: 0 },
    ],
  },
  comfyui: {
    providers: [
      { name: "comfyui", priority: 10 },
      { name: "liblibai", priority: 5 },
      { name: "ark-seedream", priority: 3 },
      { name: "mock", priority: 0 },
    ],
  },
  ark: {
    providers: [
      { name: "ark-seedream", priority: 10 },
      { name: "liblibai", priority: 5 },
      { name: "comfyui", priority: 3 },
      { name: "mock", priority: 0 },
    ],
  },
  mock: {
    providers: [
      { name: "mock", priority: 10 },
    ],
  },
};

function getPriorityConfig(): PriorityConfig {
  const provider = (process.env.IMAGE_PROVIDER || "comfyui").toLowerCase();
  return PRIORITY_MAP[provider] || PRIORITY_MAP.comfyui;
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
 * Reads IMAGE_PROVIDER env var for priority configuration.
 * Registers all providers on first access.
 */
export function getDefaultRegistry(): ProviderRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new ProviderRegistry();
    const config = getPriorityConfig();

    // Register all providers in priority config
    for (const { name, priority } of config.providers) {
      _defaultRegistry.register(createProviderByName(name), priority);
    }

    console.log(
      `[ProviderRegistry] IMAGE_PROVIDER=${process.env.IMAGE_PROVIDER || "comfyui"}: ` +
        config.providers.map((p) => `${p.name}(${p.priority})`).join(" -> ")
    );
  }
  return _defaultRegistry;
}

/**
 * Reset the default registry (useful for testing).
 */
export function resetDefaultRegistry(): void {
  _defaultRegistry = null;
}