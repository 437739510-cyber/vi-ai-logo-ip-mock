/**
 * API: POST /api/ai/generate-logo
 *
 * V10 Logo生成模块 — 为没有Logo的客户AI生成Logo方案
 *
 * 流程：
 * 1. 从 projects.client_info.brandProfile.logoDesignSuggestions 读取AI设计建议
 * 2. 用 wan2.6-t2i 生成4张Logo方案图
 * 3. 返回4张图的URL，供客户/管理端选择
 * 4. 选择后调用 /api/ai/select-logo 保存到 Supabase Storage
 *
 * 前置条件：brand-analysis 已执行，logoDesignSuggestions 不为空
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
const DASHSCOPE_TASK = "https://dashscope.aliyuncs.com/api/v1/tasks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const apiKey = process.env.ALIYUN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ALIYUN_API_KEY not configured" }, { status: 500 });
    }

    // Step 1: 从 Supabase 读取品牌档案
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, client_info")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientInfo = (project.client_info as Record<string, any>) || {};
    const brandProfile = clientInfo.brandProfile || {};
    const logoSuggestions = brandProfile.logoDesignSuggestions;

    if (!logoSuggestions?.prompts || logoSuggestions.prompts.length === 0) {
      return NextResponse.json({
        error: "No logoDesignSuggestions found. Run brand-analysis first.",
      }, { status: 400 });
    }

    const companyName = clientInfo.companyName || "品牌";

    console.log(`[generate-logo] Generating ${logoSuggestions.prompts.length} logos for: ${companyName}`);
    console.log(`[generate-logo] Style: ${logoSuggestions.style} | Concept: ${logoSuggestions.concept}`);

    // Step 2: 逐个生成Logo（串行避免429）
    const prompts: string[] = logoSuggestions.prompts;
    const logoResults: Array<{ index: number; prompt: string; imageUrl: string | null; error?: string }> = [];

    for (let i = 0; i < prompts.length; i++) {
      const rawPrompt = prompts[i];

      // 增强prompt：确保是Logo设计，白色背景，高清
      const enhancedPrompt = `${rawPrompt}, logo design on clean white background, high resolution, professional graphic design, vector style, centered composition, suitable for branding applications`;

      console.log(`[generate-logo] Prompt ${i + 1}/${prompts.length}: ${enhancedPrompt.substring(0, 100)}...`);

      try {
        const imageUrl = await generateImage(enhancedPrompt, apiKey);
        logoResults.push({
          index: i,
          prompt: rawPrompt,
          imageUrl,
          error: imageUrl ? undefined : "Generation failed",
        });
      } catch (err: any) {
        console.error(`[generate-logo] Failed prompt ${i + 1}:`, err.message);
        logoResults.push({
          index: i,
          prompt: rawPrompt,
          imageUrl: null,
          error: err.message,
        });
      }

      // 间隔2秒避免限频
      if (i < prompts.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const successCount = logoResults.filter(r => r.imageUrl).length;
    console.log(`[generate-logo] Done: ${successCount}/${prompts.length} success`);

    if (successCount === 0) {
      return NextResponse.json({ error: "All logo generations failed" }, { status: 500 });
    }

    // Step 3: 保存结果到 project.client_info
    const updatedInfo = {
      ...clientInfo,
      brandProfile: {
        ...brandProfile,
        logoGenerationResults: logoResults.map(r => ({
          index: r.index,
          prompt: r.prompt,
          imageUrl: r.imageUrl,
          error: r.error,
        })),
        logoGeneratedAt: new Date().toISOString(),
      },
    };

    await supabaseAdmin
      .from("projects")
      .update({ client_info: updatedInfo, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return NextResponse.json({
      success: true,
      projectId,
      companyName,
      style: logoSuggestions.style,
      concept: logoSuggestions.concept,
      logos: logoResults.filter(r => r.imageUrl).map(r => ({
        index: r.index,
        prompt: r.prompt,
        imageUrl: r.imageUrl,
      })),
      failedCount: logoResults.filter(r => !r.imageUrl).length,
    });
  } catch (error: any) {
    console.error("[generate-logo] Error:", error);
    return NextResponse.json({ error: error.message || "Logo generation failed" }, { status: 500 });
  }
}

// ========== 通义万相异步生图 ==========
async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  const maxRetries = 2;
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
          parameters: {
            size: "1024*1024",  // Logo用正方形
            n: 1,
          },
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        console.error(`[generate-logo] Submit attempt ${attempt}: ${submitResp.status} ${errText.substring(0, 200)}`);
        continue;
      }

      const submitData = await submitResp.json();
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        console.error(`[generate-logo] No task_id:`, JSON.stringify(submitData).substring(0, 200));
        continue;
      }

      console.log(`[generate-logo] Task submitted: ${taskId}`);

      // Step 2: 轮询结果（最多等90秒）
      for (let poll = 0; poll < 18; poll++) {
        await new Promise(r => setTimeout(r, 5000));

        const pollResp = await fetch(`${DASHSCOPE_TASK}/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!pollResp.ok) continue;
        const pollData = await pollResp.json();
        const status = pollData.output?.task_status;

        if (status === "SUCCEEDED") {
          const imageUrl = pollData.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imageUrl) {
            console.error(`[generate-logo] No image URL in result`);
            break;
          }
          console.log(`[generate-logo] Image generated: ${imageUrl.substring(0, 80)}...`);
          return imageUrl;
        }

        if (status === "FAILED") {
          console.error(`[generate-logo] Task failed:`, pollData.output?.message || "unknown");
          break;
        }
      }
    } catch (err: any) {
      console.error(`[generate-logo] Attempt ${attempt} error:`, err.message);
    }
  }
  return null;
}
