/**
 * TICKET-084-B 试点脚本：4 张 VI 保真样本生图 + 文字化视觉门（本地 ComfyUI + Ollama）。
 *
 * 白名单新增文件（仅本文件、D:\ComfyUI-backup\output\bb-clean-084-b\、桌面回执）。
 * 固定 seed：S1=8401、S2=8402、S3=8403、S4=8404；占位品牌名 + 示例色板，不写死客户品牌。
 *
 * 说明：comfyGenerateScene 不支持指定 seed（内部随机），为满足工单「固定 seed」要求，
 * 本脚本复制与 provider 相同的 Z-Image Turbo 13 节点工作流并用 comfyGenerateFromWorkflow
 * 提交（同一管线：z_image_turbo_nvfp4 + qwen_3_4b_fp8_mixed + ae，euler/simple/steps=4）。
 * comfyGenerateScene 仅按工单要求导入并在此注释记录差异，不实际调用。
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  comfyGenerateScene,
  comfyGenerateFromWorkflow,
  isComfyUIAvailable,
} from "../src/lib/ip/ip-image-provider/comfyui-provider";

const OUTPUT_DIR = "D:\\ComfyUI-backup\\output\\bb-clean-084-b";
const LOG_PATH = join(OUTPUT_DIR, "pilot-084-b.log");
const RESULT_PATH = join(OUTPUT_DIR, "result-084-b.json");
const STALL_PATH = "D:\\disk\\HermesDisk\\bb-clean\\_bridge\\stall-084-B.md";
const OLLAMA_BASE = "http://127.0.0.1:11434";
const SIZE = "1024x1024";
const NEGATIVE_PROMPT =
  "blurry, low quality, distorted text, watermark, text errors, bad typography, 乱码, 错字";

type LifecycleModule = {
  ensureComfyUIReady: (opts?: Record<string, unknown>) => Promise<boolean>;
  killComfyUI: () => void;
  waitForComfyUIProcessExit: (timeoutMs?: number) => Promise<boolean>;
  waitForVramZero: (timeoutMs?: number) => Promise<boolean>;
  runWithMidGenerationGuard: (
    fn: () => Promise<unknown>,
    opts?: Record<string, unknown>
  ) => Promise<unknown>;
  gpuSnapshot: () => Promise<string>;
};

type Sample = {
  id: string;
  seed: number;
  brand: string;
  carrier: string;
  industry: string;
  palette: string;
  output: string;
  prompt: string;
  visionPrompt: string;
};

class StallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StallError";
  }
}

// 运行前清空外部凭据环境变量（离线生图不需要任何密钥）。
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
  "OLLAMA_API_KEY",
]) {
  process.env[name] = "";
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function log(level: "INFO" | "ERROR", message: string): void {
  const line = `${nowIso()} [${level}] ${message}`;
  appendFileSync(LOG_PATH, `${line}\n`, "utf8");
  console.log(line);
}

function roundTo8(n: number): number {
  return Math.max(64, Math.round(n / 8) * 8);
}

/** 与 comfyui-provider buildZTWorkflow 相同的 Z-Image Turbo 管线，唯一差异：外部传入 seed。 */
function buildZTWorkflow(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  seed: number
): Record<string, unknown> {
  return {
    "1": {
      class_type: "UNETLoader",
      inputs: { unet_name: "z_image_turbo_nvfp4.safetensors", weight_dtype: "default" },
    },
    "2": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "qwen_image" },
    },
    "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, distorted", clip: ["2", 0] },
    },
    "6": { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: ["4", 0] } },
    "7": {
      class_type: "BasicScheduler",
      inputs: { model: ["1", 0], scheduler: "simple", steps: 4, denoise: 1.0 },
    },
    "8": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "9": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "10": {
      class_type: "EmptySD3LatentImage",
      inputs: { width: roundTo8(width), height: roundTo8(height), batch_size: 1 },
    },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["9", 0],
        guider: ["6", 0],
        sampler: ["8", 0],
        sigmas: ["7", 0],
        latent_image: ["10", 0],
      },
    },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    "13": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui_zt", images: ["12", 0] },
    },
  };
}

