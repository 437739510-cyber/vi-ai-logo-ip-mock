// gen-logo-helloworld.mjs — HelloWorld v7 + 圆章设计v1 正确配方
import { copyFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const COMFYUI = "http://127.0.0.1:8188";
const OUT = "D:\\disk\\CODEX\\vi手册logo";
mkdirSync(OUT, { recursive: true });

const MODEL = "LEOSAM HelloWorld 新世界 _ SDXL大模型_v7.0.safetensors";
const LORA = { name: "【SDXL】模型在手，圆章我有！_【SDXL版】圆章设计v1.safetensors", w: 1.0 };
const STEPS = 20, CFG = 5.0, SAMPLER = "euler_ancestral";
const NEG = "deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, extra limbs, bad anatomy, photorealistic, illustration, cartoon, text, letters, words";

// 仿 Chaowei 验证风格 + 花颜品牌元素
const PROMPTS = [
  "2D flat vector logo, clean white background, centered, high contrast, sharp edges, circular badge emblem, elegant blooming flower petals merging with a feminine silhouette, HUAYAN integrated as part of the circular design, rose pink #E8576C and champagne gold accents, refined beauty salon brand mark, 8k",
  "2D flat vector logo, clean white background, centered, high contrast, sharp edges, round medallion style, stylized flower bloom with soft curved petals forming a wreath, delicate feminine profile at center, HUAYAN text curved along the bottom arc, rose pink #E8576C and champagne gold #F0D5A8, elegant spa identity, 8k",
  "2D flat vector logo, clean white background, centered, high contrast, sharp edges, circular emblem, geometric flower mandala with layered petals, soft feminine silhouette in negative space, HUAYAN lettering integrated into the circular border, rose pink #E8576C with purple #9B72CF accent, luxury beauty brand, 8k",
  "2D flat vector logo, clean white background, centered, high contrast, sharp edges, circular stamp style, single elegant flower with flowing stem forming the letter H, HUAYAN in minimal sans-serif below the mark, rose pink #E8576C monochrome with gold trim, modern minimalist beauty salon, 8k"
];

function wf(prompt, seed, prefix) {
  return {
    "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: MODEL } },
    "10": { class_type: "LoraLoader", inputs: { lora_name: LORA.name, strength_model: LORA.w, strength_clip: LORA.w, model: ["3",0], clip: ["3",1] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10",1] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: NEG, clip: ["10",1] } },
    "6": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "7": { class_type: "KSampler", inputs: { seed, steps: STEPS, cfg: CFG, sampler_name: SAMPLER, scheduler: "normal", denoise: 1, model: ["10",0], positive: ["4",0], negative: ["5",0], latent_image: ["6",0] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["7",0], vae: ["3",2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: prefix, images: ["8",0] } }
  };
}

async function gen(prompt, prefix) {
  const seed = Math.floor(Math.random() * 999999999999);
  const r = await fetch(`${COMFYUI}/api/prompt`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({prompt:wf(prompt, seed, prefix)}) });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  const pid = d.prompt_id, st = Date.now();
  while (Date.now()-st < 300000) {
    await new Promise(r=>setTimeout(r,2000));
    const hr = await fetch(`${COMFYUI}/api/history/${pid}`);
    if (hr.status===404) continue; if(!hr.ok) continue;
    const hd = await hr.json(); const pr = hd[pid];
    if (!pr) continue;
    if (pr.status?.status_str==="error") throw new Error(pr.status.reason);
    if (pr.outputs) for (const nid of Object.keys(pr.outputs)) {
      const imgs = pr.outputs[nid]?.images;
      if (imgs?.length>0) return imgs[0].filename;
    }
  }
  throw new Error("timeout");
}

async function main() {
  console.log("HelloWorld v7 + 圆章v1 (1.0) | 20步 CFG 5.0 Euler A");
  for (let i=0; i<PROMPTS.length; i++) {
    console.log(`  Logo ${i+1}/4...`);
    try {
      const fn = await gen(PROMPTS[i], "huayan_hw");
      const src = path.join("D:\\ComfyUI-backup\\output", fn);
      const dst = path.join(OUT, `huayan_hw_logo_0000${i+1}_.png`);
      copyFileSync(src, dst);
      console.log(`  Done: huayan_hw_logo_0000${i+1}_.png`);
    } catch(e) { console.error(`  FAIL: ${e.message}`); }
  }
  writeFileSync(path.join(OUT, "huayan_hw_prompts.json"), JSON.stringify(PROMPTS, null, 2), "utf-8");
  console.log("\nDone!");
}
main().catch(e=>{console.error(e);process.exit(1);});
