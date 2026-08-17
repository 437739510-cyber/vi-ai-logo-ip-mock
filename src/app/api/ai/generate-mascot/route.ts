/**
 * API: POST /api/ai/generate-mascot
 *
 * Generate IP mascot images via local ComfyUI.
 *
 * Flow:
 * 1. Validates project wants mascot (wantMascot == "yes")
 * 2. Immediately sets mascotStatus = "mascot_generating" (sync return)
 * 3. Background generates 16+ images:
 *    - 3 views (front/side/back)
 *    - 8 emotions (微笑/欢迎/专注/惊喜/安心/开心/引导/俏皮)
 *    - N scenes based on mascotSceneCount (default 4, minimum 4)
 *    - 3-view composite sheet
 * 4. Uploads to processed-assets/{projectId}/ bucket
 * 5. Updates mascotStatus to "mascot_generated" or "mascot_failed"
 * 6. Preserves the existing usage summary structure
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { recommendMascot } from "@/agents/mascot-designer";
import type { MascotRecommendationInput } from "@/agents/mascot-designer";
import { generateMascotPromptSet, type MascotPromptInput } from "@/lib/ip/mascot-prompt-strategy";
import { MASCOT_SCENES_MIN } from "@/lib/vi-manual/mascot-assets";
// 本地 ComfyUI 优先（免费），与 LOGO 路由同源
import { comfyGenerateImage, isComfyUIAvailable } from "@/lib/ip/ip-image-provider/comfyui-provider";
import { checkLegacyWebGenerationGate } from "@/lib/core/legacy-web-generation-gate";

const _DEV = process.env.NODE_ENV === "development";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ========== Constants ==========

const MASCOT_BUCKET = "processed-assets";

const EMOTION_MAP: Record<string, { label: string; expression: string; pose: string }> = {
  smile: { label: "微笑", expression: "warm gentle smile, friendly expression", pose: "standing relaxed, hands together" },
  welcome: { label: "欢迎", expression: "welcoming friendly smile", pose: "open arms greeting gesture, welcoming pose" },
  focus: { label: "专注", expression: "focused attentive expression, gentle determined look", pose: "steady standing posture, attentive pose" },
  surprise: { label: "惊喜", expression: "surprised happy expression, eyes wide", pose: "hands to mouth, excited stance" },
  calm: { label: "安心", expression: "calm reassuring smile, peaceful expression", pose: "sitting comfortably, soothing posture" },
  joy: { label: "开心", expression: "big happy smile, joyful expression", pose: "jumping with joy, arms raised" },
  guide: { label: "引导", expression: "confident friendly smile", pose: "guiding gesture, one hand pointing forward" },
  playful: { label: "俏皮", expression: "playful cute expression, winking", pose: "cheerful casual pose, playful mood" },
};

const SCENE_MAP: Record<string, { label: string; context: string }> = {
  storefront: { label: "门店迎宾", context: "welcoming customers at the store entrance, storefront signage context" },
  packaging: { label: "包装应用", context: "applied on the brand product packaging, cup box or paper bag context" },
  membership: { label: "会员互动", context: "on membership card and interactive member terminal context" },
  social_media: { label: "社媒互动", context: "social media banner and avatar context, digital screen" },
  merchandise: { label: "周边商品", context: "on merchandise items, plush toys, stationery" },
  interior_decor: { label: "室内装饰", context: "in an interior decoration setting, wall art" },
};

const SCENE_NAMES = Object.keys(SCENE_MAP);
const EMOTION_NAMES = Object.keys(EMOTION_MAP);

// ========== Pure Helpers ==========

/** Download URL -> Buffer (supports both https and data: URLs) */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("data:")) {
      const comma = url.indexOf(",");
      const meta = url.slice(5, comma);
      const b64 = url.slice(comma + 1);
      return meta.includes(";base64")
        ? Buffer.from(b64, "base64")
        : Buffer.from(decodeURIComponent(b64), "utf-8");
    }
    const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    return resp.ok ? Buffer.from(await resp.arrayBuffer()) : null;
  } catch { return null; }
}

/** Upload Buffer to Supabase Storage: processed-assets/{projectId}/{name} */
async function uploadToStorage(projectId: string, name: string, buf: Buffer): Promise<string | null> {
  try {
    const fp = projectId + "/" + name;
    const { error } = await supabaseAdmin.storage.from(MASCOT_BUCKET).upload(fp, buf, { contentType: "image/png", upsert: true });
    if (error) { console.error("[mascot] Upload " + fp + ": " + error.message); return null; }
    return supabaseAdmin.storage.from(MASCOT_BUCKET).getPublicUrl(fp).data?.publicUrl || null;
  } catch { return null; }
}

