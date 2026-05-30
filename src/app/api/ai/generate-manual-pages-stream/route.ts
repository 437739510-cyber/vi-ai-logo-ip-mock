// API Route: POST /api/ai/generate-manual-pages-stream
// Server-Sent Events: one page at a time
// Hybrid approach:
// 1. Generate clean background via Tongyi Wanxiang (no text, no logo in image)
// 2. Composite LOGO, IP, and text via sharp SVG overlay for pixel-perfect control
import { writeFile, mkdir, unlink, rename, readFile } from "fs/promises";
import { getCachedProcessedPath, processAndCacheImage } from "@/lib/image-cache";
import path from "path";
import sharp from "sharp";
import { planPages } from "@/lib/page-planner";
import { renderBlueprintToSvg } from "@/lib/render-blueprint";
import type { PageBlueprint } from "@/lib/page-planner";
import { validateBlueprintAgainstRules } from "@/lib/design-rules";
import { saveGenerationLog, type GenerationLogEntry } from "@/lib/generation-logger";

const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const PAGE_DEFS = [
  { id: "cover", label: "封面", desc: "VI manual cover page with brand name and logo" },
  { id: "brand-philosophy", label: "品牌核心理念", desc: "Brand vision, core values and target market" },
  { id: "logo-interpretation", label: "标识诠释", desc: "Logo design concept and element explanation" },
  { id: "brand-colors", label: "标准色彩规范", desc: "Brand standard color palette and color psychology" },
  { id: "typography", label: "字体系统", desc: "Chinese and English font system specification" },
  { id: "basic-spec", label: "基础规范", desc: "Logo clear space, minimum sizes, incorrect usage" },
  { id: "stationery", label: "办公应用系统", desc: "Business card, envelope and letterhead design" },
  { id: "packaging", label: "产品包装系统", desc: "Product packaging design with brand identity" },
  { id: "marketing", label: "营销展示系统", desc: "Marketing posters and application scenarios" },
  { id: "summary", label: "总结", desc: "Brand visual asset management summary" },
  { id: "closing", label: "感谢观看", desc: "VI manual back cover with contact info" },
];

/** Negative prompt for background generation (no text, no logos, no characters) */
const NEGATIVE_PROMPT_BG =
  "文字，LOGO，IP公仔，人物，五官，变形，扭曲，" +
  "低画质，模糊，噪点，杂色，风格杂乱";

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n"));
}

/** Read image via cache (auto-bg-removed), return base64 data URI for embedding in SVG */
async function imageToDataUri(filePath: string): Promise<string | null> {
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    return "data:" + mime + ";base64," + buf.toString("base64");
  } catch { return null; }
}


/**
 * Create a pixel-perfect SVG page for a VI manual.
 * This replaces AI-generated text with programmatic SVG for precise control.
 * Background image is composited separately.
 */
