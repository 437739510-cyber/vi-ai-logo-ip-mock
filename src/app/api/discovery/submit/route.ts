/**
 * Discovery Submit API
 *
 * 将品牌访谈完成后的数据写入 Supabase，打通 Discovery → 主干流程的断点
 * V83: 修复数据丢失 — 保存3张照片到Storage、补全storeHistory/familyStory等字段
 * POST /api/discovery/submit
 *
 * 输入：{ sessionId, briefData, selectedPlan }
 * 输出：{ projectId, viewPassword, plan }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { getSession } from "@/lib/core/discovery/session-store";

/** base64 → Supabase Storage上传，返回公开URL */
async function uploadPhoto(base64Data: string, projectId: string, filename: string): Promise<string | null> {
  try {
    const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return null;
    const mime = matches[1];
    const ext = mime.split('/')[1] || 'png';
    const buf = Buffer.from(matches[2], 'base64');
    const path = `${projectId}/discovery/${filename}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from('manuals').upload(path, buf, {
      contentType: mime, upsert: true,
    });
    if (upErr) { console.warn('[DISCOVERY/SUBMIT] Photo upload error:', upErr.message); return null; }
    const { data } = supabaseAdmin.storage.from('manuals').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e: any) {
    console.warn('[DISCOVERY/SUBMIT] Photo upload failed:', e.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, briefData } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // 获取会话数据
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.isComplete) {
      return NextResponse.json({ error: "Discovery not complete" }, { status: 400 });
    }

    const extractedData = session.extractedData;
    const brief = briefData || {};

    // 生成 ID
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const projectId = `VI-${dateStr}-${rand}`;
    const submissionId = `SBM-${dateStr}-${String(Date.now()).slice(-4)}`;
    const isoNow = now.toISOString();

    // 从访谈数据提取结构化字段
    const companyName = extractedData.founder
      ? `${extractedData.founder}的店`
      : "品牌名称待确认";
    const industry = brief.brand_analysis?.industry || "传统商业";
    const brandVision = brief.brand_story?.core_value || extractedData.brandSpirit || "";
    const coreValues = brief.brand_story?.brand_spirit || extractedData.brandSpiritCustom || "";
    const yearsInBusiness = extractedData.yearsInBusiness || null;

    // 套餐：优先使用用户选择，否则根据AI推荐
    const selectedPlan = body.selectedPlan || "basic";
    const recommendedPlan = ["basic","standard"].includes(selectedPlan) ? selectedPlan : "basic";

    // 查看密码：4位相同数字，方便客人记忆
    const digit = String(Math.floor(Math.random() * 10));
    const viewPassword = digit.repeat(4);

    // V83: 上传3张照片到Supabase Storage
    const discoveryPhotos: Record<string, string> = {};
    const photoUploads: Promise<void>[] = [];
    const photoFields: [string, string][] = [
      ['signatureItemPhoto', 'signature-item'],
      ['signboardPhoto', 'signboard'],
      ['storefrontPhoto', 'storefront'],
    ];
    for (const [field, filename] of photoFields) {
      const b64 = (extractedData as any)[field];
      if (b64 && typeof b64 === 'string' && b64.startsWith('data:image')) {
        photoUploads.push(
          uploadPhoto(b64, projectId, filename).then(url => { if (url) discoveryPhotos[field] = url; })
        );
      }
    }
    await Promise.all(photoUploads);

    // 构建 brandProfile：将 briefData 映射为 brand-analysis 的输出格式
    const brandProfile = {
      industryInsight: brief.brand_analysis?.brandPositioning || "",
      geoEnvironment: "",
      competitiveLandscape: "",
      brandPositioning: brief.brand_analysis?.brandPositioning || "",
      refinedBrandVision: brandVision,
      refinedCoreValues: coreValues,
      refinedTargetMarket: brief.brand_analysis?.targetAudience || "",
      brandToneKeywords: brief.brand_analysis?.brandPersona
        ? brief.brand_analysis.brandPersona.split(/[、,，]/).map((s: string) => s.trim()).filter(Boolean)
        : [],
      visualStyleSuggestion: brief.brand_analysis?.visualDirection || brief.visual_dna?.style || "",
      sceneImageSuggestions: [],
      logoDesignSuggestions: {
        style: brief.visual_dna?.style || "",
        colors: brief.visual_dna?.colors || [],
        elements: brief.visual_dna?.elements || [],
        ipStrategy: brief.ip_strategy || null,
      },
      aiGeneratedFields: {
        source: "discovery",
        sessionId,
        generatedAt: isoNow,
      },
      analyzedAt: isoNow,
    };

    // 写入 Supabase submissions
    try {
      const supabaseSub = {
        id: submissionId,
        client_name: extractedData.founder || "",
        company_name: companyName,
        brand_vision: brandVision,
        core_values: coreValues,
        target_market: brief.brand_analysis?.targetAudience || "",
        logo_philosophy: "",
        mascot_philosophy: "",
        phone: "",
        wechat: "",
        email: "",
        industry: industry,
        industry_custom: "",
        business_years: yearsInBusiness,
        brand_highlight: extractedData.proudMoment || "",
        customer_profile: extractedData.customerReasons?.join("、") || "",
        existing_brand_color: brief.visual_dna?.colors?.join(", ") || "",
        budget_range: recommendedPlan === "standard" ? "99" : "49",
        province: "",
        city: "",
        description: [
          `品牌精神：${extractedData.brandSpirit || extractedData.brandSpiritCustom || ""}`,
          `感人故事：${extractedData.touchingStory || extractedData.customerQuote || ""}`,
          `标志性物件：${extractedData.signatureItem || ""}`,
          `风格偏好：${extractedData.selectedStyle || ""}`,
          // V83: 补全之前丢失的字段
          extractedData.storeHistory ? `店铺历史：${extractedData.storeHistory}` : "",
          extractedData.familyStory ? `家族传承：${extractedData.familyStory}` : "",
        ].filter((s) => s && !s.endsWith("：")).join("\n"),
        logo_assets: [],
        mascot_assets: [],
        submitted_at: isoNow,
      };
      const { error: subErr } = await supabaseAdmin.from("submissions").insert(supabaseSub);
      if (subErr) console.warn("[DISCOVERY/SUBMIT] Supabase submission error:", subErr.message);
    } catch (e) {
      console.warn("[DISCOVERY/SUBMIT] Supabase submission skipped:", e);
    }

    // 写入 Supabase projects，含 brandProfile + V83完整数据
    try {
      const supabaseProj = {
        id: projectId,
        submission_id: submissionId,
        status: "submitted",
        client_name: extractedData.founder || companyName,
        industry: industry,
        client_info: {
          viewPassword,
          brandProfile,
          discoveryBrief: brief,
          mainProducts: "",
          businessForm: "",
          // V83: 保存完整的discovery数据，不再丢失
          discoveryData: {
            founder: extractedData.founder || "",
            yearsInBusiness: extractedData.yearsInBusiness || null,
            isOldStore: extractedData.isOldStore || false,
            storeHistory: extractedData.storeHistory || "",
            familyStory: extractedData.familyStory || "",
            customerReasons: extractedData.customerReasons || [],
            proudMoment: extractedData.proudMoment || "",
            touchingStory: extractedData.touchingStory || "",
            customerQuote: extractedData.customerQuote || "",
            brandSpirit: extractedData.brandSpirit || "",
            brandSpiritCustom: extractedData.brandSpiritCustom || "",
            signatureItem: extractedData.signatureItem || "",
            selectedStyle: extractedData.selectedStyle || "",
            styleNotes: extractedData.styleNotes || "",
            discoveryPhotos,  // 照片URL
          },
        },
        created_at: isoNow,
        updated_at: isoNow,
      };
      const { error: projErr } = await supabaseAdmin.from("projects").insert(supabaseProj);
      if (projErr) console.warn("[DISCOVERY/SUBMIT] Supabase project error:", projErr.message);
    } catch (e) {
      console.warn("[DISCOVERY/SUBMIT] Supabase project skipped:", e);
    }

    console.log(`[DISCOVERY/SUBMIT] Created project ${projectId} from discovery session ${sessionId}, photos: ${Object.keys(discoveryPhotos).join(',')}`);

    return NextResponse.json({
      success: true,
      projectId,
      viewPassword,
      plan: recommendedPlan,
    });
  } catch (error) {
    console.error("[DISCOVERY/SUBMIT] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submit failed" },
      { status: 500 }
    );
  }
}
