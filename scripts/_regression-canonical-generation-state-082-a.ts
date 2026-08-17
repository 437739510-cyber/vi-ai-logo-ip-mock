import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_GENERATION_TRANSITIONS,
  CANONICAL_GENERATION_STATES,
  canonicalProjectStatus,
  canonicalizeGenerationState,
  canTransitionGenerationState,
  resolveGenerationState,
  type CanonicalGenerationState,
} from "../src/lib/core/generation-state";

let assertions = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}

const expectedStates = [
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

const expectedAliases: Readonly<Record<string, CanonicalGenerationState>> = {
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

function testCanonicalization(): void {
  deepEqual(CANONICAL_GENERATION_STATES, expectedStates, "canonical list must exactly match the contract");
  equal(new Set(CANONICAL_GENERATION_STATES).size, 13, "canonical states must be unique");

  for (const state of expectedStates) {
    equal(canonicalizeGenerationState(state), state, `${state} must remain canonical`);
    equal(canonicalizeGenerationState(`  ${state.toUpperCase()}  `), state, `${state} must normalize safely`);
    equal(canonicalProjectStatus(state), state, `${state} must mirror to project status unchanged`);
  }

  for (const [alias, canonical] of Object.entries(expectedAliases)) {
    equal(canonicalizeGenerationState(alias), canonical, `${alias} must map to ${canonical}`);
    equal(canonicalizeGenerationState(` ${alias.toUpperCase()} `), canonical, `${alias} must trim and lowercase`);
  }

  for (const value of [null, undefined, "", "   ", "unknown", 1, false, {}, []]) {
    equal(canonicalizeGenerationState(value), null, `invalid value ${String(value)} must be rejected`);
  }
}

function testResolution(): void {
  deepEqual(resolveGenerationState(" PAID ", "pending_logo"), {
    state: "pending_logo",
    source: "client",
    clientState: "pending_logo",
    projectState: "pending_logo",
    mirrorMatches: true,
    hasResolutionAnomaly: false,
    hasUnknownRawValue: false,
    hasUnknownClientValue: false,
    hasUnknownProjectValue: false,
  }, "recognized equal values must use client truth and confirm the mirror");

  const conflict = resolveGenerationState("logo_generated", "manual_generated");
  equal(conflict.state, "logo_generated", "recognized client value must win a conflict");
  equal(conflict.source, "client", "conflict source must remain client");
  equal(conflict.mirrorMatches, false, "unequal recognized values must report a mirror mismatch");
  equal(conflict.hasResolutionAnomaly, true, "mirror conflict must be marked anomalous");

  const fallback = resolveGenerationState("legacy_surprise", "manual_pending");
  equal(fallback.state, "pending_manual", "recognized project alias must provide fallback");
  equal(fallback.source, "project_fallback", "unknown client must identify project fallback");
  equal(fallback.hasUnknownClientValue, true, "unknown client raw value must be diagnosed");
  equal(fallback.hasUnknownRawValue, true, "unknown raw anomaly must be summarized");
  equal(fallback.hasResolutionAnomaly, true, "project fallback must be marked anomalous");

  const missingClient = resolveGenerationState(undefined, "scene_rendering");
  equal(missingClient.state, "manual_generating", "missing client must allow project fallback");
  equal(missingClient.hasUnknownRawValue, false, "missing value is not an unknown raw anomaly");
  equal(missingClient.hasResolutionAnomaly, true, "missing-client project fallback must still be anomalous");

  const unresolved = resolveGenerationState("future_state", 42);
  equal(unresolved.state, null, "two unrecognized values must remain unresolved");
  equal(unresolved.source, "unresolved", "unrecognized values must identify unresolved source");
  equal(unresolved.hasUnknownProjectValue, true, "non-string project raw value must be diagnosed");
  equal(unresolved.mirrorMatches, false, "unresolved values cannot establish a matching mirror");
  equal(unresolved.hasResolutionAnomaly, true, "unresolved values must be marked anomalous");
}

function testTransitions(): void {
  deepEqual(Object.keys(ALLOWED_GENERATION_TRANSITIONS), expectedStates, "transition table must cover canonical states in order");
  const canonicalSet = new Set<string>(CANONICAL_GENERATION_STATES);

  for (const state of expectedStates) {
    equal(canTransitionGenerationState(state, state), true, `${state} must allow idempotent same-state writes`);
    equal(canTransitionGenerationState(state, state, { allowSame: false }), false, `${state} must honor allowSame=false`);
    for (const target of ALLOWED_GENERATION_TRANSITIONS[state]) {
      equal(canonicalSet.has(target), true, `${state} transition target ${target} must be canonical`);
      equal(canTransitionGenerationState(state, target), true, `${state} -> ${target} must be allowed`);
    }
  }

  equal(canTransitionGenerationState("submitted", "completed"), false, "submitted must not jump to completed");
  equal(canTransitionGenerationState("logo_generated", "logo_generating"), false, "logo flow must not move backward implicitly");
  equal(canTransitionGenerationState("completed", "pending_logo"), false, "completed must be terminal");
  equal(canTransitionGenerationState("future_state", "submitted"), false, "unknown source must be rejected");
  equal(canTransitionGenerationState("submitted", "future_state"), false, "unknown target must be rejected");
  equal(canTransitionGenerationState(" PAID ", "AI_ANALYSIS"), true, "aliases must normalize before transition checks");
}

function testPurityGuard(): void {
  const source = readFileSync("src/lib/core/generation-state.ts", "utf8");
  for (const forbidden of ["process.env", "fetch(", "Date(", "Date.now", "Math.random", "supabase", "node:fs", "@ts-ignore", "@ts-nocheck"] ) {
    equal(source.includes(forbidden), false, `pure contract must not contain ${forbidden}`);
  }
  equal(/\bany\b/.test(source), false, "contract must not use any");
}

testCanonicalization();
testResolution();
testTransitions();
testPurityGuard();

console.log(`[082-A] PASS (${assertions} assertions)`);
