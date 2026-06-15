/**
 * IP Image Provider Layer — Types
 *
 * Unified interfaces for image generation providers.
 * Sandbox calls provider.generateImage() without knowing
 * whether it's Mock, Wanxiang, Flux, or Midjourney.
 */

// ========== Parameters ==========

export interface GenerateImageParams {
  /** Brand context */
  brandContext: {
    brandName: string;
    industry: string;
    brandPositioning: string;
    brandPersona: string[];
    visualDirection: string;
  };

  /** IP / Mascot profile */
  ipProfile: {
    mascotName?: string;
    type: string;
    personality: string[];
    visualTraits: string[];
    colorDirection: string[];
  };

  /** Current sandbox step info */
  step: {
    stepId: string;
    label: string;
    description: string;
  };

  /** Generation prompt (from MascotPromptSet) */
  prompt: string;
  /** Negative prompt */
  negativePrompt: string;

  /** Previous asset ID for consistency */
  seedAssetId?: string;

  /** Output configuration */
  output: {
    width: number;
    height: number;
    format: "png" | "webp";
  };
}

// ========== Result ==========

export interface GenerateImageResult {
  /** Image URL (empty for MockProvider) */
  imageUrl: string;
  /** Actual cost in credits */
  actualCost: number;
  /** Generation duration in ms */
  durationMs: number;
  /** Asset ID for seed consistency */
  assetId: string;
  /** Provider name that generated this image */
  providerName: string;
  /** Optional quality score (0-100) for future use */
  qualityScore?: number;
  /** Provider metadata */
  providerMeta?: Record<string, unknown>;
}

// ========== Provider Interface ==========

export interface ImageProvider {
  /** Unique provider name */
  name: string;

  /** Whether this provider is available (API key configured, etc.) */
  isAvailable(): Promise<boolean>;

  /** Generate a single image */
  generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;

  /** Generate a variant (retry with different seed) */
  generateVariant(params: GenerateImageParams): Promise<GenerateImageResult>;
}

// ========== Provider Metrics ==========

/** Per-provider aggregated statistics */
export interface ProviderMetrics {
  providerName: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalCost: number;
  averageLatencyMs: number;
  totalDurationMs: number;
  lastCalledAt: string | null;
  createdAt: string;
}

/** Snapshot of a single provider call */
export interface ProviderCallLog {
  providerName: string;
  method: "generateImage" | "generateVariant";
  success: boolean;
  cost: number;
  durationMs: number;
  stepId: string;
  errorMessage?: string;
  timestamp: string;
}