/** Composite 3 views into one sheet via Sharp */
async function composeThreeView(front: Buffer, side: Buffer, back: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(front).metadata();
    const w = meta.width || 1024, h = meta.height || 1024;
    const [r1, r2, r3] = await Promise.all([
      sharp(front).resize(w, h, { fit: "inside" }).toBuffer(),
      sharp(side).resize(w, h, { fit: "inside" }).toBuffer(),
      sharp(back).resize(w, h, { fit: "inside" }).toBuffer(),
    ]);
    return sharp({ create: { width: w * 3, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: r1, top: 0, left: 0 }, { input: r2, top: 0, left: w }, { input: r3, top: 0, left: w * 2 }])
      .png().toBuffer();
  } catch (e) { console.error("[mascot] Sharp fail: " + (e as Error).message); return null; }
}

interface MascotLocalDeps {
  isLocalAvailable?: () => Promise<boolean>;
  generateLocal?: (options: { prompt: string; negativePrompt: string; width: number; height: number }) => Promise<{ imageUrl?: string | null }>;
  downloadLocalImage?: (url: string) => Promise<Buffer | null>;
  uploadLocalAsset?: (projectId: string, fileName: string, buffer: Buffer) => Promise<string | null>;
}

/** Generate one image through local ComfyUI only. */
async function genOne(
  projectId: string,
  fileName: string,
  prompt: string,
  negativePrompt: string,
  size?: string,
  deps: MascotLocalDeps = {},
):
  Promise<{ url: string | null; cost: number; model: string | null }> {
  const dim = (size || "1024x1024").split("x").map(Number);
  const w = dim[0] || 1024, h = dim[1] || 1024;
  const isLocalAvailable = deps.isLocalAvailable || isComfyUIAvailable;
  const generateLocal = deps.generateLocal || comfyGenerateImage;
  const downloadLocalImage = deps.downloadLocalImage || downloadImage;
  const uploadLocalAsset = deps.uploadLocalAsset || uploadToStorage;

  try {
    if (await isLocalAvailable()) {
      const c = await generateLocal({ prompt, negativePrompt: negativePrompt || "", width: w, height: h });
      if (c?.imageUrl) {
        const buf = await downloadLocalImage(c.imageUrl);
        if (buf) {
          const url = await uploadLocalAsset(projectId, fileName, buf);
          if (url) return { url, cost: 0, model: "comfyui-z-image-turbo" };
        }
      }
    }
  } catch {
    console.warn("[mascot] Local ComfyUI or local asset processing failed");
  }
  return { url: null, cost: 0, model: null };
}

// ========== Style suffix ==========

function styleSuffix(pref: string): string {
  switch (pref) {
    case "pixar_3d": return "Pixar-style 3D render, soft volumetric lighting, Disney-Pixar quality";
    case "flat_cute": return "flat illustration, cute vector design, clean lines, vibrant flat colors";
    case "chinese_trendy": return "Chinese trendy illustration, ink wash elements, traditional patterns";
    case "minimalist": return "minimalist design, clean shapes, simple elegant, modern vector illustration";
    case "tech_sleek": return "sleek sci-fi, smooth surfaces, neon accents, futuristic design";
    default: return "kawaii cute style, soft round shapes, big expressive eyes, adorable, high quality";
  }
}

// ========== Main Handler ==========

