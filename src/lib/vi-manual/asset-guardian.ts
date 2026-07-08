/**
 * Asset Guardian — Logo asset safety guard (pre/post generation)
 *
 * Protects existing brand assets by detecting risky prompt patterns
 * before they reach image generation providers, and validates
 * generated assets after creation.
 *
 * Design principles:
 * - Guard, don't block: risk detection warns but doesn't halt the pipeline
 * - Configurable rules: detection patterns are arrays, easy to extend
 * - Non-invasive: integrates via a single function call in the generator
 */

// ---- Types ----

export interface AssetGuardResult {
  passed: boolean;
  blockedTerms: string[];
  riskLevel: "none" | "low" | "medium" | "high";
  enhancedPrompt?: string;
}

interface DetectionRule {
  name: string;
  terms: string[];
  riskLevel: "low" | "medium" | "high";
}

// ---- Configurable detection rules ----

const DETECTION_RULES: DetectionRule[] = [
  {
    name: "repaint",
    terms: ["repaint", "redraw", "redesign", "recreate", "replace logo", "remake", "rework logo"],
    riskLevel: "high",
  },
  {
    name: "recolor",
    terms: ["change color", "recolor", "different color scheme", "new palette", "swap colors", "alter color"],
    riskLevel: "medium",
  },
  {
    name: "distort",
    terms: ["stretch", "distort", "warp", "change proportion", "resize logo", "squash"],
    riskLevel: "medium",
  },
];

// ---- Protection suffix always appended ----

const PROTECTION_SUFFIX =
  ", maintaining original logo design integrity, preserve existing brand elements, do not redraw or modify core shapes";

// ---- Public API ----

/**
 * Pre-generation guard: scans the prompt for risky terms and injects
 * protection constraints regardless of risk level.
 */
export function preGenerationGuard(
  prompt: string,
  brandName: string
): AssetGuardResult {
  const lowerPrompt = prompt.toLowerCase();
  const blockedTerms: string[] = [];
  let maxRisk: AssetGuardResult["riskLevel"] = "none";

  for (const rule of DETECTION_RULES) {
    for (const term of rule.terms) {
      if (lowerPrompt.includes(term.toLowerCase())) {
        blockedTerms.push(`${rule.name}:${term}`);
        if (riskRank(rule.riskLevel) > riskRank(maxRisk)) {
          maxRisk = rule.riskLevel;
        }
      }
    }
  }

  const enhancedPrompt = prompt + PROTECTION_SUFFIX;

  return {
    passed: maxRisk !== "high",
    blockedTerms,
    riskLevel: maxRisk,
    enhancedPrompt,
  };
}

/**
 * Post-generation guard: validates basic asset properties (URL, size, naming).
 * Does NOT perform complex image comparison (requires external vision service).
 */
export async function postGenerationGuard(
  originalImageUrl: string | null,
  generatedImageUrl: string,
  brandName: string
): Promise<AssetGuardResult> {
  const warnings: string[] = [];
  let riskLevel: AssetGuardResult["riskLevel"] = "none";

  // 1. URL accessibility check
  try {
    const resp = await fetch(generatedImageUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      warnings.push(`url:HTTP ${resp.status}`);
      riskLevel = "high";
    } else {
      const contentLength = resp.headers.get("content-length");
      if (contentLength) {
        const sizeBytes = parseInt(contentLength, 10);
        // 2. Size check: image must be ≥ 256×256 worth of data (~5KB floor)
        if (sizeBytes < 5000) {
          warnings.push(`size:${sizeBytes}bytes (too small)`);
          riskLevel = riskLevel === "high" ? "high" : "medium";
        }
      }
    }
  } catch {
    warnings.push("url:unreachable");
    riskLevel = "high";
  }

  // 3. Naming check (if URL path contains no brand-related tokens)
  try {
    const urlPath = new URL(generatedImageUrl).pathname.toLowerCase();
    const brandTokens = brandName.toLowerCase().split(/\s+/);
    const hasBrandToken = brandTokens.some((t) => t.length > 0 && urlPath.includes(t));
    if (!hasBrandToken) {
      warnings.push("naming:no brand token in URL");
      // Low severity — many CDNs use random filenames
      if (riskLevel === "none") riskLevel = "low";
    }
  } catch {
    // Invalid URL — already caught above
  }

  return {
    passed: riskLevel !== "high",
    blockedTerms: warnings,
    riskLevel,
  };
}

// ---- Helpers ----

function riskRank(level: AssetGuardResult["riskLevel"]): number {
  switch (level) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}
