import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  comfyGenerateLogo,
  comfyGenerateScene,
} from "../src/lib/ip/ip-image-provider/comfyui-provider";

const providerPath = "src/lib/ip/ip-image-provider/comfyui-provider.ts";
const source = readFileSync(providerPath, "utf8");
let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string) {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function functionSource(name: string, nextName: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`export async function ${nextName}`, start + 1);
  check(start >= 0 && end > start, `${name} source boundaries exist`);
  return source.slice(start, end);
}

const logoSource = functionSource("comfyGenerateLogo", "comfyGenerateReferenceAnchor");
const sceneSource = functionSource("comfyGenerateScene", "comfyuiInpaintPhoto");
const referenceSource = functionSource("comfyGenerateReferenceAnchor", "comfyGenerateCompositeBackground");
const compositeSource = functionSource("comfyGenerateCompositeBackground", "comfyGenerateScene");

for (const [name, body] of [["Logo", logoSource], ["Scene", sceneSource]] as const) {
  check(!/arkGenerate|source:\s*["']ark["']/.test(body), `${name} has no ARK fallback call or result`);
  check(!/COMFYUI_DISABLE_ARK_FALLBACK|ARK_API_KEY|IMAGE_PROVIDER/.test(body), `${name} ignores fallback/provider environment switches`);
  check(/Local (?:Logo|Scene) generation failed; rethrowing local error/.test(body), `${name} logs safe local failure`);
  check(/catch \(ztErr\)[\s\S]*throw ztErr/.test(body), `${name} rethrows local error`);
}

check(!/ark-fallback|arkGenerate/.test(source), "ComfyUI provider no longer imports or calls ARK fallback");
check(!/COMFYUI_DISABLE_ARK_FALLBACK|ARK_API_KEY/.test(source), "provider no longer reads ARK fallback switch or key");
check(!/arkGenerate|source:\s*["']ark["']/.test(referenceSource), "reference-anchor remains local-only");
check(!/arkGenerate|source:\s*["']ark["']/.test(compositeSource), "composite background remains local-only");
check(/source:\s*["']local["']/.test(referenceSource), "reference-anchor local source contract remains");
check(/source:\s*["']local["']/.test(compositeSource), "composite local source contract remains");

const originalWarn = console.warn;
console.warn = () => undefined;

async function verifyFailure(
  label: string,
  generate: (deps: { fetchImpl: typeof fetch; sleepImpl: (ms: number) => Promise<void> }) => Promise<unknown>,
) {
  const urls: string[] = [];
  const localError = new Error(`${label} local submit failed`);
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (!url.startsWith("http://offline-comfy.test/")) throw new Error("network fallback attempted");
    throw localError;
  }) as typeof fetch;
  await assert.rejects(
    generate({ fetchImpl, sleepImpl: async () => undefined }),
    (error: unknown) => error === localError,
    `${label} rethrows injected local error`,
  );
  assertions += 1;
  equal(urls.length, 1, `${label} makes no second/fallback request after local failure`);
  check(urls[0].endsWith("/prompt"), `${label} only attempts local prompt submission`);
}

async function verifySuccess(
  label: string,
  generate: (deps: { fetchImpl: typeof fetch; sleepImpl: (ms: number) => Promise<void> }) => Promise<{ imageUrl: string; durationMs: number; model: string; source: string; seed?: number }>,
  expectedModel: string,
  expectedSeed?: number,
) {
  const urls: string[] = [];
  let workflowText = "";
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    check(url.startsWith("http://offline-comfy.test/"), `${label} success uses only injected local base URL`);
    if (url.endsWith("/prompt")) {
      workflowText = String(init?.body || "");
      return new Response(JSON.stringify({ prompt_id: `${label}-prompt` }), { status: 200 });
    }
    if (url.endsWith("/queue")) {
      return new Response(JSON.stringify({ queue_running: [[1, `${label}-prompt`]], queue_pending: [] }), { status: 200 });
    }
    if (url.includes("/history/")) {
      return new Response(JSON.stringify({
        [`${label}-prompt`]: { status: { completed: true }, outputs: { "11": { images: [{ filename: `${label}.png` }] } }, },
      }), { status: 200 });
    }
    if (url.includes("/view?")) return new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
    throw new Error(`unexpected local URL: ${url}`);
  }) as typeof fetch;

  const result = await generate({ fetchImpl, sleepImpl: async () => undefined });
  equal(result.source, "local", `${label} preserves local source`);
  equal(result.model, expectedModel, `${label} preserves model`);
  check(result.imageUrl.startsWith("data:image/png;base64,"), `${label} preserves data URL output`);
  check(result.durationMs >= 0, `${label} preserves duration`);
  if (expectedSeed !== undefined) equal(result.seed, expectedSeed, `${label} preserves seed`);
  check(workflowText.includes('"width":768') && workflowText.includes('"height":512'), `${label} preserves requested size in workflow`);
  equal(urls.length, 4, `${label} success uses prompt, queue, history and view only`);
}

async function main() {
  const oldBase = process.env.COMFYUI_BASE_URL;
  const oldDisable = process.env.COMFYUI_DISABLE_ARK_FALLBACK;
  const oldArkKey = process.env.ARK_API_KEY;
  const oldProvider = process.env.IMAGE_PROVIDER;
  process.env.COMFYUI_BASE_URL = "http://ignored-after-module-load.test";
  process.env.COMFYUI_DISABLE_ARK_FALLBACK = "0";
  process.env.ARK_API_KEY = "fake-offline-key-must-not-be-used";
  process.env.IMAGE_PROVIDER = "ark";
  try {
    await verifyFailure("logo", (deps) => comfyGenerateLogo({ prompt: "offline logo", seed: 81 }, { ...deps, baseUrl: "http://offline-comfy.test" }));
    await verifyFailure("scene", (deps) => comfyGenerateScene({ prompt: "offline scene", size: "768x512" }, { ...deps, baseUrl: "http://offline-comfy.test" }));
    await verifySuccess(
      "logo",
      (deps) => comfyGenerateLogo({ prompt: "offline logo", size: "768x512", seed: 8101 }, { ...deps, baseUrl: "http://offline-comfy.test" }),
      "z_image_turbo_nvfp4",
      8101,
    );
    await verifySuccess(
      "scene",
      (deps) => comfyGenerateScene({ prompt: "offline scene", size: "768x512" }, { ...deps, baseUrl: "http://offline-comfy.test" }),
      "z_image_turbo_nvfp4",
    );
  } finally {
    console.warn = originalWarn;
    if (oldBase === undefined) delete process.env.COMFYUI_BASE_URL; else process.env.COMFYUI_BASE_URL = oldBase;
    if (oldDisable === undefined) delete process.env.COMFYUI_DISABLE_ARK_FALLBACK; else process.env.COMFYUI_DISABLE_ARK_FALLBACK = oldDisable;
    if (oldArkKey === undefined) delete process.env.ARK_API_KEY; else process.env.ARK_API_KEY = oldArkKey;
    if (oldProvider === undefined) delete process.env.IMAGE_PROVIDER; else process.env.IMAGE_PROVIDER = oldProvider;
  }

  check(!/@ts-ignore|@ts-nocheck/.test(source), "no TypeScript suppression added");
  console.log(`TICKET-081-A regression: ${assertions} assertions passed`);
}

main().catch((error: unknown) => {
  console.warn = originalWarn;
  console.error(error instanceof Error ? error.message : "081-A regression failed");
  process.exitCode = 1;
});
