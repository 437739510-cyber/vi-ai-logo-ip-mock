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
export type IndustryType = "restaurant" | "fastfood" | "beverage" | "beauty" | "fashion" | "mother_baby" | "wedding" | "fitness" | "pharmacy" | "pet" | "retail" | "education" | "general";

export function getIndustryType(industry?: string): IndustryType {
  if (!industry) return "general";
  const s = industry.toLowerCase();
  
  // V14: 优先匹配二级格式（一级:二级）
  if (s.includes(":")) {
    const [cat, sub] = s.split(":");
    // 美食
    if (cat === "美食") {
      if (/小吃快餐|速食/.test(sub)) return "fastfood";
      return "restaurant";
    }
    if (cat === "饮品") return "beverage";
    if (cat === "丽人") return "beauty";
    if (cat === "购物") {
      if (/服装|鞋帽/.test(sub)) return "fashion";
      if (/母婴|儿童/.test(sub)) return "mother_baby";
      return "retail";
    }
    if (cat === "生活服务") {
      if (/婚庆|摄影/.test(sub)) return "wedding";
      if (/宠物/.test(sub)) return "pet";
      return "general";
    }
    if (cat === "运动健身") return "fitness";
    if (cat === "教育培训") return "education";
    if (cat === "医疗保健") return "pharmacy";
    if (cat === "汽车服务") return "retail";
    if (cat === "公司企业") return "general";
    return "general";
  }
  
  // V14: 兼容旧版一级格式
  // 1. 美容/美发（在零售之前拦截）
  if (/美容|美发|理发|美甲|spa|沙龙|造型|护肤|美体|美睫|剪发|烫发/.test(s)) return "beauty";
  // 2. 婚庆/摄影
  if (/婚|婚庆|婚纱|摄影|影楼|照相|写真|跟拍|司仪/.test(s)) return "wedding";
  // 3. 药店/诊所（含养生馆、中医馆）
  if (/药|诊所|中医|牙科|骨科|推拿|针灸|理疗|药房|大药房|养生/.test(s)) return "pharmacy";
  // 4. 宠物
  if (/宠物|猫咖|狗咖|水族/.test(s)) return "pet";
  // 5. 健身/运动
  if (/健身|瑜伽|武术|搏击|游泳|运动|跆拳道|舞蹈|普拉提/.test(s)) return "fitness";
  // 6. 母婴/儿童
  if (/母婴|儿童|婴儿|奶粉|早教|月子|孕妇|宝宝/.test(s)) return "mother_baby";
  // 7. 服装/鞋帽
  if (/服装|鞋|帽|服饰|女装|男装|内衣|皮具|箱包|裁缝|西装|潮牌/.test(s)) return "fashion";
  // 8. 饮品/茶饮
  if (/饮品|茶饮|奶茶|咖啡|果汁|椰|椰子|椰汁|酒|酒吧|气泡|矿泉|纯净水/.test(s)) return "beverage";
  // 9. 小吃快餐（V14新增，区别于正餐）
  if (/小吃快餐|速食|快餐|汉堡|炸鸡|盒饭|盖浇/.test(s)) return "fastfood";
  // 10. 餐厅/正餐
  if (/餐厅|正餐|面馆|饭馆|炒菜|海鲜|川菜|粤菜|湘菜|鲁菜|饭店/.test(s)) return "restaurant";
  // 11. 火锅/烧烤
  if (/火锅|串串|烧烤|烘焙|饺子|包子|小吃/.test(s)) return "restaurant";
  // 12. 通用餐饮匹配兜底
  if (/餐饮|餐|食|面|外卖/.test(s)) return "restaurant";
  // 13. 零售/电商
  if (/零售|超市|便利|商店|杂货|数码/.test(s)) return "retail";
  // 14. 教育/培训
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
  fastfood: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a fast food restaurant apron and staff uniform with branded logo, clean studio background, bright lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a branded fast food paper bag with logo, hamburger box and drink cup on counter, studio lighting, eye-level angle" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a branded hamburger wrapper and fries container on clean surface, fast food packaging design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fast food storefront sign light box with brand logo, illuminated at night, eye-catching design" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a promotional standee poster for a fast food brand, vibrant colors, studio setting" },
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
  fashion: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a fashion brand clothing tag and label, luxury minimalist design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a luxury fashion shopping bag, elegant design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a fashion gift box with ribbon, premium look, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fashion new collection poster, modern chic style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a fashion window display card, elegant typography, studio lighting" },
  ],
  mother_baby: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a baby product label and membership card, warm pastel colors, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a baby gift box set, soft pastel packaging, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a mother-baby brand tote bag, cute design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a baby store promotional poster, warm inviting style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a baby event display stand, pastel theme, studio lighting" },
  ],
  wedding: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a wedding invitation card, elegant gold foil design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a wedding favor candy box, romantic design, clean studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a wedding gift bag, elegant floral design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a wedding planning poster, romantic elegant style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a wedding venue display stand, luxurious design, studio lighting" },
  ],
  fitness: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a gym membership card and branded towel, modern sporty design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a sports water bottle with brand logo, energetic design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a gym duffel bag with brand identity, modern athletic style, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a fitness promotion poster, dynamic energetic style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a fitness class schedule card, modern design, studio lighting" },
  ],
  pharmacy: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a pharmacy prescription bag and medicine box label, clean professional design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a health supplement gift box, professional medical branding, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a pharmacy branded tote bag, clean trustworthy design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a health awareness poster, professional medical style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a pharmacy loyalty card, clean modern design, studio lighting" },
  ],
  pet: [
    { key: "stationery-1", page: "stationery", rawPrompt: "Professional product photography of a pet tag and membership card, fun colorful design, studio lighting" },
    { key: "packaging-1", page: "packaging", rawPrompt: "Professional product photography of a pet food bag with brand identity, premium design, studio background" },
    { key: "packaging-2", page: "packaging", rawPrompt: "Professional product photography of a pet gift box, cute playful design, studio lighting" },
    { key: "marketing-1", page: "marketing", rawPrompt: "Professional product photography of a pet store promotional poster, fun vibrant style, studio setting" },
    { key: "marketing-2", page: "marketing", rawPrompt: "Professional product photography of a pet event display stand, playful design, studio lighting" },
  ],
};

