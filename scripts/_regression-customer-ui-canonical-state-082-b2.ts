import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANONICAL_GENERATION_STATES,
  GENERATION_STATE_LABELS,
  getGenerationStateLabel,
  type CanonicalGenerationState,
} from "../src/lib/core/generation-state";

const statePath = "src/lib/core/generation-state.ts";
const viewPath = "src/app/(client)/view/page.tsx";
const mascotPath = "src/components/client/MascotSection.tsx";
const stateSource = readFileSync(statePath, "utf8");
const viewSource = readFileSync(viewPath, "utf8");
const mascotSource = readFileSync(mascotPath, "utf8");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  assertions += 1;
}

const expectedLabels: Readonly<Record<CanonicalGenerationState, string>> = {
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
};

function testSharedLabels(): void {
  assert.deepEqual(Object.keys(GENERATION_STATE_LABELS), CANONICAL_GENERATION_STATES, "labels must cover exactly 13 canonical states");
  assertions += 1;
  for (const state of CANONICAL_GENERATION_STATES) {
    equal(getGenerationStateLabel(state), expectedLabels[state], `${state} must have its accurate shared label`);
  }
  equal(getGenerationStateLabel(null), "状态待核查", "null must have a safe review label");
  for (const forbidden of ["14", "22", "PDF", "线上生图"]) {
    check(!Object.values(GENERATION_STATE_LABELS).some((label) => label.includes(forbidden)), `labels must not promise ${forbidden}`);
  }
}

function testCustomerView(): void {
  check(/generationStatus:\s*CanonicalGenerationState\s*\|\s*null/.test(viewSource), "view status type must be nullable canonical");
  check(viewSource.includes("generationStateSource: GenerationStateSource"), "view must declare B1 source");
  check(viewSource.includes("generationStateNeedsReview: boolean"), "view must declare B1 needs-review flag");
  check(viewSource.includes("generationStateMirrorMatches: boolean"), "view must declare B1 mirror flag");
  check(viewSource.includes("getGenerationStateLabel(projectData.generationStatus)"), "status badge must use shared label helper");
  check(!viewSource.includes("const getStatusText"), "page-local legacy label map must be removed");

  check(/generationStatus\s*===\s*["']logo_generating["']/.test(viewSource), "Logo generation branch must use canonical status");
  check(!/generationStatus\s*===\s*["']brand_analyzing["']/.test(viewSource), "Logo branch must not use legacy alias");
  check(/generationStatus\s*===\s*["']submitted["']/.test(viewSource), "waiting branch must include submitted");
  check(/generationStatus\s*===\s*["']pending_logo["']/.test(viewSource), "waiting branch must include pending_logo");
  check(/projectData\.status\s*===\s*["']payment_uploaded["']/.test(viewSource), "payment upload must remain a business-status check");
  check(!/generationStatus\s*===\s*["']payment_uploaded["']/.test(viewSource), "payment upload must not be treated as generation state");

  check(viewSource.includes("projectData.generationStatus === null || projectData.generationStateNeedsReview"), "null or anomaly must show safe synchronization notice");
  check(viewSource.includes("状态正在同步"), "view must provide a gentle synchronization message");
  check(viewSource.includes("projectData.generationStatus !== null"), "unknown status must not fall into no-Logo completion-like content");
  check(viewSource.includes("!projectData.generationStateNeedsReview"), "conflicted status must not fall into generic no-Logo content");
}

function testMascotStagesAndSelection(): void {
  check(/generationStatus:\s*CanonicalGenerationState\s*\|\s*null/.test(mascotSource), "mascot status type must be nullable canonical");
  const expectedChecks = [
    'generationStatus === "mascot_generating"',
    'generationStatus === "mascot_samples_ready"',
    'generationStatus === "mascot_full_generating"',
    'generationStatus === "pending_manual"',
    'generationStatus === "manual_generating"',
    'generationStatus === "paused_comfyui"',
    'generationStatus === "needs_review"',
    'generationStatus === "failed"',
    'generationStatus === "completed"',
  ];
  for (const statusCheck of expectedChecks) {
    check(mascotSource.includes(statusCheck), `MascotSection must cover ${statusCheck}`);
  }
  for (const copy of [
    "公仔样稿正在本地生产中",
    "请选择您偏好的公仔风格方向",
    "完整公仔素材正在本地生产中",
    "公仔素材已进入 VI 手册制作阶段",
    "本地生产暂时暂停",
    "人工复核中",
    "生成过程中出现异常",
    "VI 手册已完成",
  ]) {
    check(mascotSource.includes(copy), `MascotSection must display stage copy: ${copy}`);
  }

  check(mascotSource.includes("filterMascotSamples(ci.mascotSamples)"), "real mascot sample filtering must remain");
  check(mascotSource.includes('fetch("/api/ai/save-mascot-preference"'), "mascot selection API must remain");
  check(mascotSource.includes("projectId, selectedSampleId: id, phone, viewPassword"), "selection credentials and project ownership data must remain");
  check(mascotSource.includes('onStatusChange("mascot_full_generating")'), "canonical selection callback must remain");
}

function testRetiredUiAndSafety(): void {
  const uiSource = `${viewSource}\n${mascotSource}`;
  const legacyAliases = [
    "brand_analyzing",
    "mascot_pending",
    "mascot_generated",
    "waiting_manual_review",
    "manual_review_complete",
    "scene_rendering",
    "pptx_assembling",
    "manual_generated",
    "mascot_failed",
    "mascot_sample_fail",
    "mascot_full_fail",
    "mascot_render_fail",
  ];
  for (const alias of legacyAliases) {
    check(!uiSource.includes(alias), `customer UI must not contain legacy status ${alias}`);
  }
  for (const retired of ["14页", "14 页", "22页", "22 页", "download-manual", "countWorkdaysFromNow", "deliveryDate", "PDF", "线上生图"]) {
    check(!uiSource.includes(retired), `customer UI must remove ${retired}`);
  }

  const testSource = readFileSync("scripts/_regression-customer-ui-canonical-state-082-b2.ts", "utf8");
  const unsafeType = ["a", "n", "y"].join("");
  const ignoreSuppression = ["@ts", "-ignore"].join("");
  const noCheckSuppression = ["@ts", "-nocheck"].join("");
  check(!new RegExp(`\\b${unsafeType}\\b`).test(testSource), `new regression must not use ${unsafeType}`);
  check(!testSource.includes(ignoreSuppression), `new regression must not use ${ignoreSuppression}`);
  check(!testSource.includes(noCheckSuppression), `new regression must not use ${noCheckSuppression}`);
  check(!stateSource.includes("process.env"), "shared labels must remain environment independent");
  check(!stateSource.includes("fetch("), "shared labels must remain network independent");
}

testSharedLabels();
testCustomerView();
testMascotStagesAndSelection();
testRetiredUiAndSafety();

console.log(`[082-B2] PASS (${assertions} assertions)`);
