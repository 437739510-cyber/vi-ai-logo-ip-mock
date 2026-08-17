/**
 * 工单 074-R2：复用 074-R1 已生成的真实 PNG，离线复制并做一次本地双图核验。
 * 不启动 ComfyUI、不提交 prompt、不访问生产或公网服务。
 */
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE_CANDIDATE = "D:\\ComfyUI-backup\\output\\bb_ref_anchor_00001_.png";
const SOURCE_REFERENCE = "D:\\ComfyUI-backup\\output\\bb-clean-074-r1\\reference-074-r1.png";
const EXPECTED_CANDIDATE_BYTES = 196_406;
const EXPECTED_CANDIDATE_SHA256 = "764E5548DD6AF9130029B4265E74B9450B8EBD8B7C7F711A6979A4EB22DCF3DF";
const OUTPUT_DIR = "D:\\ComfyUI-backup\\output\\bb-clean-074-r2";
const CANDIDATE_PATH = path.join(OUTPUT_DIR, "candidate-074-r2.png");
const REFERENCE_PATH = path.join(OUTPUT_DIR, "reference-074-r2.png");
const LOG_PATH = path.join(OUTPUT_DIR, "pilot-074-r2.log");
const RESULT_PATH = path.join(OUTPUT_DIR, "result-074-r2.json");