function renderPageSvg(
  pageId: string,
  companyName: string,
  brandColors: any,
  logoDataUri: string | null,
  mascotDataUri: string | null,
  pageIndex: number,
  totalPages: number,
  refAnalysis?: any
): string {
  const pw = 1024, ph = 1024; // page dimensions
  const priHex = brandColors?.primary?.hex || "#1A73E8";
  const secHex = brandColors?.secondary?.hex || "#34A853";
  const accHex = brandColors?.accent?.hex || "#FBBC04";

  // Common styles
 const titleFont = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
 const bodyFont = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

 let svg = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
 svg += `<defs>`;
 svg += `<filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/></filter>`;
 svg += `</defs>`;

   if (pageId === "cover") {
    // === COVER PAGE: 椰岛工坊 VI Manual Cover ===
    // Brand background color: #005032 (deep green)
    svg += `<rect x="0" y="0" width="${pw}" height="${ph}" fill="#005032"/>`;
    svg += `<rect x="0" y="${ph-6}" width="${pw}" height="6" fill="#0078B4"/>`;

    // Subtle decorative wave lines (bottom area)
    svg += `<path d="M0 ${ph-60} Q ${pw/4} ${ph-80} ${pw/2} ${ph-60} T ${pw} ${ph-60}" stroke="#0078B4" stroke-width="1.5" fill="none" opacity="0.15"/>`;
    svg += `<path d="M0 ${ph-45} Q ${pw/4} ${ph-65} ${pw/2} ${ph-45} T ${pw} ${ph-45}" stroke="#0078B4" stroke-width="1" fill="none" opacity="0.1"/>`;

    // Corner accents
    svg += `<rect x="30" y="30" width="50" height="3" fill="#0078B4" opacity="0.3"/>`;
    svg += `<rect x="30" y="30" width="3" height="50" fill="#0078B4" opacity="0.3"/>`;
    svg += `<rect x="${pw-80}" y="30" width="50" height="3" fill="#0078B4" opacity="0.3"/>`;
    svg += `<rect x="${pw-33}" y="30" width="3" height="50" fill="#0078B4" opacity="0.3"/>`;

    // LOGO: Top-center, ~460px width
    if (logoDataUri) {
      const logoW = 460, logoH = 200;
      const logoX = (pw - logoW) / 2;
      const logoY = 90;
      svg += `<image x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet" filter="url(#shadow)"/>`;
    }

    // Brand Name in brush/calligraphic font
    const nameY = logoDataUri ? 370 : 200;
    svg += `<text x="${pw/2}" y="${nameY}" text-anchor="middle" font-family="'STXingkai','LiSu','KaiTi','Noto Sans SC','PingFang SC',sans-serif" font-size="52" font-weight="bold" fill="#FFFFFF" filter="url(#shadow)">${companyName}</text>`;

    // Subtitle
    svg += `<text x="${pw/2}" y="${nameY + 65}" text-anchor="middle" font-family="${titleFont}" font-size="26" font-weight="700" fill="#FFFFFF" opacity="0.95">品牌视觉识别系统（VI）规范手册</text>`;
    svg += `<line x1="${pw/2 - 140}" y1="${nameY + 80}" x2="${pw/2 + 140}" y2="${nameY + 80}" stroke="#0078B4" stroke-width="2" opacity="0.5"/>`;

    // English subtitle
    svg += `<text x="${pw/2}" y="${nameY + 110}" text-anchor="middle" font-family="${bodyFont}" font-size="16" font-weight="300" fill="#FFFFFF" opacity="0.8" letter-spacing="4">VISUAL IDENTITY GUIDELINES</text>`;

    // IP Mascot: Right side, vertically centered
    if (mascotDataUri) {
      const mSize = 280;
      const mX = pw - mSize - 50;
      const mY = (ph - mSize) / 2 + 30;
      svg += `<image x="${mX}" y="${mY}" width="${mSize}" height="${mSize}" href="${mascotDataUri}" preserveAspectRatio="xMidYMid meet" opacity="0.95" filter="url(#shadow)"/>`;
    }

    // Bottom info
    const bottomY = ph - 100;
    svg += `<text x="${pw/2}" y="${bottomY}" text-anchor="middle" font-family="${bodyFont}" font-size="15" fill="#FFFFFF" opacity="0.9">品牌总监：林晓薇 / Brand Director</text>`;
    svg += `<text x="${pw/2}" y="${bottomY + 28}" text-anchor="middle" font-family="${bodyFont}" font-size="13" fill="#FFFFFF" opacity="0.7">2024年第三季度 · 第3版</text>`;
  } else if (pageId === "closing") {
    // === CLOSING PAGE: Thank you / back cover ===
    svg += `<text x="${pw/2}" y="${ph/2-40}" text-anchor="middle" font-family="${titleFont}" font-size="36" font-weight="700" fill="#FFFFFF" opacity="0.9">感谢观看</text>`;
    svg += `<text x="${pw/2}" y="${ph/2+20}" text-anchor="middle" font-family="${titleFont}" font-size="16" fill="#FFFFFF" opacity="0.6">${companyName} · 品牌视觉识别系统 (VI) 规范手册</text>`;
    svg += `<text x="${pw/2}" y="${ph-80}" text-anchor="middle" font-family="${bodyFont}" font-size="13" fill="#FFFFFF" opacity="0.5">如有疑问，请咨询品牌管理部</text>`;
    if (mascotDataUri) {
      const mSize = 140;
      svg += `<image x="${(pw-mSize)/2}" y="${ph/2+50}" width="${mSize}" height="${mSize}" href="${mascotDataUri}" preserveAspectRatio="xMidYMid meet" opacity="0.8"/>`;
    }

    // Bottom decorative bar
    svg += `<rect x="0" y="${ph-6}" width="${pw}" height="6" fill="${accHex}"/>`;
  } else {
    // === INNER PAGES: Content page layout ===
    // Top brand bar
    svg += `<rect x="0" y="0" width="${pw}" height="4" fill="${accHex}"/>`;

    // Page title at top
    const label = PAGE_DEFS.find(p => p.id === pageId)?.label || pageId;
    svg += `<text x="50" y="55" font-family="${titleFont}" font-size="26" font-weight="700" fill="${priHex}">${label}</text>`;
    svg += `<line x1="50" y1="68" x2="250" y2="68" stroke="${accHex}" stroke-width="2" opacity="0.6"/>`;

    // Company name at top-right
    svg += `<text x="${pw-50}" y="55" text-anchor="end" font-family="${bodyFont}" font-size="14" fill="#888">${companyName}</text>`;

    // Page number at bottom-right
    svg += `<text x="${pw-50}" y="${ph-30}" text-anchor="end" font-family="${bodyFont}" font-size="12" fill="#AAA">${pageIndex + 1} / ${totalPages}</text>`;

    // Decorative bottom line
    svg += `<rect x="50" y="${ph-50}" width="${pw-100}" height="1" fill="${secHex}" opacity="0.2"/>`;

    // Content area hint (placeholder that page-specific content will be shown)
    // The actual content area is left for the AI-generated background to fill in
  }

  svg += `</svg>`;
  return svg;
}

