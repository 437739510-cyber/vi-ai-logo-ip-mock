/**
 * IP Creation Plan V1
 *
 * Generates a structured IP asset creation plan before any image generation.
 * Acts as the decision layer between mascot strategy and actual image API calls.
 *
 * Current phase: Plan only.
 * No image generation. No Tongyi Wanxiang. No SVG. No generation layer changes.
 */

import type { MascotProfile, MascotDesignMode } from "@/agents/mascot-designer";
import type { BrandProfile } from "./brand-analyzer";
import type { BusinessProfile } from "./business-profile";

// ========== Public Types ==========

export type CostLevel = "low" | "medium" | "high";

export interface IPAssetStep {
  /** Unique step identifier */
  id: string;
  /** Human-readable label (Chinese) */
  label: string;
  /** Step description */
  description: string;
  /** Whether this step is required */
  required: boolean;
  /** Steps that must be completed before this one */
  dependsOn?: string[];
  /** Estimated images to generate for this step */
  estimatedImages: number;
}

export interface IPCreationPlan {
  /** Design mode (mirrors MascotProfile.mode) */
  mode: MascotDesignMode;

  /** Ordered list of asset generation steps */
  assetSequence: IPAssetStep[];

  /** Total estimated images to generate */
  estimatedImages: number;
  /** Cost level estimate */
  estimatedCostLevel: CostLevel;
  /** Estimated total credits / fee */
  estimatedCostCredits: number;
  /** Estimated time in minutes */
  estimatedMinutes: number;

  /** Whether user approval is required before proceeding */
  requiresUserApproval: boolean;

  /** Warnings / notes for the user */
  warnings: string[];

  /** Recommended next action */
  nextAction: string;
}

// ========== Per-step cost constants (credits per image) ==========

const COST_PER_IP_IMAGE = 800; // matches future_ip_generate unit price
const COST_PER_REUSE_IMAGE = 100; // for protect_existing: layout/norm only

// ========== Asset Step Definitions by Mode ==========

const STEPS_CREATE_NEW: IPAssetStep[] = [
  {
    id: "mascot-main",
    label: "\u4e3b\u5f62\u8c61\u8bbe\u8ba1",
    description: "\u751f\u6210IP\u4e3b\u89d2\u8272\u6b63\u9762\u5168\u8eab\u56fe\uff0c\u786e\u5b9a\u6574\u4f53\u98ce\u683c\u3001\u6bd4\u4f8b\u3001\u9762\u90e8\u8868\u60c5\u3001\u89d2\u8272\u8bbe\u5b9a",
    required: true,
    estimatedImages: 1,
  },
  {
    id: "mascot-three-view",
    label: "\u4e09\u89c6\u56fe",
    description: "\u6b63\u9762\u3001\u4fa7\u9762\u3001\u80cc\u9762\u4e09\u89c6\u56fe\uff0c\u786e\u5b9a\u89d2\u8272\u7acb\u4f53\u7ed3\u6784\u548c\u6bd4\u4f8b\u7cfb\u7edf",
    required: true,
    dependsOn: ["mascot-main"],
    estimatedImages: 1, // composite image with 3 views
  },
  {
    id: "mascot-colors",
    label: "\u6807\u51c6\u8272\u89c4\u8303",
    description: "IP\u6807\u51c6\u8272\u3001\u8f85\u52a9\u8272\u3001\u5e94\u7528\u9634\u5f71\u8272\u89c4\u8303\uff0c\u4e0e\u54c1\u724c\u8272\u7cfb\u7edf\u5bf9\u63a5",
    required: true,
    dependsOn: ["mascot-main"],
    estimatedImages: 1,
  },
  {
    id: "mascot-expression",
    label: "\u8868\u60c5\u7cfb\u7edf",
    description: "\u5fae\u7b11\u3001\u6b22\u8fce\u3001\u60ca\u8bb6\u3001\u56f0\u60d1\u3001\u5f97\u610f\u7b898-12\u79cd\u57fa\u7840\u8868\u60c5\uff0c\u6784\u5efa\u60c5\u611f\u8868\u8fbe\u4f53\u7cfb",
    required: true,
    dependsOn: ["mascot-three-view", "mascot-colors"],
    estimatedImages: 2, // 2 composite images covering all expressions
  },
  {
    id: "mascot-pose",
    label: "\u52a8\u4f5c\u7cfb\u7edf",
    description: "\u62db\u624b\u3001\u62e5\u62b1\u3001\u7ad6\u5927\u62c7\u6307\u3001\u6307\u5f15\u7b496-8\u79cd\u57fa\u7840\u52a8\u4f5c\u59ff\u6001",
    required: false,
    dependsOn: ["mascot-three-view"],
    estimatedImages: 2, // 2 composite images
  },
  {
    id: "mascot-scene",
    label: "\u573a\u666f\u5ef6\u5c55",
    description: "\u54c1\u724c\u573a\u666f\u4e2d\u7684\u89d2\u8272\u5e94\u7528\uff1a\u4ea7\u54c1\u5305\u88c5\u3001\u5e97\u94fa\u5c55\u793a\u3001\u793e\u4ea4\u5a92\u4f53\u7b49\u573a\u666f\u5ef6\u5c55",
    required: false,
    dependsOn: ["mascot-expression", "mascot-pose"],
    estimatedImages: 2,
  },
  {
    id: "mascot-packaging",
    label: "\u5305\u88c5\u5e94\u7528",
    description: "IP\u5728\u4ea7\u54c1\u5305\u88c5\u4e0a\u7684\u5e94\u7528\u793a\u4f8b\uff1a\u4e3b\u89d2\u8272\u3001\u8868\u60c5\u3001\u52a8\u4f5c\u5728\u5305\u88c5\u4e0a\u7684\u5e03\u5c40",
    required: false,
    dependsOn: ["mascot-scene"],
    estimatedImages: 1,
  },
  {
    id: "mascot-social",
    label: "\u793e\u5a92\u5e94\u7528",
    description: "\u793e\u4ea4\u5a92\u4f53\u5934\u50cf\u3001\u5c01\u9762\u3001\u5e95\u56fe\u3001\u8868\u60c5\u5305\u7b49\u793e\u5a92\u5185\u5bb9IP\u5e94\u7528",
    required: false,
    dependsOn: ["mascot-expression"],
    estimatedImages: 1,
  },
];

