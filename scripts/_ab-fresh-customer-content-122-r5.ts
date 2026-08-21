import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const LOG_ROOT = path.join(ROOT, "logs", "122-r5");
const ASSET_ROOT = path.join(LOG_ROOT, "assets");
const CANDIDATE_ROOT = path.join(ASSET_ROOT, "candidates");
const COMFY = "http://127.0.0.1:8188";
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SceneJob = { role: string; key: string; label: string; prompt: string; seed: number };
const sharedStyle = "山西太原社区汽车清洁养护门店，真实商业摄影，写实中国社区环境，深青绿#0F6B6D与清水蓝绿#5CC8C4点缀，暖白与石墨灰空间，清爽、踏实、亲切、利落，现代但不过度科技，专业但不奢华，横向构图，室内外自然光，细节清晰，画面中所有招牌、屏幕、卡片、包装、车牌保持完全空白，无可识别文字，无商标，无水印，无豪车品牌，无卡通公仔，无人物特写";
const jobs: SceneJob[] = [
  { role: "scene.storefront", key: "marketing-storefront", label: "社区沿街洗车门店外景", seed: 1225101, prompt: `社区沿街单店洗车场外景，普通家庭车辆驶入，四个洗车工位可辨识，店面整洁可信，空白门头，不像连锁旗舰店，${sharedStyle}` },
  { role: "scene.wash_bay", key: "packaging-1", label: "明亮整洁洗车工位", seed: 1225201, prompt: `明亮整洁的洗车工位，专业高压水枪、泡沫与排水设施，普通家庭用车正在标准洗车，工作区井然有序，无人员近景，${sharedStyle}` },
  { role: "scene.interior_detail", key: "packaging-2", label: "内饰深度清洁", seed: 1225301, prompt: `普通家用车内饰深度清洁场景，吸尘器、软刷、毛巾和细节清洁工具整齐摆放，座椅与中控干净，无人物近景，${sharedStyle}` },
  { role: "scene.handover", key: "marketing-1", label: "完工交车与共同验车", seed: 1225401, prompt: `洗车完工后的共同验车交付场景，一位门店师傅与车主从远处侧身检查普通家用车漆面和轮毂，友好透明，无人物特写，空白验车单，${sharedStyle}` },
  { role: "scene.loyalty_materials", key: "stationery-1", label: "老客户会员维护物料", seed: 1225501, prompt: `社区洗车场老客户维护物料静物摄影，深青绿毛巾、清水蓝绿车钥匙牌、空白会员卡和车辆习惯记录夹整齐陈列，不出现人物，所有卡片与标签完全空白，${sharedStyle}` },
];
// attempt-2 定向补强：针对 attempt-1 wash_bay 出现的“粉色小猪公仔”与“奥迪车标”
// 明确禁止动物公仔/玩具摆件与任何汽车品牌车标；其余场景沿用基础 prompt。
const attempt2PromptOverrides: Record<string, string> = {
  "scene.storefront": `社区沿街单店洗车场外景，普通家庭车辆驶入（车头朝向不露出任何品牌车标），四个洗车工位可辨识，店面整洁可信，空白门头，不像连锁旗舰店，画面中没有任何动物公仔、毛绒玩具、玩偶、立牌或装饰摆件，${sharedStyle}`,
  "scene.wash_bay": `明亮整洁的洗车工位，专业高压水枪、泡沫与排水设施，普通家用车车头朝向侧后方、不露出任何品牌车标，正在标准洗车，工作区井然有序，没有任何动物公仔、毛绒玩具、玩偶、立牌或装饰摆件，无人员近景，${sharedStyle}`,
};
// R6：attempt-3 强约束——公仔/玩偶/吉祥物/人形立牌/装饰卡通形象显式禁止，
// 且强调「保持真实门店/工位原貌，无装饰物」。
const attempt3PromptOverrides: Record<string, string> = {
  "scene.storefront": `社区沿街单店洗车场外景，普通家庭车辆驶入（车头朝向不露出任何品牌车标），四个洗车工位可辨识，店面整洁可信，空白门头，不像连锁旗舰店，画面中绝对没有任何公仔、玩偶、吉祥物、毛绒玩具、人形立牌或装饰卡通形象，没有任何装饰摆件或玩具陈列，保持真实社区洗车门店原貌，${sharedStyle}`,
  "scene.wash_bay": `明亮整洁的洗车工位，专业高压水枪、泡沫与排水设施，普通家用车车头朝向侧后方、不露出任何品牌车标，正在标准洗车，工作区井然有序，画面中绝对没有任何公仔、玩偶、吉祥物、毛绒玩具、人形立牌或装饰卡通形象，没有任何装饰摆件或玩具，无人员近景，${sharedStyle}`,
};
// R7（TICKET-122-R7）：Klein Base attempt-5/6 定向约束——车头朝后/侧后方、
// 不露出任何品牌车标/轮毂/车尾标志；保留 attempt-4 强无公仔与无文字约束。
const attempt5PromptOverrides: Record<string, string> = {
  "scene.wash_bay": `明亮整洁的洗车工位，专业高压水枪、泡沫与排水设施，普通家用车车头朝向后方或侧后方、完全看不到任何品牌车标、轮毂标志或车尾标志，正在标准洗车，工作区井然有序，墙面与柱子完全空白无任何文字，画面中绝对没有任何公仔、玩偶、吉祥物、毛绒玩具、人形立牌或装饰卡通形象，没有任何装饰摆件或玩具，无人员近景，${sharedStyle}`,
};
// R7 候选 2（attempt-6）：车头完全不可见（车尾朝向镜头），车身无任何徽章字母，
// 负面词追加具体品牌词，进一步压制品牌车标。
const attempt6PromptOverrides: Record<string, string> = {
  "scene.wash_bay": `明亮整洁的洗车工位，专业高压水枪、泡沫与排水设施，普通家用车车尾朝向镜头、车头完全不可见，车身无任何品牌徽章、字母或车标，正在标准洗车，工作区井然有序，墙面与柱子完全空白无任何文字，画面中绝对没有任何公仔、玩偶、吉祥物、毛绒玩具、人形立牌或装饰卡通形象，没有任何装饰摆件或玩具，无人员近景，${sharedStyle}`,
};
const negative = "文字, 汉字, 英文, 字母, 数字, 招牌文字, 水印, 商标, logo, 品牌名, 车牌号码, 皇冠, 盾牌, 翅膀, 火焰, 红金配色, 豪车展厅, 奢华连锁店, 加油站, 修理厂, 卡通, 插画, 3D公仔, 吉祥物, 人物特写, 面部特写, 动物公仔, 毛绒玩具, 玩偶, 摆件, 立牌, 招财猫, 汽车车标, 车头标志, 车尾标志, 轮毂标志, 豪车标志, 品牌车标, brand logo, car emblem, car badge, logo on car, 车标, subaru, audi, bmw, mercedes, volkswagen, toyota, honda, hyundai, 斯巴鲁, 奥迪, 宝马, mascot, plush toy, doll, cartoon figure, standee, decorative character, mascot cutout, toy, blurry, low quality, distorted, duplicate";