/** Get a background-only prompt from DeepSeek, guided by reference analysis */
async function getBackgroundPrompt(
  pageDef: typeof PAGE_DEFS[0],
  clientInfo: any,
  brandColors: any,
  apiKey: string,
  refAnalysis?: any
): Promise<string> {
  const companyName = clientInfo?.companyName || "品牌名称";
  const priHex = brandColors?.primary?.hex || "#1A73E8";
  const secHex = brandColors?.secondary?.hex || "#34A853";
  const accHex = brandColors?.accent?.hex || "#FBBC04";

  let instruction = "你是一个企业VI手册背景设计师。请生成一张通义万相背景图提示词。";
  if (clientInfo?.brandVision) instruction += "\n品牌愿景：" + clientInfo.brandVision;
  if (clientInfo?.coreValues) instruction += "\n核心价值：" + clientInfo.coreValues;
  if (clientInfo?.targetMarket) instruction += "\n目标市场：" + clientInfo.targetMarket;
  if (clientInfo?.logoPhilosophy) instruction += "\nLOGO设计理念：" + clientInfo.logoPhilosophy;
  if (clientInfo?.mascotPhilosophy) instruction += "\nIP公仔设计理念：" + clientInfo.mascotPhilosophy;
  instruction += "\n\n重要规则：生成的图片中不能包含任何文字、LOGO、IP公仔、人物。只生成纯背景/底图。";
  instruction += "\n品牌：" + companyName;
  instruction += "\n页面类型：" + pageDef.label;
  instruction += "\n主色：" + priHex + "，辅助色：" + secHex + "，强调色：" + accHex;

  // Inject reference analysis if available
  if (refAnalysis && refAnalysis.analysis) {
    const ra = refAnalysis.analysis;
    instruction += "\n\n参考设计风格：";
    if (ra.visualMood) instruction += "\n- 视觉情绪：" + ra.visualMood;
    if (ra.colorPalette) instruction += "\n- 色彩方案：" + ra.colorPalette;
    if (ra.visualHierarchy) instruction += "\n- 视觉层次：" + ra.visualHierarchy;
  }

  instruction += "\n\n风格要求：企业VI商业风格，干净简洁，高质量，渐变或微纹理背景，矢量质感，高清8K";
  instruction += "\n反向提示词：" + NEGATIVE_PROMPT_BG;
  instruction += "\n输出要求：只输出通义万相提示词本身，不要解释。";

  try {
    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一个企业VI设计提示词工程师。严格按照要求输出通义万相文生图prompt。" },
          { role: "user", content: instruction },
        ],
      }),
    });
    if (!resp.ok) throw new Error("DeepSeek error: " + resp.status);
    const data = await resp.json();
    return data.choices[0].message.content.trim();
  } catch {
    // Simple fallback background prompt
    return `企业VI手册${pageDef.label}页面背景，品牌色${priHex}，简洁渐变色背景，商务质感，轻微纹理，无文字，无LOGO，无人物`;
  }
}

