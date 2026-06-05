/**
 * API: POST /api/ai/select-logo
 *
 * V12 Logo选择模块 — 支持人工选择和AI智能选优
 *
 * 新增 autoSelect 模式：
 * - autoSelect=true 时，用DeepSeek对4张Logo评分，选最高分的
 * - 评分维度：品牌契合度、视觉辨识度、行业适配性
 * - 人工选择时行为不变
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

interface LogoCandidate {
  index: number;
  imageUrl: string;
  prompt?: string;
}

async function aiScoreLogos(
  logos: LogoCandidate[],
  companyName: string,
  industry: string,
  apiKey: string
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

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    }),
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, logoImageUrl, logoIndex, autoSelect, companyName, industry } = body;

    let selectedLogoUrl = logoImageUrl;
    let selectedIndex = logoIndex ?? 0;
    let selectionMethod = "manual";
    let scores: number[] = [];
    let reasoning = "";

    // === AI智能选优模式 ===
    if (autoSelect) {
      console.log("[select-logo] Auto-select mode activated");

      // 从Supabase读取Logo生成结果
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("id, client_info")
        .eq("id", projectId)
        .single();

      const clientInfo = (project?.client_info as Record<string, any>) || {};
      const brandProfile = clientInfo.brandProfile || {};
      const logoResults = brandProfile.logoGenerationResults || [];

      const candidates: LogoCandidate[] = logoResults
        .filter((r: any) => r.imageUrl)
        .map((r: any) => ({ index: r.index, imageUrl: r.imageUrl, prompt: r.prompt }));

      if (candidates.length === 0) {
        return NextResponse.json({ error: "No logo candidates found for auto-selection" }, { status: 400 });
      }

      const dsKey = process.env.DEEPSEEK_API_KEY;
      const name = companyName || clientInfo.companyName || "品牌";
      const ind = industry || clientInfo.industry || "通用";

      if (dsKey && candidates.length > 1) {
        try {
          const result = await aiScoreLogos(candidates, name, ind, dsKey);
          selectedIndex = result.bestIndex;
          scores = result.scores;
          reasoning = result.reasoning;
          selectionMethod = "ai-scored";
          console.log(`[select-logo] AI scores: ${scores.join(",")} → best=#${selectedIndex + 1} (${reasoning})`);
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
    console.log(`[select-logo] Downloading logo from: ${selectedLogoUrl.substring(0, 80)}...`);
    const imgResp = await fetch(selectedLogoUrl);
    if (!imgResp.ok) {
      return NextResponse.json({ error: "Failed to download logo image" }, { status: 400 });
    }
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const imgSize = imgBuffer.length;
    console.log(`[select-logo] Downloaded: ${imgSize} bytes`);

    // Step 2: 获取 project → submission 信息
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, submission_id, client_info")
      .eq("id", projectId)
      .single();

    const submissionId = project?.submission_id;
    const clientInfo = (project?.client_info as Record<string, any>) || {};

    // Step 3: 上传到 Supabase Storage (form-assets)
    const timestamp = Date.now();
    const logoFileName = `logo-${timestamp}.png`;
    const formAssetsPath = `${projectId}/${logoFileName}`;

    const { error: uploadErr1 } = await supabaseAdmin.storage
      .from("form-assets")
      .upload(formAssetsPath, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadErr1) {
      console.warn("[select-logo] form-assets upload failed:", uploadErr1.message);
    } else {
      console.log("[select-logo] Uploaded to form-assets:", formAssetsPath);
    }

    // Step 4: 上传到 processed-assets 桶
    const processedPath = `${projectId}/logo-${timestamp}.png`;

    const { error: uploadErr2 } = await supabaseAdmin.storage
      .from("processed-assets")
      .upload(processedPath, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadErr2) {
      console.warn("[select-logo] processed-assets upload failed:", uploadErr2.message);
    } else {
      console.log("[select-logo] Uploaded to processed-assets:", processedPath);
    }

    // Step 5: 更新 submissions.logo_assets
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
        console.log("[select-logo] Updated submission logo_assets");
      }
    }

    // Step 6: 更新 project.client_info
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
    };

    await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    console.log("[select-logo] Done! Logo saved and linked to project.");

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