function workflow(prompt: string, seed: number, filenamePrefix: string) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "z_image_turbo_nvfp4.safetensors", weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "qwen_image" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: prompt } },
    "5": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: negative } },
    "6": { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: ["4", 0] } },
    "7": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "8": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["7", 0], guider: ["6", 0], sampler: ["13", 0], sigmas: ["12", 0], latent_image: ["9", 0] } },
    "9": { class_type: "EmptySD3LatentImage", inputs: { width: 1024, height: 768, batch_size: 1 } },
    "10": { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
    "11": { class_type: "SaveImage", inputs: { images: ["10", 0], filename_prefix: filenamePrefix } },
    "12": { class_type: "BasicScheduler", inputs: { model: ["1", 0], scheduler: "simple", steps: 4, denoise: 1 } },
    "13": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
  };
}

// R6：B 配方思路——Klein Base（非 turbo）写实场景工作流，无参考图文本直出。
// 参数对齐 worker.mjs 场景 A 配方：Flux2Scheduler 20 步 + CFG 3.5 + euler。
function workflowBase(prompt: string, negativeText: string, seed: number, filenamePrefix: string) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "Flux2-Klein-9B-True-v2-nvfp4mixed.safetensors", weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_8b_fp8mixed.safetensors", type: "flux2", device: "default" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: "flux2-vae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: prompt } },
    "5": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: negativeText } },
    "6": { class_type: "EmptyFlux2LatentImage", inputs: { width: 1024, height: 768, batch_size: 1 } },
    "7": { class_type: "Flux2Scheduler", inputs: { steps: 20, width: 1024, height: 768 } },
    "8": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "9": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "10": { class_type: "CFGGuider", inputs: { model: ["1", 0], positive: ["4", 0], negative: ["5", 0], cfg: 3.5 } },
    "11": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["9", 0], guider: ["10", 0], sampler: ["8", 0], sigmas: ["7", 0], latent_image: ["6", 0] } },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    "13": { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: filenamePrefix } },
  };
}