// ========== 行业默认色 ==========
const INDUSTRY_DEFAULTS: Record<string, { primary: string; secondary: string; accent: string }> = {
  restaurant:  { primary: "#2E7D32", secondary: "#E65100", accent: "#F9A825" },
  fastfood:    { primary: "#D32F2F", secondary: "#F9A825", accent: "#FFFFFF" },
  beverage:    { primary: "#00695C", secondary: "#D84315", accent: "#FFB300" },
  beauty:      { primary: "#E8576C", secondary: "#9B72CF", accent: "#F0D5A8" },
  fashion:     { primary: "#1A1A2E", secondary: "#C9A96E", accent: "#E8D5B7" },
  mother_baby: { primary: "#E8836B", secondary: "#5B9EA6", accent: "#F5C6AA" },
  wedding:     { primary: "#8B6F4E", secondary: "#D4A574", accent: "#F5E6D3" },
  fitness:     { primary: "#D32F2F", secondary: "#1B5E20", accent: "#FFC107" },
  pharmacy:    { primary: "#1565C0", secondary: "#2E7D32", accent: "#BBDEFB" },
  pet:         { primary: "#FF8F00", secondary: "#5D4037", accent: "#FFE082" },
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

  const maxRetries = 2;
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
        ? { size: "768*1024", n: 1, enable_interleave: false, prompt_extend: true }
        : { size: "768*1024", n: 1 };
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
      for (let poll = 0; poll < 12; poll++) {
        await new Promise(r => setTimeout(r, 8000)); // 等8秒

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


// V17: 通义万相AI生图Logo（替代DeepSeek SVG方案）
async function generateLogoImage(
  prompt: string,
  brandColors: { primary: string; secondary: string }
): Promise<string | null> {
  const apiKey = process.env.ALIYUN_API_KEY;
  if (!apiKey) {
    console.error("[generateLogo] No ALIYUN_API_KEY");
    return null;
  }

  // 增强prompt：确保Logo设计品质
  const enhancedPrompt = `${prompt}, logo design on clean white background, high resolution, professional graphic design, centered composition, suitable for branding applications, clean and scalable`;

  const maxRetries = 1;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Logo用正方形1024x1024
      const submitResp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: "wan2.6-t2i",
          input: { messages: [{ role: "user", content: [{ text: enhancedPrompt }] }] },
          parameters: { size: "1024*1024", n: 1 },
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        console.error(`[generateLogo] Submit attempt ${attempt}: ${submitResp.status} ${errText.substring(0, 200)}`);
        continue;
      }

      const submitData = await submitResp.json();
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        console.error(`[generateLogo] No task_id:`, JSON.stringify(submitData).substring(0, 200));
        continue;
      }

      console.log(`[generateLogo] Task submitted: ${taskId}`);

      // 轮询结果（最多等90秒）
      for (let poll = 0; poll < 12; poll++) {
        await new Promise(r => setTimeout(r, 8000));

        const pollResp = await fetch(`${DASHSCOPE_TASK}/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!pollResp.ok) continue;
        const pollData = await pollResp.json();
        const status = pollData.output?.task_status;

        if (status === "SUCCEEDED") {
          const imageUrl = pollData.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imageUrl) {
            console.error(`[generateLogo] No image URL in result`);
            break;
          }

          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const imgBuf = Buffer.from(await imgResp.arrayBuffer());
            const base64 = imgBuf.toString("base64");
            console.log(`[generateLogo] OK! base64 length=${base64.length}`);
            return `data:image/png;base64,${base64}`;
          }
          console.error(`[generateLogo] Failed to download image`);
          break;
        }

        if (status === "FAILED") {
          console.error(`[generateLogo] Task failed:`, pollData.output?.message || "unknown");
          break;
        }
      }
    } catch (err: any) {
      console.error(`[generateLogo] Attempt ${attempt} error:`, err.message);
    }
  }
  return null;
}

// ========== 流式进度推送辅助函数 ==========
function createStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  
  const stream = new ReadableStream({
    start(c) { controller = c; },
    cancel() { /* cleanup */ },
  });

  function sendEvent(type: string, data: any) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}

`));
    } catch { /* stream closed */ }
  }

  function sendProgress(step: string, message: string, percent?: number) {
    sendEvent("progress", { step, message, percent });
  }

  function sendComplete(data: any) {
    sendEvent("complete", { success: true, ...data });
    try { controller.close(); } catch { /* already closed */ }
  }

  function sendError(message: string) {
    sendEvent("error", { message });
    try { controller.close(); } catch { /* already closed */ }
  }

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });

  return { response, sendProgress, sendComplete, sendError };
}


