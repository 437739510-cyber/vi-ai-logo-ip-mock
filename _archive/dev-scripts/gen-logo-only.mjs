// gen-logo-only.mjs — 单独生成花颜美容院 Logo
import { promises as fs } from "fs";
import path from "path";

const COMFYUI = "http://127.0.0.1:8188";
const OUT = "D:\\disk\\CODEX\\vi手册logo";
const MODEL = "dreamshaperXL_alpha2Xl10.safetensors";
const LORA = { name: "LogoRedmondV2-Logo-LogoRedmAF.safetensors", w: 0.5 };
const NEG = "deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, text, extra limbs, bad anatomy";

// DeepSeek 提取的 DNA（上次跑出来的）
const DNA = "a minimalist flat vector logo of a circular monogram blending a blooming flower with a feminine silhouette, flowing soft curved petals, rose pink #E8576C and champagne gold #F0D5A8 accents, elegant line-art, symmetrical composition, pure white background, centered, high contrast, sharp edges, brand identity mark";

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
  await fs.mkdir(OUT,{recursive:true});
  console.log("花颜美容院 Logo 生成 — DreamShaperXL + LogoRedmondV2 LoRA");
  for(let i=1; i<=4; i++) {
    console.log(`  Logo ${i}/4...`);
    try {
      const fn = await gen(DNA, "yang_logo");
      const src = path.join("D:\\ComfyUI-backup\\output", fn);
      const dst = path.join(OUT, `yang_logo_0000${i}_.png`);
      await fs.copyFile(src, dst);
      console.log(`  Done: yang_logo_0000${i}_.png`);
    } catch(e) { console.error(`  FAIL: ${e.message}`); }
  }
  console.log("完成!");
}
main().catch(e=>{console.error(e);process.exit(1);});
