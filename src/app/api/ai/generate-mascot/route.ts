/**
 * API: POST /api/ai/generate-mascot
 *
 * Generate IP mascot images via ark-seedream cloud provider.
 *
 * Flow:
 * 1. Validates project wants mascot (wantMascot == "yes")
 * 2. Immediately sets mascotStatus = "mascot_generating" (sync return)
 * 3. Background generates 16+ images:
 *    - 3 views (front/side/back)
 *    - 6 emotions (happy/smile/shy/relaxed/surprised/healing)
 *    - N scenes based on mascotSceneCount (default 6)
 *    - 3-view composite sheet
 * 4. Uploads to processed-assets/{projectId}/ bucket
 * 5. Updates mascotStatus to "mascot_generated" or "mascot_failed"
 * 6. Tracks cost via arkUsageLog
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { recommendMascot } from "@/agents/mascot-designer";
import type { MascotRecommendationInput } from "@/agents/mascot-designer";
import { generateMascotPromptSet, type MascotPromptInput } from "@/lib/ip/mascot-prompt-strategy";
import { estimateArkCost } from "@/lib/ip/ip-image-provider/ark-seedream-provider";
import { LiblibAIProvider } from "@/lib/ip/ip-image-provider/liblibai-provider";

const _DEV = process.env.NODE_ENV === "development";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ========== Constants ==========

const ARK_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const TIMEOUT_MS = 60_000;
const MASCOT_BUCKET = "processed-assets";

const ARK_MODELS = [
  "doubao-seedream-4-0-250828",
  "doubao-seedream-4-5-251128",
  "doubao-seedream-5-0-260128",
];

const EMOTION_MAP: Record<string, { label: string; expression: string; pose: string }> = {
  happy: { label: "开心", expression: "big happy smile, joyful expression", pose: "jumping with joy, arms raised" },
  smile: { label: "微笑", expression: "warm gentle smile, friendly expression", pose: "standing relaxed, hands together" },
  shy: { label: "害羞", expression: "shy smile, blushing slightly", pose: "hands behind back, head tilted" },
  relaxed: { label: "放松", expression: "calm relaxed smile, peaceful expression", pose: "sitting comfortably, casual posture" },
  surprised: { label: "惊喜", expression: "surprised happy expression, eyes wide", pose: "hands to mouth, excited stance" },
  healing: { label: "治愈", expression: "warm comforting smile, gentle expression", pose: "arms open for hug, soothing posture" },
};

const SCENE_MAP: Record<string, { label: string; context: string }> = {
  storefront: { label: "门店招牌", context: "in front of a store signage, outdoor street scene" },
  packaging: { label: "产品包装", context: "on product packaging box, retail shelf context" },
  membership: { label: "会员卡", context: "on a membership card design, professional background" },
  social_media: { label: "社交媒体", context: "social media banner background, digital screen" },
  merchandise: { label: "周边商品", context: "on merchandise items, plush toys, stationery" },
  interior_decor: { label: "室内装饰", context: "in an interior decoration setting, wall art" },
};

const SCENE_NAMES = Object.keys(SCENE_MAP);
const EMOTION_NAMES = Object.keys(EMOTION_MAP);

// ========== Pure Helpers ==========

/** Call ARK API directly — explicit ark-seedream, never comfyui */
async function arkGenerate(opts: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string } | null> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) { console.error("[mascot] ARK_API_KEY missing"); return null; }

  const size = opts.size || "1024x1024";
  for (const model of ARK_MODELS) {
    try {
      const payload: Record<string, unknown> = {
        model, prompt: opts.prompt,
        sequential_image_generation: "disabled",
        response_format: "url", size, watermark: false,
      };
      if (opts.negativePrompt) payload.negative_prompt = opts.negativePrompt;

      const start = Date.now();
      const resp = await fetch(ARK_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const dur = Date.now() - start;
      if (!resp.ok) { console.warn("[mascot] " + model + " HTTP " + resp.status); continue; }
      const data: any = await resp.json();
      if (data.error) { console.warn("[mascot] " + model + " err: " + data.error.message); continue; }
      const url: string = data?.data?.[0]?.url || "";
      if (!url) continue;
      _DEV && console.log("[mascot] " + model + " in " + dur + "ms");
      return { imageUrl: url, durationMs: dur, model };
    } catch (e: any) { console.warn("[mascot] " + model + " threw: " + e.message); }
  }
  return null;
}

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

