#!/usr/bin/env python3
"""Write the updated route.ts with Tongyi Wanxiang consistency features."""
import os

content = """// API Route: POST /api/ai/generate-manual-pages-stream
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
  { id: "cover", label: "\u5c01\u9762", desc: "VI manual cover page with brand name and logo" },
  { id: "brand-colors", label: "\u54c1\u724c\u8272\u677f", desc: "Brand standard color palette display" },
  { id: "typography", label: "\u5b57\u4f53\u89c4\u8303", desc: "Chinese and English font usage guide" },
  { id: "logo-usage", label: "Logo \u89c4\u8303", desc: "Logo standard usage and clearance" },
  { id: "logo-variants", label: "Logo \u53d8\u4f53", desc: "Logo horizontal vertical and monochrome variants" },
  { id: "auxiliary", label: "\u8f85\u52a9\u56fe\u5f62", desc: "Brand auxiliary graphics and patterns" },
  { id: "business-card", label: "\u540d\u7247", desc: "Business card design specification" },
  { id: "letterhead", label: "\u4fe1\u7eb8", desc: "Letterhead and document specification" },
  { id: "ppt-template", label: "PPT \u6a21\u677f", desc: "PPT template application" },
  { id: "signage", label: "\u62db\u724c", desc: "Store signage system" },
  { id: "closing", label: "\u5c01\u5e95", desc: "VI manual back cover page" },
];

/** Comprehensive negative prompt to prevent distortion and inconsistency */
const NEGATIVE_PROMPT =
  "\u53d8\u5f62\uff0c\u626d\u66f2\uff0c\u4e94\u5b98\u9519\u4f4d\uff0c\u6bd4\u4f8b\u5931\u8c03\uff0c\u989c\u8272\u6df7\u4e71\uff0c\u98ce\u683c\u6742\u4e71\uff0c" +
  "LOGO\u53d8\u5f62\uff0cLOGO\u6a21\u7cca\uff0c\u591aLOGO\uff0c\u4e71\u6587\u5b57\uff0c\u6742\u8272\u80cc\u666f\uff0c" +
  "\u4f4e\u753b\u8d28\uff0c\u6a21\u7cca\uff0c\u566a\u70b9\uff0c\u4eba\u4f53\u7ed3\u6784\u9519\u8bef\uff0c\u975e\u5b98\u65b9\u5f62\u8c61\uff0c" +
  "\u591a\u4f59\u88c5\u9970\uff0c\u98ce\u683c\u4e0d\u7edf\u4e00\uff0c\u9762\u90e8\u7279\u5f81\u6539\u53d8\uff0cIP\u5f62\u8c61\u6f02\u79fb";

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode("event: " + event + "\\ndata: " + JSON.stringify(data) + "\\n\\n"));
}

/** Build the fixed IP DNA prompt that must be prepended to every image generation */
function buildIPDnaPrompt(clientInfo: any, brandColors: any): string {
  const hasMascot = clientInfo?.mascotAssets?.length > 0;
  if (!hasMascot) return "";
  const mascotName = clientInfo.mascotAssets[0]?.name || "\u5b98\u65b9IP\u516c\u4ed4";
  const mascotPersonality = clientInfo.mascotAssets[0]?.personality || "\u6d3b\u6cfc\u53ef\u7231";
  const primHex = brandColors?.primary?.hex || "#1A73E8";
  const secHex = brandColors?.secondary?.hex || "#34A853";
  const accHex = brandColors?.accent?.hex || "#FBBC04";

  return (
    "\u3010\u4f01\u4e1aIP\u56fa\u5b9aDNA\uff0c\u5168\u7a0b\u4e0d\u53d8\u3011" +
    "\u5b98\u65b9IP\u5f62\u8c61\uff1a" + mascotName + "\uff0c" +
    "Q\u7248\u5361\u901a\u5f62\u8c61\uff0c" +
    "\u56fa\u5b9a\u9762\u90e8\u7279\u5f81\uff1a\u5706\u8138\uff0c\u5927\u773c\u775b\uff0c\u56fa\u5b9a\u8868\u60c5\u6e29\u548c\u5fae\u7b11\uff0c" +
    "\u56fa\u5b9a\u8eab\u4f53\u6bd4\u4f8b\uff1a\u5934\u5927\u8eab\u5c0fQ\u7248\uff0c" +
    "\u56fa\u5b9a\u914d\u8272\uff1a\u4e3b\u8272" + primHex + " \u8f85\u8272" + secHex + " \u70b9\u7f00\u8272" + accHex + "\uff0c" +
    (mascotPersonality ? "\u6027\u683c\uff1a" + mascotPersonality + "\uff0c" : "") +
    "\u56fa\u5b9aLOGO\u4f4d\u7f6e\uff1a\u80f8\u53e3/\u5de6\u4e0a\u89d2\uff0cLOGO\u5927\u5c0f\u7edf\u4e00\uff0c" +
    "\u4f01\u4e1aVI\u5546\u4e1a\u63d2\u753b\u98ce\u683c\uff0c\u6e05\u6670\u8f6e\u5ed3\uff0c\u65e0\u7565\u53d8\uff0c\u65e0\u53d8\u5f62\uff0c\u6bd4\u4f8b\u4e25\u683c\u4e00\u81f4\uff0c" +
    "\u4e0e\u57fa\u51c6\u56fe\u5b8c\u5168\u76f8\u540c\u7684IP\u5f62\u8c61\uff0c\u7981\u6b62\u6539\u53d8\u4e94\u5b98\u3001\u6bd4\u4f8b\u3001\u989c\u8272\u3001LOGO\u6837\u5f0f"
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
  const companyName = clientInfo?.companyName || "\u54c1\u724c\u540d\u79f0";

  let instruction = "\u8bf7\u4e3a\u4e00\u4e2aVI\u624b\u518c\u7684" + pageDef.label + "\u9875\u751f\u6210\u901a\u4e49\u4e07\u76f8\u6587\u751f\u56fe\u63d0\u793a\u8bcd\u3002\\n\\n";
  instruction += "\u54c1\u724c\uff1a" + companyName + "\\n";
  instruction += "\u884c\u4e1a\uff1a" + (clientInfo?.industry || "\u901a\u7528") + "\\n";
  instruction += "\u4e3b\u8272\uff1a" + (brandColors?.primary?.hex || "#1A73E8") + "\\n";
  instruction += "\u8f85\u52a9\u8272\uff1a" + (brandColors?.secondary?.hex || "#34A853") + "\\n";
  instruction += "\u5f3a\u8c03\u8272\uff1a" + (brandColors?.accent?.hex || "#FBBC04") + "\\n";
  instruction += "\u9875\u9762\u7528\u9014\uff1a" + pageDef.desc + "\\n\\n";

  if (hasMascot && ipDnaPrompt) {
    instruction += "\u3010IP\u56fa\u5b9aDNA\uff0c\u5fc5\u987b\u653e\u5728\u63d0\u793a\u8bcd\u6700\u524d\u9762\u3011\\n" + ipDnaPrompt + "\\n\\n";
  }
  if (hasLogo) {
    instruction += "\u3010LOGO\u4f4d\u7f6e\u3011LOGO\u56fa\u5b9a\u5728\u9875\u9762\u5de6\u4e0a\u89d2\uff0c\u7b49\u6bd4\u4f8b\u7f29\u5c0f\uff0c\u900f\u660e\u5e95\uff0c\u4e0d\u906e\u6321\u4e3b\u4f53\uff0c\u4e0d\u53d8\u5f62\u3002\\n";
  }
  if (hasMascot) {
    instruction += "\u3010IP\u4f4d\u7f6e\u3011IP\u516c\u4ed4\u5728\u9875\u9762\u4e2d\uff0c\u6839\u636e\u9875\u9762\u5185\u5bb9\u9009\u62e9\u5408\u9002\u7684\u52a8\u4f5c\uff08\u6b63\u9762\u7ad9\u7acb/\u624b\u6301\u5c55\u793a/\u6307\u5f15\u624b\u52bf\u7b49\uff09\u3002\\n";
  }

  instruction += "\u3010\u98ce\u683c\u3011\u4f01\u4e1aVI\u5546\u4e1a\u63d2\u753b\u98ce\u683c\uff0c" + pageDef.label + "\u4e3b\u9898\uff0c" +
    "\u4f7f\u7528\u54c1\u724c\u8272" + (brandColors?.primary?.hex || "") + "\u548c" + (brandColors?.secondary?.hex || "") + "\u4e3a\u4e3b\u8272\u8c03\uff0c" +
    "\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f\uff0c\u9ad8\u6e058K\uff0c\u65e0\u6587\u5b57\u9519\u4e71\u3002\\n\\n";
  instruction += "\u3010\u53cd\u5411\u63d0\u793a\u8bcd\u3011\u53d8\u5f62\uff0c\u626d\u66f2\uff0c\u4e94\u5b98\u9519\u4f4d\uff0c\u6bd4\u4f8b\u5931\u8c03\uff0cLOGO\u53d8\u5f62\uff0c\u4f4e\u753b\u8d28\uff0c\u6a21\u7cca\uff0c\u6742\u8272\\n\\n";
  instruction += "\u8f93\u51fa\u8981\u6c42\uff1a\u53ea\u8f93\u51fa\u901a\u4e49\u4e07\u76f8\u7684\u63d0\u793a\u8bcd\uff08\u4e2d\u6587+\u82f1\u6587\u5173\u952e\u8bcd\uff09\uff0c\u4e0d\u8981\u89e3\u91ca\u3002";

  try {
    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "\u4f60\u662f\u4e00\u4e2a\u4f01\u4e1aVI\u8bbe\u8ba1\u63d0\u793a\u8bcd\u5de5\u7a0b\u5e08\u3002\u4e25\u683c\u6309\u7167\u7528\u6237\u8981\u6c42\u7684\u683c\u5f0f\u8f93\u51fa\u901a\u4e49\u4e07\u76f8\u6587\u751f\u56feprompt\uff0c\u53ea\u8f93\u51faprompt\u672c\u8eab\uff0c\u4e0d\u8f93\u51fa\u4efb\u4f55\u89e3\u91ca\u3002" },
          { role: "user", content: instruction },
        ],
      }),
    });
    if (!resp.ok) throw new Error("DeepSeek error: " + resp.status);
    const data = await resp.json();
    return data.choices[0].message.content.trim();
  } catch {
    const dna = ipDnaPrompt ? ipDnaPrompt + "\uff0c" : "";
    return dna +
      (hasLogo ? "\u5de6\u4e0a\u89d2\u653e\u7f6e\u4f01\u4e1aLOGO\uff0c\u900f\u660e\u5e95\uff0c" : "") +
      "\u4f01\u4e1aVI\u98ce\u683c\uff0c" + pageDef.label + "\u4e3b\u9898\uff0c" +
      "\u4e3b\u8272" + (brandColors?.primary?.hex || "#1A73E8") +
      "\uff0c\u767d\u8272\u80cc\u666f\uff0c\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f\uff0c\u9ad8\u6e058K\uff0c\u65e0\u6587\u5b57";
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
      // Build multimodal content: text + optional reference images (following guide's multi-image fusion)
      const content: any[] = [{ text: prompt }];
      if (mascotUrl) {
        const url = mascotUrl.startsWith("http") ? mascotUrl : "http://localhost:3000" + mascotUrl;
        content.push({ image: url });
      }
      if (logoUrl) {
        const url = logoUrl.startsWith("http") ? logoUrl : "http://localhost:3000" + logoUrl;
        content.push({ image: url });
      }

      const body: any = {
        model: "wan2.6-t2i",
        input: { messages: [{ role: "user", content }] },
        parameters: {
          size: "1024*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999),
          negative_prompt: NEGATIVE_PROMPT,
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
      const logoPath = path.join(process.cwd(), "public", logoUrl.replace(/^\\//, ""));
      const logoBuf = await sharp(logoPath).resize(Math.round(pw * 0.12)).png().toBuffer();
      composites.push({ input: logoBuf, top: Math.round(ph * 0.05), left: Math.round(pw * 0.05) });
    }

    // Mascot: bottom-right, 22% width
    if (mascotUrl) {
      const mascotPath = path.join(process.cwd(), "public", mascotUrl.replace(/^\\//, ""));
      const mascotBuf = await sharp(mascotPath).resize(Math.round(pw * 0.22)).png().toBuffer();
      composites.push({ input: mascotBuf, top: Math.round(ph * 0.68), left: Math.round(pw * 0.73) });
    }

    if (composites.length > 0) {
      const compositedPath = pagePath.replace(/\\.png$/, "-composited.png");
      await sharp(pagePath).composite(composites).png().toFile(compositedPath);
      await unlink(pagePath);
      await rename(compositedPath, pagePath);
    }
  } catch (e) {
    console.warn("[compositeImages] Failed for", pageId, "-", String(e));
  }
}

export async function POST(req: Request) {
  const { projectId, clientInfo, brandColors, logoUrl, mascotUrl } = await req.json();
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
        for (let i = 0; i < PAGE_DEFS.length; i++) {
          const page = PAGE_DEFS[i];
          sse(controller, "page:start", { pageId: page.id, label: page.label, index: i, total: PAGE_DEFS.length });

          let pagePrompt: string;
          try {
            pagePrompt = await getPagePrompt(page, clientInfo, brandColors, ipDnaPrompt, deepseekKey);
          } catch {
            const dna = ipDnaPrompt ? ipDnaPrompt + "\uff0c" : "";
            pagePrompt = dna +
              (logoUrl ? "\u5de6\u4e0a\u89d2\u653e\u7f6e\u4f01\u4e1aLOGO\uff0c\u900f\u660e\u5e95\uff0c" : "") +
              "\u4f01\u4e1aVI\u98ce\u683c\uff0c" + page.label + "\u4e3b\u9898\uff0c" +
              "\u4e3b\u8272" + (brandColors?.primary?.hex || "#1A73E8") +
              "\uff0c\u767d\u8272\u80cc\u666f\uff0c\u5e72\u51c0\u7b80\u6d01\uff0c\u77e2\u91cf\u8d28\u611f";
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
        sse(controller, "done", { totalPages: results.length, failedPages: errors.length });
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
"""

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages-stream\route.ts'
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Written successfully, size:', len(content))
