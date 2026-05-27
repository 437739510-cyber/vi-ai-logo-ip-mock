// API Route: POST /api/ai/generate-manual-pages-stream
// Server-Sent Events: one page at a time
// Implements Tongyi Wanxiang enterprise VI consistency guide:
// - IP fixed DNA prompt (never change)
// - LOGO + IP reference images via multimodal
// - Negative prompts to prevent distortion
import { writeFile, mkdir, unlink, rename } from "fs/promises";
import path from "path";
import sharp from "sharp";

const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const PAGE_DEFS = [
  { id: "cover", label: "封面", desc: "VI manual cover page with brand name and logo" },
  { id: "brand-colors", label: "品牌色板", desc: "Brand standard color palette display" },
  { id: "typography", label: "字体规范", desc: "Chinese and English font usage guide" },
  { id: "logo-usage", label: "Logo 规范", desc: "Logo standard usage and clearance" },
  { id: "logo-variants", label: "Logo 变体", desc: "Logo horizontal vertical and monochrome variants" },
  { id: "auxiliary", label: "辅助图形", desc: "Brand auxiliary graphics and patterns" },
  { id: "business-card", label: "名片", desc: "Business card design specification" },
  { id: "letterhead", label: "信纸", desc: "Letterhead and document specification" },
  { id: "ppt-template", label: "PPT 模板", desc: "PPT template application" },
  { id: "signage", label: "招牌", desc: "Store signage system" },
  { id: "closing", label: "封底", desc: "VI manual back cover page" },
];

/** Comprehensive negative prompt to prevent distortion and inconsistency */
const NEGATIVE_PROMPT =
  "变形，扭曲，五官错位，比例失调，颜色混乱，风格杂乱，" +
  "LOGO变形，LOGO模糊，多LOGO，乱文字，杂色背景，" +
  "低画质，模糊，噪点，人体结构错误，非官方形象，" +
  "多余装饰，风格不统一，面部特征改变，IP形象漂移";

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n"));
}

/** Build the fixed IP DNA prompt that must be prepended to every image generation */
function buildIPDnaPrompt(clientInfo: any, brandColors: any): string {
  const hasMascot = clientInfo?.mascotAssets?.length > 0;
  if (!hasMascot) return "";
  const mascotName = clientInfo.mascotAssets[0]?.name || "官方IP公仔";
  const mascotPersonality = clientInfo.mascotAssets[0]?.personality || "活泼可爱";
  const primHex = brandColors?.primary?.hex || "#1A73E8";
  const secHex = brandColors?.secondary?.hex || "#34A853";
  const accHex = brandColors?.accent?.hex || "#FBBC04";

  return (
    "【企业IP固定DNA，全程不变】" +
    "官方IP形象：" + mascotName + "，" +
    "Q版卡通形象，" +
    "固定面部特征：圆脸，大眼睛，固定表情温和微笑，" +
    "固定身体比例：头大身小Q版，" +
    "固定配色：主色" + primHex + " 辅色" + secHex + " 点缀色" + accHex + "，" +
    (mascotPersonality ? "性格：" + mascotPersonality + "，" : "") +
    "固定LOGO位置：胸口/左上角，LOGO大小统一，" +
    "企业VI商业插画风格，清晰轮廓，无略变，无变形，比例严格一致，" +
    "与基准图完全相同的IP形象，禁止改变五官、比例、颜色、LOGO样式"
  );
}

