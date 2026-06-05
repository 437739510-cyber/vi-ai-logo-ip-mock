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
  // V11: 行业细分匹配
  // 1. 饮品/茶饮 - 单独匹配（包含饮品、茶饮、奶茶、咖啡等）
  if (/饮品|茶饮|奶茶|咖啡|果汁|椰|椰子|椰汁|酒|酒吧|气泡|矿泉|纯净水/.test(s)) return "beverage";
  // 2. 餐厅/正餐 - 匹配餐厅、面馆、炒菜等
  if (/餐厅|正餐|面馆|饭馆|炒菜|海鲜|川菜|粤菜|湘菜|鲁菜|饭店/.test(s)) return "restaurant";
  // 3. 火锅/小吃 - 用restaurant配置（热闹风格物料）
  if (/火锅|串串|烧烤|烘焙|饺子|包子|小吃/.test(s)) return "restaurant";
  // 4. 通用餐饮匹配兜底
  if (/餐饮|餐|食|面|馆|外卖/.test(s)) return "restaurant";
  // 5. 美容/美发
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫/.test(s)) return "beauty";
  // 6. 零售/电商
  if (/零售|超市|便利|商店|杂货|服装|鞋|饰品|母婴|数码/.test(s)) return "retail";
  // 7. 教育/培训
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
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a restaurant napkin sleeve and chopstick cover set, placed on a wooden table, clean minimalist design, studio lighting, top-down angle" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a food delivery paper bag standing on a surface, minimalist design, clean studio background, side angle view" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a takeout food container box with lid, placed on clean surface, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional standee poster display in a restaurant, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a restaurant menu card on a dining table, clean minimal design, studio lighting" },
  ],
  beverage: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of branded office stationery set: business cards, envelopes, letterheads with company logo printed, arranged on wooden desk, studio lighting, angled view, product fully visible" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded paper tote bag with company logo printed on it, standing upright, studio lighting, product fully visible" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beverage bottle with branded label and company logo, on clean surface, studio lighting, product fully visible" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a promotional poster display for a beverage brand in store, with company branding visible, studio setting, product fully visible" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a branded membership card with company logo design, clean studio background, product fully visible" },
  ],
  beauty: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of beauty product bottles and packaging set, elegant minimalist design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded gift bag with ribbon handles, elegant design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a beauty product jar with label, clean design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a beauty salon promotional poster, elegant and luxurious style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a VIP membership card with elegant design, clean background" },
  ],
  retail: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded shopping bag with handles, standing on surface, minimalist design, studio lighting" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a retail promotional poster display, modern clean style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a retail price tag with hanging string, clean studio background" },
  ],
  education: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a school ID badge and lanyard, clean design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag for education, brand color design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a course material folder, brand color accent, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of an education enrollment promotional poster, inspiring style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a campus event banner stand, brand color design, studio lighting" },
  ],
  general: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a business card mockup, clean minimalist design, studio lighting, angled view" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded tote bag, standing upright, minimalist design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a product packaging box, clean elegant design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a corporate promotional poster, modern professional style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a company ID badge, brand color accent, studio lighting" },
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

