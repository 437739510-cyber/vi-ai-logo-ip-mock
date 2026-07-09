/**
 * generate-yang-vi.mjs
 * Full pipeline: DeepSeek DNA -> ComfyUI scene images -> PptxGenJS VI manual
 * Run: node scripts/generate-yang-vi.mjs (from bb-clean root)
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const COMFYUI_URL = "http://127.0.0.1:8188";
const OUTPUT_DIR = "D:\\disk\\CODEX\\vi手册logo";

const brandData = {
  brandName: "花颜美容院",
  industry: "beauty",
  industryLabel: "美容/养生",
  brandVision: "以花养颜，传承东方草本护肤智慧，让每一位女性焕发自然之美",
  coreValues: "天然、匠心、信赖、优雅",
  targetMarket: "28-55岁都市女性，追求天然护肤与身心平衡",
  brandColors: {
    primary: { hex: "#E8576C", name: "花颜粉" },
    secondary: { hex: "#F8BBD0", name: "浅樱粉" },
    accent: { hex: "#C9A96E", name: "暗金" },
  },
  logoDescription: "以花瓣与女性侧脸轮廓融合的圆形徽章，线条柔美流畅，体现东方韵味与自然之美",
  logoStyle: "新中式、简约优雅、花瓣徽章",
  businessAge: 15,
  location: "北京",
};

const sceneTemplates = [
  { key: "stationery", page: "Brand Stationery", template: "{{DNA}} branded beauty product bottles and packaging set, elegant minimalist design, soft pink rose gold accents, arranged on marble surface, warm studio lighting, photorealistic, 8k." },
  { key: "packaging-1", page: "Packaging System", template: "{{DNA}} branded luxury gift bag with satin ribbon handles, elegant floral embossed pattern, soft pink and gold tones, standing on clean surface, studio lighting, photorealistic, 8k." },
  { key: "packaging-2", page: "Product Packaging", template: "{{DNA}} branded beauty product jar with elegant label design, cream jar with rose gold lid, soft botanical elements, clean studio background, product photography, photorealistic, 8k." },
  { key: "marketing-1", page: "Promo Poster", template: "{{DNA}} beauty salon promotional poster display, elegant Chinese aesthetic with floral motifs, warm inviting atmosphere, standing poster in a luxurious spa setting, photorealistic, 8k." },
  { key: "marketing-2", page: "VIP Card", template: "{{DNA}} branded VIP membership card with elegant gold foil stamping, floral pattern, premium textured paper look, placed on a rose petal surface, studio lighting, photorealistic, 8k." },
];

const NEGATIVE_PROMPT = "cartoon, illustration, vector art, flat design, clipart, low quality, blurry, distorted, watermark, text, logo, signature, ugly, deformed, bad anatomy";

// ===== DEEPSEEK: Extract Brand DNA =====
async function extractBrandDNA() {
  console.log("[1/3] DeepSeek extracting brand DNA...");

  const systemPrompt = `You are a brand visual identity expert. Given a brand information, extract a concise visual DNA: a 25-30 word English description of the brand logo pure visual characteristics.

RULES:
- Describe ONLY shape, color, composition, and aesthetic style
- Do NOT include material descriptions, rendering instructions, or background
- Keep it short: 25-30 words maximum
- Use concrete visual terms

Output JSON only:
{
  "logo_pure_prompt": "25-30 word English prompt describing pure logo visual DNA",
  "negative_en": "text, letters, words, watermark, blurry, low quality"
}`;

  const userMessage = `Brand: ${brandData.brandName}
Industry: ${brandData.industryLabel}
Brand Vision: ${brandData.brandVision}
Core Values: ${brandData.coreValues}
Logo Description: ${brandData.logoDescription}
Logo Style: ${brandData.logoStyle}
Colors: primary=${brandData.brandColors.primary.hex} (${brandData.brandColors.primary.name}), secondary=${brandData.brandColors.secondary.hex}, accent=${brandData.brandColors.accent.hex}
Location: ${brandData.location}, ${brandData.businessAge} years in business`;

  const resp = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.7, max_tokens: 500 }),
  });

  if (!resp.ok) { const err = await resp.text(); throw new Error(`DeepSeek error ${resp.status}: ${err.slice(0, 200)}`); }
  const data = await resp.json();
  const content = data.choices[0].message.content;
  const m = content.match(/\{[\s\S]*\}/);
  const dna = JSON.parse(m ? m[0] : content);
  console.log(`  DNA: ${dna.logo_pure_prompt?.slice(0, 80)}...`);
  return dna;
}

// ===== COMFYUI: SDXL Workflow =====
function buildSDXLWorkflow(prompt, negativePrompt, width, height, seed) {
  const r8 = (n) => Math.max(64, Math.round(n / 8) * 8);
  return {
    "3": { class_type: "KSampler", inputs: { seed, steps: 20, cfg: 3.5, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "dreamshaperXL_alpha2Xl10.safetensors" } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: r8(width), height: r8(height), batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt || "blurry, low quality, distorted", clip: ["4", 1] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "yang_vi_scene", images: ["8", 0] } },
  };
}

async function generateSceneImage(prompt, negativePrompt, width, height) {
  const seed = Math.floor(Math.random() * 999999999999);
  const wf = buildSDXLWorkflow(prompt, negativePrompt, width || 1024, height || 1024, seed);
  const sr = await fetch(`${COMFYUI_URL}/api/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: wf }) });
  if (!sr.ok) throw new Error(`ComfyUI submit error ${sr.status}`);
  const { prompt_id } = await sr.json();
  const st = Date.now();
  while (Date.now() - st < 180000) {
    await new Promise(r => setTimeout(r, 2000));
    const hr = await fetch(`${COMFYUI_URL}/api/history/${prompt_id}`);
    if (hr.status === 404) continue;
    if (!hr.ok) continue;
    const hd = await hr.json();
    const result = hd[prompt_id];
    if (!result) continue;
    if (result.status?.status_str === "error") throw new Error(`ComfyUI error: ${result.status?.reason || "unknown"}`);
    if (result.outputs) {
      for (const nid of Object.keys(result.outputs)) {
        const imgs = result.outputs[nid]?.images;
        if (imgs?.length > 0) return { filename: imgs[0].filename, subfolder: imgs[0].subfolder || "", durationMs: Date.now() - st };
      }
    }
  }
  throw new Error("ComfyUI generation timed out");
}

async function copyFromComfyUI(filename, subfolder, destPath) {
  const srcDir = subfolder ? path.join("E:\\ComfyUI\\output", subfolder) : "E:\\ComfyUI\\output";
  await fs.copyFile(path.join(srcDir, filename), destPath);
}

// ===== PPTX: Assemble VI Manual =====
async function renderPptx(sceneImages, brandDNA) {
  console.log("[3/3] Assembling VI manual PPTX...");
  const pptxMod = await import(pathToFileURL(path.join(PROJECT_ROOT, "node_modules", "pptxgenjs", "dist", "pptxgen.cjs.js")).href);
  const PptxGenJS = pptxMod.default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4", width: 8.27, height: 11.69 });
  pptx.layout = "A4";
  const SW = 8.27, SH = 11.69, MARGIN = 0.6;
  const pri = brandData.brandColors.primary.hex;
  const sec = brandData.brandColors.secondary.hex;
  const acc = brandData.brandColors.accent.hex;

  function addFrame(slide) {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: SH, fill: { color: pri } });
    slide.addShape(pptx.ShapeType.rect, { x: 0.1, y: SH - 0.04, w: SW - 0.1, h: 0.04, fill: { color: pri } });
  }
  function addPn(slide, num, total) {
    slide.addText(`${num} / ${total}`, { x: SW - 1.2, y: SH - 0.6, w: 1.0, h: 0.4, fontSize: 8, color: "999999", align: "right", fontFace: "Arial" });
  }

  const TOTAL = 13;
  let pn = 0, slide;

  // Page 1: Cover
  pn++; slide = pptx.addSlide();
  slide.background = { fill: pri };
  slide.addShape(pptx.ShapeType.ellipse, { x: SW * 0.25, y: SH * 0.15, w: SW * 0.5, h: SW * 0.5, fill: { color: sec, transparency: 60 } });
  slide.addText("BRAND IDENTITY MANUAL", { x: MARGIN, y: SH * 0.55, w: SW - MARGIN * 2, h: 0.5, fontSize: 11, color: "FFFFFF", align: "center", fontFace: "Arial", charSpacing: 6 });
  slide.addText("花颜美容院", { x: MARGIN, y: SH * 0.62, w: SW - MARGIN * 2, h: 1.0, fontSize: 42, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei", bold: true });
  slide.addText("HUA YAN BEAUTY", { x: MARGIN, y: SH * 0.72, w: SW - MARGIN * 2, h: 0.6, fontSize: 14, color: "FFFFFF", align: "center", fontFace: "Arial", charSpacing: 6 });
  slide.addText("视觉识别系统规范手册", { x: MARGIN, y: SH * 0.82, w: SW - MARGIN * 2, h: 0.5, fontSize: 12, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei" });
  slide.addText("2026", { x: MARGIN, y: SH * 0.90, w: SW - MARGIN * 2, h: 0.4, fontSize: 10, color: "FFFFFF", align: "center", fontFace: "Arial" });

  // Page 2: TOC
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("目  录", { x: MARGIN + 0.15, y: 0.6, w: 4, h: 0.8, fontSize: 28, color: pri, fontFace: "Microsoft YaHei", bold: true });
  ["01  品牌概述","02  设计理念","03  标识释义","04  标识规范","05  色彩系统","06  字体系统","07  品牌物料","08  包装系统","09  产品包装","10  宣传海报","11  会员卡设计","12  应用场景"].forEach((item, i) => {
    slide.addText(item, { x: MARGIN + 0.15 + (i < 6 ? 0 : 3.2), y: 1.8 + (i % 6) * 1.2, w: 3.0, h: 0.8, fontSize: 13, color: "555555", fontFace: "Microsoft YaHei" });
  });
  addPn(slide, pn, TOTAL);

  // Page 3: Brand Overview
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("01  品牌概述", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  [
    ["品牌名称", brandData.brandName], ["行业类别", brandData.industryLabel],
    ["经营年限", `${brandData.businessAge} 年`], ["所在城市", brandData.location],
    ["品牌愿景", brandData.brandVision], ["核心价值", brandData.coreValues],
    ["目标客群", brandData.targetMarket],
  ].forEach(([label, value], i) => {
    slide.addText(label, { x: MARGIN + 0.15, y: 1.5 + i * 1.0, w: 1.8, h: 0.6, fontSize: 12, color: pri, fontFace: "Microsoft YaHei", bold: true });
    slide.addText(value, { x: MARGIN + 2.0, y: 1.5 + i * 1.0, w: 5.2, h: 0.6, fontSize: 12, color: "333333", fontFace: "Microsoft YaHei" });
  });
  addPn(slide, pn, TOTAL);

  // Page 4: Design Philosophy
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("02  设计理念", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  slide.addText("以花为魂，以颜为美", { x: MARGIN + 0.15, y: 1.6, w: SW - MARGIN * 2 - 0.15, h: 0.8, fontSize: 20, color: pri, fontFace: "Microsoft YaHei", italic: true });
  slide.addText("花颜美容院的品牌视觉以「花瓣」为核心设计元素，融合东方女性的柔美曲线与自然生命力。整体风格追求「新中式优雅」——既传承古典东方美学，又赋予现代简约气质。\n\n色彩体系以花颜粉为主调，搭配浅樱粉的柔和过渡与暗金的高级点缀，营造温暖、信赖、优雅的品牌感受。", { x: MARGIN + 0.15, y: 2.6, w: SW - MARGIN * 2 - 0.15, h: 5.0, fontSize: 12, color: "555555", fontFace: "Microsoft YaHei", lineSpacingMultiple: 1.8 });
  addPn(slide, pn, TOTAL);

  // Page 5: Logo Interpretation
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("03  标识释义", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  slide.addText("花颜标识以「花瓣」与「女性侧脸轮廓」为核心元素，采用圆形徽章构图，传达完满、和谐的品牌精神。花瓣层叠舒展，寓意肌肤如花般自然绽放；侧脸线条柔美流畅，体现东方女性优雅气质。整体造型简约克制，在现代感与传统韵味之间取得精妙平衡。", { x: MARGIN + 0.15, y: 1.6, w: SW - MARGIN * 2 - 0.15, h: 3.5, fontSize: 12, color: "555555", fontFace: "Microsoft YaHei", lineSpacingMultiple: 1.8 });
  if (brandDNA?.logo_pure_prompt) {
    slide.addText("Visual DNA:", { x: MARGIN + 0.15, y: 5.5, w: 2, h: 0.5, fontSize: 11, color: pri, fontFace: "Arial", bold: true });
    slide.addText(brandDNA.logo_pure_prompt, { x: MARGIN + 0.15, y: 5.9, w: SW - MARGIN * 2 - 0.15, h: 1.2, fontSize: 10, color: "777777", fontFace: "Arial", italic: true });
  }
  addPn(slide, pn, TOTAL);

  // Page 6: Logo Specs
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("04  标识规范", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  slide.addShape(pptx.ShapeType.rect, { x: SW * 0.2, y: 1.8, w: SW * 0.6, h: SW * 0.6, fill: { color: "F5F5F5" }, rectRadius: 0.1 });
  slide.addText("品牌标识\n展示区域", { x: SW * 0.2, y: 2.5, w: SW * 0.6, h: 1.0, fontSize: 14, color: "CCCCCC", align: "center", fontFace: "Microsoft YaHei" });
  slide.addText("最小使用尺寸：高度不低于 20mm\n保护空间：标识四周保留 1/4 标识高度的空白区域\n背景控制：浅色背景使用标准版，深色背景使用反白版", { x: MARGIN + 0.15, y: 6.2, w: SW - MARGIN * 2 - 0.15, h: 2.0, fontSize: 11, color: "555555", fontFace: "Microsoft YaHei", lineSpacingMultiple: 1.6 });
  addPn(slide, pn, TOTAL);

  // Page 7: Color System
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("05  色彩系统", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  [
    { hex: pri, name: "花颜粉", role: "主色 / Primary", usage: "品牌核心识别色，用于Logo主色调、重要标题、品牌装饰条" },
    { hex: sec, name: "浅樱粉", role: "辅助色 / Secondary", usage: "背景色、大面积底色、柔和过渡区域" },
    { hex: acc, name: "暗金", role: "强调色 / Accent", usage: "点缀线条、图标高亮、高端质感表达" },
  ].forEach((c, i) => {
    const y = 1.6 + i * 2.5;
    slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: y, w: 1.5, h: 1.8, fill: { color: c.hex }, rectRadius: 0.05 });
    slide.addText(c.name, { x: MARGIN + 1.9, y: y, w: 4, h: 0.5, fontSize: 16, color: "333333", fontFace: "Microsoft YaHei", bold: true });
    slide.addText(`${c.role}    ${c.hex}`, { x: MARGIN + 1.9, y: y + 0.5, w: 5, h: 0.4, fontSize: 10, color: "888888", fontFace: "Arial" });
    slide.addText(c.usage, { x: MARGIN + 1.9, y: y + 1.0, w: 5, h: 0.7, fontSize: 10, color: "666666", fontFace: "Microsoft YaHei" });
  });
  addPn(slide, pn, TOTAL);

  // Page 8: Typography
  pn++; slide = pptx.addSlide(); addFrame(slide);
  slide.addText("06  字体系统", { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.7, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.15, w: 1.5, h: 0.03, fill: { color: acc } });
  slide.addText("品牌专用字体", { x: MARGIN + 0.15, y: 1.6, w: 4, h: 0.5, fontSize: 14, color: pri, fontFace: "Microsoft YaHei", bold: true });
  slide.addText("标题字体：思源黑体 Bold / Noto Sans SC Bold\n正文字体：思源黑体 Regular / Noto Sans SC Regular\n装饰字体：思源宋体 / Noto Serif SC（仅用于品牌理念等特殊页面）", { x: MARGIN + 0.15, y: 2.2, w: SW - MARGIN * 2 - 0.15, h: 2.5, fontSize: 11, color: "555555", fontFace: "Microsoft YaHei", lineSpacingMultiple: 1.8 });
  slide.addText("字体层级规范", { x: MARGIN + 0.15, y: 4.8, w: 4, h: 0.5, fontSize: 14, color: pri, fontFace: "Microsoft YaHei", bold: true });
  [["封面标题","42pt","Bold"],["章节标题","22pt","Bold"],["小标题","16pt","Bold"],["正文","12pt","Regular"],["注释/页码","8pt","Regular"]].forEach((row, i) => {
    slide.addText(row[0], { x: MARGIN + 0.15, y: 5.4 + i * 0.5, w: 2, h: 0.4, fontSize: 11, color: "333333", fontFace: "Microsoft YaHei" });
    slide.addText(row[1], { x: MARGIN + 2.3, y: 5.4 + i * 0.5, w: 1.5, h: 0.4, fontSize: 11, color: "888888", fontFace: "Arial" });
    slide.addText(row[2], { x: MARGIN + 3.8, y: 5.4 + i * 0.5, w: 1.5, h: 0.4, fontSize: 11, color: "888888", fontFace: "Arial" });
  });
  addPn(slide, pn, TOTAL);

  // Page 9-13: Scene Application Pages
  const scenePages = [
    { title: "07  品牌物料", sub: "Brand Stationery", desc: "美容产品瓶身与包装套装，延续花颜粉主色调，营造统一优雅的产品陈列效果。" },
    { title: "08  包装系统", sub: "Packaging System", desc: "品牌礼品袋采用浅樱粉基调搭配暗金缎带，精致花卉压纹工艺，体现高端美容会所品牌质感。" },
    { title: "09  产品包装", sub: "Product Packaging", desc: "产品罐装采用花颜粉标签搭配玫瑰金瓶盖，植物元素点缀其间，传达天然护肤理念。" },
    { title: "10  宣传海报", sub: "Promotional Poster", desc: "品牌宣传海报融合中式美学与花卉元素，暖调灯光营造温馨舒适的美容空间氛围。" },
    { title: "11  会员卡设计", sub: "VIP Membership Card", desc: "VIP会员卡采用暗金烫印工艺，花卉纹理搭配高级纹理纸，彰显尊贵会员身份。" },
  ];

  for (let i = 0; i < scenePages.length; i++) {
    pn++; slide = pptx.addSlide(); addFrame(slide);
    const cfg = scenePages[i];
    slide.addText(cfg.title, { x: MARGIN + 0.15, y: 0.5, w: 6, h: 0.6, fontSize: 22, color: pri, fontFace: "Microsoft YaHei", bold: true });
    slide.addText(cfg.sub, { x: MARGIN + 0.15, y: 1.0, w: 6, h: 0.4, fontSize: 10, color: "999999", fontFace: "Arial", charSpacing: 2 });
    slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.4, w: 1.5, h: 0.03, fill: { color: acc } });

    if (i < sceneImages.length && sceneImages[i]?.localPath) {
      try {
        const imgBuf = await fs.readFile(sceneImages[i].localPath);
        const ext = path.extname(sceneImages[i].localPath).slice(1) || "png";
        slide.addImage({ data: `image/${ext};base64,${imgBuf.toString("base64")}` }, { x: MARGIN + 0.15, y: 1.8, w: SW - MARGIN * 2 - 0.15, h: 5.5, sizing: { type: "contain", w: SW - MARGIN * 2 - 0.15, h: 5.5 } });
      } catch (e) {
        slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.8, w: SW - MARGIN * 2 - 0.15, h: 5.5, fill: { color: "F5F5F5" } });
        slide.addText("[ 场景图加载失败 ]", { x: MARGIN + 0.15, y: 4.2, w: SW - MARGIN * 2 - 0.15, h: 0.5, fontSize: 12, color: "CCCCCC", align: "center", fontFace: "Microsoft YaHei" });
      }
    } else {
      slide.addShape(pptx.ShapeType.rect, { x: MARGIN + 0.15, y: 1.8, w: SW - MARGIN * 2 - 0.15, h: 5.5, fill: { color: "F5F5F5" } });
      slide.addText("[ 待嵌入场景图 ]", { x: MARGIN + 0.15, y: 4.2, w: SW - MARGIN * 2 - 0.15, h: 0.5, fontSize: 12, color: "CCCCCC", align: "center", fontFace: "Microsoft YaHei" });
    }
    slide.addText(cfg.desc, { x: MARGIN + 0.15, y: 7.5, w: SW - MARGIN * 2 - 0.15, h: 1.0, fontSize: 10, color: "777777", fontFace: "Microsoft YaHei" });
    addPn(slide, pn, TOTAL);
  }

  // Back Cover
  pn++; slide = pptx.addSlide();
  slide.background = { fill: pri };
  slide.addText("花颜美容院", { x: MARGIN, y: SH * 0.38, w: SW - MARGIN * 2, h: 0.8, fontSize: 32, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei", bold: true });
  slide.addText("HUA YAN BEAUTY", { x: MARGIN, y: SH * 0.48, w: SW - MARGIN * 2, h: 0.5, fontSize: 14, color: "FFFFFF", align: "center", fontFace: "Arial", charSpacing: 6 });
  slide.addShape(pptx.ShapeType.rect, { x: SW * 0.35, y: SH * 0.56, w: SW * 0.3, h: 0.01, fill: { color: "FFFFFF" } });
  slide.addText("视觉识别系统规范手册", { x: MARGIN, y: SH * 0.60, w: SW - MARGIN * 2, h: 0.5, fontSize: 12, color: "FFFFFF", align: "center", fontFace: "Microsoft YaHei" });
  slide.addText("BrandBrain  ·  品牌大脑", { x: MARGIN, y: SH * 0.85, w: SW - MARGIN * 2, h: 0.4, fontSize: 9, color: "FFFFFF", align: "center", fontFace: "Arial", charSpacing: 4 });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const pptxPath = path.join(OUTPUT_DIR, "花颜美容院-VI手册.pptx");
  const buf = await pptx.write({ outputType: "nodebuffer" });
  await fs.writeFile(pptxPath, buf);
  console.log(`  PPTX saved: ${pptxPath}`);
  return pptxPath;
}


// ===== MAIN =====
async function main() {
  console.log("=".repeat(60));
  console.log("BrandBrain VI Pipeline — 花颜美容院 (Ms. Yang)");
  console.log("=".repeat(60));
  const startTime = Date.now();

  // Step 1: Extract brand DNA
  let brandDNA;
  try {
    brandDNA = await extractBrandDNA();
  } catch (e) {
    console.error(`  DeepSeek failed: ${e.message}, using default DNA`);
    brandDNA = { logo_pure_prompt: "elegant circular floral emblem, soft pink rose gold geometric petals, feminine silhouette outline, minimalist Chinese aesthetic, symmetrical harmonious composition", negative_en: "text, letters, words, watermark, blurry, low quality" };
  }

  // Step 2: Generate scene images via ComfyUI
  console.log(`[2/3] ComfyUI generating ${sceneTemplates.length} scene images...`);
  const sceneResults = [];
  for (let i = 0; i < sceneTemplates.length; i++) {
    const tpl = sceneTemplates[i];
    const prompt = tpl.template.replace("{{DNA}}", brandDNA.logo_pure_prompt);
    console.log(`  Scene ${i + 1}/${sceneTemplates.length}: ${tpl.key}`);
    try {
      const result = await generateSceneImage(prompt, NEGATIVE_PROMPT, 1024, 1024);
      const localName = `yang_scene_${tpl.key}.png`;
      const localPath = path.join(OUTPUT_DIR, localName);
      await copyFromComfyUI(result.filename, result.subfolder, localPath);
      console.log(`    Done: ${localName} (${(result.durationMs / 1000).toFixed(1)}s)`);
      sceneResults.push({ key: tpl.key, page: tpl.page, localPath, comfyFilename: result.filename });
    } catch (e) {
      console.error(`    Failed: ${e.message}`);
      sceneResults.push(null);
    }
  }

  // Step 3: Assemble PPTX
  const pptxPath = await renderPptx(sceneResults.filter(Boolean), brandDNA);

  const totalMs = Date.now() - startTime;
  console.log("");
  console.log("=".repeat(60));
  console.log(`DONE in ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  DNA: ${brandDNA.logo_pure_prompt?.slice(0, 60)}...`);
  console.log(`  Scenes: ${sceneResults.filter(Boolean).length}/${sceneTemplates.length} generated`);
  console.log(`  PPTX: ${pptxPath}`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);
  console.log("=".repeat(60));
}

main().catch(e => { console.error("Pipeline failed:", e); process.exit(1); });