const STEPS_PROTECT_EXISTING: IPAssetStep[] = [
  {
    id: "existing-asset-sort",
    label: "\u539f\u59cbIP\u6574\u7406",
    description: "\u5bf9\u73b0\u6709IP\u7d20\u6750\u8fdb\u884c\u6574\u7406\u3001\u5206\u7c7b\u3001\u8bc6\u522b\u6700\u4f73\u8d28\u91cf\u539f\u56fe",
    required: true,
    estimatedImages: 0, // no generation, just organization
  },
  {
    id: "existing-usage-spec",
    label: "\u4f7f\u7528\u89c4\u8303",
    description: "\u5efa\u7acb\u73b0\u6709IP\u7684\u4f7f\u7528\u89c4\u8303\uff1a\u5b89\u5168\u533a\u3001\u6700\u5c0f\u5c3a\u5bf8\u3001\u80cc\u666f\u63a7\u5236\u3001\u9519\u8bef\u7528\u6cd5",
    required: true,
    estimatedImages: 1, // spec page layout
  },
  {
    id: "existing-scene-extension",
    label: "\u573a\u666f\u5ef6\u5c55\u89c4\u8303",
    description: "\u539f\u59cbIP\u5728\u4e0d\u540c\u573a\u666f\u4e2d\u7684\u5e94\u7528\u793a\u4f8b\uff0c\u5982\u5305\u88c5\u3001\u5e97\u94fa\u3001\u793e\u5a92\uff08\u4fdd\u6301\u539f\u59cb\u5f62\u8c61\uff09",
    required: true,
    dependsOn: ["existing-usage-spec"],
    estimatedImages: 1,
  },
  {
    id: "existing-packaging",
    label: "\u5305\u88c5\u5e94\u7528",
    description: "\u539f\u59cbIP\u5728\u5305\u88c5\u4e0a\u7684\u5e03\u5c40\u793a\u4f8b\uff0c\u4ec5\u505a\u7f29\u653e\u548c\u6392\u7248\uff0c\u4e0d\u505a\u91cd\u7ed8",
    required: false,
    dependsOn: ["existing-scene-extension"],
    estimatedImages: 1,
  },
];

