/** 工单 077：付款门纯离线回归；不连接数据库、不启动 Worker、不联网。 */
import { readFileSync } from "node:fs";
import {
  buildPaymentRequiredClientInfo,
  ensurePaymentConfirmed,
  evaluatePaymentGate,
  evaluatePaymentRevocation,
} from "../src/lib/core/payment-gate";

const submitSrc = readFileSync(new URL("../src/app/api/submit/route.ts", import.meta.url), "utf8");
const markPaidSrc = readFileSync(new URL("../src/app/api/admin/mark-paid/route.ts", import.meta.url), "utf8");
const regenerateSrc = readFileSync(new URL("../src/app/api/ai/regenerate-logo/route.ts", import.meta.url), "utf8");
const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const checks: Array<{ name: string; pass: boolean; evidence: string }> = [];

function check(name: string, pass: boolean, evidence: string): void {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} | 证据: ${evidence}`);
}

const submitClientInfoStart = submitSrc.indexOf("client_info: {");
const submitClientInfoEnd = submitSrc.indexOf("created_at: isoNow", submitClientInfoStart);
const submitClientInfoBlock = submitSrc.slice(submitClientInfoStart, submitClientInfoEnd);
check(
  "077-1 新提交保持 submitted 且不写付款确认或 pending_logo",
  submitClientInfoBlock.includes('generationStatus: "submitted"') &&
    !submitClientInfoBlock.includes('generationStatus: "pending_logo"') &&
    !submitClientInfoBlock.includes("paymentConfirmed"),
  JSON.stringify({ submitted: true, pendingLogo: false, paymentMarker: false }),
);

const confirmationStart = markPaidSrc.indexOf("// 工单 025/077");
const confirmationEnd = markPaidSrc.indexOf("return NextResponse.json({ success: true, status: \"paid\"", confirmationStart);
const confirmationBlock = markPaidSrc.slice(confirmationStart, confirmationEnd);
check(
  "077-2 mark-paid 确认分支一次 update 原子写 paid、付款标记与 pending_logo",
  (confirmationBlock.match(/\.update\(/g) || []).length === 1 && confirmationBlock.includes('status: "paid"') &&
    confirmationBlock.includes("ensurePaymentConfirmed") && confirmationBlock.includes('generationStatus: "pending_logo"') &&
    confirmationBlock.includes('.eq("status", project.status)') && confirmationBlock.includes(".maybeSingle()"),
  JSON.stringify({ updateCalls: (confirmationBlock.match(/\.update\(/g) || []).length, atomicFields: true }),
);

const confirmedAt = "2026-08-09T13:00:00.000Z";
const confirmed = ensurePaymentConfirmed({ generationStatus: "submitted", paymentRequired: true }, confirmedAt);
const revoked = buildPaymentRequiredClientInfo({ ...confirmed, generationStatus: "pending_logo" });
check(
  "077-3 尚未生产的撤销会清付款标记并回到安全状态",
  evaluatePaymentRevocation("paid", "pending_logo").allowed &&
    !("paymentConfirmed" in revoked) && !("paymentConfirmedAt" in revoked) &&
    revoked.generationStatus === "submitted" && revoked.generationMessage === "payment_required" && revoked.paymentRequired === true,
  JSON.stringify(revoked),
);

const startedStates = [
  ["logo_generating", "logo_generating"],
  ["submitted", "paused_comfyui"],
  ["logo_generated", "logo_generated"],
  ["mascot_generated", "pending_manual"],
  ["completed", "completed"],
];
check(
  "077-4 已进入 Logo/IP/手册或完成阶段不能静默撤销",
  startedStates.every(([status, generation]) => !evaluatePaymentRevocation(status, generation).allowed) &&
    markPaidSrc.includes("PAYMENT_REVOCATION_REQUIRES_MANUAL_REVIEW") &&
    markPaidSrc.includes("PAYMENT_CONFIRMATION_REQUIRES_MANUAL_REVIEW") && markPaidSrc.includes("status: 409"),
  JSON.stringify(startedStates.map(([status, generation]) => ({ status, generation, allowed: evaluatePaymentRevocation(status, generation).allowed }))),
);

const unpaid = evaluatePaymentGate("submitted", { generationStatus: "pending_logo" });
const guardStart = workerSrc.indexOf("async function guardLogoProjectPayment");
const pollStart = workerSrc.indexOf("async function poll()", guardStart);
const guardBlock = workerSrc.slice(guardStart, pollStart);
const pollLogoStart = workerSrc.indexOf("// Phase 1: Check for pending_logo", pollStart);
const pollLogoEnd = workerSrc.indexOf("// Phase 3:", pollLogoStart);
const pollLogoBlock = workerSrc.slice(pollLogoStart, pollLogoEnd);
check(
  "077-5 Worker 对 pending_logo 未付款项目 fail-closed，不进入生成函数",
  !unpaid.allowed && guardBlock.includes("buildPaymentRequiredClientInfo") && guardBlock.includes("return null") &&
    guardBlock.includes("stale unpaid write skipped") &&
    pollLogoBlock.indexOf("guardLogoProjectPayment") < pollLogoBlock.indexOf("processLogoGeneration") &&
    pollLogoBlock.includes("if (paidProject) await processLogoGeneration(paidProject)"),
  JSON.stringify({ gate: unpaid, guardedBeforeGeneration: true }),
);

const persistent = evaluatePaymentGate("logo_generated", { paymentConfirmed: true, paymentConfirmedAt: confirmedAt });
check(
  "077-6 持久付款标记在项目状态变化后仍放行",
  persistent.allowed && persistent.source === "persistent" && !persistent.shouldPersist,
  JSON.stringify(persistent),
);

const legacy = evaluatePaymentGate("paid", { generationStatus: "pending_logo" });
const upgraded = ensurePaymentConfirmed({ generationStatus: "pending_logo" }, confirmedAt);
check(
  "077-7 旧项目只有明确 status=paid 才升级持久标记后放行",
  legacy.allowed && legacy.source === "legacy_paid" && legacy.shouldPersist &&
    upgraded.paymentConfirmed === true && upgraded.paymentConfirmedAt === confirmedAt &&
    !evaluatePaymentGate("logo_generated", { generationStatus: "pending_logo" }).allowed,
  JSON.stringify({ legacy, upgraded }),
);

const passwordIndex = regenerateSrc.indexOf("storedPassword !== viewPassword");
const paymentIndex = regenerateSrc.indexOf("evaluatePaymentGate(project.status, clientInfo)");
const queueIndex = regenerateSrc.indexOf('generationStatus: "pending_logo"');
check(
  "077-8 合法重生成先验密码再验付款；未付款拒绝，排队保留标记",
  passwordIndex >= 0 && paymentIndex > passwordIndex && queueIndex > paymentIndex &&
    regenerateSrc.includes("ensurePaymentConfirmed") && regenerateSrc.includes('code: "PAYMENT_REQUIRED"') &&
    regenerateSrc.includes("status: 402") && regenerateSrc.includes('.select("id, status, client_info, submission_id")') &&
    regenerateSrc.includes('.eq("status", project.status)') && regenerateSrc.includes(".maybeSingle()"),
  JSON.stringify({ passwordIndex, paymentIndex, queueIndex, rejectsUnpaid: true }),
);

const comfyRetryStart = workerSrc.indexOf("if (!comfyReady)");
const comfyRetryEnd = workerSrc.indexOf("// Step 4:", comfyRetryStart);
const comfyRetryBlock = workerSrc.slice(comfyRetryStart, comfyRetryEnd);
check(
  "077-9 ComfyUI 重试写回展开已过门的 clientInfo，不丢付款字段",
  comfyRetryBlock.includes("client_info: { ...clientInfo, generationStatus: 'pending_logo' }") &&
    guardBlock.includes("client_info: claimedClientInfo") && guardBlock.includes("ensurePaymentConfirmed") &&
    workerSrc.includes("ensurePaymentConfirmed"),
  JSON.stringify({ retrySpreadsClientInfo: true, legacyUpgradePassedForward: true }),
);

check(
  "077-10 保留签名 admin 会话、查看密码及 025/038 Worker-only 契约",
  markPaidSrc.includes("ADMIN_SESSION_COOKIE") && markPaidSrc.includes("verifyAdminSession") &&
    markPaidSrc.includes('session?.role !== "admin"') &&
    !markPaidSrc.includes('req.cookies.get("admin_auth")') &&
    !markPaidSrc.includes('req.cookies.get("admin_role")') &&
    !markPaidSrc.includes('req.cookies.get("admin_user_id")') &&
    !markPaidSrc.includes("/api/ai/analyze-brand") && !markPaidSrc.includes("/api/ai/generate-logo") &&
    markPaidSrc.includes('generationStatus: "pending_logo"') && markPaidSrc.includes("已收款，正在生成") &&
    regenerateSrc.includes("storedPassword !== viewPassword") && !regenerateSrc.includes("vi-ai-logo-ip-mock") &&
    !regenerateSrc.includes("logo_regenerating") && regenerateSrc.includes('generationStatus: "pending_logo"') &&
    /clientInfo\.logoTextLanguage = logoTextLanguage/.test(regenerateSrc),
  "signed admin session + no legacy cookie trust + viewPassword + pending_logo local Worker handoff remain present",
);

check(
  "077-11 Worker Logo 查询取回 status，付款门位于 DeepSeek/ComfyUI 入口之前",
  pollLogoBlock.includes(".select('id, status, client_info, submission_id')") &&
    guardStart > workerSrc.indexOf("callDeepSeek") && guardStart < pollStart && pollLogoBlock.includes("guardLogoProjectPayment") &&
    guardBlock.includes("status: 'logo_generating'") && guardBlock.includes(".eq('status', projectStatus)") &&
    (guardBlock.match(/client_info->>generationStatus/g) || []).length >= 2,
  JSON.stringify({ selectsStatus: true, guardedAtPollBoundary: true, atomicClaim: true }),
);

const failed = checks.filter((item) => !item.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
process.exit(failed.length ? 1 : 0);