async function generateSceneImage(prompt: string, logoBase64?: string): Promise<string | null> {
  const apiKey = process.env.ALIYUN_API_KEY;
  if (!apiKey) {
    console.error("[generateImage] No ALIYUN_API_KEY");
    return null;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // V9: 支持Logo参考图 - wan2.6-image图像编辑模式
      const useRefImage = !!logoBase64;
      const model = useRefImage ? "wan2.6-image" : "wan2.6-t2i";
      let imgContent: Array<{ text?: string; image?: string }>;
      if (useRefImage) {
        imgContent = [{ text: prompt }, { image: logoBase64! }];
      } else {
        imgContent = [{ text: prompt }];
      }
      const requestParams = useRefImage
        ? { size: "960*1280", n: 1, enable_interleave: false, prompt_extend: true }
        : { size: "1024*1536", n: 1 };
      // Step 1: 提交异步任务
      const submitResp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model,
          input: { messages: [{ role: "user", content: imgContent }] },
          parameters: requestParams,
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

    // ===== Step 2.5: AI 品牌分析 =====
    let brandProfile: any = null;
    let effectiveBrandVision = brandVision;
    let effectiveCoreValues = coreValues;
    let effectiveTargetMarket = targetMarket;
    let dynamicScenePrompts: Array<{zh: string; en: string}> | null = null;

    try {
      // 调用品牌分析引擎（内部调用，不走HTTP）
      const { planLayoutEngine } = await import("@/lib/plan-layout-engine");
      
      // 直接调用brand-analysis核心逻辑
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (apiKey && (companyName !== "品牌")) {
        const analysisPrompt = buildBrandAnalysisPrompt({
          companyName, industry, brandVision, coreValues, targetMarket,
          logoPhilosophy, mascotPhilosophy,
          province: body.clientInfo?.province || submission?.province,
          city: body.clientInfo?.city || submission?.city,
          description: body.clientInfo?.description || submission?.description,
          brandColors: realColors,
        });

        const analysisResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
              { role: "user", content: analysisPrompt },
            ],
            temperature: 0.7,
            max_tokens: 4096,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (analysisResp.ok) {
          const analysisData = await analysisResp.json();
          const analysisContent = analysisData.choices?.[0]?.message?.content || "{}";
          try {
            const cleaned = analysisContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            brandProfile = JSON.parse(cleaned);
            console.log("[generate-pptx] Brand analysis OK:", brandProfile.brandToneKeywords);

            // 用AI分析结果增强客户信息（客户写了的保留，没写的AI补）
            if (brandProfile.refinedBrandVision) effectiveBrandVision = brandProfile.refinedBrandVision;
            if (brandProfile.refinedCoreValues) effectiveCoreValues = brandProfile.refinedCoreValues;
            if (brandProfile.refinedTargetMarket) effectiveTargetMarket = brandProfile.refinedTargetMarket;

            // V10: 保存logoDesignSuggestions到brandProfile
            if (brandProfile.logoDesignSuggestions) {
              console.log("[generate-pptx] Logo design suggestions available:", brandProfile.logoDesignSuggestions.style);
            }

            // 用AI建议的场景图prompt
            if (brandProfile.sceneImageSuggestions?.length >= 5) {
              dynamicScenePrompts = brandProfile.sceneImageSuggestions;
              console.log("[generate-pptx] Using dynamic scene prompts from AI analysis");
            }

            // 保存品牌档案到 projects.client_info（保留selectedLogo和logoGenerationResults）
            const { data: projInfo } = await supabaseAdmin
              .from("projects").select("client_info").eq("id", projectId).single();
            const existingInfo = (projInfo?.client_info as Record<string, any>) || {};
            const existingBP = (existingInfo.brandProfile as Record<string, any>) || {};
            await supabaseAdmin.from("projects").update({
              client_info: {
                ...existingInfo,
                brandProfile: {
                  ...brandProfile,
                  analyzedAt: new Date().toISOString(),
                  // V10: 保留Logo选择和生成结果
                  selectedLogo: existingBP.selectedLogo || null,
                  logoGenerationResults: existingBP.logoGenerationResults || null,
                  logoGeneratedAt: existingBP.logoGeneratedAt || null,
                }
              },
              updated_at: new Date().toISOString(),
            }).eq("id", projectId);
          } catch (parseErr) {
            console.warn("[generate-pptx] Brand analysis parse failed:", parseErr);
          }
        } else {
          console.warn("[generate-pptx] Brand analysis API failed:", analysisResp.status);
        }
      }
    } catch (analysisErr) {
      console.warn("[generate-pptx] Brand analysis error:", analysisErr);
    }

    // ===== Step 3: 加载 Logo/Mascot =====
    let logoData: string | null = null;
    let mascotData: string | null = null;
    let mascotSplitViews: string[] | null = null;

    if (body.logoUrl) logoData = await loadImg(body.logoUrl);
    if (!logoData) logoData = await findAsset(projectId, "logo");
    if (!logoData) logoData = await findFromStorage(projectId, "logo");
    // V10: Try loading AI-generated logo from project.client_info (set by select-logo API)
    if (!logoData) {
      try {
        const { data: projForLogo } = await supabaseAdmin
          .from("projects").select("client_info").eq("id", projectId).single();
        const savedProfile = (projForLogo?.client_info as Record<string, any>)?.brandProfile;
        if (savedProfile?.selectedLogo?.imageUrl) {
          console.log("[generate-pptx] Trying AI-generated logo from select-logo");
          logoData = await loadImg(savedProfile.selectedLogo.imageUrl);
        }
      } catch (e) {
        console.warn("[generate-pptx] Could not load AI-generated logo:", e);
      }
    }

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
    // 动态场景图prompt（AI分析结果 > 硬编码fallback）
    let imgDefs = SCENE_IMG_DEFS[industryType] || SCENE_IMG_DEFS.general;
    if (dynamicScenePrompts && dynamicScenePrompts.length >= 5) {
      // V9: 用AI分析生成的行业定制prompt，动态标签替代硬编码
      const promptPages = ["stationery", "packaging", "packaging", "marketing", "marketing"];
      imgDefs = dynamicScenePrompts.map((suggestion: any, i: number) => ({
        key: `${promptPages[i]}-${i === 0 ? 1 : i <= 2 ? i : i - 2}`,
        page: promptPages[i],
        rawPrompt: suggestion.en + ", with brand logo visible on product, professional product photography, studio lighting, product fully visible",
        label: suggestion.zh || "",  // V9: 保存中文标签用于渲染
      }));
    }

    console.log("[generate-pptx] ===== AI IMAGE GENERATION =====");
    console.log("[generate-pptx] Industry:", industryType, "| Images:", imgDefs.length, "| Dynamic:", !!dynamicScenePrompts);

    // V7c: Serial image generation - avoid 429 rate limiting
    const sceneImages: Record<string, string> = {};
    const sceneLabels: Record<string, string> = {};  // V9: AI动态标签
    let imgSuccess = 0;
    for (let i = 0; i < imgDefs.length; i++) {
      const def = imgDefs[i];
      try {
        const imgData = await generateSceneImage(def.rawPrompt, logoData || undefined);
        if (imgData) {
          sceneImages[def.key] = imgData;
          if ((def as any).label) sceneLabels[def.key] = (def as any).label;  // V9
          imgSuccess++;
        }
      } catch (err) {
        console.error(`[generateImage] Failed (${def.key}):`, err);
      }
      if (i < imgDefs.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.log(`[generate-pptx] Images: ${imgSuccess}/${imgDefs.length} success`);

    // ===== Step 5: 生成蓝图 =====
    const blueprints = await planPages({
      clientInfo: { companyName, brandVision: effectiveBrandVision, coreValues: effectiveCoreValues, targetMarket: effectiveTargetMarket, logoPhilosophy, mascotPhilosophy, industry },
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
      brandVision: effectiveBrandVision,
      coreValues: effectiveCoreValues,
      targetMarket: effectiveTargetMarket,
      logoPhilosophy,
      mascotPhilosophy,
      sceneImages,
      sceneLabels,
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


// ========== AI 品牌分析 Prompt ==========

const BRAND_ANALYSIS_SYSTEM_PROMPT = `你是一位资深的品牌战略分析师，精通中国本土市场的品牌定位与VI策略。

你的任务是：根据客户提供的品牌基础信息，进行深度分析，输出品牌档案。

## 分析框架
1. 行业洞察：市场趋势、痛点与机会
2. 地理环境：所在地的商业环境与资源优势
3. 竞品格局：主要竞品及其定位
4. 品牌定位：差异化定位方向、品牌调性关键词
5. 文案补全：客户没写的AI代写，已写的润色保留原意
6. 视觉方向：推荐视觉风格 + 5个写实场景图描述（中英文对照）
7. Logo设计建议：为没有Logo的客户提供4个不同方向的Logo设计方案

## 输出格式（严格JSON，不要markdown包裹）
{
  "industryInsight": "行业洞察，2-3句话",
  "geoEnvironment": "地理环境分析，2-3句话",
  "competitiveLandscape": "竞品格局，2-3句话",
  "brandPositioning": "品牌定位建议，2-3句话",
  "refinedBrandVision": "AI提炼/补充的品牌愿景",
  "refinedCoreValues": "AI提炼/补充的核心价值，逗号分隔",
  "refinedTargetMarket": "AI细化/补充的目标市场",
  "brandToneKeywords": ["关键词1", "关键词2", "关键词3"],
  "visualStyleSuggestion": "视觉风格建议",
  "sceneImageSuggestions": [
    {"zh": "名片", "en": "Professional product photography of branded business cards with company logo printed on them, arranged on wooden desk, studio lighting, angled view"},
    {"zh": "手提袋", "en": "Professional product photography of a branded paper tote bag with company logo printed on front, standing upright, studio lighting"},
    {"zh": "产品瓶装", "en": "Professional product photography of a branded beverage bottle with company logo label, on clean surface, studio lighting, product fully visible"},
    {"zh": "促销海报", "en": "Professional product photography of a branded promotional poster standee in store, with company branding visible, studio setting"},
    {"zh": "会员卡", "en": "Professional product photography of a branded VIP membership card with company logo, clean studio background"}
  ],
  "logoDesignSuggestions": {
    "concept": "Logo设计核心概念，1-2句话",
    "style": "设计风格（如：传统书法、现代简约、国潮、手绘等）",
    "elements": "建议包含的设计元素（图形、符号、字体风格）",
    "colorGuidance": "配色建议，需与品牌色协调",
    "prompts": [
      "英文prompt1：用于AI生图的详细描述，需包含设计风格、核心图形元素、配色方案、布局方式",
      "英文prompt2：同一概念的风格变体",
      "英文prompt3：不同方向的变体",
      "英文prompt4：另一个创意方向"
    ]
  },
  "aiGeneratedFields": {
    "brandVision": "客户没写则AI代写，已写则留空",
    "coreValues": "客户没写则AI代写，已写则留空",
    "targetMarket": "客户没写则AI代写，已写则留空"
  }
}`;

function buildBrandAnalysisPrompt(info: {
  companyName: string; industry: string;
  brandVision?: string; coreValues?: string; targetMarket?: string;
  logoPhilosophy?: string; mascotPhilosophy?: string;
  province?: string; city?: string; description?: string;
  brandColors?: { primary: string; secondary: string; accent: string };
}): string {
  const parts: string[] = [];
  parts.push("## 客户品牌基础信息");
  parts.push("");
  parts.push("公司名称：" + (info.companyName || "未提供"));
  parts.push("所属行业：" + (info.industry || "未提供"));
  if (info.province || info.city) {
    parts.push("所在地：" + (info.province || "") + (info.city || ""));
  }
  parts.push("");
  parts.push("### 客户已填写的品牌信息（有则保留润色，无则AI代写）：");
  parts.push("品牌愿景：" + (info.brandVision || "（客户未填写，请AI代写）"));
  parts.push("核心价值：" + (info.coreValues || "（客户未填写，请AI代写）"));
  parts.push("目标市场：" + (info.targetMarket || "（客户未填写，请AI代写）"));
  if (info.logoPhilosophy) parts.push("LOGO设计理念：" + info.logoPhilosophy);
  if (info.mascotPhilosophy) parts.push("IP公仔设计理念：" + info.mascotPhilosophy);
  if (info.brandColors) parts.push("品牌色：" + info.brandColors.primary + " / " + info.brandColors.secondary + " / " + info.brandColors.accent);
  if (info.description) parts.push("补充描述：" + info.description);
  parts.push("");
  parts.push("请基于以上信息进行深度品牌分析。");
  parts.push("");
  parts.push("重要：sceneImageSuggestions必须根据具体行业和品牌定制。每个场景的zh字段是该图的中文标签（如\u2018名片\u2019、\u2018手提袋\u2019、\u2018产品瓶装\u2019），en字段是英文生图prompt。prompt必须明确描述产品上印有品牌标识(company logo printed/branded label)。zh标签必须和en prompt描述的产品完全一致——如果prompt画的是手提袋，zh就必须是\u2018手提袋\u2019，不能写其他内容。");
  parts.push("");
  parts.push("重要：logoDesignSuggestions是为没有Logo的客户设计的。请根据品牌名称、行业特征、地域文化特色，设计4个不同方向的Logo方案。每个prompt需要是完整的英文AI生图指令，详细描述设计风格、核心图形元素、配色方案、排版布局。Logo需要简洁、辨识度高、适合各种尺寸应用（名片、招牌、包装等）。");
  return parts.join("\n");
}
