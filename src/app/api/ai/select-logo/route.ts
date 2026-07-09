/**
 * API: POST /api/ai/select-logo
 *
 * V13 Logo选择模块 — 支持人工选择和AI智能选优
 *
 * 优化：
 * - projects查询从2次合并为1次（提前获取submission_id+client_info）
 * - 两个Storage桶上传并行化
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { guardedDeepSeekCall, DEEPSEEK_MODEL } from '@/lib/core/billing/deepseek-guard';
import { STORAGE_BUCKET } from "@/config/storage";
const _DEV = process.env.NODE_ENV === "development";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
interface LogoCandidate {
  index: number;
  imageUrl: string;
  prompt?: string;
}
async function aiScoreLogos(
  logos: LogoCandidate[],
  companyName: string,
  industry: string
): Promise<{ bestIndex: number; scores: number[]; reasoning: string }> {
  const prompt = `你是一位品牌设计评审专家。请对以下${logos.length}个Logo方案进行评分。
品牌名称：${companyName}
行业：${industry}
请从三个维度对每个Logo评分（1-10分）：
1. 品牌契合度：Logo是否准确传达品牌名称的意境和行业特征
2. 视觉辨识度：Logo是否简洁有力、容易记住、放大缩小都清晰
3. 行业适配性：Logo是否适合该行业的应用场景（招牌、包装、名片等）
Logo方案：${logos.map((l, i) => `\n方案${i + 1}：设计提示词 - ${l.prompt || "无"}`).join("")}
请严格按以下JSON格式回复，不要有其他内容：
{"scores":[分数1,分数2,...],"best":最佳方案序号(从1开始),"reasoning":"简短说明选择理由(50字以内)"}`;
  const resp = await guardedDeepSeekCall({
      route: "ai/select-logo",
      body: {model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,},
      timeoutMs: 30000,
    });
  if (!resp.ok) {
    throw new Error(`DeepSeek API error: ${resp.status}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  // 解析JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse DeepSeek response");
  }
  const result = JSON.parse(jsonMatch[0]);
  return {
    bestIndex: (result.best || 1) - 1,
    scores: result.scores || [],
    reasoning: result.reasoning || "",
  };
}
function extractLibStyleTags(prompt: string): string[] {
  const tags: string[] = [];
  const kw: Record<string, string[]> = {
    "极简": ["minimalist","minimal","simple","极简","简约","简洁"],
    "国风": ["chinese","国风","传统","中式","古风","东方"],
    "现代": ["modern","现代","时尚","潮流"],
    "可爱": ["cute","可爱","卡通","萌","kawaii"],
    "高端": ["luxury","高端","奢华","premium","elegant","优雅"],
    "活力": ["energetic","活力","动感","运动","dynamic"],
    "自然": ["nature","自然","生态","organic","green"],
    "科技": ["tech","科技","数字","digital","cyber"],
    "复古": ["vintage","复古","怀旧","retro"],
    "卡通吉祥物": ["cartoon","卡通","mascot","吉祥物"],
  };
  const lower = prompt.toLowerCase();
  for (const [tag, words] of Object.entries(kw)) {
    if (words.some(w => lower.includes(w))) tags.push(tag);
  }
  return tags.length > 0 ? tags : ["通用"];
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, logoImageUrl, logoIndex, autoSelect, companyName, industry } = body;
    let selectedLogoUrl = logoImageUrl;
    let selectedIndex = logoIndex ?? 0;
    let selectionMethod = "manual";
    let scores: number[] = [];
    let reasoning = "";
    // 前置查询：一次性获取project数据（原2次查询合并为1次）
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_info")
      .eq("id", projectId)
      .single();
    const clientInfo = (project?.client_info as Record<string, any>) || {};
    const brandProfile = (clientInfo.brandProfile || {}) as Record<string, any>;
    const submissionId = project?.submission_id;
    // === AI智能选优模式 ===
    if (autoSelect) {
      _DEV && console.log("[select-logo] Auto-select mode activated");
      const brandProfileLocal = clientInfo.brandProfile || {};  // used locally in autoSelect
      const logoResults = brandProfileLocal.logoGenerationResults || [];
      const candidates: LogoCandidate[] = logoResults
        .filter((r: any) => r.imageUrl)
        .map((r: any) => ({ index: r.index, imageUrl: r.imageUrl, prompt: r.prompt }));
      if (candidates.length === 0) {
        return NextResponse.json({ error: "No logo candidates found for auto-selection" }, { status: 400 });
      }
      const name = companyName || clientInfo.companyName || "品牌";
      const ind = industry || clientInfo.industry || "通用";
      if (candidates.length > 1) {
        try {
          const result = await aiScoreLogos(candidates, name, ind);
          selectedIndex = result.bestIndex;
          scores = result.scores;
          reasoning = result.reasoning;
          selectionMethod = "ai-scored";
          _DEV && console.log(`[select-logo] AI scores: ${scores.join(",")} → best=#${selectedIndex + 1} (${reasoning})`);
        } catch (err: any) {
          console.warn("[select-logo] AI scoring failed, fallback to first:", err.message);
          selectedIndex = 0;
          selectionMethod = "ai-fallback-first";
        }
      } else {
        selectedIndex = 0;
        selectionMethod = "ai-fallback-first";
      }
      selectedLogoUrl = candidates[selectedIndex]?.imageUrl;
      if (!selectedLogoUrl) {
        return NextResponse.json({ error: "Selected logo URL not found" }, { status: 400 });
      }
    }
    if (!projectId || !selectedLogoUrl) {
      return NextResponse.json({ error: "projectId and logoImageUrl required" }, { status: 400 });
    }
    // Step 1: 下载Logo图片
    _DEV && console.log(`[select-logo] Downloading logo from: ${selectedLogoUrl.substring(0, 80)}...`);
    const imgResp = await fetch(selectedLogoUrl);
    if (!imgResp.ok) {
      return NextResponse.json({ error: "Failed to download logo image" }, { status: 400 });
    }
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const imgSize = imgBuffer.length;
    _DEV && console.log(`[select-logo] Downloaded: ${imgSize} bytes`);
    // Step 2: 并行上传到两个Storage桶
    const timestamp = Date.now();
    const logoFileName = `logo-${timestamp}.png`;
    const formAssetsPath = `${projectId}/${logoFileName}`;
    const processedPath = `${projectId}/logo-${timestamp}.png`;
    const [uploadRes1, uploadRes2] = await Promise.allSettled([
      supabaseAdmin.storage
        .from("form-assets")
        .upload(formAssetsPath, imgBuffer, { contentType: "image/png", upsert: true }),
      supabaseAdmin.storage
        .from("processed-assets")
        .upload(processedPath, imgBuffer, { contentType: "image/png", upsert: true }),
    ]);
    if (uploadRes1.status === "fulfilled" && !uploadRes1.value.error) {
      _DEV && console.log("[select-logo] Uploaded to form-assets:", formAssetsPath);
    } else {
      console.warn("[select-logo] form-assets upload failed:", uploadRes1.status === "fulfilled" ? uploadRes1.value.error?.message : "rejected");
    }
    if (uploadRes2.status === "fulfilled" && !uploadRes2.value.error) {
      _DEV && console.log("[select-logo] Uploaded to processed-assets:", processedPath);
    } else {
      console.warn("[select-logo] processed-assets upload failed:", uploadRes2.status === "fulfilled" ? uploadRes2.value.error?.message : "rejected");
    }
    // Step 3: 更新 submissions.logo_assets
    if (submissionId) {
      const formAssetsUrl = supabaseAdmin.storage.from("form-assets").getPublicUrl(formAssetsPath).data.publicUrl;
      const logoAssetEntry = { fileName: logoFileName, url: formAssetsUrl, size: imgSize, source: "ai-generated" };
      const { data: sub } = await supabaseAdmin
        .from("submissions")
        .select("logo_assets")
        .eq("id", submissionId)
        .single();
      const existingAssets = (sub?.logo_assets as any[]) || [];
      const updatedAssets = [...existingAssets, logoAssetEntry];
      const { error: subErr } = await supabaseAdmin
        .from("submissions")
        .update({ logo_assets: updatedAssets })
        .eq("id", submissionId);
      if (subErr) {
        console.warn("[select-logo] Submission update failed:", subErr.message);
      } else {
        _DEV && console.log("[select-logo] Updated submission logo_assets");
      }
    }
    // Step 4: 更新 project.client_info
    const updatedInfo = {
      ...clientInfo,
      brandProfile: {
        ...(clientInfo.brandProfile || {}),
        selectedLogo: {
          imageUrl: selectedLogoUrl,
          index: selectedIndex,
          selectedAt: new Date().toISOString(),
          storagePath: processedPath,
          selectionMethod,
          ...(scores.length > 0 ? { aiScores: scores, aiReasoning: reasoning } : {}),
        },
      },
        generationStatus: "pending_manual",
    };
    await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, status: "manual_pending", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    _DEV && console.log("[select-logo] Done! Logo saved and linked to project.");
    // === Auto-collect unselected logos to library ===
    (async () => {
      try {
        const unselectedLogos = (brandProfile.logoGenerationResults || [])
          .filter((l: any) => l.index !== selectedIndex && l.imageUrl);
        if (unselectedLogos.length > 0) {
          const { data: existingLib } = await supabaseAdmin
            .from("logo_library").select("project_id, logo_index")
            .eq("project_id", projectId);
          const existingSet = new Set((existingLib || []).map((e: any) => e.logo_index));
          
          let industry = "未分类", companyName = "", businessType = "店铺";
          if (submissionId) {
            const { data: sub } = await supabaseAdmin.from("submissions")
              .select("company_name, industry").eq("id", submissionId).single();
            if (sub) { industry = sub.industry || "未分类"; companyName = sub.company_name || ""; }
          }
          if ((clientInfo as any).businessType) businessType = (clientInfo as any).businessType;
          
          for (const logo of unselectedLogos) {
            if (existingSet.has(logo.index)) continue;
            try {
              const imgResp = await fetch(logo.imageUrl);
              if (!imgResp.ok) continue;
              const imgBuf = Buffer.from(await imgResp.arrayBuffer());
              const ts = Date.now();
              const sp = `library/${projectId}/logo-${logo.index}-${ts}.png`;
              const { error: upErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET)
                .upload(sp, imgBuf, { contentType: "image/png", upsert: true });
              if (upErr) continue;
              const permUrl = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(sp).data.publicUrl;
              const styleTags = extractLibStyleTags(logo.prompt || "");
              await supabaseAdmin.from("logo_library").insert({
                project_id: projectId, company_name: companyName, industry,
                business_type: businessType, logo_index: logo.index,
                image_url: permUrl, storage_path: sp, prompt: logo.prompt,
                style_tags: styleTags, brand_colors: brandProfile.brand_colors || null,
                file_size: imgBuf.length,
              });
              _DEV && console.log(`[select-logo] Collected unselected logo #${logo.index} to library`);
            } catch (e: any) { console.warn("[select-logo] Failed to collect logo:", e.message); }
          }
        }
      } catch (e: any) { console.warn("[select-logo] Library collection error:", e.message); }
    })();
    return NextResponse.json({
      success: true,
      projectId,
      selectedIndex,
      selectedImageUrl: selectedLogoUrl,
      storagePath: processedPath,
      selectionMethod,
      ...(scores.length > 0 ? { scores, reasoning } : {}),
      message: "Logo selected and saved. Ready for PPTX generation.",
    });
  } catch (error: any) {
    console.error("[select-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Logo selection failed" }, { status: 500 });
  }
}
