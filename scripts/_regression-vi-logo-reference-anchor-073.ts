/** 工单 073：reference-anchor 生产接口与 candidate_074 门禁。纯离线 Mock，不启动本地服务。 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReferenceAnchorWorkflow,
  comfyGenerateReferenceAnchor,
  ComfyUIError,
} from "../src/lib/ip/ip-image-provider/comfyui-provider";
import {
  buildLogoFidelityPayload,
  evaluateLogoFidelityFacts,
  parseLogoFidelityResult,
} from "../src/lib/vision-check";
import {
  buildLogoCompositeFallbackPrompt,
  evaluateLogoSceneDeliveryGate,
  getLogoSceneLayout,
} from "../src/lib/vi-manual/logo-scene-compositor";

process.env.ARK_API_KEY = "";
process.env.DEEPSEEK_API_KEY = "";
process.env.SUPABASE_SERVICE_KEY = "";
process.env.COMFYUI_DISABLE_ARK_FALLBACK = "1";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const providerSrc = readFileSync(path.join(root, "src/lib/ip/ip-image-provider/comfyui-provider.ts"), "utf8");
const visionSrc = readFileSync(path.join(root, "src/lib/vision-check/index.ts"), "utf8");
const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");
const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} | 证据: ${evidence}`);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

async function errorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof ComfyUIError ? error.code : (error as Error).message;
  }
}

async function errorDetails(run: () => Promise<unknown>): Promise<{ code: string; retryable: boolean }> {
  try {
    await run();
    return { code: "NO_ERROR", retryable: false };
  } catch (error) {
    return error instanceof ComfyUIError
      ? { code: error.code, retryable: error.retryable }
      : { code: error instanceof Error ? error.message : String(error), retryable: false };
  }
}

function syncErrorCode(run: () => unknown): string {
  try {
    run();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof ComfyUIError ? error.code : (error as Error).message;
  }
}

async function main() {
  const workflow = buildReferenceAnchorWorkflow({
    prompt: "premium retail storefront with a complete entrance and street context",
    referenceImageName: "bb-ref-fixture.png",
    seed: 73073,
    width: 1024,
    height: 768,
  });
  const classes = Object.values(workflow).map((node) => node.class_type);
  const requiredClasses = [
    "UNETLoader", "CLIPLoader", "VAELoader", "CLIPTextEncode", "ConditioningZeroOut",
    "FluxKontextMultiReferenceLatentMethod", "EmptyFlux2LatentImage", "LoadImage",
    "FluxKontextImageScale", "VAEEncode", "ReferenceLatent", "Flux2Scheduler",
    "KSamplerSelect", "RandomNoise", "CFGGuider", "SamplerCustomAdvanced", "VAEDecode", "SaveImage",
  ];
  check("073-1 纯构建器包含 18 个规定节点", Object.keys(workflow).length === 18 && requiredClasses.every((item) => classes.includes(item)), `nodes=${Object.keys(workflow).length}`);
  check("073-2 LoadImage 使用正式上传名", workflow["8"].inputs.image === "bb-ref-fixture.png", String(workflow["8"].inputs.image));
  check("073-3 参考图真实接入 ReferenceLatent→Guider", JSON.stringify(workflow["11"].inputs.latent) === '["10",0]' && JSON.stringify(workflow["15"].inputs.positive) === '["11",0]', "8→9→10→11→15");
  check("073-4 使用本机已确认的 Klein/CLIP/VAE 文件名", String(workflow["1"].inputs.unet_name).includes("Flux2-Klein-9B") && String(workflow["2"].inputs.clip_name).includes("qwen_3_8b") && workflow["3"].inputs.vae_name === "flux2-vae.safetensors", "model trio");
  check("073-4b seed/steps/尺寸及输出前缀均有安全边界", [
    syncErrorCode(() => buildReferenceAnchorWorkflow({ prompt: "x", referenceImageName: "ref.png", seed: -1 })),
    syncErrorCode(() => buildReferenceAnchorWorkflow({ prompt: "x", referenceImageName: "ref.png", steps: 3 })),
    syncErrorCode(() => buildReferenceAnchorWorkflow({ prompt: "x", referenceImageName: "ref.png", width: 4096 })),
    syncErrorCode(() => buildReferenceAnchorWorkflow({ prompt: "x", referenceImageName: "ref.png", filenamePrefix: "客户名" })),
  ].every((code) => code === "REFERENCE_INVALID_CONFIG"), "invalid config rejected");
  const encodedPrompt = String(workflow["4"].inputs.text);
  check("073-5 Prompt 强制完整商业环境而非孤立 Logo", /complete professional commercial scene/.test(encodedPrompt) && /not an isolated logo/.test(encodedPrompt) && /wide or medium-wide/.test(encodedPrompt), "scene completeness guards");
  check("073-6 Prompt 包含透视/材质/光影融合约束", /perspective/.test(encodedPrompt) && /material/.test(encodedPrompt) && /ambient lighting/.test(encodedPrompt), "integration guards");

  let submittedWorkflow: unknown = null;
  const successFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/upload/image")) {
      check("073-7 上传使用 multipart FormData", init?.method === "POST" && init.body instanceof FormData, "POST /upload/image");
      return json({ name: "bb-ref-mock.png", subfolder: "" });
    }
    if (url.endsWith("/prompt")) {
      submittedWorkflow = JSON.parse(String(init?.body)).prompt;
      return json({ prompt_id: "prompt-073" });
    }
    if (url.endsWith("/queue")) return json({ queue_running: [[1, "prompt-073"]], queue_pending: [] });
    if (url.endsWith("/history/prompt-073")) return json({ "prompt-073": { status: { completed: true }, outputs: { "18": { images: [{ filename: "out-073.png" }] } } } });
    if (url.includes("/view?")) return new Response(Uint8Array.from([137, 80, 78, 71]), { status: 200 });
    if (url.endsWith("/interrupt")) return json({});
    throw new Error(`Unexpected network route: ${url}`);
  };
  const result = await comfyGenerateReferenceAnchor({
    prompt: "complete beverage storefront",
    referenceImage: Buffer.from([1, 2, 3, 4]),
    seed: 73123,
  }, { fetchImpl: successFetch, sleepImpl: async () => {}, baseUrl: "http://mock.invalid", randomIdImpl: () => "fixture" });
  check("073-8 Mock 闭环为 upload→submit→poll→view", !!submittedWorkflow && result.imageUrl.startsWith("data:image/png;base64,"), `prompt=${result.diagnostics.promptId}`);
  check("073-9 结果明确标记 reference_anchor/candidate_074", result.strategy === "reference_anchor" && result.executorStatus === "candidate_074" && result.source === "local", `${result.strategy}/${result.executorStatus}`);
  check("073-10 诊断保留上传名、prompt_id、节点数", result.diagnostics.referenceUploadName === "bb-ref-mock.png" && result.diagnostics.promptId === "prompt-073" && result.diagnostics.workflowNodeCount === 18, JSON.stringify(result.diagnostics));

  const uploadFailure = await errorCode(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, {
    fetchImpl: async () => new Response("upload down", { status: 503 }), baseUrl: "http://mock.invalid",
  }));
  check("073-11 上传失败有明确错误码", uploadFailure === "REFERENCE_UPLOAD_FAILED", uploadFailure);

  const nodeFailureFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/upload/image")) return json({ name: "ref.png" });
    if (url.endsWith("/prompt")) return new Response("class_type FluxKontext node does not exist", { status: 400 });
    throw new Error(`Unexpected route ${url}`);
  };
  const nodeFailure = await errorCode(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, { fetchImpl: nodeFailureFetch, baseUrl: "http://mock.invalid" }));
  check("073-12 缺节点映射为 REFERENCE_NODE_MISSING", nodeFailure === "REFERENCE_NODE_MISSING", nodeFailure);
  const modelFailureFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/upload/image")) return json({ name: "ref.png" });
    if (url.endsWith("/prompt")) return new Response("unet_name model not in list", { status: 400 });
    throw new Error(`Unexpected route ${url}`);
  };
  const modelFailure = await errorCode(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, { fetchImpl: modelFailureFetch, baseUrl: "http://mock.invalid" }));
  check("073-12b 缺模型映射为 REFERENCE_MODEL_MISSING", modelFailure === "REFERENCE_MODEL_MISSING", modelFailure);

  let clock = 0;
  const timeoutFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/upload/image")) return json({ name: "ref.png" });
    if (url.endsWith("/prompt")) return json({ prompt_id: "timeout-073" });
    throw new Error(`Unexpected route ${url}`);
  };
  const timeoutFailure = await errorCode(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]), timeoutMs: 500 }, {
    fetchImpl: timeoutFetch, baseUrl: "http://mock.invalid", nowImpl: () => (clock += 1000), sleepImpl: async () => {},
  }));
  check("073-13 超时映射为 REFERENCE_TIMEOUT", timeoutFailure === "REFERENCE_TIMEOUT", timeoutFailure);
  const noOutputFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/upload/image")) return json({ name: "ref.png" });
    if (url.endsWith("/prompt")) return json({ prompt_id: "empty-073" });
    if (url.endsWith("/queue")) return json({ queue_running: [[1, "empty-073"]], queue_pending: [] });
    if (url.endsWith("/history/empty-073")) return json({ "empty-073": { status: { completed: true }, outputs: {} } });
    throw new Error(`Unexpected route ${url}`);
  };
  const noOutputFailure = await errorCode(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, { fetchImpl: noOutputFetch, baseUrl: "http://mock.invalid", sleepImpl: async () => {} }));
  check("073-13b 完成但无输出映射为 REFERENCE_NO_OUTPUT", noOutputFailure === "REFERENCE_NO_OUTPUT", noOutputFailure);

  const createViewFetch = (viewImpl: (attempt: number) => Promise<Response>) => {
    const counts = { prompt: 0, view: 0 };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/upload/image")) return json({ name: "ref-r2.png" });
      if (url.endsWith("/prompt")) {
        counts.prompt += 1;
        return json({ prompt_id: "prompt-r2" });
      }
      if (url.endsWith("/queue")) return json({ queue_running: [[1, "prompt-r2"]], queue_pending: [] });
      if (url.endsWith("/history/prompt-r2")) return json({ "prompt-r2": { status: { completed: true }, outputs: { "18": { images: [{ filename: "out-r2.png" }] } } } });
      if (url.includes("/view?")) {
        counts.view += 1;
        return viewImpl(counts.view);
      }
      throw new Error(`Unexpected route ${url}`);
    };
    return { counts, fetchImpl };
  };

  const transientThenSuccess = createViewFetch(async (attempt) => {
    if (attempt === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    return new Response(Uint8Array.from([137, 80, 78, 71]), { status: 200 });
  });
  const retrySleeps: number[] = [];
  const retryResult = await comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, {
    fetchImpl: transientThenSuccess.fetchImpl,
    baseUrl: "http://mock.invalid",
    sleepImpl: async (ms) => { retrySleeps.push(ms); },
  });
  check(
    "074-R2-1 /view 首次 Timeout、第二次成功返回本地 data URI",
    retryResult.source === "local" && retryResult.imageUrl.startsWith("data:image/png;base64,") && transientThenSuccess.counts.view === 2 && retrySleeps.filter((ms) => ms === 2_000).length === 2,
    JSON.stringify({ source: retryResult.source, view: transientThenSuccess.counts.view, backoff: retrySleeps.filter((ms) => ms === 2_000).length }),
  );
  check(
    "074-R2-2 下载重试不重复提交 /prompt",
    transientThenSuccess.counts.prompt === 1 && transientThenSuccess.counts.view === 2,
    JSON.stringify(transientThenSuccess.counts),
  );

  const exhausted = createViewFetch(async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  });
  const exhaustedError = await errorDetails(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, {
    fetchImpl: exhausted.fetchImpl,
    baseUrl: "http://mock.invalid",
    sleepImpl: async () => {},
  }));
  check(
    "074-R2-3 /view 三次瞬时失败给出明确 retryable 错误",
    exhaustedError.code === "REFERENCE_OUTPUT_FETCH_FAILED" && exhaustedError.retryable && exhausted.counts.prompt === 1 && exhausted.counts.view === 3,
    JSON.stringify({ ...exhaustedError, ...exhausted.counts }),
  );

  const deterministic4xx = createViewFetch(async () => new Response("missing", { status: 404 }));
  const deterministicError = await errorDetails(() => comfyGenerateReferenceAnchor({ prompt: "x", referenceImage: Buffer.from([1]) }, {
    fetchImpl: deterministic4xx.fetchImpl,
    baseUrl: "http://mock.invalid",
    sleepImpl: async () => {},
  }));
  check(
    "074-R2-4 确定性 4xx 不做三次盲试",
    deterministicError.code === "REFERENCE_OUTPUT_FETCH_FAILED" && !deterministicError.retryable && deterministic4xx.counts.prompt === 1 && deterministic4xx.counts.view === 1,
    JSON.stringify({ ...deterministicError, ...deterministic4xx.counts }),
  );

  const payload = buildLogoFidelityPayload("fixture-vl", "data:image/png;base64,UkVG", "data:image/png;base64,Q0FORElEQVRF");
  check("073-14 忠实度请求同批携带 reference/candidate 两图", Array.isArray(payload.images) && payload.images.length === 2 && payload.images[0] === "UkVG" && payload.images[1] === "Q0FORElEQVRF", JSON.stringify(payload.images));
  const allFacts = { logoPresent: true, shapePreserved: true, keyElementsPreserved: true, sceneComplete: true, integrationNatural: true, reason: "ok" };
  check("073-15 五项全真才 passed", evaluateLogoFidelityFacts(allFacts) === "passed" && evaluateLogoFidelityFacts({ ...allFacts, shapePreserved: false }) === "needs_review", "strict conjunction");
  check("073-16 Logo 缺失或场景不完整直接 failed", evaluateLogoFidelityFacts({ ...allFacts, logoPresent: false }) === "failed" && evaluateLogoFidelityFacts({ ...allFacts, sceneComplete: false }) === "failed", "hard failures");
  check("073-17 非法/缺字段模型输出不能通过", parseLogoFidelityResult('{"logoPresent":true}').status === "needs_review" && parseLogoFidelityResult("not-json").status === "needs_review", "invalid→needs_review");
  check("073-18 双图检查使用本地 Ollama 且 skipped 不等于 passed", visionSrc.includes("images: [stripDataUriPrefix(referenceImageBase64), stripDataUriPrefix(candidateImageBase64)]") && visionSrc.includes('status: "skipped"'), "local dual-image contract");

  const fallbackPrompt = buildLogoCompositeFallbackPrompt("retail entrance scene");
  check("073-19 大场景已有 composite fallback 通用布局与无字底图约束", !!getLogoSceneLayout("marketing-storefront") && !!getLogoSceneLayout("marketing-1") && /no logo, no text/.test(fallbackPrompt), "storefront/marketing layouts");
  const candidateGate = evaluateLogoSceneDeliveryGate({
    requiredKeys: ["marketing-storefront"],
    sceneImages: { "marketing-storefront": "candidate" },
    sceneVision: { "marketing-storefront": "passed" },
    requests: [{ key: "marketing-storefront", routeStatus: "candidate_074", logoPlacement: { strategy: "reference_anchor" } }],
  });
  check("073-20 candidate_074 即使视觉 passed 仍被最终交付门阻断", !candidateGate.ready && candidateGate.blockers[0]?.reason === "candidate_074", JSON.stringify(candidateGate.blockers));
  const referenceGate = (vision?: string, image = "candidate") => evaluateLogoSceneDeliveryGate({
    requiredKeys: ["marketing-storefront"],
    sceneImages: image ? { "marketing-storefront": image } : {},
    sceneVision: vision ? { "marketing-storefront": vision } : {},
    requests: [{ key: "marketing-storefront", routeStatus: "ready", logoPlacement: { strategy: "reference_anchor" } }],
  });
  const readyPassedGate = referenceGate("passed");
  check("073-R1-1 reference_anchor ready + image + passed 才可放行", readyPassedGate.ready, JSON.stringify(readyPassedGate));
  const skippedGate = referenceGate("skipped");
  check("073-R1-2 reference_anchor ready + image + skipped 必须阻断", !skippedGate.ready && skippedGate.blockers[0]?.reason === "reference_anchor_skipped", JSON.stringify(skippedGate.blockers));
  const strictBlocked = ["needs_review", "failed", "suspect"].map((status) => ({ status, gate: referenceGate(status) }));
  check(
    "073-R1-3 reference_anchor needs_review/failed/suspect 全部阻断",
    strictBlocked.every(({ status, gate }) => !gate.ready && gate.blockers[0]?.reason === `reference_anchor_${status}`),
    JSON.stringify(strictBlocked.map(({ status, gate }) => ({ status, blockers: gate.blockers }))),
  );
  const missingVisionGate = referenceGate();
  const missingImageGate = referenceGate("passed", "");
  check(
    "073-R1-4 reference_anchor 缺失视觉状态或图片必须阻断",
    !missingVisionGate.ready && missingVisionGate.blockers[0]?.reason === "reference_anchor_missing" &&
      !missingImageGate.ready && missingImageGate.blockers[0]?.reason === "reference_anchor_missing_image",
    JSON.stringify({ missingVision: missingVisionGate.blockers, missingImage: missingImageGate.blockers }),
  );
  check(
    "073-R1-5 生产请求把 071 logoPlacement.strategy 原样送入交付门",
    /const sceneGenerationRequests = activeScenePrompts\.map\(\(sp\) => \(\{[\s\S]*?\.\.\.sp,[\s\S]*?\}\)\);/.test(workerSrc) &&
      /evaluateLogoSceneDeliveryGate\(\{[\s\S]*?requests: sceneGenerationRequests/.test(workerSrc),
    "scene item.logoPlacement → sceneGenerationRequests → delivery gate",
  );
  check("073-21 Worker 串联 reference→忠实度→明确 composite fallback→再校验", workerSrc.includes("comfyGenerateReferenceAnchor") && (workerSrc.match(/runLogoFidelityVisionCheck/g) || []).length >= 2 && workerSrc.includes("switching to explicit composite fallback"), "reference/fallback/revalidate");
  const gateIndex = workerSrc.indexOf("const logoSceneGate = evaluateLogoSceneDeliveryGate");
  const plannerIndex = workerSrc.indexOf("// Step 3: Plan pages via DeepSeek");
  check("073-22 门禁位于 DeepSeek/PPTX/上传之前", gateIndex > 0 && plannerIndex > gateIndex, `gate=${gateIndex} planner=${plannerIndex}`);
  const executorStart = providerSrc.indexOf("export async function comfyGenerateReferenceAnchor");
  const executorEnd = providerSrc.indexOf("export async function comfyGenerateCompositeBackground", executorStart);
  const executorSrc = providerSrc.slice(executorStart, executorEnd);
  check("073-23 reference executor 无 ARK/普通 txt2img 静默回退", !executorSrc.includes("arkGenerate") && !executorSrc.includes("comfyGenerateScene") && !executorSrc.includes("buildZTWorkflow"), "local reference only");
  const forbidden = [String.fromCodePoint(30334, 30103, 33803), "P" + "OLP", "VI-" + "20260806", "samples-" + "060", "pilot-" + "069"];
  check("073-24 无客户名、项目 ID、试跑目录硬编码", forbidden.every((value) => !providerSrc.includes(value) && !workerSrc.includes(value) && !selfSrc.includes(value)), "generic contract");
  const referencePhase = workerSrc.slice(workerSrc.indexOf("// 073：参考图与 Ollama 双图校验严格分阶段"), gateIndex);
  const firstStop = referencePhase.indexOf("ensureVisionVramFree");
  const firstVision = referencePhase.indexOf("runLogoFidelityVisionCheck");
  const fallbackGenerate = referencePhase.indexOf("SceneCompositeFallback");
  const secondStop = referencePhase.indexOf("ensureVisionVramFree", firstStop + 1);
  const secondVision = referencePhase.indexOf("runLogoFidelityVisionCheck", firstVision + 1);
  check("073-25 两阶段显存隔离：参考生成→停 ComfyUI→校验→合成→再停机→复验", firstStop > 0 && firstVision > firstStop && fallbackGenerate > firstVision && secondStop > fallbackGenerate && secondVision > secondStop, `indexes=${[firstStop, firstVision, fallbackGenerate, secondStop, secondVision].join(",")}`);
  const backgroundStart = providerSrc.indexOf("export async function comfyGenerateCompositeBackground");
  const backgroundEnd = providerSrc.indexOf("export async function comfyGenerateScene", backgroundStart);
  const backgroundSrc = providerSrc.slice(backgroundStart, backgroundEnd);
  check("073-26 composite fallback 底图只走本地 ZT，不触发 ARK", workerSrc.includes("comfyGenerateCompositeBackground") && backgroundSrc.includes("buildZTWorkflow") && !backgroundSrc.includes("arkGenerate"), "local composite background");

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
  if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