// LiblibAI free-tier client (singleton, serial by design). Returns null on any failure so caller falls back to ark.
let _liblibai: LiblibAIProvider | null = null;
async function generateViaLiblibAI(
  prompt: string,
  negativePrompt: string,
  size?: string
): Promise<{ imageUrl: string } | null> {
  try {
    if (!process.env.LIBLIBAI_ACCESS_KEY) return null;
    if (!_liblibai) _liblibai = new LiblibAIProvider();
    const dim = (size || "1024x1024").split("x").map(Number);
    const w = dim[0] || 1024, h = dim[1] || 1024;
    const res = await _liblibai.generateImage({
      brandContext: { brandName: "", industry: "", brandPositioning: "", brandPersona: [], visualDirection: "" },
      ipProfile: { type: "mascot", personality: [], visualTraits: [], colorDirection: [] },
      step: { stepId: "mascot", label: "mascot", description: "" },
      prompt,
      negativePrompt: negativePrompt || "",
      output: { width: w, height: h, format: "png" },
    });
    return { imageUrl: res.imageUrl };
  } catch (e: any) {
    console.warn("[mascot] LiblibAI failed, fallback ark: " + (e?.message || "unknown"));
    return null;
  }
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

/** Generate one image: LiblibAI (free) -> download -> upload; fallback to ark if LiblibAI unavailable/fails */
async function genOne(projectId: string, fileName: string, prompt: string, negativePrompt: string, size?: string):
  Promise<{ url: string | null; cost: number; model: string | null }> {
  for (let i = 0; i < 2; i++) {
    // 1) LiblibAI free tier (preferred)
    const li = await generateViaLiblibAI(prompt, negativePrompt, size);
    if (li?.imageUrl) {
      const buf = await downloadImage(li.imageUrl);
      if (buf) {
        const url = await uploadToStorage(projectId, fileName, buf);
        if (url) return { url, cost: 0, model: "liblibai-star3-alpha" };
      }
    }
    // 2) Ark paid fallback
    const r = await arkGenerate({ prompt, negativePrompt, size });
    if (!r) continue;
    const buf = await downloadImage(r.imageUrl);
    if (!buf) continue;
    const url = await uploadToStorage(projectId, fileName, buf);
    if (url) { return { url, cost: estimateArkCost(r.model, 1), model: r.model }; }
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
  try {
    const body = await req.json();
    const projectId: string = body.projectId || "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("id, client_info").eq("id", projectId).single();
    if (projErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const ci = (project.client_info as Record<string, any>) || {};
    if (ci.wantMascot !== "yes") return NextResponse.json({ error: 'wantMascot !== "yes"' }, { status: 400 });
    if (ci.mascotStatus === "mascot_generating")
      return NextResponse.json({ success: true, message: "公仔生成进行中", status: "mascot_generating" }, { status: 202 });

    // Set generating status immediately
    await supabaseAdmin.from("projects").update({
      client_info: { ...ci, mascotStatus: "mascot_generating", mascotProgress: { completed: 0, total: 0 } },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    // Fire background
    performGeneration(projectId, ci);

    return NextResponse.json({ success: true, message: "公仔生成已启动", status: "mascot_generating", projectId }, { status: 202 });
  } catch (e: any) {
    console.error("[mascot] POST err:", e);
    return NextResponse.json({ error: e.message || "Mascot generation failed" }, { status: 500 });
  }
}

// ========== Background ==========

async function performGeneration(projectId: string, ci: Record<string, any>) {
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
    const sceneN = Math.min(prefs.mascotSceneCount || 6, SCENE_NAMES.length);
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

    for (const j of jobs) {
      const r = await genOne(projectId, j.fn, j.p, negPrompt);
      results.push({ url: r.url, fn: j.fn });
      if (r.url) { done++; if (r.model) usage.push({ model: r.model, type: "mascot", cost: r.cost, timestamp: new Date().toISOString() }); }
      else fail++;
      await supabaseAdmin.from("projects").update({
        client_info: { ...ci, mascotStatus: "mascot_generating", mascotProgress: { completed: done, total } },
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
    }

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

    const allViewsOk = front?.url != null && side?.url != null && back?.url != null;
    const assets = {
      front: front?.url || null, side: side?.url || null, back: back?.url || null, threeView,
      emotions: results.filter(r => r.fn.startsWith("mascot-emotion-") && r.url).map(r => ({ name: r.fn.replace("mascot-emotion-", "").replace(".png", ""), url: r.url })),
      scenes: results.filter(r => r.fn.startsWith("mascot-scene-") && r.url).map(r => ({ name: r.fn.replace("mascot-scene-", "").replace(".png", ""), url: r.url })),
    };

    const fin = { ...ci }; delete fin.mascotProgress;
    await supabaseAdmin.from("projects").update({
      client_info: { ...fin, mascotStatus: allViewsOk ? "mascot_generated" : "mascot_failed", mascotError: allViewsOk ? undefined : "三视图生成失败", mascotAssets: assets, mascotName: profile.suggestedName || "品牌公仔", arkUsageLog: [...(fin.arkUsageLog || []), ...usage] },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    _DEV && console.log("[mascot] Done " + projectId + ": " + done + "/" + total + " views=" + allViewsOk);
  } catch (e: any) {
    console.error("[mascot] FATAL " + projectId + ": " + e.message);
    try { await supabaseAdmin.from("projects").update({ client_info: { ...ci, mascotStatus: "mascot_failed", mascotError: "异常: " + (e.message || "unknown") }, updated_at: new Date().toISOString() }).eq("id", projectId); } catch {}
  }
}