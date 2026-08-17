import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveGenerationState } from "../src/lib/core/generation-state";

const routePath = "src/app/api/view/route.ts";
const routeSource = readFileSync(routePath, "utf8");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function projectState(clientStatus: unknown, projectStatus: unknown) {
  const resolved = resolveGenerationState(clientStatus, projectStatus);
  return {
    generationStatus: resolved.state,
    generationStateSource: resolved.source,
    generationStateNeedsReview: resolved.hasResolutionAnomaly,
    generationStateMirrorMatches: resolved.mirrorMatches,
  };
}

function testRouteWiring(): void {
  check(
    /import\s*\{\s*resolveGenerationState\s*\}\s*from\s*["']@\/lib\/core\/generation-state["']/.test(routeSource),
    "route must import the 082-A resolver",
  );
  check(
    /resolveGenerationState\(\s*clientInfo\.generationStatus\s*,\s*project\.status\s*\)/.test(routeSource),
    "route must call resolver with client status first and project status second",
  );
  check(/generationStatus:\s*generationState\.state/.test(routeSource), "route must project canonical state or null");
  check(/generationStateSource:\s*generationState\.source/.test(routeSource), "route must project safe source");
  check(
    /generationStateNeedsReview:\s*generationState\.hasResolutionAnomaly/.test(routeSource),
    "route must project anomaly as needs-review",
  );
  check(
    /generationStateMirrorMatches:\s*generationState\.mirrorMatches/.test(routeSource),
    "route must project mirror match boolean",
  );
  check(!routeSource.includes('|| "pending"'), "route must not default unknown state to pending");
  check(!routeSource.includes("任一 completed"), "route must remove forced-completed logic");
  check(
    !/generationStatus\s*===\s*["']completed["']\s*\|\|\s*project\.status\s*===\s*["']completed["']/.test(routeSource),
    "route must not force completion when either mirror says completed",
  );
}

function testFiveProjectionCases(): void {
  assert.deepEqual(projectState("logo_generated", "logo_generated"), {
    generationStatus: "logo_generated",
    generationStateSource: "client",
    generationStateNeedsReview: false,
    generationStateMirrorMatches: true,
  }, "matching canonical values must project without review");
  assertions += 1;

  assert.deepEqual(projectState(" pptx_assembling ", "manual_generating"), {
    generationStatus: "manual_generating",
    generationStateSource: "client",
    generationStateNeedsReview: false,
    generationStateMirrorMatches: true,
  }, "alias must project as canonical state");
  assertions += 1;

  assert.deepEqual(projectState("logo_generated", "completed"), {
    generationStatus: "logo_generated",
    generationStateSource: "client",
    generationStateNeedsReview: true,
    generationStateMirrorMatches: false,
  }, "client/project conflict must preserve client truth rather than force completed");
  assertions += 1;

  assert.deepEqual(projectState("legacy_unknown", "manual_pending"), {
    generationStatus: "pending_manual",
    generationStateSource: "project_fallback",
    generationStateNeedsReview: true,
    generationStateMirrorMatches: false,
  }, "recognized project alias must be an anomalous fallback");
  assertions += 1;

  assert.deepEqual(projectState("legacy_unknown", "future_unknown"), {
    generationStatus: null,
    generationStateSource: "unresolved",
    generationStateNeedsReview: true,
    generationStateMirrorMatches: false,
  }, "two unknown values must remain unresolved without a guessed status");
  assertions += 1;
}

function testResponseSafetyAndCompatibility(): void {
  const passwordCheckIndex = routeSource.indexOf("storedPassword !== viewPassword");
  const successResponseIndex = routeSource.indexOf("success: true");
  check(passwordCheckIndex >= 0, "password verification must remain present");
  check(successResponseIndex > passwordCheckIndex, "password verification must precede project response");

  const responseSource = routeSource.slice(successResponseIndex);
  check(responseSource.includes("client_info: clientInfoForView"), "sanitized client_info must remain in response");
  check(!responseSource.includes("viewPassword"), "response must not expose viewPassword");
  check(responseSource.includes("logos: validLogos"), "customer Logo filtering must remain wired");
  check(routeSource.includes("filterCustomerLogos(logoResults)"), "Logo results must still be filtered");
  check(responseSource.includes("submission: { wantMascot:"), "submission.wantMascot must remain in response");
  check(responseSource.includes("status: project.status"), "existing project.status compatibility field must remain");

  for (const forbiddenField of [
    "clientState",
    "projectState",
    "hasUnknownRawValue",
    "hasUnknownClientValue",
    "hasUnknownProjectValue",
  ]) {
    check(!responseSource.includes(forbiddenField), `response must not expose ${forbiddenField}`);
  }
}

function testReadOnlyAndOfflineBoundary(): void {
  const ignoreSuppression = ["@ts", "-ignore"].join("");
  const noCheckSuppression = ["@ts", "-nocheck"].join("");
  for (const forbidden of [".update(", ".upsert(", ".delete(", "fetch(", "process.env", ignoreSuppression, noCheckSuppression]) {
    check(!routeSource.includes(forbidden), `route must not add ${forbidden}`);
  }
  const testSource = readFileSync("scripts/_regression-customer-view-canonical-state-082-b1.ts", "utf8");
  const unsafeType = ["a", "n", "y"].join("");
  check(!new RegExp(`\\b${unsafeType}\\b`).test(testSource), `new regression must not use ${unsafeType}`);
  check(!testSource.includes(ignoreSuppression), `new regression must not use ${ignoreSuppression}`);
  check(!testSource.includes(noCheckSuppression), `new regression must not use ${noCheckSuppression}`);
}

testRouteWiring();
testFiveProjectionCases();
testResponseSafetyAndCompatibility();
testReadOnlyAndOfflineBoundary();

equal(typeof resolveGenerationState, "function", "082-A resolver must be available at runtime");
console.log(`[082-B1] PASS (${assertions} assertions)`);
