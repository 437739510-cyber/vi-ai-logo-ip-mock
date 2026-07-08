/**
 * Anti-Pattern Library
 * Known error patterns from past VI manual generations.
 * Feeds into QC checks and prompt constraints.
 */
export interface AntiPattern {
  errorId: string;
  errorLevel: "critical" | "warning" | "info";
  errorType: "硬错误" | "假规范" | "资产风险" | "内容错配";
  errorFeature: string;
  detectRule: string;
  promptConstraint: string;
  fixGuide: string;
  occurrenceCount: number;
  firstFound: string;
}

/** Seed with known errors (populated via KM-002 and ongoing QC feedback) */
export const ANTI_PATTERNS: AntiPattern[] = [];
