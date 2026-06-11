// API Route: POST /api/ai/generate-manual-pages-stream
// V4: 设计决策引擎(DeepSeek) + 写实图生成(万相2.7) + 14页A4竖版渲染
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { saveGenerationLog, type GenerationLogEntry } from "@/lib/generation-logger";
import { arkGenerateScene } from "@/lib/ip-image-provider/ark-seedream-provider";
import { renderProfessionalPage } from "@/lib/vi-page-renderer";
import { supabaseAdmin } from "@/lib/supabase";

// ===== V4: 14页 PAGE_DEFS =====
const PAGE_DEFS = [
  { id: "cover", label: "封面", desc: "VI manual cover page" },
  { id: "toc", label: "目录", desc: "Table of contents" },
  { id: "brand-philosophy", label: "品牌核心理念", desc: "Brand vision, core values" },
  { id: "logo-interpretation", label: "标识诠释", desc: "Logo design concept" },
  { id: "brand-colors", label: "标准色彩规范", desc: "Brand color palette" },
  { id: "typography", label: "字体系统", desc: "Font system specification" },
  { id: "basic-spec", label: "基础规范", desc: "Logo usage guidelines" },
  { id: "mascot-spec", label: "IP公仔规范", desc: "Mascot guidelines" },
  { id: "stationery", label: "办公应用系统", desc: "Stationery design" },
  { id: "packaging", label: "产品包装系统", desc: "Product packaging" },
  { id: "marketing", label: "营销展示系统", desc: "Marketing materials" },
  { id: "digital", label: "数字应用规范", desc: "Digital application guidelines" },
  { id: "summary", label: "总结", desc: "Brand asset summary" },
  { id: "closing", label: "感谢观看", desc: "Back cover" },
];

const TOTAL_PAGES = PAGE_DEFS.length;
const PAGE_ORDER = new Map(PAGE_DEFS.map((p, i) => [p.id, i]));

type ManualPageResult = { pageId: string; label: string; url: string };
type ManualPageError = { pageId: string; label: string; error: string };

function sortByPageOrder<T extends { pageId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = PAGE_ORDER.get(a.pageId) ?? Number.MAX_SAFE_INTEGER;
    const bi = PAGE_ORDER.get(b.pageId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function mergeByPageId<T extends { pageId: string }>(oldItems: T[], newItems: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of oldItems || []) merged.set(item.pageId, item);
  for (const item of newItems || []) merged.set(item.pageId, item);
  return sortByPageOrder(Array.from(merged.values()));
}

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n"));
}