const SAMPLES: Sample[] = [
  {
    id: "S1",
    seed: 8401,
    brand: "示例面馆",
    carrier: "名片",
    industry: "面馆/餐饮（无 IP）",
    palette: "暖红 #B33A2B / 米白 #F5EFE6",
    output: "candidate-S1.png",
    prompt:
      "示例面馆品牌名片设计。这是面馆餐饮行业的商业名片，正面印有品牌名称「示例面馆」，" +
      "采用暖红色（#B33A2B）与米白色（#F5EFE6）双色搭配，简洁大气的平面排版，" +
      "名片上的中文文字必须清晰可读、逐字正确，名片放在真实餐饮商业环境中。",
    visionPrompt:
      "你是严谨的视觉质检员。请仔细查看这张「示例面馆」名片图片，对以下判据逐项回答 true / false / 无法判断，" +
      "每项一行，格式：「判据1: true - 理由」。只输出判据行。\n" +
      "判据1: Logo 文字逐字正确（品牌名「示例面馆」逐字核对，不得错字、缺字、多字）。\n" +
      "判据2: 无缺笔、结构可辨认（Logo 形状与关键元素完整可辨）。\n" +
      "判据3: 品牌色正确（暖红 #B33A2B 与米白 #F5EFE6 为主要配色，允许光影导致的合理偏差）。\n" +
      "判据4: 无客户专属元素串入（画面中不得出现其他品牌名、Logo 元素或公仔）。\n" +
      "判据5: 无跨行业物料（面馆/餐饮名片不得出现茶饮杯套、咖啡杯等其他行业物料元素）。",
  },
  {
    id: "S2",
    seed: 8402,
    brand: "示例茶饮",
    carrier: "手提袋",
    industry: "茶饮（有 IP）",
    palette: "深青 #0F5C5C / 浅金 #C9A227",
    output: "candidate-S2.png",
    prompt:
      "示例茶饮品牌手提袋设计。这是茶饮行业的商业手提纸袋，袋面印有品牌名称「示例茶饮」" +
      "以及属于示例茶饮品牌的公仔形象，采用深青色（#0F5C5C）与浅金色（#C9A227）双色搭配，" +
      "手提袋上的中文文字必须清晰可读、逐字正确，手提袋放在真实奶茶店商业环境中。",
    visionPrompt:
      "你是严谨的视觉质检员。请仔细查看这张「示例茶饮」手提袋图片，对以下判据逐项回答 true / false / 无法判断，" +
      "每项一行，格式：「判据1: true - 理由」。只输出判据行。\n" +
      "判据1: Logo 文字逐字正确（品牌名「示例茶饮」逐字核对，不得错字、缺字、多字）。\n" +
      "判据2: 无缺笔、结构可辨认（Logo 形状与关键元素完整可辨）。\n" +
      "判据3: 品牌色正确（深青 #0F5C5C 与浅金 #C9A227 为主要配色，允许光影导致的合理偏差）。\n" +
      "判据4: 无其他客户专属元素串入（画面中只允许「示例茶饮」品牌名与其公仔，公仔形象必须归属示例茶饮品牌，不得出现其他品牌名、Logo 元素或公仔）。\n" +
      "判据5: 无跨行业物料（茶饮手提袋不得出现面馆、美业等其他行业物料元素）。",
  },
  {
    id: "S3",
    seed: 8403,
    brand: "示例面馆",
    carrier: "门头",
    industry: "面馆/餐饮（无 IP）",
    palette: "暖红 #B33A2B / 米白 #F5EFE6",
    output: "candidate-S3.png",
    prompt:
      "示例面馆的门头招牌实景图。这是面馆餐饮行业的商业门头，招牌上印有品牌名称「示例面馆」，" +
      "采用暖红色（#B33A2B）与米白色（#F5EFE6）双色搭配，门头位于完整的街边餐饮商业环境中，" +
      "透视、光影与材质自然，招牌上的中文文字必须清晰可读、逐字正确，" +
      "画面中不得出现茶饮杯套、咖啡杯等其他行业物料。",
    visionPrompt:
      "你是严谨的视觉质检员。请仔细查看这张「示例面馆」门头实景图片，对以下判据逐项回答 true / false / 无法判断，" +
      "每项一行，格式：「判据1: true - 理由」。只输出判据行。\n" +
      "判据1: Logo 文字逐字正确（品牌名「示例面馆」逐字核对，不得错字、缺字、多字）。\n" +
      "判据2: 无缺笔、结构可辨认（Logo 形状与关键元素完整可辨）。\n" +
      "判据3: 品牌色正确（暖红 #B33A2B 与米白 #F5EFE6 为主要配色，允许光影导致的合理偏差）。\n" +
      "判据4: 无客户专属元素串入（画面中不得出现其他品牌名、Logo 元素或公仔）。\n" +
      "判据5: 无跨行业物料（面馆门头不得出现茶饮杯套、咖啡杯等其他行业物料元素）。\n" +
      "判据6: 完整商业环境（sceneComplete，门头位于真实完整的街边餐饮商业环境中，不能只有 Logo 悬浮或孤立）。\n" +
      "判据7: 自然融合（integrationNatural，Logo 的透视、材质、光影与背景一致）。",
  },
  {
    id: "S4",
    seed: 8404,
    brand: "示例美业",
    carrier: "海报",
    industry: "美业/丽人",
    palette: "深紫 #4A2C5A / 哑金 #B08D57",
    output: "candidate-S4.png",
    prompt:
      "示例美业品牌宣传海报设计。这是美业丽人行业的商业海报，海报上印有品牌名称「示例美业」，" +
      "采用深紫色（#4A2C5A）与哑金色（#B08D57）双色搭配，海报位于完整的美容院商业环境中，" +
      "透视光影与材质自然融合，海报上的中文文字必须清晰可读、逐字正确。",
    visionPrompt:
      "你是严谨的视觉质检员。请仔细查看这张「示例美业」宣传海报图片，对以下判据逐项回答 true / false / 无法判断，" +
      "每项一行，格式：「判据1: true - 理由」。只输出判据行。\n" +
      "判据1: Logo 文字逐字正确（品牌名「示例美业」逐字核对，不得错字、缺字、多字）。\n" +
      "判据2: 无缺笔、结构可辨认（Logo 形状与关键元素完整可辨）。\n" +
      "判据3: 品牌色正确（深紫 #4A2C5A 与哑金 #B08D57 为主要配色，允许光影导致的合理偏差）。\n" +
      "判据4: 无客户专属元素串入（画面中不得出现其他品牌名、Logo 元素或公仔）。\n" +
      "判据5: 无跨行业物料（美业海报不得出现面馆、茶饮等其他行业物料元素）。\n" +
      "判据6: 完整商业环境（sceneComplete，海报位于真实完整的美容院商业环境中，不能只有 Logo 悬浮或孤立）。\n" +
      "判据7: 自然融合（integrationNatural，海报上内容的透视、材质、光影与背景一致）。",
  },
];