async function comfyJson(endpoint: string, init?: RequestInit) {
  const response = await fetch(`${COMFY}${endpoint}`, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`ComfyUI ${endpoint} HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<any>;
}

async function generateScene(job: SceneJob, attempt: number) {
  const prefix = `r5_qingli_${job.role.replace(/[^a-z0-9]+/gi, "_")}_a${attempt}`;
  const effectivePrompt = (attempt >= 6 && attempt6PromptOverrides[job.role])
    ? attempt6PromptOverrides[job.role]
    : (attempt >= 5 && attempt5PromptOverrides[job.role]) ? attempt5PromptOverrides[job.role]
      : (attempt >= 3 && attempt3PromptOverrides[job.role]) ? attempt3PromptOverrides[job.role]
        : (attempt === 2 && attempt2PromptOverrides[job.role]) ? attempt2PromptOverrides[job.role] : job.prompt;
  const recipe = String(process.argv.find((item) => item.startsWith("--recipe="))?.split("=")[1] || "zturbo");
  const workflowForRecipe = recipe === "base" ? workflowBase(effectivePrompt, negative, job.seed + attempt - 1, prefix) : workflow(effectivePrompt, job.seed + attempt - 1, prefix);
  const submitted = await comfyJson("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflowForRecipe, client_id: `r5-${crypto.randomUUID()}` }) });
  const promptId = String(submitted.prompt_id || "");
  if (!promptId) throw new Error(`Missing prompt_id for ${job.role}`);
  const started = Date.now();
  // R6：Klein Base 20 步单张约 10-20 分钟，超时放宽到 1800s；z-turbo 维持 600s。
  const timeoutMs = recipe === "base" ? 1_800_000 : 600_000;
  let image: any = null;
  while (Date.now() - started < timeoutMs) {
    await delay(3_000);
    const history = await comfyJson(`/history/${encodeURIComponent(promptId)}`);
    const item = history[promptId];
    if (item?.status?.status_str === "error") throw new Error(`ComfyUI execution error for ${job.role}`);
    if (item?.status?.completed) {
      const images = Object.values(item.outputs || {}).flatMap((output: any) => output?.images || []);
      image = images[0];
      break;
    }
  }
  if (!image) throw new Error(`ComfyUI timeout/no image for ${job.role}`);
  const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || "", type: image.type || "output" });
  const response = await fetch(`${COMFY}/view?${query}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`ComfyUI view HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const out = path.join(CANDIDATE_ROOT, `${job.role}-attempt-${attempt}.png`);
  await fs.writeFile(out, bytes);
  const meta = await sharp(bytes).metadata();
  return { role: job.role, key: job.key, label: job.label, attempt, recipe, seed: job.seed + attempt - 1, promptSha256: sha256(effectivePrompt), negativePromptSha256: sha256(negative), path: out, bytes: bytes.length, mime: "image/png", width: meta.width, height: meta.height, sha256: sha256(bytes), comfyPromptId: promptId, sourceFilename: image.filename, elapsedMs: Date.now() - started };
}

async function generateLogos() {
  // 深色底版必须用浅色水滴/车身/文字，否则水滴填充与背景同色不可见（R5 视觉门实测）。
  const svgFor = (dropFill: string, outlineStroke: string, darkFill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640"><path fill="${dropFill}" fill-rule="evenodd" d="M260 58C151 193 108 282 108 376c0 93 68 166 152 166s152-73 152-166C412 282 369 193 260 58Zm0 118c53 74 78 128 78 183 0 50-35 91-78 91s-78-41-78-91c0-55 25-109 78-183Z"/><path d="M175 350c63-70 145-70 221 0M195 356h181" fill="none" stroke="${outlineStroke}" stroke-width="28" stroke-linecap="round"/><circle cx="218" cy="385" r="19" fill="${darkFill}"/><circle cx="354" cy="385" r="19" fill="${darkFill}"/><text x="490" y="415" font-family="Microsoft YaHei,Microsoft YaHei UI,sans-serif" font-size="210" font-weight="700" letter-spacing="12" fill="${darkFill}">清丽洗车</text></svg>`;
  const variants = [
    { role: "logo.primary.transparent", file: "logo-primary-transparent.png", background: null, dropFill: "#0F6B6D", outlineStroke: "#5CC8C4", darkFill: "#263238" },
    { role: "logo.application.dark", file: "logo-on-dark.png", background: "#0F6B6D", dropFill: "#5CC8C4", outlineStroke: "#FFFFFF", darkFill: "#F5F2E8" },
    { role: "logo.application.light", file: "logo-on-light.png", background: "#F5F2E8", dropFill: "#0F6B6D", outlineStroke: "#5CC8C4", darkFill: "#263238" },
  ];
  const records = [];
  for (const item of variants) {
    let pipeline = sharp(Buffer.from(svgFor(item.dropFill, item.outlineStroke, item.darkFill))).resize({ width: 1600, height: 640, fit: "contain" });
    if (item.background) pipeline = pipeline.flatten({ background: item.background });
    const bytes = await pipeline.png().toBuffer();
    const out = path.join(ASSET_ROOT, item.file);
    await fs.writeFile(out, bytes);
    const meta = await sharp(bytes).metadata();
    records.push({ semanticRole: item.role, path: out, bytes: bytes.length, mime: "image/png", width: meta.width, height: meta.height, sha256: sha256(bytes), deterministic: true, font: "Microsoft YaHei" });
  }
  return records;
}

async function assetsMode() {
  await fs.mkdir(CANDIDATE_ROOT, { recursive: true });
  const health = await comfyJson("/system_stats");
  const queue = await comfyJson("/queue");
  if ((queue.queue_running?.length || 0) > 0 || (queue.queue_pending?.length || 0) > 0) throw new Error("ComfyUI queue is not empty; refusing to mix jobs");
  const attemptArg = Number(process.argv.find((item) => item.startsWith("--attempt="))?.split("=")[1] || "1");
  if (![1, 2, 3, 4, 5, 6].includes(attemptArg)) throw new Error("Asset attempt must be 1..6");
  const roleArg = process.argv.find((item) => item.startsWith("--roles="))?.slice("--roles=".length);
  const selectedRoles = roleArg ? new Set(roleArg.split(",")) : new Set(jobs.map((item) => item.role));
  const logoRecords = await generateLogos();
  const scenes = [];
  for (const job of jobs.filter((item) => selectedRoles.has(item.role))) {
    console.log(`[R5-ASSET] generating ${job.role} attempt ${attemptArg}`);
    scenes.push(await generateScene(job, attemptArg));
    await delay(5_000);
  }
  const output = path.join(LOG_ROOT, `asset-generation-attempt-${attemptArg}.json`);
  const recipe = String(process.argv.find((item) => item.startsWith("--recipe="))?.split("=")[1] || "zturbo");
  const meta = recipe === "base"
    ? { model: "Flux2-Klein-9B-True-v2-nvfp4mixed.safetensors", clip: "qwen_3_8b_fp8mixed.safetensors", steps: 20, cfg: "CFGGuider 3.5", sampler: "euler", width: 1024, height: 768 }
    : { model: "z_image_turbo_nvfp4.safetensors", clip: "qwen_3_4b_fp8_mixed.safetensors", steps: 4, cfg: "BasicGuider", sampler: "euler", width: 1024, height: 768 };
  await fs.writeFile(output, JSON.stringify({ ticket: "TICKET-122-R5", phase: 1, generatedAt: new Date().toISOString(), comfyReachable: !!health, queueInitiallyEmpty: true, recipe, ...meta, logoRecords, scenes, imagesDisplayedInCodex: false, paidFallbackCalls: 0 }, null, 2));
  console.log(JSON.stringify({ ok: true, output, attempt: attemptArg, generated: scenes.map((item) => ({ role: item.role, path: item.path, sha256: item.sha256, elapsedMs: item.elapsedMs })) }, null, 2));
}

async function main() {
  if (process.argv.includes("--assets")) return assetsMode();
  throw new Error("R5 main A/B mode is not yet selected; use --assets during Phase 1");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