// ===== V4: DesignDecision 类型 =====
export interface DesignDecision {
  colorScheme: {
    primary:   { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    secondary: { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    accent:    { hex: string; oklch: string; name: string; nameEn: string; meaning: string };
    reasoning: string;
  };
  pageLayouts: Array<{
    pageId: string;
    layout: 'center-hero' | 'left-sidebar' | 'left-image-right-text' | 'full-image' | 'grid' | 'standard';
    fontSize: { title: number; subtitle: number; body: number };
    needsRealPhoto: boolean;
  }>;
  photoPrompts: Array<{
    pageId: string;
    prompt: string;
    promptCn: string;
    refImages: ('logo' | 'mascot')[];
    refStrength: number;
  }>;
  typography: {
    heading: { family: string; weights: number[] };
    body: { family: string; weights: number[] };
    modularScale: number;
  };
  logoIntegrationStrategy: 'wanxiang-ref' | 'prompt-desc' | 'composite';
}

// V3 fallback 默认值
const DEFAULT_DECISION: DesignDecision = {
  colorScheme: {
    primary:   { hex: "#1A73E8", oklch: "0.55 0.2 260", name: "品牌主色", nameEn: "Primary", meaning: "专业信赖" },
    secondary: { hex: "#34A853", oklch: "0.60 0.18 145", name: "辅助色", nameEn: "Secondary", meaning: "成长活力" },
    accent:    { hex: "#FBBC04", oklch: "0.80 0.16 90", name: "强调色", nameEn: "Accent", meaning: "亮点吸引" },
    reasoning: "默认色彩方案",
  },
  pageLayouts: [
    { pageId: "cover", layout: "center-hero", fontSize: { title: 44, subtitle: 16, body: 12 }, needsRealPhoto: false },
    { pageId: "toc", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 12 }, needsRealPhoto: false },
    { pageId: "brand-philosophy", layout: "left-sidebar", fontSize: { title: 20, subtitle: 9, body: 12 }, needsRealPhoto: false },
    { pageId: "logo-interpretation", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 11 }, needsRealPhoto: false },
    { pageId: "brand-colors", layout: "grid", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: false },
    { pageId: "typography", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: false },
    { pageId: "basic-spec", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: false },
    { pageId: "mascot-spec", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 11 }, needsRealPhoto: false },
    { pageId: "stationery", layout: "left-image-right-text", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: true },
    { pageId: "packaging", layout: "left-image-right-text", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: true },
    { pageId: "marketing", layout: "left-image-right-text", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: true },
    { pageId: "digital", layout: "grid", fontSize: { title: 20, subtitle: 9, body: 10 }, needsRealPhoto: false },
    { pageId: "summary", layout: "standard", fontSize: { title: 20, subtitle: 9, body: 11 }, needsRealPhoto: false },
    { pageId: "closing", layout: "center-hero", fontSize: { title: 28, subtitle: 12, body: 10 }, needsRealPhoto: false },
  ],
  photoPrompts: [
    { pageId: "stationery", prompt: "Flat lay office stationery with brand logo on bamboo mat background, professional business card and envelope, high-end product photography", promptCn: "办公文具平铺展示", refImages: ["logo"], refStrength: 0.7 },
    { pageId: "packaging", prompt: "Product packaging display with brand mascot and logo, gift box and shopping bag on clean background, commercial photography", promptCn: "产品包装展示", refImages: ["logo", "mascot"], refStrength: 0.65 },
    { pageId: "marketing", prompt: "Brand storefront exterior with prominent logo signage, tropical atmosphere, professional architectural photography", promptCn: "品牌门店展示", refImages: ["logo"], refStrength: 0.7 },
  ],
  typography: {
    heading: { family: "Noto Sans SC", weights: [700, 800] },
    body: { family: "Noto Sans SC", weights: [400, 500] },
    modularScale: 1.25,
  },
  logoIntegrationStrategy: "wanxiang-ref",
};

// ===== V4 Phase 1: 设计决策引擎 =====
const DESIGN_DIRECTOR_PROMPT = `你是品牌VI设计总监，拥有20年专业经验。根据品牌信息，输出完整的VI设计决策。

## 设计红线（必须遵守）
1. 不用纯黑#000000，用深灰#333333替代
2. 不用紫蓝渐变配色
3. 不用嵌套卡片布局
4. 不用Inter/Roboto等默认字体
5. 不用灰色文字配彩色背景
6. 行宽不超过75个字符
7. 间距使用4px网格系统（4/8/12/16/20/24/32/40/48/64）
8. 标题字号用模块化比例（1.25 Major Third 或 1.333 Perfect Fourth）
9. 色彩用OKLCH空间计算，确保无障碍对比度
10. 主色60% + 辅色30% + 强调色10%
11. 避免低饱和度全灰配色
12. 中文字体优先选择思源黑体/思源宋体系列

## 行业色彩倾向
- 餐饮/食品：暖色系(红橙黄)，传递食欲与温暖
- 科技/互联网：冷色系(蓝紫)，传递专业与创新
- 金融/保险：深色系(深蓝/深绿)，传递稳重与信赖
- 零售/时尚：鲜明色系，传递活力与个性
- 教育/文化：中性色系(蓝绿)，传递知性与成长
- 健康/医疗：清新色系(蓝白绿)，传递安全与关怀
- 工业/制造：厚重色系(深蓝/深灰)，传递力量与精密
- 旅游/休闲：明亮色系(蓝绿橙)，传递自由与愉悦

## 输出要求
输出严格JSON，字段如下：
{
  "colorScheme": {
    "primary": {"hex": "#...", "oklch": "...", "name": "中文名", "nameEn": "English", "meaning": "色彩寓意"},
    "secondary": {"hex": "#...", "oklch": "...", "name": "中文名", "nameEn": "English", "meaning": "色彩寓意"},
    "accent": {"hex": "#...", "oklch": "...", "name": "中文名", "nameEn": "English", "meaning": "色彩寓意"},
    "reasoning": "配色理由"
  },
  "pageLayouts": [
    {"pageId": "...", "layout": "standard|center-hero|left-sidebar|left-image-right-text|full-image|grid", "fontSize": {"title": 20, "subtitle": 9, "body": 11}, "needsRealPhoto": false}
  ],
  "photoPrompts": [
    {"pageId": "stationery|packaging|marketing", "prompt": "English prompt for Wanxiang 2.7", "promptCn": "中文描述", "refImages": ["logo"], "refStrength": 0.7}
  ],
  "typography": {
    "heading": {"family": "Noto Sans SC", "weights": [700, 800]},
    "body": {"family": "Noto Sans SC", "weights": [400, 500]},
    "modularScale": 1.25
  },
  "logoIntegrationStrategy": "wanxiang-ref"
}

pageLayouts必须包含全部14页：cover, toc, brand-philosophy, logo-interpretation, brand-colors, typography, basic-spec, mascot-spec, stationery, packaging, marketing, digital, summary, closing。
photoPrompts只给stationery/packaging/marketing三页写实图prompt。
refImages中logo必选，有IP公仔时marketing和packaging加mascot。`;

