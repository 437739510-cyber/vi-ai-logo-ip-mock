/**
 * API: Generate VI Manual PPTX via PptxGenJS Engine V7
 *
 * V7 核心改动（在V6基础上）：
 * - 修复行业判定：椰子水→饮品(不是餐饮)，删掉"椰岛"从餐饮正则
 * - 修复API端点：compatible-mode不支持万相 → 改用DashScope原生异步API
 * - 修复模型名：wanx2.6-image(错) → wan2.6-t2i(纯文生图)
 * - 场景图从7张减为5张（¥0.20×5=¥1.00/份）
 * - 异步调用流程：提交任务 → 轮询结果 → 获取URL → 下载base64
 * - 新增analyze-brand共享逻辑
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile, mkdir, writeFile, readdir } from "fs/promises";
import { planPages } from "@/lib/page-planner";
import { renderPptxToBuffer } from "@/lib/render-pptx";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ========== 行业判定（与analyze-brand共享） ==========
export type IndustryType = "restaurant" | "beverage" | "beauty" | "retail" | "education" | "general";

export function getIndustryType(industry?: string): IndustryType {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  // 饮品优先判断（椰子水、茶饮等容易混入餐饮）
  if (/椰|椰子|椰汁|茶|咖啡|饮|奶茶|果汁|酒|酒吧|饮品|奶茶店|气泡|矿泉|纯净水/.test(s)) return "beverage";
  if (/餐|食|面|火锅|烧烤|烘焙|饺子|包子|炒菜|饭店|小吃|饭馆|海鲜|川菜|粤菜|湘菜|鲁菜|馆|外卖/.test(s)) return "restaurant";
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫/.test(s)) return "beauty";
  if (/零售|超市|便利|商店|杂货|服装|鞋|饰品|母婴|数码/.test(s)) return "retail";
  if (/教育|培训|学|课|幼儿园|托管|辅导/.test(s)) return "education";
  return "general";
}

// ========== 行业场景图定义（5张/份，¥1.00） ==========
interface SceneImgDef {
  key: string;
  rawPrompt: string;
  page: string;
}

const SCENE_IMG_DEFS: Record<IndustryType, SceneImgDef[]> = {
  restaurant: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a restaurant napkin sleeve and chopstick cover set, placed on a wooden table, clean minimalist design, studio lighting, top-down angle, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a food delivery paper bag standing on a surface, minimalist design, clean studio background, side angle view, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a takeout food container box with lid, placed on clean surface, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional standee poster display in a restaurant, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a restaurant menu card on a dining table, clean minimal design, studio lighting, no text no letters no watermark" },
  ],
  beverage: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a takeaway cup with cup sleeve, clean minimalist design, studio lighting, angled view, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded paper tote bag standing upright, minimalist design, clean studio background, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beverage bottle with label on clean surface, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional poster for a beverage shop, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a membership card for a beverage brand, clean studio background, no text no letters no watermark" },
  ],
  beauty: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of beauty product bottles and packaging set, elegant minimalist design, studio lighting, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded gift bag with ribbon handles, elegant design, studio background, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beauty product jar with label, clean design, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a beauty salon promotional poster, elegant and luxurious style, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a VIP membership card with elegant design, clean background, no text no letters no watermark" },
  ],
  retail: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded shopping bag with handles, standing on surface, minimalist design, studio lighting, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a retail promotional poster display, modern clean style, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a retail price tag with hanging string, clean studio background, no text no letters no watermark" },
  ],
  education: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a school ID badge and lanyard, clean design, studio lighting, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag for education, brand color design, clean studio background, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a course material folder, brand color accent, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of an education enrollment promotional poster, inspiring style, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a campus event banner stand, brand color design, studio lighting, no text no letters no watermark" },
  ],
  general: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view, no text no letters no watermark" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag, standing upright, minimalist design, clean studio background, no text no letters no watermark" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting, no text no letters no watermark" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a corporate promotional poster, modern professional style, studio setting, no text no letters no watermark" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a company ID badge, brand color accent, studio lighting, no text no letters no watermark" },
  ],
};

// ========== 行业默认色 ==========
const INDUSTRY_DEFAULTS: Record<string, { primary: string; secondary: string; accent: string }> = {
  restaurant:  { primary: "#2E7D32", secondary: "#E65100", accent: "#F9A825" },
  beverage:    { primary: "#00695C", secondary: "#D84315", accent: "#FFB300" },
  beauty:      { primary: "#AD1457", secondary: "#6A1B9A", accent: "#F48FB1" },
  retail:      { primary: "#1565C0", secondary: "#EF6C00", accent: "#78909C" },
  education:   { primary: "#283593", secondary: "#00897B", accent: "#FF8F00" },
  general:     { primary: "#37474F", secondary: "#00897B", accent: "#FFB300" },
};

export function getIndustryDefaults(industry?: string): { primary: string; secondary: string; accent: string } {
  const it = getIndustryType(industry);
  return INDUSTRY_DEFAULTS[it] || INDUSTRY_DEFAULTS.general;
}

function normalizeColors(colors: any, industry?: string): { primary: string; secondary: string; accent: string } {
  const defaults = getIndustryDefaults(industry);
  if (!colors) return defaults;
  if (colors.primary?.hex) {
    return {
      primary: colors.primary.hex || defaults.primary,
      secondary: colors.secondary?.hex || defaults.secondary,
      accent: colors.accent?.hex || defaults.accent,
    };
  }
  if (typeof colors.primary === "string" && colors.primary) {
    return {
      primary: colors.primary || defaults.primary,
      secondary: (typeof colors.secondary === "string" ? colors.secondary : defaults.secondary) || defaults.secondary,
      accent: (typeof colors.accent === "string" ? colors.accent : defaults.accent) || defaults.accent,
    };
  }
  if (Array.isArray(colors) && colors.length > 0) {
    return {
      primary: colors[0]?.hex || colors[0] || defaults.primary,
      secondary: (colors[1]?.hex || colors[1] || defaults.secondary) as string,
      accent: (colors[2]?.hex || colors[2] || defaults.accent) as string,
    };
  }
  return defaults;
}

// ========== 通义万相 异步图片生成 ==========
const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
const DASHSCOPE_TASK = "https://dashscope.aliyuncs.com/api/v1/tasks";

async function generateSceneImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.ALIYUN_API_KEY;
  if (!apiKey) {
    console.error("[generateImage] No ALIYUN_API_KEY");
    return null;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: 提交异步任务
      const submitResp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: "wan2.6-t2i",
          input: {
            messages: [{ role: "user", content: [{ text: prompt }] }],
          },
          parameters: { size: "1024*1024", n: 1 },
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        console.error(`[generateImage] Submit attempt ${attempt}: ${submitResp.status} ${errText.substring(0, 200)}`);
        continue;
      }

      const submitData = await submitResp.json();
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        console.error(`[generateImage] No task_id in response:`, JSON.stringify(submitData).substring(0, 200));
        continue;
      }

      console.log(`[generateImage] Task submitted: ${taskId}`);

      // Step 2: 轮询任务结果（最多等90秒）
      for (let poll = 0; poll < 18; poll++) {
        await new Promise(r => setTimeout(r, 5000)); // 等5秒

        const pollResp = await fetch(`${DASHSCOPE_TASK}/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!pollResp.ok) continue;
        const pollData = await pollResp.json();
        const status = pollData.output?.task_status;

        if (status === "SUCCEEDED") {
          // 提取图片URL
          const imageUrl = pollData.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imageUrl) {
            console.error(`[generateImage] No image URL in result`);
            break;
          }

          // Step 3: 下载图片转base64
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const base64 = imgBuf.toString("base64");
            console.log(`[generateImage] OK! base64 length=${base64.length}`);
            return `data:image/png;base64,${base64}`;
          }
          console.error(`[generateImage] Failed to download image`);
          break;
        }

        if (status === "FAILED") {
          console.error(`[generateImage] Task failed:`, pollData.output?.message || "unknown");
          break;
        }

        // 仍在PENDING/RUNNING，继续轮询
      }
    } catch (err: any) {
      console.error(`[generateImage] Attempt ${attempt} error: ${err.message}`);
    }
  }
  return null;
}

// ========== 主流程 ==========
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // ===== Step 1: 从 Supabase 查 project + submission =====
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id")
      .eq("id", projectId)
      .single();

    if (projErr) console.error("[generate-pptx] Project query error:", projErr.message);

    let submission: any = null;
    if (project?.submission_id) {
      const { data: sub, error: subErr } = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("id", project.submission_id)
        .single();
      if (!subErr && sub) submission = sub;
    }

    // ===== Step 2: 提取所有数据 =====
    const companyName = body.clientInfo?.companyName || body.clientInfo?.clientName || submission?.company_name || submission?.companyName || "品牌";
    const industry = body.clientInfo?.industry || submission?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || submission?.brandVision || "";
    const coreValues = body.clientInfo?.coreValues || submission?.core_values || submission?.coreValues || "";
    const targetMarket = body.clientInfo?.targetMarket || submission?.target_market || submission?.targetMarket || "";
    const logoPhilosophy = body.clientInfo?.logoPhilosophy || submission?.logo_philosophy || submission?.logoPhilosophy || "";
    const mascotPhilosophy = body.clientInfo?.mascotPhilosophy || submission?.mascot_philosophy || submission?.mascotPhilosophy || "";

    const rawColors = body.brandColors || submission?.brand_colors || submission?.brandColors;
    const realColors = normalizeColors(rawColors, industry);

    const industryType = getIndustryType(industry);
    console.log("[generate-pptx] ===== BRAND DATA =====");
    console.log("[generate-pptx] Company:", companyName, "| Industry:", industry, "| Type:", industryType);
    console.log("[generate-pptx] Colors:", JSON.stringify(realColors));

    // ===== Step 3: 加载 Logo/Mascot =====
    let logoData: string | null = null;
    let mascotData: string | null = null;
    let mascotSplitViews: string[] | null = null;

    if (body.logoUrl) logoData = await loadImg(body.logoUrl);
    if (!logoData) logoData = await findAsset(projectId, "logo");
    if (!logoData) logoData = await findFromStorage(projectId, "logo");

    if (body.mascotUrl) mascotData = await loadImg(body.mascotUrl);
    if (body.mascotFiles?.length > 0) {
      for (const mf of body.mascotFiles) {
        const url = typeof mf === "string" ? mf : mf.url;
        mascotData = await loadImg(url);
        if (mascotData) break;
      }
    }
    if (!mascotData) mascotData = await findAsset(projectId, "mascot");
    if (!mascotData) mascotData = await findFromStorage(projectId, "mascot");
    if (mascotData) mascotSplitViews = await findSplitViews(projectId);

    console.log("[generate-pptx] Logo:", logoData ? "OK" : "null", "| Mascot:", mascotData ? "OK" : "null");

    // ===== Step 4: 生成 AI 写实场景图（5张，异步并行） =====
    const imgDefs = SCENE_IMG_DEFS[industryType] || SCENE_IMG_DEFS.general;

    console.log("[generate-pptx] ===== AI IMAGE GENERATION =====");
    console.log("[generate-pptx] Industry:", industryType, "| Images:", imgDefs.length);

    const imageResults = await Promise.allSettled(
      imgDefs.map(async (def) => {
        console.log(`[generateImage] Starting ${def.key}...`);
        const imgData = await generateSceneImage(def.rawPrompt);
        return { key: def.key, page: def.page, data: imgData };
      })
    );

    const sceneImages: Record<string, string> = {};
    let imgSuccess = 0;
    for (const result of imageResults) {
      if (result.status === "fulfilled" && result.value.data) {
        sceneImages[result.value.key] = result.value.data;
        imgSuccess++;
      } else if (result.status === "rejected") {
        console.error("[generateImage] Failed:", result.reason);
      }
    }
    console.log(`[generate-pptx] Images: ${imgSuccess}/${imgDefs.length} success`);

    // ===== Step 5: 生成蓝图 =====
    const blueprints = await planPages({
      clientInfo: { companyName, brandVision, coreValues, targetMarket, logoPhilosophy, mascotPhilosophy, industry },
      brandColors: {
        primary: { hex: realColors.primary },
        secondary: { hex: realColors.secondary },
        accent: { hex: realColors.accent },
      },
      assetAnalysis: {
        logo: { hasLogo: !!logoData, logoUrl: body.logoUrl || "", elements: [], styleTags: [], meaning: logoPhilosophy },
        mascot: { hasMascot: !!mascotData, mascotUrl: body.mascotUrl || "", isThreeView: !!(mascotSplitViews?.length === 3), splitViews: mascotSplitViews || [], name: "", style: "", personality: "" },
      },
    });

    console.log("[generate-pptx] Blueprints:", blueprints.length, "pages");

    // ===== Step 6: 渲染 PPTX =====
    const buffer = await renderPptxToBuffer(blueprints, {
      projectName: projectId,
      companyName,
      industry,
      logoData,
      mascotData,
      mascotSplitViews,
      brandColors: realColors,
      brandVision,
      coreValues,
      targetMarket,
      logoPhilosophy,
      mascotPhilosophy,
      sceneImages,
    });

    // ===== Step 7: 保存文件 =====
    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });
    const fileName = `vi-manual-${projectId}-${Date.now()}.pptx`;
    await writeFile(path.join(outputDir, fileName), buffer);

    console.log("[generate-pptx] ===== DONE =====", fileName, `(${imgSuccess} images, ${blueprints.length} pages)`);

    return NextResponse.json({
      success: true,
      url: `/generated/${fileName}`,
      pageCount: blueprints.length,
      imageCount: imgSuccess,
      industryType,
      fileName,
    });
  } catch (error: any) {
    console.error("[generate-pptx] Error:", error);
    return NextResponse.json({ error: error.message || "PPTX generation failed" }, { status: 500 });
  }
}

// ========== Helper Functions ==========
async function loadImg(imagePath: string): Promise<string | null> {
  if (!imagePath) return null;
  const candidates = [
    path.join(process.cwd(), "public", imagePath.replace(/^\//, "")),
    path.join(process.cwd(), imagePath),
  ];
  for (const fp of candidates) {
    try {
      const buf = await readFile(fp);
      const ext = path.extname(fp).toLowerCase();
      const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : ext === ".svg" ? "image/svg+xml" : "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch { /* next */ }
  }
  if (imagePath.startsWith("http")) {
    try {
      const resp = await fetch(imagePath);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "image/png";
        return `data:${ct};base64,${buf.toString("base64")}`;
      }
    } catch { /* fail */ }
  }
  return null;
}

