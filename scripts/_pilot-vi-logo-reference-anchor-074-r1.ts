/**
 * 工单 074-R1：单次 25 分钟 reference-anchor 本地试产。
 * 仅允许 localhost ComfyUI / Ollama，不读取客户、订单或凭据数据。
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = "D:\\ComfyUI-backup\\output\\bb-clean-074-r1";
const REFERENCE_PATH = path.join(OUTPUT_DIR, "reference-074-r1.png");
const CANDIDATE_PATH = path.join(OUTPUT_DIR, "candidate-074-r1.png");
const LOG_PATH = path.join(OUTPUT_DIR, "pilot-074-r1.log");
const RESULT_PATH = path.join(OUTPUT_DIR, "result-074-r1.json");
const COMFY_BASE = "http://127.0.0.1:8188";
const HARD_TIMEOUT_MS = 1_500_000;
const FIXED_SEED = 74_001;

type LogLevel = "INFO" | "WARN" | "ERROR";
type LogFn = (level: LogLevel, message: string) => void;
type GpuSnapshot = { usedMiB: number; utilPct: number } | null;
type LifecycleModule = {
  ensureComfyUIReady: (options?: Record<string, unknown>) => Promise<boolean>;
  runWithMidGenerationGuard: <T>(fn: () => Promise<T>, options?: Record<string, unknown>) => Promise<T>;
  killAndRestartComfyUI: (options?: Record<string, unknown>) => Promise<boolean>;
  killComfyUI: () => void;
  waitForComfyUIProcessExit: (timeoutMs?: number) => Promise<boolean>;
  comfyuiPids: () => number[];
  nvidiaSmiQuery: () => Promise<GpuSnapshot>;
};
type ReferenceResult = {
  imageUrl: string;
  durationMs: number;
  model: string;
  source: "local";
  seed: number;
  strategy: "reference_anchor";
  executorStatus: "candidate_074";
  diagnostics: { referenceUploadName: string; promptId: string; workflowNodeCount: number };
};
type ProviderModule = {
  comfyGenerateReferenceAnchor: (options: {
    prompt: string;
    referenceImage: Buffer | string;
    seed: number;
    steps: number;
    width: number;
    height: number;
    timeoutMs: number;
  }) => Promise<ReferenceResult>;
  isComfyUIAvailable: () => Promise<boolean>;
};
type FidelityResult = {
  logoPresent: boolean;
  shapePreserved: boolean;
  keyElementsPreserved: boolean;
  sceneComplete: boolean;
  integrationNatural: boolean;
  reason: string;
  status: "passed" | "failed" | "needs_review" | "skipped";
  model: string;
  raw?: string;
  checkedAt: string;
};
type VisionModule = {
  runLogoFidelityVisionCheck: (options: {
    referenceImageBase64: string;
    candidateImageBase64: string;
    model?: string;
  }) => Promise<FidelityResult>;
};

for (const name of [
  "ARK_API_KEY",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "TOKENHUB_API_KEY",
]) {
  process.env[name] = "";
}
process.env.COMFYUI_DISABLE_ARK_FALLBACK = "1";
process.env.COMFYUI_BASE_URL = COMFY_BASE;
process.env.COMFYUI_NO_PROGRESS_TIMEOUT_MS = "150000";

function log(level: LogLevel, message: string): void {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  appendFileSync(LOG_PATH, `${line}\n`, "utf8");
  console.log(line);
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex").toUpperCase();
}

function dataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function decodeDataUri(value: string): Buffer {
  const match = /^data:image\/[A-Za-z0-9.+-]+;base64,([\s\S]+)$/.exec(value);
  if (!match) throw new Error("REFERENCE_RESULT_NOT_DATA_URI");
  return Buffer.from(match[1], "base64");
}

function errorDetails(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  let code = "REFERENCE_PILOT_FAILED";
  if (typeof error === "object" && error !== null && "code" in error) {
    const value = (error as { code?: unknown }).code;
    if (typeof value === "string" && value) code = value;
  } else if (/TIMEOUT|NO_PROGRESS|COMFYUI-GUARD/.test(message)) {
    code = "REFERENCE_TIMEOUT";
  }
  return { code, message: message.slice(0, 500) };
}

async function waitForVramRelease(
  lifecycle: LifecycleModule,
  baselineUsedMiB: number,
  timeoutMs = 120_000,
): Promise<{ released: boolean; final: GpuSnapshot }> {
  const deadline = Date.now() + timeoutMs;
  let latest = await lifecycle.nvidiaSmiQuery();
  while (Date.now() < deadline) {
    if (latest && latest.usedMiB <= baselineUsedMiB + 512) return { released: true, final: latest };
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    latest = await lifecycle.nvidiaSmiQuery();
  }
  return { released: !!latest && latest.usedMiB <= baselineUsedMiB + 512, final: latest };
}

async function stopComfyUI(lifecycle: LifecycleModule, baselineUsedMiB: number): Promise<{
  exited: boolean;
  released: boolean;
  pids: number[];
  gpu: GpuSnapshot;
}> {
  lifecycle.killComfyUI();
  const exited = await lifecycle.waitForComfyUIProcessExit(30_000);
  const release = await waitForVramRelease(lifecycle, baselineUsedMiB);
  const state = { exited, released: release.released, pids: lifecycle.comfyuiPids(), gpu: release.final };
  log("INFO", `[074-R1-STOP] ${JSON.stringify(state)}`);
  return state;
}

async function main(): Promise<void> {
  if ([REFERENCE_PATH, CANDIDATE_PATH, LOG_PATH, RESULT_PATH].some((file) => existsSync(file))) {
    throw new Error("OUTPUT_EXISTS_REFUSE_OVERWRITE");
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(LOG_PATH, "", "utf8");

  const lifecycle = await import("./_comfyui-lifecycle.mjs") as unknown as LifecycleModule;
  const provider = await import("../src/lib/ip/ip-image-provider/comfyui-provider") as unknown as ProviderModule;
  const vision = await import("../src/lib/vision-check") as unknown as VisionModule;
  const initialGpu = await lifecycle.nvidiaSmiQuery();
  if (!initialGpu) throw new Error("GPU_SNAPSHOT_UNAVAILABLE");
  const baselineUsedMiB = initialGpu.usedMiB;
  log("INFO", `[074-R1-START] gpu=${JSON.stringify(initialGpu)} comfyPids=${JSON.stringify(lifecycle.comfyuiPids())}`);

  const referenceSvg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="none"/>
      <circle cx="512" cy="512" r="300" fill="none" stroke="#0B5963" stroke-width="92"/>
      <path d="M315 690 C430 555 565 405 730 285 C670 475 550 650 365 775 Z" fill="#EF7A27"/>
      <circle cx="405" cy="455" r="38" fill="#FFFFFF"/>
      <circle cx="512" cy="375" r="38" fill="#FFFFFF"/>
      <circle cx="620" cy="455" r="38" fill="#FFFFFF"/>
    </svg>`;
  const referenceBuffer = await sharp(Buffer.from(referenceSvg, "utf8")).png().toBuffer();
  const referenceMeta = await sharp(referenceBuffer).metadata();
  if (referenceMeta.width !== 1024 || referenceMeta.height !== 1024) throw new Error("REFERENCE_SIZE_INVALID");
  writeFileSync(REFERENCE_PATH, referenceBuffer);
  log("INFO", `[074-R1-ASSET] reference path=${REFERENCE_PATH} bytes=${referenceBuffer.length} sha256=${sha256(referenceBuffer)} size=1024x1024`);

  const prompt = [
    "complete professional urban street view and modern storefront architecture",
    "a deep teal circular emblem with one orange diagonal leaf-like path and exactly three white circular dots",
    "integrate the reference emblem naturally into a physical brushed metal and softly illuminated storefront sign",
    "preserve the circular outline, orange diagonal element and all three white dots",
    "wide commercial scene with entrance, windows, facade materials, pavement and surrounding street context",
    "realistic perspective, surface material, reflections, shadows and ambient light",
    "no text, no letters, no watermark, no floating graphic, no isolated logo, no logo close-up",
  ].join(", ");

  const ready = await lifecycle.ensureComfyUIReady({
    log,
    restartAttempts: 2,
    readyTimeoutMs: 180_000,
    coolMs: 10_000,
  });
  log("INFO", `[074-R1-HEALTH] ready=${ready} pids=${JSON.stringify(lifecycle.comfyuiPids())}`);
  if (!ready) throw new Error("BLOCKED_COMFYUI_HEALTH");

  const startedAt = new Date().toISOString();
  let recoveredByGuard = false;
  let generated: ReferenceResult;
  log("INFO", "[074-R1-ATTEMPT] start 1/1");
  try {
    generated = await lifecycle.runWithMidGenerationGuard(
      () => provider.comfyGenerateReferenceAnchor({
        prompt,
        referenceImage: referenceBuffer,
        seed: FIXED_SEED,
        steps: 20,
        width: 1024,
        height: 1024,
        timeoutMs: HARD_TIMEOUT_MS,
      }),
      {
        log,
        probeIntervalMs: 20_000,
        startupGraceMs: 60_000,
        apiFailProbes: 2,
        zeroUtilProbes: 3,
        probe: async (): Promise<{ apiOk: boolean; utilPct: number | null; queueHasAny: boolean }> => {
          let apiOk = false;
          try {
            apiOk = await provider.isComfyUIAvailable();
          } catch {
            apiOk = false;
          }
          const gpu = await lifecycle.nvidiaSmiQuery();
          let queueHasAny = false;
          try {
            const response = await fetch(`${COMFY_BASE}/queue`, { signal: AbortSignal.timeout(5_000) });
            if (response.ok) {
              const queue = await response.json() as { queue_running?: unknown[]; queue_pending?: unknown[] };
              queueHasAny = (queue.queue_running?.length || 0) + (queue.queue_pending?.length || 0) > 0;
            }
          } catch {
            queueHasAny = false;
          }
          const snapshot = { apiOk, utilPct: gpu?.utilPct ?? null, queueHasAny };
          log("INFO", `[074-R1-GUARD-PROBE] ${JSON.stringify(snapshot)}`);
          return snapshot;
        },
        onStall: async (reason: string): Promise<boolean> => {
          log("WARN", `[074-R1-GUARD-STALL] reason=${reason}`);
          recoveredByGuard = await lifecycle.killAndRestartComfyUI({
            log,
            readyTimeoutMs: 180_000,
            coolMs: 10_000,
          });
          return recoveredByGuard;
        },
      },
    );
  } catch (error) {
    const details = errorDetails(error);
    const finishedAt = new Date().toISOString();
    log("ERROR", `[074-R1-ATTEMPT] failed 1/1 code=${details.code} message=${details.message}`);
    const stopState = await stopComfyUI(lifecycle, baselineUsedMiB);
    const conclusion = /TIMEOUT|NO_PROGRESS|COMFYUI-GUARD/.test(`${details.code} ${details.message}`)
      ? "BLOCKED_TIMEOUT"
      : `BLOCKED_${details.code}`;
    writeFileSync(RESULT_PATH, JSON.stringify({
      conclusion,
      monitor: {
        probeIntervalMs: 20_000,
        startupGraceMs: 60_000,
        apiFailProbes: 2,
        zeroUtilProbes: 3,
        noProgressTimeoutMs: 150_000,
        providerHardTimeoutMs: HARD_TIMEOUT_MS,
        maxAttempts: 1,
      },
      attempt: { attempt: 1, startedAt, finishedAt, recoveredByGuard, error: details },
      stopState,
    }, null, 2), "utf8");
    process.exitCode = 2;
    return;
  }

  const finishedAt = new Date().toISOString();
  log("INFO", `[074-R1-ATTEMPT] success 1/1 promptId=${generated.diagnostics.promptId} durationMs=${generated.durationMs}`);
  if (generated.source !== "local" || generated.strategy !== "reference_anchor" || generated.executorStatus !== "candidate_074") {
    throw new Error("REFERENCE_CONTRACT_INVALID");
  }
  const candidateBuffer = decodeDataUri(generated.imageUrl);
  const candidateMeta = await sharp(candidateBuffer).metadata();
  if (candidateMeta.width !== 1024 || candidateMeta.height !== 1024) {
    throw new Error(`CANDIDATE_SIZE_INVALID_${candidateMeta.width}x${candidateMeta.height}`);
  }
  writeFileSync(CANDIDATE_PATH, candidateBuffer);
  log("INFO", `[074-R1-ASSET] candidate path=${CANDIDATE_PATH} bytes=${candidateBuffer.length} sha256=${sha256(candidateBuffer)} size=${candidateMeta.width}x${candidateMeta.height}`);

  const stopBeforeVision = await stopComfyUI(lifecycle, baselineUsedMiB);
  if (!stopBeforeVision.exited || stopBeforeVision.pids.length > 0) throw new Error("BLOCKED_COMFYUI_STOP");
  const fidelity = await vision.runLogoFidelityVisionCheck({
    referenceImageBase64: dataUri(referenceBuffer),
    candidateImageBase64: dataUri(candidateBuffer),
  });
  log("INFO", `[074-R1-VISION] ${JSON.stringify({
    status: fidelity.status,
    logoPresent: fidelity.logoPresent,
    shapePreserved: fidelity.shapePreserved,
    keyElementsPreserved: fidelity.keyElementsPreserved,
    sceneComplete: fidelity.sceneComplete,
    integrationNatural: fidelity.integrationNatural,
    reason: fidelity.reason,
    model: fidelity.model,
    checkedAt: fidelity.checkedAt,
  })}`);
  const finalGpu = await lifecycle.nvidiaSmiQuery();
  const conclusion = fidelity.status === "passed" ? "PASS" : "NEEDS_REVIEW";
  writeFileSync(RESULT_PATH, JSON.stringify({
    conclusion,
    monitor: {
      probeIntervalMs: 20_000,
      startupGraceMs: 60_000,
      apiFailProbes: 2,
      zeroUtilProbes: 3,
      noProgressTimeoutMs: 150_000,
      providerHardTimeoutMs: HARD_TIMEOUT_MS,
      maxAttempts: 1,
    },
    attempt: {
      attempt: 1,
      startedAt,
      finishedAt,
      recoveredByGuard,
      result: {
        durationMs: generated.durationMs,
        model: generated.model,
        source: generated.source,
        strategy: generated.strategy,
        executorStatus: generated.executorStatus,
        seed: generated.seed,
        referenceUploadName: generated.diagnostics.referenceUploadName,
        promptId: generated.diagnostics.promptId,
        workflowNodeCount: generated.diagnostics.workflowNodeCount,
      },
    },
    assets: {
      reference: { path: REFERENCE_PATH, bytes: referenceBuffer.length, width: referenceMeta.width, height: referenceMeta.height, sha256: sha256(referenceBuffer) },
      candidate: { path: CANDIDATE_PATH, bytes: candidateBuffer.length, width: candidateMeta.width, height: candidateMeta.height, sha256: sha256(candidateBuffer) },
    },
    fidelity,
    stopBeforeVision,
    finalGpu,
    logPath: LOG_PATH,
  }, null, 2), "utf8");
}

main().catch(async (error: unknown) => {
  const details = errorDetails(error);
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!existsSync(LOG_PATH)) writeFileSync(LOG_PATH, "", "utf8");
    log("ERROR", `[074-R1-FATAL] code=${details.code} message=${details.message}`);
    const lifecycle = await import("./_comfyui-lifecycle.mjs") as unknown as LifecycleModule;
    lifecycle.killComfyUI();
    await lifecycle.waitForComfyUIProcessExit(30_000);
    writeFileSync(RESULT_PATH, JSON.stringify({ conclusion: `BLOCKED_${details.code}`, fatal: details }, null, 2), "utf8");
  } catch {
    // Final cleanup is best effort; the original failure remains authoritative.
  }
  console.error(`074-R1 pilot failed: ${details.code}: ${details.message}`);
  process.exitCode = 2;
});