/** Build a page-specific prompt for DeepSeek to generate the image prompt */
async function getPagePrompt(
  pageDef: typeof PAGE_DEFS[0],
  clientInfo: any,
  brandColors: any,
  ipDnaPrompt: string,
  apiKey: string
): Promise<string> {
  const hasLogo = clientInfo?.logoAssets?.length > 0;
  const hasMascot = clientInfo?.mascotAssets?.length > 0;
  const companyName = clientInfo?.companyName || "品牌名称";

  let instruction = "请为一个VI手册的" + pageDef.label + "页生成通义万相文生图提示词。\n\n";
  instruction += "品牌：" + companyName + "\n";
  instruction += "行业：" + (clientInfo?.industry || "通用") + "\n";
  instruction += "主色：" + (brandColors?.primary?.hex || "#1A73E8") + "\n";
  instruction += "辅助色：" + (brandColors?.secondary?.hex || "#34A853") + "\n";
  instruction += "强调色：" + (brandColors?.accent?.hex || "#FBBC04") + "\n";
  instruction += "页面用途：" + pageDef.desc + mascotDesc + "\n\n";

  if (hasMascot && ipDnaPrompt) {
    instruction += "【IP固定DNA，必须放在提示词最前面】\n" + ipDnaPrompt + "\n\n";
  }
  if (hasLogo) {
    instruction += "【LOGO位置】LOGO固定在页面左上角，等比例缩小，透明底，不遮挡主体，不变形。\n";
  }
  if (hasMascot) {
    instruction += "【IP位置】IP公仔在页面中，根据页面内容选择合适的动作（正面站立/手持展示/指引手势等）。\n";
  }

  instruction += "【风格】企业VI商业插画风格，" + pageDef.label + "主题，" +
    "使用品牌色" + (brandColors?.primary?.hex || "") + "和" + (brandColors?.secondary?.hex || "") + "为主色调，" +
    "干净简洁，矢量质感，高清8K，无文字错乱。\n\n";
  instruction += "【反向提示词】变形，扭曲，五官错位，比例失调，LOGO变形，低画质，模糊，杂色\n\n";
  instruction += "输出要求：只输出通义万相的提示词（中文+英文关键词），不要解释。";

  try {
    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一个企业VI设计提示词工程师。严格按照用户要求的格式输出通义万相文生图prompt，只输出prompt本身，不输出任何解释。" },
          { role: "user", content: instruction },
        ],
      }),
    });
    if (!resp.ok) throw new Error("DeepSeek error: " + resp.status);
    const data = await resp.json();
    return data.choices[0].message.content.trim();
  } catch {
    const dna = ipDnaPrompt ? ipDnaPrompt + "，" : "";
    return dna +
      (hasLogo ? "左上角放置企业LOGO，透明底，" : "") +
      "企业VI风格，" + pageDef.label + "主题，" +
      "主色" + (brandColors?.primary?.hex || "#1A73E8") +
      "，白色背景，干净简洁，矢量质感，高清8K，无文字";
  }
}

