export const CANONICAL_GENERATION_STATES = [
  "submitted",
  "pending_logo",
  "logo_generating",
  "logo_generated",
  "mascot_generating",
  "mascot_samples_ready",
  "mascot_full_generating",
  "pending_manual",
  "manual_generating",
  "paused_comfyui",
  "needs_review",
  "completed",
  "failed",
] as const;

export type CanonicalGenerationState = (typeof CANONICAL_GENERATION_STATES)[number];

export const GENERATION_STATE_LABELS = {
  submitted: "已提交",
  pending_logo: "等待 Logo 生成",
  logo_generating: "Logo 生成中",
  logo_generated: "Logo 待选择",
  mascot_generating: "公仔样稿生成中",
  mascot_samples_ready: "公仔样稿待选择",
  mascot_full_generating: "完整公仔生成中",
  pending_manual: "等待 VI 手册生成",
  manual_generating: "VI 手册生成中",
  paused_comfyui: "本地生产已暂停",
  needs_review: "人工复核中",
  completed: "VI 手册已完成",
  failed: "生成失败",
} as const satisfies Readonly<Record<CanonicalGenerationState, string>>;

export function getGenerationStateLabel(state: CanonicalGenerationState | null): string {
  return state === null ? "状态待核查" : GENERATION_STATE_LABELS[state];
}

const canonicalStates = new Set<string>(CANONICAL_GENERATION_STATES);

const GENERATION_STATE_ALIASES: Readonly<Record<string, CanonicalGenerationState>> = {
  pending: "submitted",
  payment_uploaded: "submitted",
  payment_required: "submitted",
  paid: "pending_logo",
  ai_analysis: "logo_generating",
  brand_analyzing: "logo_generating",
  brand_analyzed: "logo_generating",
  designing: "logo_generating",
  mascot_pending: "mascot_full_generating",
  mascot_generated: "pending_manual",
  manual_pending: "pending_manual",
  manual_review_complete: "pending_manual",
  scene_rendering: "manual_generating",
  pptx_assembling: "manual_generating",
  waiting_manual_review: "needs_review",
  manual_generated: "completed",
};

export function canonicalizeGenerationState(value: unknown): CanonicalGenerationState | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (canonicalStates.has(normalized)) return normalized as CanonicalGenerationState;
  return GENERATION_STATE_ALIASES[normalized] ?? null;
}

export type GenerationStateSource = "client" | "project_fallback" | "unresolved";

export interface ResolvedGenerationState {
  readonly state: CanonicalGenerationState | null;
  readonly source: GenerationStateSource;
  readonly clientState: CanonicalGenerationState | null;
  readonly projectState: CanonicalGenerationState | null;
  readonly mirrorMatches: boolean;
  readonly hasResolutionAnomaly: boolean;
  readonly hasUnknownRawValue: boolean;
  readonly hasUnknownClientValue: boolean;
  readonly hasUnknownProjectValue: boolean;
}

function isUnknownRawValue(value: unknown, normalized: CanonicalGenerationState | null): boolean {
  if (normalized !== null || value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

export function resolveGenerationState(
  clientStatus: unknown,
  projectStatus: unknown,
): ResolvedGenerationState {
  const clientState = canonicalizeGenerationState(clientStatus);
  const projectState = canonicalizeGenerationState(projectStatus);
  const hasUnknownClientValue = isUnknownRawValue(clientStatus, clientState);
  const hasUnknownProjectValue = isUnknownRawValue(projectStatus, projectState);
  const source: GenerationStateSource = clientState ? "client" : projectState ? "project_fallback" : "unresolved";
  const mirrorMatches = clientState !== null && projectState !== null && clientState === projectState;

  return {
    state: clientState ?? projectState,
    source,
    clientState,
    projectState,
    mirrorMatches,
    hasResolutionAnomaly: source !== "client" || !mirrorMatches || hasUnknownClientValue || hasUnknownProjectValue,
    hasUnknownRawValue: hasUnknownClientValue || hasUnknownProjectValue,
    hasUnknownClientValue,
    hasUnknownProjectValue,
  };
}

export const ALLOWED_GENERATION_TRANSITIONS = {
  submitted: ["pending_logo"],
  pending_logo: ["logo_generating", "submitted"],
  logo_generating: ["logo_generated", "paused_comfyui", "failed"],
  logo_generated: ["mascot_generating", "pending_manual"],
  mascot_generating: ["mascot_samples_ready", "paused_comfyui", "needs_review", "failed"],
  mascot_samples_ready: ["mascot_full_generating"],
  mascot_full_generating: ["pending_manual", "paused_comfyui", "needs_review", "failed"],
  pending_manual: ["manual_generating"],
  manual_generating: ["completed", "paused_comfyui", "needs_review", "failed"],
  paused_comfyui: ["pending_logo", "mascot_generating", "mascot_full_generating", "pending_manual"],
  needs_review: ["mascot_full_generating", "pending_manual", "manual_generating"],
  completed: [],
  failed: ["pending_logo", "mascot_generating", "mascot_full_generating", "pending_manual"],
} as const satisfies Readonly<Record<CanonicalGenerationState, readonly CanonicalGenerationState[]>>;

export interface GenerationStateTransitionOptions {
  readonly allowSame?: boolean;
}

export function canTransitionGenerationState(
  from: unknown,
  to: unknown,
  options: GenerationStateTransitionOptions = {},
): boolean {
  const canonicalFrom = canonicalizeGenerationState(from);
  const canonicalTo = canonicalizeGenerationState(to);
  if (canonicalFrom === null || canonicalTo === null) return false;
  if (canonicalFrom === canonicalTo) return options.allowSame !== false;

  const targets: readonly CanonicalGenerationState[] = ALLOWED_GENERATION_TRANSITIONS[canonicalFrom];
  return targets.includes(canonicalTo);
}

export function canonicalProjectStatus(state: CanonicalGenerationState): CanonicalGenerationState {
  return state;
}