/** Generate background image via Tongyi Wanxiang */
async function generateBackground(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body: any = {
        model: "wan2.7-image-pro",
        input: {
          messages: [{
            role: "user",
            content: [{ text: prompt }]
          }]
        },
        parameters: {
          size: "1024*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999),
          negative_prompt: NEGATIVE_PROMPT_BG,
          prompt_relevance: 0.95,
        },
      };

      const resp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify(body),
      });
      const rawText = await resp.text();
      if (!resp.ok) { await new Promise(r => setTimeout(r, 2000)); continue; }
      let data;
      try { data = JSON.parse(rawText); } catch { await new Promise(r => setTimeout(r, 2000)); continue; }
      const imgUrl = data.output?.choices?.[0]?.message?.content?.find((c: any) => c.type === "image")?.image;
      if (imgUrl) return imgUrl;
      if (data.output?.task_id) {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const tr = await fetch("https://dashscope.aliyuncs.com/api/v1/tasks/" + data.output.task_id, {
              headers: { Authorization: "Bearer " + apiKey },
            });
            if (!tr.ok) continue;
            const td = JSON.parse(await tr.text());
            if (td.output?.task_status === "SUCCEEDED") {
              const u = td.output?.results?.[0]?.image_url;
              if (u) return u;
            }
            if (td.output?.task_status === "FAILED") break;
          } catch { continue; }
        }
      }
    } catch { await new Promise(r => setTimeout(r, 2000)); }
  }
  return null;
}

/**
 * Hybrid page assembly:
 * 1. Generate background image via Tongyi Wanxiang (no text/logo)
 * 2. If background fails, create a solid-color fallback
 * 3. Composite SVG overlay (text, logo, IP) onto the background
 */