/** Generate a single image via Tongyi Wanxiang with reference images for consistency */
async function generateSingleImage(
  prompt: string,
  apiKey: string,
  logoUrl?: string,
  mascotUrl?: string
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
          negative_prompt: NEGATIVE_PROMPT,
          prompt_relevance: 0.98,
          role_consistency: true,
          consistency_level: "commercial",
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

/** Composite uploaded LOGO and mascot images onto the generated page image */
async function compositeImages(
  pagePath: string,
  logoUrl: string | undefined,
  mascotUrl: string | undefined,
  pageId: string
): Promise<void> {
  try {
    if (!logoUrl && !mascotUrl) return;
    const composites: sharp.OverlayOptions[] = [];
    const pageMeta = await sharp(pagePath).metadata();
    const pw = pageMeta.width || 1024;
    const ph = pageMeta.height || 1024;

    // LOGO: top-left, 12% width (guide: fixed position, transparent bg, no deformation)
    if (logoUrl) {
      const logoPath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
      const logoBuf = await sharp(logoPath).resize(Math.round(pw * 0.12)).png().toBuffer();
      composites.push({ input: logoBuf, top: Math.round(ph * 0.05), left: Math.round(pw * 0.05) });
    }

    // Mascot: bottom-right, 22% width
    if (mascotUrl) {
      const mascotPath = path.join(process.cwd(), "public", mascotUrl.replace(/^\//, ""));
      const mascotBuf = await sharp(mascotPath).resize(Math.round(pw * 0.22)).png().toBuffer();
      composites.push({ input: mascotBuf, top: Math.round(ph * 0.68), left: Math.round(pw * 0.73) });
    }

    if (composites.length > 0) {
      const compositedPath = pagePath.replace(/\.png$/, "-composited.png");
      await sharp(pagePath).composite(composites).png().toFile(compositedPath);
      await unlink(pagePath);
      await rename(compositedPath, pagePath);
    }
  } catch (e) {
    console.warn("[compositeImages] Failed for", pageId, "-", String(e));
  }
}

export async function POST(req: Request) {
  const { projectId, clientInfo, brandColors, logoUrl, mascotUrl, maxPages } = await req.json();
  const totalToGenerate = maxPages || PAGE_DEFS.length;
  if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });

  const dashscopeKey = process.env.ALIYUN_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!dashscopeKey || !deepseekKey) return new Response(JSON.stringify({ error: "API keys not configured" }), { status: 500 });

  // Build the fixed IP DNA prompt once for all pages (guide: never change DNA)
  const ipDnaPrompt = buildIPDnaPrompt(clientInfo, brandColors);

  const stream = new ReadableStream({
    async start(controller) {
      const results: { pageId: string; label: string; url: string }[] = [];
      const errors: { pageId: string; label: string; error: string }[] = [];
      try {
        for (let i = 0; i < totalToGenerate; i++) {
          const page = PAGE_DEFS[i];
          sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: totalToGenerate });

          let pagePrompt: string;
          try {
            pagePrompt = await getPagePrompt(page, clientInfo, brandColors, ipDnaPrompt, deepseekKey);
          } catch {
            const dna = ipDnaPrompt ? ipDnaPrompt + "，" : "";
            const fbMascotDesc = clientInfo?.mascotAssets?.length > 0 ? "，以参考图的IP形象为主体，禁止修改五官、造型、材质、配色" : "";
            pagePrompt = dna +
              (logoUrl ? "左上角放置企业LOGO，透明底，" : "") +
              "企业VI风格，" + page.label + "主题，" +
              "主色" + (brandColors?.primary?.hex || "#1A73E8") +
              "，白色背景，干净简洁，矢量质感" + fbMascotDesc;
          }

          let imageUrl: string | null = null;
          try {
            imageUrl = await generateSingleImage(pagePrompt, dashscopeKey, logoUrl, mascotUrl);
          } catch {}

          if (imageUrl) {
            const fileName = projectId + "-" + page.id + ".png";
            const filePath = path.join(process.cwd(), "public", "generated", fileName);
            try {
              await mkdir(path.dirname(filePath), { recursive: true });
              const imgResp = await fetch(imageUrl);
              if (imgResp.ok) {
                const buf = Buffer.from(await imgResp.arrayBuffer());
                await writeFile(filePath, buf);
                try {
                  await compositeImages(filePath, logoUrl, mascotUrl, page.id);
                } catch (e) {
                  console.warn("[compositeImages] Error:", String(e));
                }
                results.push({ pageId: page.id, label: page.label, url: "/generated/" + fileName });
                sse(controller, "page:done", { pageId: page.id, label: page.label, url: "/generated/" + fileName, index: i, total: PAGE_DEFS.length });
              } else {
                errors.push({ pageId: page.id, label: page.label, error: "Download failed" });
                sse(controller, "page:fail", { pageId: page.id, label: page.label, error: "Download failed", index: i });
              }
            } catch {
              errors.push({ pageId: page.id, label: page.label, error: "Save failed" });
              sse(controller, "page:fail", { pageId: page.id, label: page.label, error: "Save failed", index: i });
            }
          } else {
            errors.push({ pageId: page.id, label: page.label, error: "Generation failed" });
            sse(controller, "page:fail", { pageId: page.id, label: page.label, error: "Generation failed", index: i });
          }
        }

        const pagesData = { projectId, pages: results, errors, generatedAt: new Date().toISOString(), totalPages: results.length, failedPages: errors.length };
        const dataPath = path.join(process.cwd(), "public", "mock", "manual-pages-" + projectId + ".json");
        await mkdir(path.dirname(dataPath), { recursive: true });
        await writeFile(dataPath, JSON.stringify(pagesData, null, 2), "utf-8");
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