async function generateDesignDecision(
  clientInfo: any,
  brandColors: any,
  hasMascot: boolean,
  deepseekKey: string,
): Promise<DesignDecision> {
  const brief = [
    `公司名：${clientInfo?.companyName || "未提供"}`,
    `行业：${clientInfo?.industry || "未提供"}`,
    `品牌愿景：${clientInfo?.brandVision || "未提供"}`,
    `核心价值：${clientInfo?.coreValues || "未提供"}`,
    `目标市场：${clientInfo?.targetMarket || "未提供"}`,
    `品牌定位：${clientInfo?.brandPositioning || "未提供"}`,
    `品牌性格：${clientInfo?.brandPersona || "未提供"}`,
    `品牌原型：${clientInfo?.brandArchetype || "未提供"}`,
    `Logo理念：${clientInfo?.logoPhilosophy || "未提供"}`,
    `IP理念：${clientInfo?.mascotPhilosophy || "无"}`,
    `是否有IP公仔：${hasMascot ? "是" : "否"}`,
    brandColors?.primary ? `已有主色：${brandColors.primary.hex}` : "无已有色彩",
  ].join("\n");

  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: DESIGN_DIRECTOR_PROMPT },
          { role: "user", content: `请为以下品牌生成VI设计决策：\n\n${brief}` },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`[V4-DesignDecision] DeepSeek failed: ${resp.status}, using defaults`);
      return DEFAULT_DECISION;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[V4-DesignDecision] Empty response, using defaults");
      return DEFAULT_DECISION;
    }

    const decision = JSON.parse(content) as DesignDecision;

    // 验证关键字段
    if (!decision.colorScheme?.primary?.hex || !decision.pageLayouts?.length || !decision.photoPrompts?.length) {
      console.warn("[V4-DesignDecision] Missing critical fields, using defaults");
      return DEFAULT_DECISION;
    }

    // 如果有已提取的品牌色，覆盖AI提取的色彩（以已有为准）
    if (brandColors?.primary?.hex) {
      decision.colorScheme.primary.hex = brandColors.primary.hex;
      if (brandColors.primary.name) decision.colorScheme.primary.name = brandColors.primary.name;
    }
    if (brandColors?.secondary?.hex) {
      decision.colorScheme.secondary.hex = brandColors.secondary.hex;
    }
    if (brandColors?.accent?.hex) {
      decision.colorScheme.accent.hex = brandColors.accent.hex;
    }

    console.log("[V4-DesignDecision] Success:", decision.colorScheme.primary.hex, decision.colorScheme.reasoning?.slice(0, 80));
    return decision;
  } catch (e) {
    console.warn("[V4-DesignDecision] Error, using defaults:", String(e));
    return DEFAULT_DECISION;
  }
}

// ===== V4 Phase 2: 写实图生成 =====
const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

interface PhotoResult {
  pageId: string;
  base64: string | null;  // base64 data URI or null on failure
}

