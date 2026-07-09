// gen-logo-via-deepseek.mjs — DeepSeek 生成专业 Logo 提示词 → ComfyUI
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const DS_KEY = "sk-026843124fbc4b33b0a524c852f3017a";
const COMFYUI = "http://127.0.0.1:8188";
const OUT = "D:\\disk\\CODEX\\vi手册logo";

const brandInfo = {
  companyName: "花颜美容院",
  pinyin: "HUAYAN",
  industry: "丽人:美容SPA",
  brandVision: "让每一位女性绽放自信之美",
  coreValues: "专业、温暖、匠心",
  targetMarket: "25-45岁注重生活品质的都市女性",
  logoStyle: "文字+图标组合",
  logoPhilosophy: "以绽放的花朵为灵感，花瓣线条柔美优雅",
  brandColors: { primary: "#E8576C", secondary: "#9B72CF", accent: "#F0D5A8" }
};

// Step 1: DeepSeek 生成专业 Logo 提示词
async function getLogoPrompts() {
  console.log("[1/2] DeepSeek 分析品牌，生成 Logo 提示词...");
  const systemPrompt = `You are a senior brand identity designer. Given a brand profile, create 4 logo design prompts for AI image generation (SDXL/ComfyUI).

CRITICAL RULES:
- All prompts in English only (image model cannot read Chinese)
- The brand name MUST be rendered as its pinyin: "${brandInfo.pinyin}"
- Each prompt must specify "a minimalist flat vector logo" style
- Include color hex codes in the prompt
- Keep each prompt 40-60 words
- Describe specific shapes, not abstract concepts
- Use these ComfyUI-friendly keywords: "flat vector", "clean white background", "centered", "high contrast", "sharp edges", "8k"

Output JSON array only, no markdown:
[
  "prompt 1 text here",
  "prompt 2 text here",
  "prompt 3 text here",
  "prompt 4 text here"
]`;

  const userMsg = `Create 4 logo prompts for:
Brand: ${brandInfo.companyName} (pinyin: ${brandInfo.pinyin})
Industry: ${brandInfo.industry}
Logo Style: ${brandInfo.logoStyle}
Logo Philosophy: ${brandInfo.logoPhilosophy}
Brand Vision: ${brandInfo.brandVision}
Core Values: ${brandInfo.coreValues}
Target: ${brandInfo.targetMarket}
Colors: primary=${brandInfo.brandColors.primary} (rose pink), secondary=${brandInfo.brandColors.secondary} (purple), accent=${brandInfo.brandColors.accent} (champagne gold)`;

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DS_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }], temperature: 0.8, max_tokens: 1200 })
  });
  const d = await r.json();
  const content = d.choices[0].message.content;
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("No JSON array in DeepSeek response: " + content.slice(0, 200));
  const prompts = JSON.parse(m[0]);
  console.log(`  Got ${prompts.length} prompts`);
  prompts.forEach((p, i) => console.log(`  [${i+1}] ${p.slice(0, 80)}...`));
  return prompts;
}

// Step 2: ComfyUI 生成（DreamShaperXL + LogoRedmondV2 LoRA）
const MODEL = "dreamshaperXL_alpha2Xl10.safetensors";
const LORA = { name: "LogoRedmondV2-Logo-LogoRedmAF.safetensors", w: 0.5 };
const NEG = "deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, extra limbs, bad anatomy, photorealistic, illustration, cartoon, text, letters, words";

function wf(prompt, seed, prefix) {
  return {
    "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: MODEL } },
    "10": { class_type: "LoraLoader", inputs: { lora_name: LORA.name, strength_model: LORA.w, strength_clip: LORA.w, model: ["3",0], clip: ["3",1] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10",1] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: NEG, clip: ["10",1] } },
    "6": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "7": { class_type: "KSampler", inputs: { seed, steps: 20, cfg: 3.5, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["10",0], positive: ["4",0], negative: ["5",0], latent_image: ["6",0] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["7",0], vae: ["3",2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: prefix, images: ["8",0] } }
  };
}

async function gen(prompt, prefix) {
  const seed = Math.floor(Math.random() * 999999999999);
  const r = await fetch(`${COMFYUI}/api/prompt`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({prompt:wf(prompt, seed, prefix)}) });
  const { prompt_id } = await r.json();
  const st = Date.now();
  while(Date.now()-st < 300000) {
    await new Promise(r=>setTimeout(r,2000));
    const hr = await fetch(`${COMFYUI}/api/history/${prompt_id}`);
    if(hr.status===404) continue;
    if(!hr.ok) continue;
    const hd = await hr.json();
    const pr = hd[prompt_id];
    if(!pr) continue;
    if(pr.status?.status_str==="error") throw new Error(pr.status.reason);
    if(pr.outputs) for(const nid of Object.keys(pr.outputs)) {
      const imgs = pr.outputs[nid]?.images;
      if(imgs?.length>0) return imgs[0].filename;
    }
  }
  throw new Error("timeout");
}

async function main() {
  const prompts = await getLogoPrompts();
  console.log("\n[2/2] ComfyUI 生成 4 张 Logo...");
  for(let i=0; i<prompts.length; i++) {
    console.log(`  Logo ${i+1}/4...`);
    try {
      const fn = await gen(prompts[i], "huayan_ds");
      const src = path.join("D:\\ComfyUI-backup\\output", fn);
      const dst = path.join(OUT, `huayan_ds_logo_0000${i+1}_.png`);
      const { copyFileSync } = await import("fs");
      copyFileSync(src, dst);
      console.log(`  Done: huayan_ds_logo_0000${i+1}_.png`);
    } catch(e) { console.error(`  FAIL: ${e.message}`); }
  }
  // Save prompts for reference
  writeFileSync(path.join(OUT, "huayan_ds_prompts.json"), JSON.stringify(prompts, null, 2), "utf-8");
  console.log("\nDone! Prompts saved to huayan_ds_prompts.json");
}
main().catch(e=>{console.error(e);process.exit(1);});