async function ollamaGenerate(model: string, imageBase64: string, prompt: string): Promise<string> {
  const resp = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      images: [imageBase64],
      stream: false,
      options: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!resp.ok) {
    throw new Error(`ollama ${model} HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { response?: string };
  if (!data.response) {
    throw new Error(`ollama ${model} empty response`);
  }
  return data.response;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function writeStallFile(context: {
  reason: string;
  actions: string[];
  questions: string[];
  evidence: string[];
}): Promise<void> {
  const content = [
    "# stall-084-B",
    "",
    `- 时间：${nowIso()}`,
    `- 工单：TICKET-084-B-VISION-FIDELITY-4-SAMPLE-GENERATION`,
    `- 状态：STALLED（侧窗执行停止，等待主窗决策）`,
    "",
    "## 已完成动作",
    ...context.actions.map((a) => `- ${a}`),
    "",
    "## 卡住原因",
    `- ${context.reason}`,
    "",
    "## 需要主窗决策的问题",
    ...context.questions.map((q) => `- ${q}`),
    "",
    "## 已有证据与输出",
    ...context.evidence.map((e) => `- ${e}`),
    "",
  ].join("\n");
  writeFileSync(STALL_PATH, content, "utf8");
  log("INFO", `[084-B-STALL] 已写 ${STALL_PATH}`);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(LOG_PATH, "", "utf8");
  log("INFO", `[084-B-START] 试点启动 ${nowIso()}，seed=${SAMPLES.map((s) => `${s.id}=${s.seed}`).join(",")}`);
  log("INFO", `[084-B-NOTE] comfyGenerateScene 已导入但不调用：其 API 不支持固定 seed，改用 comfyGenerateFromWorkflow + 本地复制的 ZT 工作流（同管线）`);

  const lifecycle = (await import("./_comfyui-lifecycle.mjs")) as unknown as LifecycleModule;

  // Step 1：ComfyUI 就绪（单实例，多次重启未就绪 → stall）
  log("INFO", "[084-B-COMFY] ensureComfyUIReady() 开始（单实例启动，约 90~140s）");
  const ready = await lifecycle.ensureComfyUIReady({
    log: (level: string, msg: string) => log(level === "ERROR" ? "ERROR" : "INFO", `[COMFYUI-HEALTH] ${msg}`),
  });
  if (!ready) {
    throw new StallError("ComfyUI 多次重启仍未就绪（ensureComfyUIReady=false）");
  }
  const apiOk = await isComfyUIAvailable();
  if (!apiOk) {
    throw new StallError("ComfyUI API 已就绪但 isComfyUIAvailable=false（端口 8188 异常）");
  }
  log("INFO", "[084-B-COMFY] ComfyUI 就绪，开始生成 4 张样本");

  // Step 2：逐张生成（runWithMidGenerationGuard 包裹，连续失败 2 次 → stall）
  const generation: unknown[] = [];
  for (const s of SAMPLES) {
    let lastError: unknown = null;
    let saved = false;
    for (let attempt = 1; attempt <= 2 && !saved; attempt += 1) {
      try {
        const workflow = buildZTWorkflow(s.prompt, NEGATIVE_PROMPT, 1024, 1024, s.seed);
        const result = (await lifecycle.runWithMidGenerationGuard(
          async () => comfyGenerateFromWorkflow(workflow),
          {
            log: (level: string, msg: string) => log(level === "ERROR" ? "ERROR" : "INFO", `[COMFYUI-GUARD] ${msg}`),
          }
        )) as { imageUrl: string; durationMs: number };
        const dataUri = result.imageUrl || "";
        const base64 = dataUri.startsWith("data:image/") ? dataUri.split(",")[1] ?? "" : dataUri;
        const buffer = Buffer.from(base64, "base64");
        if (buffer.length === 0) {
          throw new Error("EMPTY_IMAGE_OUTPUT");
        }
        const outPath = join(OUTPUT_DIR, s.output);
        writeFileSync(outPath, buffer);
        const digest = sha256(buffer);
        const record = {
          id: s.id,
          seed: s.seed,
          model: "z_image_turbo_nvfp4",
          steps: 4,
          sampler: "euler",
          scheduler: "simple",
          size: SIZE,
          durationMs: result.durationMs,
          filename: s.output,
          path: outPath,
          sha256: digest,
          attempt,
          generatedAt: nowIso(),
        };
        generation.push(record);
        log("INFO", `[084-B-IMG] ${JSON.stringify(record)}`);
        saved = true;
      } catch (error) {
        lastError = error;
        log("ERROR", `[084-B-IMG] ${s.id} 第 ${attempt} 次生成失败：${errorMessage(error)}`);
        if (attempt === 2) {
          throw new StallError(`${s.id} 连续失败 2 次：${errorMessage(lastError)}`);
        }
      }
    }
  }
  log("INFO", "[084-B-IMG] 4 张样本全部生成，开始停止 ComfyUI（034 约定）");

  // Step 2 收尾：ComfyUI 必须完全停止、显存归零后才进入视觉门
  lifecycle.killComfyUI();
  const exited = await lifecycle.waitForComfyUIProcessExit(30_000);
  const vramZero = await lifecycle.waitForVramZero(60_000);
  const shutdown = { killIssuedAt: nowIso(), processExited: exited, vramZero };
  log("INFO", `[084-B-SHUTDOWN] ${JSON.stringify(shutdown)}`);
  if (!exited || !vramZero) {
    throw new StallError(
      `ComfyUI 未能完全停止（processExited=${exited}，vramZero=${vramZero}），违反 034 约定，禁止进入视觉门`
    );
  }

  // Step 3：Ollama 文字化视觉门（qwen2.5vl:3b 粗筛 + my-vl:latest 终审）
  let ollamaFailCount = 0;
  const visionGate: unknown[] = [];
  for (const s of SAMPLES) {
    const imageBase64 = readFileSync(join(OUTPUT_DIR, s.output)).toString("base64");
    const entry: Record<string, unknown> = { id: s.id, coarse: null, final: null };
    try {
      const raw = await ollamaGenerate("qwen2.5vl:3b", imageBase64, s.visionPrompt);
      ollamaFailCount = 0;
      entry.coarse = { model: "qwen2.5vl:3b", checkedAt: nowIso(), raw };
      log("INFO", `[084-B-VISION] ${s.id} 粗筛 qwen2.5vl:3b 完成`);
    } catch (error) {
      ollamaFailCount += 1;
      log("ERROR", `[084-B-VISION] ${s.id} 粗筛失败：${errorMessage(error)}（连续 ${ollamaFailCount} 次）`);
      if (ollamaFailCount >= 2) {
        throw new StallError(`Ollama 连续 ${ollamaFailCount} 次不可用（粗筛失败：${errorMessage(error)}）`);
      }
    }
    try {
      const raw = await ollamaGenerate("my-vl:latest", imageBase64, s.visionPrompt);
      ollamaFailCount = 0;
      entry.final = { model: "my-vl:latest", checkedAt: nowIso(), raw };
      log("INFO", `[084-B-VISION] ${s.id} 终审 my-vl:latest 完成`);
    } catch (error) {
      ollamaFailCount += 1;
      log("ERROR", `[084-B-VISION] ${s.id} 终审失败：${errorMessage(error)}（连续 ${ollamaFailCount} 次）`);
      if (ollamaFailCount >= 2) {
        throw new StallError(`Ollama 连续 ${ollamaFailCount} 次不可用（终审失败：${errorMessage(error)}）`);
      }
    }
    visionGate.push(entry);
  }

  // 汇总结果（合并既有 capability 快照）
  const existing: Record<string, unknown> = existsSync(RESULT_PATH)
    ? JSON.parse(readFileSync(RESULT_PATH, "utf8"))
    : {};
  const summary = {
    ...existing,
    pilot: {
      ticket: "TICKET-084-B",
      startedAt: nowIso(),
      status: "completed",
      note: "comfyGenerateScene 不支持 seed，已改用 comfyGenerateFromWorkflow + 同管线 ZT 工作流实现固定 seed",
    },
    generation,
    shutdown,
    visionGate,
  };
  writeFileSync(RESULT_PATH, JSON.stringify(summary, null, 2), "utf8");
  log("INFO", `[084-B-DONE] 全部完成，结果 ${RESULT_PATH}`);
  console.log("PILOT_OK");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (error) => {
  const lifecycle = (await import("./_comfyui-lifecycle.mjs")) as unknown as LifecycleModule;
  if (error instanceof StallError) {
    let gpu = "nvidia-smi unavailable";
    try {
      gpu = await lifecycle.gpuSnapshot();
    } catch {
      // ignore
    }
    try {
      lifecycle.killComfyUI();
      await lifecycle.waitForComfyUIProcessExit(30_000);
      await lifecycle.waitForVramZero(60_000);
    } catch {
      // best effort
    }
    await writeStallFile({
      reason: error.message,
      actions: [
        "能力检查通过（显存/内存/模型/D 盘/端口，详见 result-084-b.json capability）",
        "ComfyUI 已按 034 约定尝试完全停止并等待显存归零",
        `日志：${LOG_PATH}`,
      ],
      questions: [
        "是否授权排查并重试本单？重试前请确认根因与是否调整 seed/提示词。",
      ],
      evidence: [
        `执行日志：${LOG_PATH}`,
        `结果文件：${RESULT_PATH}`,
        `GPU 快照：${gpu}`,
        `最后错误：${error.message}`,
      ],
    });
    console.log(`STALL_REASON=${error.message}`);
    process.exitCode = 3;
  } else {
    log("ERROR", `[084-B-FATAL] 未捕获错误：${errorMessage(error)}`);
    console.log(`FATAL_REASON=${errorMessage(error)}`);
    process.exitCode = 2;
  }
});