async function generateSinglePhoto(
  prompt: string,
  logoBase64: string | null,
  mascotBase64: string | null,
  refImages: ('logo' | 'mascot')[],
  refStrength: number,
  aliyunKey: string,
): Promise<string | null> {
  // 优先使用方舟Seedream(图生图,免费额度), 失败降级万相2.7
  const arkKey = process.env.ARK_API_KEY;
  if (arkKey) {
    // 需要公网可访问的参考图URL, base64不支持, 先上传到Supabase获取URL
    for (const refType of refImages) {
      const refBase64 = refType === 'logo' ? logoBase64 : mascotBase64;
      if (!refBase64) continue;
      
      try {
        // 将base64上传到Supabase获取公网URL
        const refUrl = await uploadBase64ToUrl(refBase64, refType);
        if (!refUrl) continue;
        
        const result = await arkGenerateScene({
          prompt,
          refImageUrl: refUrl,
          size: "720x1280",
        });
        
        // 下载图片转base64
        const imgResp = await fetch(result.imageUrl);
        if (imgResp.ok) {
          const imgBuf = Buffer.from(await imgResp.arrayBuffer());
          console.log(`[V4-Photo] Ark Seedream OK (${result.durationMs}ms, model: ${result.model})`);
          return "data:image/png;base64," + imgBuf.toString("base64");
        }
      } catch (e) {
        console.warn(`[V4-Photo] Ark Seedream failed, falling back to Wanxiang:`, String(e));
      }
      break; // 只用一个参考图
    }
  }

  // Fallback: 万相2.7 图生图
  try {
    const content_arr: any[] = [];
    if (refImages.includes('logo') && logoBase64) {
      content_arr.push({ image: logoBase64 });
    }
    if (refImages.includes('mascot') && mascotBase64) {
      content_arr.push({ image: mascotBase64 });
    }
    content_arr.push({ text: prompt });

    const body: any = {
      model: "wan2.7-image-pro",
      input: { messages: [{ role: "user", content: content_arr }] },
      parameters: { size: "800*1130", n: 1, watermark: false, ref_strength: refStrength },
    };

    const resp = await fetch(DASHSCOPE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aliyunKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) { console.warn(`[V4-Photo] Wanxiang failed: ${resp.status}`); return null; }

    const data = await resp.json();
    const imageUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!imageUrl) { console.warn("[V4-Photo] No image in response"); return null; }

    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;
    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
    return "data:image/png;base64," + imgBuf.toString("base64");
  } catch (e) {
    console.warn(`[V4-Photo] Error:`, String(e));
    return null;
  }
}

// 上传base64图片到Supabase获取公网URL(方舟图生图需要公网可访问的参考图)
async function uploadBase64ToUrl(base64Data: string, label: string): Promise<string | null> {
  try {
    const matches = base64Data.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) return null;
    const mime = matches[1];
    const b64 = matches[2];
    const buf = Buffer.from(b64, 'base64');
    const ext = mime.includes('png') ? 'png' : mime.includes('svg') ? 'svg' : 'jpg';
    const fileName = `ref-${label}-${Date.now()}.${ext}`;
    const filePath = `ref-images/${fileName}`;
    
    const { data, error } = await supabaseAdmin.storage
      .from('brand-brain-generated')
      .upload(filePath, buf, { contentType: mime, upsert: true });
    if (error) { console.warn('[uploadBase64ToUrl] Failed:', error.message); return null; }
    
    const { data: urlData } = supabaseAdmin.storage
      .from('brand-brain-generated')
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (e) {
    console.warn('[uploadBase64ToUrl] Error:', String(e));
    return null;
  }
}

async function generateRealPhotos(
  designDecision: DesignDecision,
  logoBase64: string | null,
  mascotBase64: string | null,
  aliyunKey: string,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // 并行生成3张写实图
  const photoTasks = designDecision.photoPrompts.map(async (pp) => {
    const base64 = await generateSinglePhoto(
      pp.prompt,
      logoBase64,
      mascotBase64,
      pp.refImages,
      pp.refStrength,
      aliyunKey,
    );
    results.set(pp.pageId, base64);
    console.log(`[V4-Photo] ${pp.pageId}: ${base64 ? "OK" : "FAILED"}`);
  });

  await Promise.allSettled(photoTasks);
  return results;
}

// ===== 图片处理工具 =====

async function processImageToDataUri(
  filePath: string,
  options?: { cropThreeView?: boolean }
): Promise<string | null> {
  try {
    let pipeline = sharp(filePath);
    const meta = await pipeline.metadata();
    const w = meta.width || 1;
    const h = meta.height || 1;

    // Step 1: trim去白边（修复：使用对象参数）
    pipeline = sharp(filePath).trim({ threshold: 10 });

    const trimmedMeta = await pipeline.metadata();
    const tw = trimmedMeta.width || w;
    const th = trimmedMeta.height || h;

    // Step 2: 三视图裁剪中间1/3
    if (options?.cropThreeView && tw > th * 1.5) {
      const cropWidth = Math.floor(tw / 3);
      pipeline = sharp(filePath)
        .trim({ threshold: 10 })
        .extract({ left: cropWidth, top: 0, width: cropWidth, height: th });
    }

    const buf = await pipeline.png().toBuffer();
    return "data:image/png;base64," + buf.toString("base64");
  } catch (e) {
    console.warn("[processImage] sharp failed, raw fallback:", String(e));
    try {
      const buf = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
      return "data:" + mime + ";base64," + buf.toString("base64");
    } catch { return null; }
  }
}

