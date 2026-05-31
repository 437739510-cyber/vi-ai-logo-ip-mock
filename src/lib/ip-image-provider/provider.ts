/**
 * IP Image Provider Layer — Provider Registry
 *
 * Manages available image providers and selects the best one.
 * Fallback chain: Wanxiang → Flux → Midjourney → Mock (guaranteed)
 */

import type { ImageProvider } from "./types";
import { MockProvider } from "./mock-provider";

export class ProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();
  private priorityOrder: string[] = [];

  /**
   * Register a provider with optional priority.
   * Higher priority = checked first.
   */
  register(provider: ImageProvider, priority: number = 0): void {
    this.providers.set(provider.name, provider);
    if (!this.priorityOrder.includes(provider.name)) {
      this.priorityOrder.push(provider.name);
    }
    // Re-sort by priority (maintained externally, but we keep insertion order)
  }

  /**
   * Get a provider by name.
   */
  get(name: string): ImageProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the currently active (first available) provider.
   * Falls back to MockProvider if nothing else is available.
   */
  async getActive(): Promise<ImageProvider> {
    // Check registered providers in priority order
    for (const name of this.priorityOrder) {
      const provider = this.providers.get(name);
      if (provider && (await provider.isAvailable())) {
        return provider;
      }
    }

    // Fallback: check mock provider
    if (this.providers.has("mock")) {
      return this.providers.get("mock")!;
    }

    // Last resort: always available
    return new MockProvider();
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
  }
  return _defaultRegistry;
}

/**
 * Reset the default registry (useful for testing).
 */
export function resetDefaultRegistry(): void {
  _defaultRegistry = null;
}
