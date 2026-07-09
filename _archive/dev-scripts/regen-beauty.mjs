/**
 * regen-beauty.mjs — 花语时光美容院 VI 场景图重新生成
 * 按 image-gen-config.json 参数，英语提示词（SDXL不出中文）
 * 品牌名用拼音 "huayu" 替代中文
 */

import { promises as fs } from "fs";
import path from "path";

const COMFYUI_URL = "http://127.0.0.1:8188";
const OUTPUT_DIR = "D:\\disk\\CODEX\\vi手册logo";

// === 按 image-gen-config.json 配置 ===
const CFG = {
  model: "dreamshaperXL_alpha2Xl10.safetensors",
  width: 1024, height: 1024,
  steps: 20, cfg: 3.5,
  sampler: "euler", scheduler: "normal",
  negative: "deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, text, extra limbs, bad anatomy",
  // LogoRedmondV2 LoRA 0.5 (from config)
  lora: { name: "LogoRedmondV2-Logo-LogoRedmAF.safetensors", strength: 0.5 }
};

// === 美容院品牌: 花语时光 (huayu shiguang) ===
// 拼音: huayu (花语), meirong (美容) — SDXL 只能出英文/拼音

const LOGO_PROMPT = "a minimalist flat vector logo of a delicate floral bloom with flowing petals and soft curved stems, using rose pink #E8576C and champagne gold #F0D5A8, clean geometric line-art style, circular emblem composition, brand name HUAYU in elegant sans-serif lettering below the mark, centered, no shadows or gradients, pure white background, high contrast, sharp edges, 8k, brand identity mark";

const SCENE_PROMPTS = {
  "stationery": "product photography, studio lighting, beauty product bottles and packaging set in soft pink and rose gold tones, elegant minimalist design, HUAYU brand label, arranged on white marble surface, warm studio lighting, photorealistic, 8k",
  "giftbag": "product photography, luxury gift bag with satin ribbon handles in soft pink tones, HUAYU embossed in rose gold foil, elegant floral pattern, standing on clean surface, studio lighting, photorealistic, 8k",
  "jar": "product photography, macro shot, a frosted glass beauty cream jar with rose gold lid, HUAYU printed as delicate gold foil label, soft botanical elements, clean studio background, photorealistic, 8k",
  "poster": "editorial photography, beauty salon promotional poster on a wall, HUAYU centered with elegant floral motifs, warm inviting atmosphere, Chinese aesthetic spa setting, soft gallery lighting, photorealistic, 8k",
  "vipcard": "product photography, close-up, luxury VIP membership card with HUAYU embossed in gold foil, floral pattern, premium textured paper, placed on a wooden surface beside dried rose petals, soft natural light, photorealistic, 8k",
  "storefront": "architectural photography, a modern beauty salon storefront at dusk, backlit acrylic sign with HUAYU BEAUTY glowing warmly, white facade, potted plants on both sides, golden hour, photorealistic, 8k"
};

// === ComfyUI SDXL Workflow ===
function buildWorkflow(prompt, negativePrompt, width, height, seed, filenamePrefix) {
  const r8 = (n) => Math.max(64, Math.round(n / 8) * 8);
  return {
    "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CFG.model } },
    "10": { class_type: "LoraLoader", inputs: { lora_name: CFG.lora.name, strength_model: CFG.lora.strength, strength_clip: CFG.lora.strength, model: ["3", 0], clip: ["3", 1] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10", 1] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt || CFG.negative, clip: ["10", 1] } },
    "6": { class_type: "EmptyLatentImage", inputs: { width: r8(width), height: r8(height), batch_size: 1 } },
    "7": { class_type: "KSampler", inputs: { seed, steps: CFG.steps, cfg: CFG.cfg, sampler_name: CFG.sampler, scheduler: CFG.scheduler, denoise: 1, model: ["10", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: filenamePrefix, images: ["8", 0] } }
  };
}

async function generateAndSave(prompt, negativePrompt, prefix, outName) {
  const seed = Math.floor(Math.random() * 999999999999);
  const wf = buildWorkflow(prompt, negativePrompt, CFG.width, CFG.height, seed, prefix);
  
  console.log(`  Submitting: ${outName} (seed: ${seed})`);
  const sr = await fetch(`${COMFYUI_URL}/api/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: wf })
  });
  if (!sr.ok) throw new Error(`Submit error ${sr.status}`);
  const { prompt_id } = await sr.json();
  
  const st = Date.now();
  while (Date.now() - st < 300000) {
    await new Promise(r => setTimeout(r, 2000));
    const hr = await fetch(`${COMFYUI_URL}/api/history/${prompt_id}`);
    if (hr.status === 404) continue;
    if (!hr.ok) continue;
    const hd = await hr.json();
    const result = hd[prompt_id];
    if (!result) continue;
    if (result.status?.status_str === "error") throw new Error(`Gen error: ${result.status?.reason}`);
    if (result.outputs) {
      for (const nid of Object.keys(result.outputs)) {
        const imgs = result.outputs[nid]?.images;
        if (imgs?.length > 0) {
          const src = path.join("E:\\ComfyUI\\output", imgs[0].subfolder || "", imgs[0].filename);
          const dst = path.join(OUTPUT_DIR, outName);
          try { await fs.copyFile(src, dst); } catch { await fs.copyFile(path.join("E:\\ComfyUI\\output", imgs[0].filename), dst); }
          console.log(`  Done: ${outName} (${((Date.now()-st)/1000).toFixed(1)}s)`);
          return dst;
        }
      }
    }
  }
  throw new Error("Timed out");
}

// === MAIN ===
async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  console.log("=".repeat(50));
  console.log("花语时光美容院 VI 场景图 — 拼音版重新生成");
  console.log(`配置: ${CFG.model} | ${CFG.width}x${CFG.height} | CFG ${CFG.cfg} | ${CFG.steps} steps | ${CFG.sampler}`);
  console.log("=".repeat(50));
  
  const startTime = Date.now();
  const results = {};
  
  // Logo
  console.log("\n[Logo] 生成中...");
  try {
    results.logo = await generateAndSave(LOGO_PROMPT, CFG.negative, "beauty_huayu", "beauty_huayu_logo_00001_.png");
  } catch(e) { console.error(`  Logo FAILED: ${e.message}`); }
  
  // Scenes
  const sceneKeys = Object.keys(SCENE_PROMPTS);
  for (let i = 0; i < sceneKeys.length; i++) {
    const key = sceneKeys[i];
    console.log(`\n[Scene ${i+1}/${sceneKeys.length}: ${key}] 生成中...`);
    try {
      results[key] = await generateAndSave(SCENE_PROMPTS[key], CFG.negative, `beauty_huayu_${key}`, `beauty_huayu_${key}_00001_.png`);
    } catch(e) { console.error(`  ${key} FAILED: ${e.message}`); }
  }
  
  const totalMs = Date.now() - startTime;
  const successCount = Object.values(results).filter(Boolean).length;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`完成! ${successCount}/${Object.keys(results).length} 成功 (${(totalMs/1000).toFixed(0)}s)`);
  for (const [k, v] of Object.entries(results)) {
    if (v) console.log(`  ${k}: ${v}`);
  }
  console.log(`${"=".repeat(50)}`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