// ========== DB-based progress helpers (for background async tasks) ==========
function createDbProgressHelpers(projectId: string) {
  async function updateDb(status: string, message: string, percent?: number, extra?: Record<string, any>) {
    try {
      const { data: existingInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
      const prev = (existingInfo?.client_info as Record<string, any>) || {};
      await supabaseAdmin.from("projects").update({
        client_info: { ...prev, generationStatus: status, generationMessage: message, generationPercent: percent ?? prev.generationPercent, ...(extra || {}) },
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
    } catch (e: any) {
      console.warn("[generate-pptx] DB status update error:", e.message);
    }
  }

  return {
    sendProgress: async (step: string, message: string, percent?: number) => {
      await updateDb(step === "done" ? "completed" : "pptx_assembling", message, percent);
    },
    sendComplete: async (data: any) => {
      await updateDb("completed", "生成完成！", 100, {
        pptxResult: { url: data.url, storageUrl: data.storageUrl, pageCount: data.pageCount, imageCount: data.imageCount, fileName: data.fileName },
      });
      await supabaseAdmin.from("projects").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", projectId);
    },
    sendError: async (message: string) => {
      await updateDb("failed", message);
      await supabaseAdmin.from("projects").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", projectId);
    },
  };
}

// ========== 主流程（异步后台） ==========
export async function POST(req: NextRequest) {
  // Parse request body first
  let projectId: string | null = null;
  let body: any = {};
  try {
    body = await req.json();
    projectId = body.projectId || null;
  } catch { /* ignore parse error */ }

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Set initial status in DB immediately
  try {
    const { data: existingInfo } = await supabaseAdmin.from("projects").select("client_info").eq("id", projectId).single();
    const prev = (existingInfo?.client_info as Record<string, any>) || {};
    await supabaseAdmin.from("projects").update({
      status: "pptx_assembling",
      updated_at: new Date().toISOString(),
      client_info: { ...prev, generationStatus: "pptx_assembling", generationMessage: "正在准备生成VI手册...", generationPercent: 0 },
    }).eq("id", projectId);
  } catch (e: any) {
    console.warn("[generate-pptx] Initial status update error:", e.message);
  }

  // Run generation in background (fire-and-forget)
  void (async () => {
    const { sendProgress, sendComplete, sendError } = createDbProgressHelpers(projectId!);
  try {
    sendProgress("loading", "正在加载项目数据...", 5);
    // ===== Step 1: 从 Supabase 查 project + submission =====
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_name, industry")
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

    sendProgress("extracting", "正在提取品牌数据...", 10);
    // ===== Step 2: 提取所有数据 =====
    const companyName = body.clientInfo?.companyName || body.clientInfo?.clientName || submission?.company_name || submission?.companyName || project?.client_name || "品牌";
    const industry = body.clientInfo?.industry || submission?.industry || project?.industry || "";
    const brandVision = body.clientInfo?.brandVision || submission?.brand_vision || submission?.brandVision || "";
    const coreValues = body.clientInfo?.coreValues || submission?.core_values || submission?.coreValues || "";
    const targetMarket = body.clientInfo?.targetMarket || submission?.target_market || submission?.targetMarket || "";
    const logoPhilosophy = body.clientInfo?.logoPhilosophy || submission?.logo_philosophy || submission?.logoPhilosophy || "";
    const mascotPhilosophy = body.clientInfo?.mascotPhilosophy || submission?.mascot_philosophy || submission?.mascotPhilosophy || "";

    const rawColors = body.brandColors || submission?.existing_brand_color || submission?.brand_colors || submission?.brandColors;
    const realColors = normalizeColors(rawColors, industry);

    const industryType = getIndustryType(industry);
    console.log("[generate-pptx] ===== BRAND DATA =====");
    console.log("[generate-pptx] Company:", companyName, "| Industry:", industry, "| Type:", industryType);
    console.log("[generate-pptx] Colors:", JSON.stringify(realColors));

    sendProgress("analyzing", "正在进行AI品牌分析...", 15);
    // ===== Step 2.5: AI 品牌分析 =====
    // V12: 更新项目状态
    await supabaseAdmin.from("projects").update({ status: "brand_analyzing", updated_at: new Date().toISOString() }).eq("id", projectId);
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
          signal: AbortSignal.timeout(15000),
        });

        if (analysisResp.ok) {
          const analysisData = await analysisResp.json();
          const analysisContent = analysisData.choices?.[0]?.message?.content || "{}";
          try {
            const cleaned = analysisContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            brandProfile = JSON.parse(cleaned);
            console.log("[generate-pptx] Brand analysis OK:", brandProfile.brandToneKeywords);
            sendProgress("analyzed", "品牌分析完成", 30);

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

    sendProgress("loading_assets", "正在加载品牌素材...", 40);
    // ===== Step 3: 加载 Logo/Mascot =====
    // V12: 场景图渲染中
    await supabaseAdmin.from("projects").update({ status: "scene_rendering", updated_at: new Date().toISOString() }).eq("id", projectId);
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


    // V18.1: 先5张场景图并行(DashScope并发=5刚好上限)，再串行出Logo
    // 修复V11的6并发超限导致3/5场景图丢失；V18两阶段超时300s改回并行+串行Logo
    let aiLogoData: string | null = null;
    const sceneImages: Record<string, string> = {};
    const sceneLabels: Record<string, string> = {};  // V9: AI动态标签
    let imgSuccess = 0;

    // Prepare Logo prompt (instant, just string construction)
    let logoPrompt = "";
    if (!logoData && companyName !== "品牌") {
      const industryLabel: Record<string, string> = {
        beauty: "beauty salon / nail art", restaurant: "Chinese restaurant / noodle shop", fastfood: "fast food burger shop / snack stall", beverage: "bubble tea / coffee shop",
        fashion: "fashion boutique / clothing brand", mother_baby: "maternity & baby brand", wedding: "wedding planning / photography studio",
        fitness: "gym / fitness center", pharmacy: "pharmacy / wellness", pet: "pet care / pet shop",
        retail: "retail shop", education: "education center", general: "lifestyle brand"
      };
      const industryEn = industryLabel[industryType] || "lifestyle brand";
      if (brandProfile?.logoDesignSuggestions?.prompts?.length > 0) {
        logoPrompt = brandProfile.logoDesignSuggestions.prompts[0];
        console.log("[generate-pptx] Using brand-analysis logo prompt:", logoPrompt.substring(0, 80));
      } else {
        logoPrompt = `Professional minimalist logo icon design for "${companyName}", a ${industryEn}. ` +
          `Target audience: ${targetMarket || "urban professionals"}. ` +
          `Color palette: primary ${realColors.primary}, secondary ${realColors.secondary}. ` +
          `Design style: elegant, refined, modern luxury, clean lines, symmetrical composition. ` +
          `The icon should be a single cohesive abstract symbol that suggests the brand identity, ` +
          `using flowing curves or geometric shapes, NOT literal objects. ` +
          `Reference the design philosophy of brands like Chanel, Dior, Tiffany - iconic, timeless, instantly recognizable.`;
      }
    }

    // Prepare Scene image defs (instant)
    let imgDefs = SCENE_IMG_DEFS[industryType] || SCENE_IMG_DEFS.general;
    if (dynamicScenePrompts && dynamicScenePrompts.length >= 5) {
      const promptPages = ["stationery", "packaging", "packaging", "marketing", "marketing"];
      imgDefs = dynamicScenePrompts.map((suggestion: any, i: number) => ({
        key: `${promptPages[i]}-${i === 0 ? 1 : i <= 2 ? i : i - 2}`,
        page: promptPages[i],
        rawPrompt: suggestion.en + ", with brand logo visible on product, professional product photography, studio lighting, product fully visible",
        label: suggestion.zh || "",  // V9: 保存中文标签用于渲染
      }));
    }

    // ===== V18.1 Phase 1: 5张场景图并行（5并发=DashScope上限） =====
    const sceneRefImage = mascotData || logoData || undefined;
    sendProgress("images", "正在生成场景图(5张)...", 50);
    console.log("[generate-pptx] ===== Phase 1: Scene images (5 parallel, refImage:", !!sceneRefImage, ") =====");

    const sceneTasks = imgDefs.map(async (def) => {
      const imgData = await generateSceneImage(def.rawPrompt, sceneRefImage);
      return { type: "scene" as const, def, imgData };
    });

    const sceneResults = await Promise.allSettled(sceneTasks);
    for (const result of sceneResults) {
      if (result.status === "fulfilled" && result.value) {
        const val = result.value;
        if (val.type === "scene" && val.imgData) {
          sceneImages[val.def.key] = val.imgData;
          if ((val.def as any).label) sceneLabels[val.def.key] = (val.def as any).label;
          imgSuccess++;
        }
      } else if (result.status === "rejected") {
        console.error("[generateScene] Failed:", result.reason);
      }
    }

    // ===== V18.1 Phase 2: 场景图完成后串行出Logo（避免并发冲突） =====
    if (logoPrompt) {
      sendProgress("images", "正在生成Logo方案...", 55);
      console.log("[generate-pptx] ===== Phase 2: Logo generation =====");
      try {
        aiLogoData = await generateLogoImage(logoPrompt, realColors);
        if (aiLogoData) {
          console.log("[generate-pptx] AI logo OK! base64 length:", aiLogoData.length);
        } else {
          console.warn("[generate-pptx] AI logo generation failed, will use fallback icon");
        }
      } catch (logoErr: any) {
        console.warn("[generate-pptx] AI logo error:", logoErr?.message);
      }
    }

    // V18.1: 失败的场景图用纯文生图重试一次（无参考图模式，更稳定）
    const failedDefs = imgDefs.filter((def: any) => !sceneImages[def.key]);
    if (failedDefs.length > 0) {
      console.log(`[generate-pptx] Retrying ${failedDefs.length} failed scene images without reference...`);
      for (const def of failedDefs) {
        try {
          const imgData = await generateSceneImage(def.rawPrompt, undefined);
          if (imgData) {
            sceneImages[def.key] = imgData;
            if ((def as any).label) sceneLabels[def.key] = (def as any).label;
            imgSuccess++;
            console.log(`[generate-pptx] Retry OK: ${def.key}`);
          }
        } catch (retryErr) {
          console.warn(`[generate-pptx] Retry failed: ${def.key}`, retryErr);
        }
      }
    }

    console.log(`[generate-pptx] Images: ${imgSuccess}/${imgDefs.length} success (sceneImages keys: [${Object.keys(sceneImages).join(",")}])`);

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
    // V12: PPTX组装中
    await supabaseAdmin.from("projects").update({ status: "pptx_assembling", updated_at: new Date().toISOString() }).eq("id", projectId);
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
      aiLogoData: aiLogoData || undefined,
    });

    sendProgress("saving", "正在保存文件...", 90);
    // ===== Step 7: 保存文件 =====
    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });
    const fileName = `vi-manual-${projectId}-${Date.now()}.pptx`;
    await writeFile(path.join(outputDir, fileName), buffer);

    // ===== Step 7.5: 上传到Supabase Storage存档 =====
    let storageUrl: string | null = null;
    try {
      const storagePath = `${projectId}/${fileName}`;
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("manuals")
        .upload(storagePath, buffer, {
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          upsert: true,
        });
      if (uploadErr) {
        console.warn("[generate-pptx] Storage upload failed:", uploadErr.message);
      } else {
        const { data: urlData } = supabaseAdmin.storage.from("manuals").getPublicUrl(storagePath);
        storageUrl = urlData?.publicUrl || null;
        console.log("[generate-pptx] Storage upload OK:", storageUrl);
      }
    } catch (storageErr: any) {
      console.warn("[generate-pptx] Storage upload error:", storageErr?.message);
    }

    console.log("[generate-pptx] ===== DONE =====", fileName, `(${imgSuccess} images, ${blueprints.length} pages)`);
    // V12: 更新项目状态为"完成"
    await supabaseAdmin.from("projects").update({
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    sendProgress("done", "生成完成！", 100);
    sendComplete({
      url: `/api/ai/download-pptx/${fileName}`,
      storageUrl,
      pageCount: blueprints.length,
      imageCount: imgSuccess,
      industryType,
      fileName,
    });
  } catch (error: any) {
    console.error("[generate-pptx] Error:", error);
    sendError(error.message || "PPTX generation failed");
  }
  })();  // end background task

  // Return immediately with 202 Accepted
  return NextResponse.json({
    success: true,
    projectId,
    message: "VI手册生成已启动，请轮询项目状态",
  }, { status: 202 });
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