const STEPS_OPTIONAL_RECOMMEND: IPAssetStep[] = [
  {
    id: "mascot-direction",
    label: "IP\u65b9\u5411\u7a3f",
    description: "\u751f\u6210\u4e00\u5f20IP\u65b9\u5411\u7a3f\u4f9b\u54c1\u724c\u65b9\u786e\u8ba4\u98ce\u683c\u65b9\u5411",
    required: true,
    estimatedImages: 1,
  },
  {
    id: "mascot-main-lite",
    label: "\u4e3b\u89d2\u8272\u8bbe\u8ba1\uff08\u8f7b\u91cf\u7248\uff09",
    description: "\u786e\u8ba4\u65b9\u5411\u540e\u751f\u6210\u4e3b\u89d2\u8272\u6b63\u9762\u56fe",
    required: false,
    dependsOn: ["mascot-direction"],
    estimatedImages: 1,
  },
  {
    id: "mascot-expression-lite",
    label: "\u57fa\u7840\u8868\u60c5\uff08\u8f7b\u91cf\u7248\uff09",
    description: "\u751f\u62104-6\u79cd\u57fa\u7840\u8868\u60c5\uff0c\u4f9b\u793e\u5a92\u3001\u5c01\u9762\u4f7f\u7528",
    required: false,
    dependsOn: ["mascot-main-lite"],
    estimatedImages: 1,
  },
];

// ========== Main Plan Generator ==========

export interface IPCreationPlanInput {
  mascotProfile: MascotProfile;
  brandProfile: BrandProfile;
  businessProfile?: BusinessProfile;
}

/**
 * Generate IP Creation Plan from mascot profile.
 * Pure function — no side effects, no API calls.
 */
export function generateIPCreationPlan(input: IPCreationPlanInput): IPCreationPlan {
  const { mascotProfile, brandProfile, businessProfile } = input;
  const mode = mascotProfile.mode;

  // === not_needed ===
  if (mode === "not_needed") {
    return {
      mode: "not_needed",
      assetSequence: [],
      estimatedImages: 0,
      estimatedCostLevel: "low",
      estimatedCostCredits: 0,
      estimatedMinutes: 0,
      requiresUserApproval: false,
      warnings: ["\u5f53\u524d\u54c1\u724c\u4e0d\u9002\u5408\u521b\u5efaIP\uff0c\u65e0\u9700\u751f\u6210IP\u8d44\u4ea7"],
      nextAction: "\u7ee7\u7eedVI\u624b\u518c\u751f\u6210\u6d41\u7a0b",
    };
  }

  // Select asset steps based on mode
  let baseSteps: IPAssetStep[];
  let baseWarning: string;

  switch (mode) {
    case "protect_existing":
      baseSteps = STEPS_PROTECT_EXISTING;
      baseWarning = `\u54c1\u724c\u5df2\u6709IP\u5f62\u8c61\u201c${mascotProfile.existingMascotName || "\u54c1\u724cIP"}\u201d\uff0c\u7cfb\u7edf\u5c06\u4fdd\u62a4\u539f\u59cb\u5f62\u8c61\uff0c\u4e0d\u4f1a\u8fdb\u884cAI\u91cd\u7ed8\u3001\u6539\u8272\u6216\u91cd\u65b0\u8bbe\u8ba1`;
      break;
    case "create_new":
      baseSteps = STEPS_CREATE_NEW;
      baseWarning = `\u5efa\u8bae\u5148\u751f\u6210\u4e3b\u5f62\u8c61\u8bbe\u8ba1\u65b9\u5411\u7a3f\uff0c\u786e\u8ba4\u98ce\u683c\u540e\u518d\u6269\u5c55\u5b8c\u6574IP\u4f53\u7cfb`;
      break;
    case "optional_recommend":
      baseSteps = STEPS_OPTIONAL_RECOMMEND;
      baseWarning = "\u5efa\u8bae\u5148\u4e0e\u5ba2\u6237\u6c9f\u901a\u662f\u5426\u9700\u8981IP\u516c\u4ed4\uff0c\u786e\u8ba4\u540e\u518d\u542f\u52a8\u5b8c\u6574\u8bbe\u8ba1";
      break;
    default:
      baseSteps = [];
      baseWarning = "";
  }

  // Filter steps: for protect_existing, show required steps first
  const sorted = [...baseSteps].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return 0;
  });

  // Calculate totals
  const estimatedImages = sorted.reduce((sum, s) => sum + s.estimatedImages, 0);
  const isCreateNew = mode === "create_new";
  const costPerImage = mode === "protect_existing" ? COST_PER_REUSE_IMAGE : COST_PER_IP_IMAGE;
  const estimatedCostCredits = sorted.reduce((sum, s) => sum + s.estimatedImages * costPerImage, 0);

  // Cost level
  let estimatedCostLevel: CostLevel = "low";
  if (estimatedCostCredits > 5000) estimatedCostLevel = "high";
  else if (estimatedCostCredits > 2000) estimatedCostLevel = "medium";

  // Time estimate: ~3 min per image for create_new, ~1.5 min for protect_existing
  const minPerImage = mode === "protect_existing" ? 1.5 : 2.5;
  const estimatedMinutes = Math.ceil(estimatedImages * minPerImage) + 2; // +2 buffer

  // Warnings
  const warnings: string[] = [baseWarning];

  if (mode === "create_new" || mode === "optional_recommend") {
    if (mascotProfile.confidence < 0.6) {
      warnings.push("IP\u7b56\u7565\u4fe1\u5fc3\u5ea6\u4e0d\u8db3\uff0c\u5efa\u8bae\u5148\u786e\u8ba4\u54c1\u724c\u5206\u6790\u7ed3\u679c");
    }
    if (estimatedImages > 6) {
      warnings.push("\u5efa\u8bae\u5206\u6279\u751f\u6210\uff0c\u5148\u786e\u8ba4\u4e3b\u5f62\u8c61\u518d\u7ee7\u7eed\u540e\u7eed\u6b65\u9aa4");
    }
  }

  if (mode === "protect_existing") {
    warnings.push("\u4efb\u4f55\u60c5\u51b5\u4e0b\u7981\u6b62AI\u91cd\u7ed8\u73b0\u6709IP\u5f62\u8c61");
    warnings.push("\u6240\u6709IP\u5e94\u7528\u9875\u9762\u5747\u4f7f\u7528\u539f\u56fe\u5d4c\u5165\uff0c\u975eAI\u91cd\u65b0\u751f\u6210");
  }

  // Next action
  const nextAction = getNextAction(mode, estimatedImages);

  // Requires approval if more than 3 images or create_new mode
  const requiresUserApproval = mode === "create_new" || estimatedImages > 3;

  return {
    mode,
    assetSequence: sorted,
    estimatedImages,
    estimatedCostLevel,
    estimatedCostCredits,
    estimatedMinutes,
    requiresUserApproval,
    warnings,
    nextAction,
  };
}