/** 读取图片原始base64（不trim，用于万相2.7参考图） */
async function imageToRawBase64(filePath: string): Promise<string | null> {
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    return "data:" + mime + ";base64," + buf.toString("base64");
  } catch { return null; }
}

async function uploadToSupabaseStorage(
  buffer: Buffer,
  projectId: string,
  fileName: string
): Promise<string | null> {
  try {
    const filePath = `${projectId}/${fileName}`;
    const { data, error } = await supabaseAdmin.storage
      .from("brand-brain-generated")
      .upload(filePath, buffer, { contentType: "image/png", upsert: true });
    if (error) {
      console.warn(`[supabase] Upload failed:`, error.message);
      return null;
    }
    const { data: urlData } = supabaseAdmin.storage
      .from("brand-brain-generated")
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (e) {
    console.warn(`[supabase] Error:`, String(e));
    return null;
  }
}

// ===== V4 页面装配 =====
async function assemblePage(
  pageDef: typeof PAGE_DEFS[0],
  projectId: string,
  clientInfo: any,
  brandColors: any,
  logoUrl: string | undefined,
  mascotUrl: string | undefined,
  pageIndex: number,
  designDecision: DesignDecision,
  realPhotoMap: Map<string, string | null>,
  logoDataUri: string | null,
  mascotDataUri: string | null,
): Promise<string | null> {
  const outputDir = path.join(process.cwd(), "public", "generated");
  await mkdir(outputDir, { recursive: true });

  // 获取该页的写实图
  const realPhotoBase64 = realPhotoMap.get(pageDef.id) || null;

  // 用 V4 渲染器生成 A4竖版 SVG
  const svgContent = renderProfessionalPage(
    pageDef.id, clientInfo, brandColors,
    logoDataUri, mascotDataUri,
    pageIndex, TOTAL_PAGES,
    designDecision, realPhotoBase64,
  );

  // SVG → PNG（保持A4比例）
  const outputFileName = `${Date.now()}-${pageDef.id}-final.png`;

  try {
    const svgBuf = Buffer.from(svgContent);
    const pngBuffer = await sharp(svgBuf)
      .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
      .png({ quality: 90 })
      .toBuffer();

    const supabaseUrl = await uploadToSupabaseStorage(pngBuffer, projectId, outputFileName);
    if (supabaseUrl) return supabaseUrl;

    const outputPath = path.join(outputDir, outputFileName);
    await writeFile(outputPath, pngBuffer);
    return `/generated/${outputFileName}`;
  } catch (e) {
    console.error(`[assemblePage] SVG→PNG failed for ${pageDef.id}:`, String(e));
    return null;
  }
}

// ===== POST 主流程 =====
export async function POST(req: Request) {
  const { projectId, clientInfo, brandColors, logoUrl, mascotUrl, maxPages, refId, startPage } = await req.json();
  const startIdx = startPage ?? 0;
  const totalToGenerate = maxPages || PAGE_DEFS.length;
  if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const aliyunKey = process.env.ALIYUN_API_KEY;
  if (!deepseekKey || !aliyunKey) return new Response(JSON.stringify({ error: "API keys not configured" }), { status: 500 });

  const stream = new ReadableStream({
    async start(controller) {
      const results: ManualPageResult[] = [];
      const errors: ManualPageError[] = [];
      const startTime = Date.now();
      const pageTimings: Record<string, number> = {};

      try {
        // ===== V4 Phase 1: 设计决策 =====
        sse(controller, "page:start", { pageId: "design-decision", label: "AI设计决策", index: -1, total: 0 });
        const designDecision = await generateDesignDecision(
          clientInfo, brandColors, Boolean(mascotUrl), deepseekKey,
        );
        sse(controller, "page:done", { pageId: "design-decision", label: "AI设计决策完成", url: "", index: -1, total: 0 });

        // ===== V4 Phase 2: 写实图生成 =====
        // 先处理Logo/IP图片（两套：trim版给渲染器，原始版给万相参考）
        let logoDataUri: string | null = null;
        let mascotDataUri: string | null = null;
        let logoRawBase64: string | null = null;
        let mascotRawBase64: string | null = null;

        if (logoUrl) {
          const logoPath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
          logoDataUri = await processImageToDataUri(logoPath, { cropThreeView: false });
          logoRawBase64 = await imageToRawBase64(logoPath);
        }
        if (mascotUrl) {
          const mascotPath = path.join(process.cwd(), "public", mascotUrl.replace(/^\//, ""));
          mascotDataUri = await processImageToDataUri(mascotPath, { cropThreeView: true });
          mascotRawBase64 = await imageToRawBase64(mascotPath);
        }

        sse(controller, "page:start", { pageId: "real-photos", label: "生成品牌写实图", index: -2, total: 0 });
        const realPhotoMap = await generateRealPhotos(
          designDecision, logoRawBase64, mascotRawBase64, aliyunKey,
        );
        const photoCount = Array.from(realPhotoMap.values()).filter(Boolean).length;
        sse(controller, "page:done", { pageId: "real-photos", label: `写实图生成完成(${photoCount}/3)`, url: "", index: -2, total: 0 });

        // ===== V4 Phase 3: 逐页渲染 =====
        for (let i = startIdx; i < startIdx + totalToGenerate && i < PAGE_DEFS.length; i++) {
          const page = PAGE_DEFS[i];
          sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: totalToGenerate });

          const pageStart = Date.now();
          let imageUrl: string | null = null;

          try {
            imageUrl = await assemblePage(
              page, projectId, clientInfo, brandColors,
              logoUrl, mascotUrl, i,
              designDecision, realPhotoMap,
              logoDataUri, mascotDataUri,
            );
          } catch (e) {
            console.error(`[generate] assemblePage error for ${page.id}:`, String(e));
          }

          pageTimings[page.id] = Date.now() - pageStart;

          if (imageUrl) {
            results.push({ pageId: page.id, label: page.label, url: imageUrl });
            sse(controller, "page:done", { pageId: page.id, label: page.label, url: imageUrl, index: i, total: TOTAL_PAGES });
          } else {
            errors.push({ pageId: page.id, label: page.label, error: "Generation failed" });
            sse(controller, "page:fail", { pageId: page.id, label: page.label, error: "Generation failed", index: i });
          }
        }

        // ===== 保存结果 =====
        const dataPath = path.join(process.cwd(), "public", "mock", "manual-pages-" + projectId + ".json");
        await mkdir(path.dirname(dataPath), { recursive: true });

        let oldPages: ManualPageResult[] = [];
        let oldErrors: ManualPageError[] = [];
        try {
          const oldData = JSON.parse(await readFile(dataPath, "utf-8"));
          oldPages = Array.isArray(oldData.pages) ? oldData.pages : [];
          oldErrors = Array.isArray(oldData.errors) ? oldData.errors : [];
        } catch { /* first time */ }

        const failedPageIds = new Set(errors.map(e => e.pageId));
        const successfulPageIds = new Set(results.map(p => p.pageId));
        const mergedPages = mergeByPageId(oldPages, results).filter(p => !failedPageIds.has(p.pageId));
        const mergedErrors = mergeByPageId(oldErrors, errors).filter(e => !successfulPageIds.has(e.pageId));

        const pagesData = {
          projectId,
          pages: mergedPages,
          errors: mergedErrors,
          generatedAt: new Date().toISOString(),
          totalPages: mergedPages.length,
          failedPages: mergedErrors.length,
        };
        await writeFile(dataPath, JSON.stringify(pagesData, null, 2), "utf-8");

        // Save generation log
        try {
          const logEntry: GenerationLogEntry = {
            projectId,
            refId: refId || undefined,
            generatedAt: new Date().toISOString(),
            totalPages: totalToGenerate,
            successfulPages: results.length,
            failedPages: errors.length,
            durationMs: Date.now() - startTime,
            pages: PAGE_DEFS.slice(startIdx, startIdx + totalToGenerate).map(p => ({
              pageId: p.id,
              label: p.label,
              success: results.some(r => r.pageId === p.id),
              qualityScore: null,
              qualityPassed: null,
              durationMs: pageTimings[p.id] || 0,
            })),
          };
          await saveGenerationLog(logEntry);
        } catch { /* non-fatal */ }

        sse(controller, "done", { totalPages: results.length, failedPages: errors.length, totalToGenerate });
      } catch (error) {
        sse(controller, "error", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