async function findAsset(projectId: string, type: "logo" | "mascot"): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), "public", "processed-assets", projectId);
    const files = await readdir(dir);
    const keywords = type === "logo" ? ["logo", "logo-processed"] : ["mascot", "ip", "character"];
    for (const file of files) {
      const lower = file.toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        const buf = await readFile(path.join(dir, file));
        const ext = path.extname(file).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".svg" ? "image/svg+xml" : "image/png";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  } catch { /* dir not found */ }
  return null;
}

async function findFromStorage(projectId: string, type: "logo" | "mascot"): Promise<string | null> {
  try {
    const prefix = `${projectId}/${type}`;
    const { data, error } = await supabaseAdmin.storage.from("processed-assets").list(prefix, { limit: 5 });
    if (error || !data || data.length === 0) return null;
    const file = data[0];
    const filePath = `${prefix}/${file.name}`;
    const { data: urlData } = supabaseAdmin.storage.from("processed-assets").getPublicUrl(filePath);
    if (urlData?.publicUrl) return await loadImg(urlData.publicUrl);
  } catch { /* storage not configured */ }
  return null;
}

async function findSplitViews(projectId: string): Promise<string[] | null> {
  try {
    const dir = path.join(process.cwd(), "public", "processed-assets", projectId);
    const files = await readdir(dir);
    const views: string[] = [];
    for (const suffix of ["-front", "-side", "-back"]) {
      for (const file of files) {
        if (file.toLowerCase().includes(`mascot${suffix}`) || file.toLowerCase().includes(`ip${suffix}`)) {
          const buf = await readFile(path.join(dir, file));
          const ext = path.extname(file).toLowerCase();
          const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
          views.push(`data:${mime};base64,${buf.toString("base64")}`);
          break;
        }
      }
    }
    return views.length === 3 ? views : null;
  } catch { return null; }
}