async function assemblePage(
  pageDef: typeof PAGE_DEFS[0],
  clientInfo: any,
  brandColors: any,
  logoUrl: string | undefined,
  mascotUrl: string | undefined,
  dashscopeKey: string,
  deepseekKey: string,
  pageIndex: number,
  totalPages: number,
  refAnalysis?: any, blueprint?: PageBlueprint
): Promise<string | null> {
  const companyName = clientInfo?.companyName || "品牌名称";
  const priHex = brandColors?.primary?.hex || "#1A73E8";
  const outputDir = path.join(process.cwd(), "public", "generated");
  await mkdir(outputDir, { recursive: true });

  // Step 1: Generate background
  const bgPrompt = await getBackgroundPrompt(pageDef, clientInfo, brandColors, deepseekKey, refAnalysis);
  let bgPath: string | null = null;
  const bgUrl = await generateBackground(bgPrompt, dashscopeKey);

  if (bgUrl) {
    try {
      const bgFileName = `bg-${Date.now()}-${pageDef.id}.png`;
      bgPath = path.join(outputDir, bgFileName);
      const imgResp = await fetch(bgUrl);
      if (imgResp.ok) {
        const buf = Buffer.from(await imgResp.arrayBuffer());
        await writeFile(bgPath, buf);
      } else { bgPath = null; }
    } catch { bgPath = null; }
  }

  // Step 2: Load logo/mascot as data URIs for embedding in SVG
  let logoDataUri: string | null = null;
  let mascotDataUri: string | null = null;
  if (logoUrl) {
    const logoFullPath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
    logoDataUri = await imageToDataUri(logoFullPath);
    if (!logoDataUri) try { logoDataUri = "data:image/png;base64," + (await readFile(logoFullPath)).toString("base64"); } catch(e) { console.warn("[logo] fallback failed:", String(e)); }
  }
  if (mascotUrl) {
    const mascotFullPath = path.join(process.cwd(), "public", mascotUrl.replace(/^\//, ""));
    mascotDataUri = await imageToDataUri(mascotFullPath);
    if (!mascotDataUri) try { mascotDataUri = "data:image/png;base64," + (await readFile(mascotFullPath)).toString("base64"); } catch(e) { console.warn("[mascot] fallback failed:", String(e)); }
  }

  // Step 3: Create SVG overlay
  const svgContent = blueprint
    ? renderBlueprintToSvg(blueprint, logoDataUri, mascotDataUri)
    : renderPageSvg(pageDef.id, companyName, brandColors, logoDataUri, mascotDataUri, pageIndex, totalPages, refAnalysis);

  // Step 4: Composite: if we have a background, overlay SVG on it; else just render SVG on brand color
  const outputFileName = `${Date.now()}-${pageDef.id}-final.png`;
  const outputPath = path.join(outputDir, outputFileName);

  // Try composite with background first
  if (bgPath) {
    try {
      const svgBuf = Buffer.from(svgContent);
      await sharp(bgPath)
        .composite([{ input: svgBuf, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);
      // Clean up temp bg file
      try { await unlink(bgPath); } catch {}
      return `/generated/${outputFileName}`;
    } catch (e) {
      console.warn(`[assemblePage] Composite failed for ${pageDef.id}, trying SVG fallback:`, String(e));
      // Fall through to SVG-only fallback
    }
  }

  // Fallback: render SVG directly (sharp converts SVG to PNG)
  try {
    const svgBuf = Buffer.from(svgContent);
    await sharp(svgBuf).resize(1024, 1024).png().toFile(outputPath);
    return `/generated/${outputFileName}`;
  } catch (e2) {
    console.error(`[assemblePage] SVG fallback also failed for ${pageDef.id}:`, String(e2));
    return null;
  }
}

export async function POST(req: Request) {
  const { projectId, clientInfo, brandColors, logoUrl, mascotUrl, maxPages, refId, startPage } = await req.json();
  const startIdx = startPage ?? 0;
  const totalToGenerate = maxPages || PAGE_DEFS.length;
  if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });

  const dashscopeKey = process.env.ALIYUN_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!dashscopeKey || !deepseekKey) return new Response(JSON.stringify({ error: "API keys not configured" }), { status: 500 });

  // Load reference analysis if refId is provided
  let refPageMapping: Record<string, any> | null = null;
  if (refId) {
    try {
      const refPath = path.join(process.cwd(), "public", "mock", "reference", `ref-${refId}.json`);
      const refContent = await readFile(refPath, "utf-8");
      const refData = JSON.parse(refContent);
      refPageMapping = refData.pageMapping || null;
      console.log(`[generate] Loaded ref analysis: ${refId}, pages: ${Object.keys(refPageMapping || {}).length}`);
    } catch (e) {
      console.warn(`[generate] Could not load ref analysis ${refId}:`, String(e));
    }
  }

  // Generate Page Blueprints using Page Planner
  let pageBlueprints: Record<string, PageBlueprint> = {};
  try {
    const blueprints = await planPages({
      clientInfo: {
        companyName: clientInfo?.companyName || "",
        brandVision: clientInfo?.brandVision || "",
        coreValues: clientInfo?.coreValues || "",
        targetMarket: clientInfo?.targetMarket || "",
        logoPhilosophy: clientInfo?.logoPhilosophy || "",
        mascotPhilosophy: clientInfo?.mascotPhilosophy || "",
        industry: clientInfo?.industry || "",
      },
      brandColors: brandColors || { primary: { hex: "#1A73E8" }, secondary: { hex: "#34A853" }, accent: { hex: "#FBBC04" } },
      templateId: refId || undefined,
    });
    for (const bp of blueprints) {
      pageBlueprints[bp.pageId] = bp;
    }
  } catch (e) {
    console.warn("[generate] Page Planner error, falling back to hardcoded:", String(e));
  }

  // Phase 9: Validate all blueprints against design rules
  for (const [pid, bp] of Object.entries(pageBlueprints)) {
    const { valid, results } = validateBlueprintAgainstRules(bp, pid);
    if (!valid) {
      const failedRules = results.filter(r => !r.passed).map(r => r.ruleId + ": " + r.message);
      console.warn("[generate] Rule validation issues for " + pid + ":", failedRules);
    }
  }


  const stream = new ReadableStream({
    async start(controller) {
      const results: { pageId: string; label: string; url: string }[] = [];
      const errors: { pageId: string; label: string; error: string }[] = [];
      const startTime = Date.now();
      const pageTimings: Record<string, number> = {};
      try {
        for (let i = startIdx; i < startIdx + totalToGenerate && i < PAGE_DEFS.length; i++) {
          const page = PAGE_DEFS[i];
          sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: totalToGenerate });

          const pageRef = refPageMapping ? refPageMapping[page.id] : null;

          let imageUrl: string | null = null;
            const pageStart = Date.now();
          try {
            imageUrl = await assemblePage(
              page, clientInfo, brandColors,
              logoUrl, mascotUrl,
              dashscopeKey, deepseekKey,
              i, totalToGenerate,
              pageRef,
              pageBlueprints[page.id]
            );
          } catch (e) {
            console.error(`[generate] assemblePage error for ${page.id}:`, String(e));
          }

          if (imageUrl) {
            results.push({ pageId: page.id, label: page.label, url: imageUrl });

          // Run quality check (fire-and-forget)
          let qualityScore: number | null = null;
          try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
            const qcRes = await fetch(baseUrl + "/api/ai/quality-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imagePath: imageUrl,
                pageId: page.id,
                brandColors: brandColors || {},
              }),
              signal: AbortSignal.timeout(10000),
            });
            if (qcRes.ok) {
              const qcData = await qcRes.json();
              qualityScore = qcData.overallScore;
              pageTimings[page.id] = Date.now() - pageStart;
              if (!qcData.passed) {
                console.warn("[generate] Quality alert: " + page.id + " score=" + qcData.overallScore + " suggestions: " + qcData.suggestions.join("; "));
              }
            }
          } catch (qcErr) {
            // Quality check failure is non-fatal
            if (!pageTimings[page.id]) pageTimings[page.id] = Date.now() - pageStart;
          }
            sse(controller, "page:done", { pageId: page.id, label: page.label, url: imageUrl, index: i, total: PAGE_DEFS.length });
          } else {
            errors.push({ pageId: page.id, label: page.label, error: "Generation failed" });
            sse(controller, "page:fail", { pageId: page.id, label: page.label, error: "Generation failed", index: i });
          }
        }

        const pagesData = { projectId, pages: results, errors, generatedAt: new Date().toISOString(), totalPages: results.length, failedPages: errors.length };
        const dataPath = path.join(process.cwd(), "public", "mock", "manual-pages-" + projectId + ".json");
        await mkdir(path.dirname(dataPath), { recursive: true });
        await writeFile(dataPath, JSON.stringify(pagesData, null, 2), "utf-8");

        // Save generation log for monitoring
        try {
          const logEntry: GenerationLogEntry = {
            projectId,
            refId: refId || undefined,
            generatedAt: new Date().toISOString(),
            totalPages: totalToGenerate,
            successfulPages: results.length,
            failedPages: errors.length,
            durationMs: Date.now() - startTime,
            pages: PAGE_DEFS.slice(0, totalToGenerate).map(p => ({
              pageId: p.id,
              label: p.label,
              success: results.some(r => r.pageId === p.id),
              qualityScore: null as number | null,
              qualityPassed: null as boolean | null,
              durationMs: pageTimings[p.id] || 0,
            })),
          };
          await saveGenerationLog(logEntry);
        } catch (logErr) {
          // Logging failure is non-fatal
        }
        sse(controller, "done", { totalPages: results.length, failedPages: errors.length, totalToGenerate: totalToGenerate });
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