// ========== Helpers ==========

function getNextAction(mode: MascotDesignMode, imageCount: number): string {
  switch (mode) {
    case "create_new":
      return "\u5148\u751f\u6210IP\u65b9\u5411\u7a3f\u4f9b\u54c1\u724c\u65b9\u786e\u8ba4\uff0c\u786e\u8ba4\u540e\u518d\u6269\u5c55\u5b8c\u6574IP\u4f53\u7cfb";
    case "protect_existing":
      return "\u6574\u7406\u73b0\u6709IP\u7d20\u6750\u5e76\u5efa\u7acb\u4f7f\u7528\u89c4\u8303\uff0c\u4e0d\u9700\u8981\u65b0IP\u751f\u6210";
    case "optional_recommend":
      return "\u4e0e\u5ba2\u6237\u6c9f\u901a\u662f\u5426\u9700\u8981IP\u516c\u4ed4\uff0c\u518d\u51b3\u5b9a\u662f\u5426\u8fdb\u884c\u5b8c\u6574\u8bbe\u8ba1";
    default:
      return "\u65e0\u9700IP\u751f\u6210";
  }
}

/**
 * Quick validation of an IP creation plan.
 */
export function verifyIPCreationPlan(plan: IPCreationPlan): string[] {
  const issues: string[] = [];

  if (plan.mode === "not_needed" && plan.assetSequence.length > 0) {
    issues.push("not_needed \u6a21\u5f0f\u5e94\u4e3a\u7a7a assetSequence");
  }

  if (plan.mode === "create_new") {
    if (plan.estimatedImages < 3) {
      issues.push("create_new \u6a21\u5f0f\u5e94\u81f3\u5c11\u5305\u542b 3 \u5f20\u56fe\u7247");
    }
    if (plan.estimatedCostLevel === "low") {
      issues.push("create_new \u6a21\u5f0f\u6210\u672c\u7b49\u7ea7\u4e0d\u5e94\u4e3a low");
    }
  }

  if (plan.mode === "protect_existing") {
    if (plan.estimatedImages > 6) {
      issues.push("protect_existing \u6a21\u5f0f\u5e94\u63a7\u5236\u56fe\u7247\u6570\u91cf");
    }
    if (plan.warnings.filter((w) => w.includes("\u91cd\u7ed8")).length === 0) {
      issues.push("protect_existing \u5fc5\u987b\u5305\u542b\u91cd\u7ed8\u7981\u6b62\u8b66\u544a");
    }
  }

  if (plan.estimatedMinutes < 0) {
    issues.push("estimatedMinutes \u4e0d\u80fd\u4e3a\u8d1f\u6570");
  }

  return issues;
}