export async function POST(req: NextRequest) {
  const gate = await checkLegacyWebGenerationGate(req);
  if (!gate.allowed) return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  try {
    const body = await req.json();
    const projectId: string = body.projectId || "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("id, status, client_info").eq("id", projectId).single();
    if (projErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // 💰 收款门禁：未标记「已收款」一律拒绝生图（与 LOGO 的 mark-paid 触发逻辑一致）
    if (project.status !== "paid") {
      return NextResponse.json(
        { error: "请先标记「已收款」后再生成公仔", code: "PAYMENT_REQUIRED" },
        { status: 402 }
      );
    }

    const ci = (project.client_info as Record<string, any>) || {};
    if (ci.wantMascot !== "yes") return NextResponse.json({ error: 'wantMascot !== "yes"' }, { status: 400 });
    if (ci.mascotStatus === "mascot_generating")
      return NextResponse.json({ success: true, message: "公仔生成进行中", status: "mascot_generating" }, { status: 202 });

    // Set generating status immediately
    await supabaseAdmin.from("projects").update({
      client_info: { ...ci, mascotStatus: "mascot_generating", mascotProgress: { completed: 0, total: 0 } },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);


    // Await generation synchronously
    const genResult = await performGeneration(projectId, ci);

    return NextResponse.json({
      success: true,
      status: genResult.status,
      message: genResult.status === "mascot_generated" ? "公仔生成完成" : "公仔生成失败",
      projectId,
      mascotAssets: genResult.mascotAssets,
      mascotPartial: genResult.mascotPartial,
      mascotName: genResult.mascotName,
      mascotError: genResult.mascotError || undefined,
      summary: genResult.summary,
    }, { status: 200 });
  } catch (e: any) {
    console.error("[mascot] POST err:", e);
    return NextResponse.json({ error: e.message || "Mascot generation failed" }, { status: 500 });
  }
}

// ========== Background ==========

async function performGeneration(projectId: string, ci: Record<string, any>): Promise<{
  success: boolean;
  status: string;
  mascotAssets: any;
  mascotPartial: boolean;
  mascotName: string;
  mascotError?: string;
  summary: { completed: number; failed: number; total: number };
}> {
  try {
    const prefs = {
      mascotTypePref: ci.mascotTypePref, mascotStylePref: ci.mascotStylePref,
      mascotPersonalityPref: ci.mascotPersonalityPref, mascotUsageScenes: ci.mascotUsageScenes,
      mascotColorHint: ci.mascotColorHint, mascotRefIdea: ci.mascotRefIdea,
      mascotSceneCount: ci.mascotSceneCount || 6, wantMascot: ci.wantMascot,
    };

    const profile = recommendMascot({
      brandType: ci.brandType || "consumer",
      industryCategory: ci.industryCategory || "default",
      brandPersona: ci.brandPersona || [],
      brandArchetype: ci.brandArchetype || "",
      brandStage: ci.brandStage || "",
      hasMascot: false,
      businessGoal: ci.businessGoal || "",
      businessStage: ci.businessStage || "",
      clientPreferences: prefs,
    });

    const promptSet = generateMascotPromptSet({
      mascotProfile: profile,
      brandProfile: ci.brandProfile || {},
      clientPreferences: prefs,
      brandColors: { primary: ci.primaryColor || ci.brandColor?.[0], accent: ci.accentColor || ci.brandColor?.[1] },
    });

    const basePrompt = promptSet.imagePrompt || "";
    const negPrompt = promptSet.negativePrompt || "ugly, deformed, blurry, low quality, bad anatomy, extra limbs";

    if (!basePrompt) throw new Error("Empty base prompt");

    const sp = styleSuffix(((prefs.mascotStylePref || [])[0] || "").toLowerCase());
    // 工单 006G：平台交付至少需要 4 个真实应用场景，生成数量不能低于该阈值。
    const requestedSceneCount = Number(prefs.mascotSceneCount) || MASCOT_SCENES_MIN;
    const sceneN = Math.min(Math.max(requestedSceneCount, MASCOT_SCENES_MIN), SCENE_NAMES.length);
    const bgEnd = ". " + sp + ". Clean white or soft gradient background, full body, centered, no text, no watermark, 8k";
    const scEnd = ". " + sp + ". Commercial setting, brand context, professional composition, no text, no watermark";

    // Build job list
    const jobs: { fn: string; p: string }[] = [
      { fn: "mascot-front.png", p: basePrompt + ", front view, facing forward, looking at viewer" + bgEnd },
      { fn: "mascot-side.png", p: basePrompt + ", side view, profile, facing left, full body side angle" + bgEnd },
      { fn: "mascot-back.png", p: basePrompt + ", back view, from behind, showing back" + bgEnd },
    ];
    for (const k of EMOTION_NAMES) {
      const e = EMOTION_MAP[k];
      jobs.push({ fn: "mascot-emotion-" + k + ".png", p: basePrompt + ", " + e.expression + ", " + e.pose + ", front view, showing " + e.label + " emotion" + bgEnd });
    }
    for (let i = 0; i < sceneN; i++) {
      const k = SCENE_NAMES[i], s = SCENE_MAP[k];
      jobs.push({ fn: "mascot-scene-" + k + ".png", p: basePrompt + ", " + s.context + ", " + s.label + " application" + scEnd });
    }


    const total = jobs.length + 1; // +1 for composite
    let done = 0, fail = 0;
    const usage: any[] = [];
    const results: { url: string | null; fn: string }[] = [];

    // Concurrent pool (max 4 parallel genOne calls)
    async function runConcurrentPool<T extends { fn: string }>(
      items: T[],
      worker: (item: T) => Promise<{ url: string | null; cost: number; model: string | null }>,
      concurrency: number = 4
    ): Promise<{ url: string | null; cost: number; model: string | null }[]> {
      const poolResults: { url: string | null; cost: number; model: string | null }[] = [];
      let index = 0;
      async function enqueue(): Promise<void> {
        while (index < items.length) {
          const i = index++;
          poolResults[i] = await worker(items[i]);
        }
      }
      const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => enqueue());
      await Promise.all(workers);
      return poolResults;
    }

    const poolResults = await runConcurrentPool(jobs, (j) => genOne(projectId, j.fn, j.p, negPrompt), 4);
    poolResults.forEach((r, idx) => {
      results[idx] = { fn: jobs[idx].fn, ...r };
      if (r?.url) { done++; if (r.model) usage.push({ model: r.model, type: "mascot", cost: r.cost, timestamp: new Date().toISOString() }); }
      else fail++;
    });

    // Single progress update after batch complete
    await supabaseAdmin.from("projects").update({
      client_info: { ...ci, mascotStatus: "mascot_generating", mascotProgress: { completed: done, total } },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    // Composite
    const front = results.find(r => r.fn === "mascot-front.png");
    const side = results.find(r => r.fn === "mascot-side.png");
    const back = results.find(r => r.fn === "mascot-back.png");
    let threeView: string | null = null;
    if (front?.url && side?.url && back?.url) {
      try {
        const [fb, sb, bb] = await Promise.all([downloadImage(front.url), downloadImage(side.url), downloadImage(back.url)]);
        if (fb && sb && bb) {
          const cb = await composeThreeView(fb, sb, bb);
          if (cb) { threeView = await uploadToStorage(projectId, "mascot_3view_sheet.png", cb); if (threeView) done++; else fail++; }
        }
      } catch { /* composite fail */ }
    }

    const threeViewsOk = front?.url != null && side?.url != null && back?.url != null;
    const emotionOkCount = results.filter((r: { fn: string; url: string | null }) => r.fn.startsWith('mascot-emotion-') && r.url).length;
    const sceneOkCount = results.filter((r: { fn: string; url: string | null }) => r.fn.startsWith('mascot-scene-') && r.url).length;
    const isPartial = threeViewsOk && (emotionOkCount < EMOTION_NAMES.length || sceneOkCount < sceneN);
    const mascotStatus = threeViewsOk ? "mascot_generated" : "mascot_failed";
    const mascotError = threeViewsOk ? undefined : "三视图生成失败";

    const emotionName = (fn: string): string =>
      EMOTION_MAP[fn.replace("mascot-emotion-", "").replace(".png", "")]?.label ||
      fn.replace("mascot-emotion-", "").replace(".png", "");
    const sceneName = (fn: string): string =>
      SCENE_MAP[fn.replace("mascot-scene-", "").replace(".png", "")]?.label ||
      fn.replace("mascot-scene-", "").replace(".png", "");
    const assets = {
      front: front?.url || null, side: side?.url || null, back: back?.url || null, threeView,
      emotions: results.filter(r => r.fn.startsWith('mascot-emotion-') && r.url).map(r => ({ name: emotionName(r.fn), url: r.url })),
      scenes: results.filter(r => r.fn.startsWith('mascot-scene-') && r.url).map(r => ({ name: sceneName(r.fn), url: r.url })),
    };

    const fin = { ...ci }; delete fin.mascotProgress;
    await supabaseAdmin.from("projects").update({
      client_info: { ...fin, mascotStatus, mascotError, mascotAssets: assets, mascotPartial: isPartial, mascotName: profile.suggestedName || "品牌公仔", arkUsageLog: [...(fin.arkUsageLog || []), ...usage] },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    _DEV && console.log('[mascot] Done ' + projectId + ': ' + done + '/' + total + ' views=' + threeViewsOk + ' partial=' + isPartial);

    return {
      success: threeViewsOk,
      status: mascotStatus,
      mascotAssets: assets,
      mascotPartial: isPartial,
      mascotName: profile.suggestedName || "品牌公仔",
      mascotError,
      summary: { completed: done, failed: fail, total },
    };
  } catch (e: any) {
    console.error("[mascot] FATAL " + projectId + ": " + e.message);
    try { await supabaseAdmin.from("projects").update({ client_info: { ...ci, mascotStatus: "mascot_failed", mascotError: "异常: " + (e.message || "unknown") }, updated_at: new Date().toISOString() }).eq("id", projectId); } catch {}
    return { success: false, status: "mascot_failed", mascotAssets: null, mascotPartial: false, mascotName: "brand_mascot", mascotError: e.message || "unknown", summary: { completed: 0, failed: 0, total: 0 } };
  }
}