type GpuSnapshot = { usedMiB: number; utilPct: number } | null;
type LifecycleModule = {
  comfyuiPids: () => number[];
  nvidiaSmiQuery: () => Promise<GpuSnapshot>;
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

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function dataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function log(level: "INFO" | "ERROR", message: string): void {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  appendFileSync(LOG_PATH, `${line}\n`, "utf8");
  console.log(line);
}

async function comfyApiReachable(): Promise<boolean> {
  try {
    const response = await fetch("http://127.0.0.1:8188/system_stats", { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (existsSync(OUTPUT_DIR)) throw new Error("OUTPUT_DIR_EXISTS_REFUSE_OVERWRITE");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(LOG_PATH, "", "utf8");

  const lifecycle = await import("./_comfyui-lifecycle.mjs") as unknown as LifecycleModule;
  const pids = lifecycle.comfyuiPids();
  const apiReachable = await comfyApiReachable();
  const gpuBefore = await lifecycle.nvidiaSmiQuery();
  log("INFO", `[074-R2-PREFLIGHT] comfyPids=${JSON.stringify(pids)} apiReachable=${apiReachable} gpu=${JSON.stringify(gpuBefore)}`);
  if (pids.length > 0 || apiReachable) throw new Error("BLOCKED_COMFYUI_ACTIVE");

  const candidateSourceStat = statSync(SOURCE_CANDIDATE);
  const candidateSource = readFileSync(SOURCE_CANDIDATE);
  const candidateSourceHash = sha256(candidateSource);
  const referenceSourceStat = statSync(SOURCE_REFERENCE);
  const referenceSource = readFileSync(SOURCE_REFERENCE);
  const referenceSourceHash = sha256(referenceSource);
  log("INFO", `[074-R2-SOURCE] candidate path=${SOURCE_CANDIDATE} bytes=${candidateSource.length} mtime=${candidateSourceStat.mtime.toISOString()} sha256=${candidateSourceHash}`);
  log("INFO", `[074-R2-SOURCE] reference path=${SOURCE_REFERENCE} bytes=${referenceSource.length} mtime=${referenceSourceStat.mtime.toISOString()} sha256=${referenceSourceHash}`);
  if (candidateSource.length !== EXPECTED_CANDIDATE_BYTES || candidateSourceHash !== EXPECTED_CANDIDATE_SHA256) {
    throw new Error("BLOCKED_R1_ARTIFACT_MISMATCH");
  }

  copyFileSync(SOURCE_CANDIDATE, CANDIDATE_PATH);
  copyFileSync(SOURCE_REFERENCE, REFERENCE_PATH);
  const candidateCopy = readFileSync(CANDIDATE_PATH);
  const referenceCopy = readFileSync(REFERENCE_PATH);
  const candidateMeta = await sharp(candidateCopy).metadata();
  const referenceMeta = await sharp(referenceCopy).metadata();
  if (candidateCopy.length === 0 || candidateMeta.format !== "png" || candidateMeta.width !== 1024 || candidateMeta.height !== 1024) {
    throw new Error("BLOCKED_CANDIDATE_COPY_INVALID");
  }
  if (referenceCopy.length === 0 || referenceMeta.format !== "png" || referenceMeta.width !== 1024 || referenceMeta.height !== 1024) {
    throw new Error("BLOCKED_REFERENCE_COPY_INVALID");
  }
  if (sha256(candidateCopy) !== candidateSourceHash || sha256(referenceCopy) !== referenceSourceHash) {
    throw new Error("BLOCKED_COPY_HASH_MISMATCH");
  }
  log("INFO", `[074-R2-COPY] candidate path=${CANDIDATE_PATH} bytes=${candidateCopy.length} size=${candidateMeta.width}x${candidateMeta.height} sha256=${sha256(candidateCopy)}`);
  log("INFO", `[074-R2-COPY] reference path=${REFERENCE_PATH} bytes=${referenceCopy.length} size=${referenceMeta.width}x${referenceMeta.height} sha256=${sha256(referenceCopy)}`);

  const vision = await import("../src/lib/vision-check") as unknown as VisionModule;
  const fidelity = await vision.runLogoFidelityVisionCheck({
    referenceImageBase64: dataUri(referenceCopy),
    candidateImageBase64: dataUri(candidateCopy),
  });
  const structuredFidelity = {
    status: fidelity.status,
    logoPresent: fidelity.logoPresent,
    shapePreserved: fidelity.shapePreserved,
    keyElementsPreserved: fidelity.keyElementsPreserved,
    sceneComplete: fidelity.sceneComplete,
    integrationNatural: fidelity.integrationNatural,
    reason: fidelity.reason,
    model: fidelity.model,
    checkedAt: fidelity.checkedAt,
  };
  log("INFO", `[074-R2-VISION] ${JSON.stringify(structuredFidelity)}`);

  const finalPids = lifecycle.comfyuiPids();
  const finalApiReachable = await comfyApiReachable();
  const finalGpu = await lifecycle.nvidiaSmiQuery();
  const conclusion = fidelity.status === "passed" ? "PASS" : "NEEDS_REVIEW";
  writeFileSync(RESULT_PATH, JSON.stringify({
    conclusion,
    source: {
      candidate: { path: SOURCE_CANDIDATE, bytes: candidateSource.length, mtime: candidateSourceStat.mtime.toISOString(), sha256: candidateSourceHash },
      reference: { path: SOURCE_REFERENCE, bytes: referenceSource.length, mtime: referenceSourceStat.mtime.toISOString(), sha256: referenceSourceHash },
    },
    copies: {
      candidate: { path: CANDIDATE_PATH, bytes: candidateCopy.length, width: candidateMeta.width, height: candidateMeta.height, format: candidateMeta.format, sha256: sha256(candidateCopy) },
      reference: { path: REFERENCE_PATH, bytes: referenceCopy.length, width: referenceMeta.width, height: referenceMeta.height, format: referenceMeta.format, sha256: sha256(referenceCopy) },
    },
    fidelity: structuredFidelity,
    final: { comfyPids: finalPids, apiReachable: finalApiReachable, gpu: finalGpu },
    logPath: LOG_PATH,
  }, null, 2), "utf8");
  if (finalPids.length > 0 || finalApiReachable) throw new Error("BLOCKED_COMFYUI_STARTED_UNEXPECTEDLY");
  console.log(JSON.stringify({ conclusion, resultPath: RESULT_PATH, logPath: LOG_PATH }));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  try {
    if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!existsSync(LOG_PATH)) writeFileSync(LOG_PATH, "", "utf8");
    log("ERROR", `[074-R2-FATAL] ${message.slice(0, 300)}`);
    writeFileSync(RESULT_PATH, JSON.stringify({ conclusion: message.startsWith("BLOCKED_") ? message : "BLOCKED_R2_RECOVERY", error: message.slice(0, 300) }, null, 2), "utf8");
  } catch {
    // Best-effort evidence write; original error remains authoritative.
  }
  console.error(`074-R2 recovery failed: ${message}`);
  process.exitCode = 2;
});
