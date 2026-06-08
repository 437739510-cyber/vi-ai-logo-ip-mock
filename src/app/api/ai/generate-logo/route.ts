/**
 * API: POST /api/ai/generate-logo
 *
 * V10 Logo生成模块 — 异步版本
 * 
 * 流程：
 * 1. API立即返回202（Logo生成已启动）
 * 2. 后台逐个生成4张Logo方案图（串行避免429）
 * 3. 进度实时写入DB（client_info.logoGenerationStatus）
 * 4. 前端轮询 get-project-status 获取进度
 * 5. 全部完成后状态变为 logo_generated
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
      // Check if analysis is still running in background
      const analysisStatus = brandProfile.analysisStatus;
      let errorMsg = "请先完成品牌分析（点击🧠开始AI分析）";
      if (analysisStatus === "analyzing") {
        errorMsg = "AI分析正在进行中，请稍等片刻再生成Logo";
      }
      return NextResponse.json({
        error: errorMsg,
      }, { status: 400 });
    }

    // Check if already generating
    const currentStatus = clientInfo.generationStatus;
    if (currentStatus === "logo_generating") {
      return NextResponse.json({ 
        success: true, 
        message: "Logo生成已在进行中",
        status: "logo_generating"
      }, { status: 202 });
    }

    const companyName = clientInfo.companyName || "品牌";
    const prompts: string[] = logoSuggestions.prompts;

    // Step 2: 写入初始状态 + 启动后台生成
    await supabaseAdmin.from("projects").update({
      status: "logo_generating",
      client_info: {
        ...clientInfo,
        generationStatus: "logo_generating",
        generationMessage: `正在生成Logo (0/${prompts.length})...`,
        logoGenerationStatus: {
          total: prompts.length,
          completed: 0,
          results: [],
          startedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    // Fire-and-forget: 后台生成Logo
    void (async () => {
      const logoResults: Array<{ index: number; prompt: string; imageUrl: string | null; error?: string }> = [];

      console.log(`[generate-logo] Background: Generating ${prompts.length} logos for: ${companyName}`);

      for (let i = 0; i < prompts.length; i++) {
        const rawPrompt = prompts[i];
        const enhancedPrompt = `${rawPrompt}, logo design on clean white background, high resolution, professional graphic design, vector style, centered composition, suitable for branding applications`;

        console.log(`[generate-logo] Background: Prompt ${i + 1}/${prompts.length}: ${enhancedPrompt.substring(0, 100)}...`);

        try {
          const imageUrl = await generateImage(enhancedPrompt, apiKey);
          logoResults.push({
            index: i,
            prompt: rawPrompt,
            imageUrl,
            error: imageUrl ? undefined : "Generation failed",
          });
        } catch (err: any) {
          console.error(`[generate-logo] Background: Failed prompt ${i + 1}:`, err.message);
          logoResults.push({
            index: i,
            prompt: rawPrompt,
            imageUrl: null,
            error: err.message,
          });
        }

        // Update progress in DB
        const completedCount = logoResults.filter(r => r.imageUrl).length;
        try {
          const { data: latestProj } = await supabaseAdmin
            .from("projects")
            .select("client_info")
            .eq("id", projectId)
            .single();

          const latestInfo = (latestProj?.client_info as Record<string, any>) || {};
          await supabaseAdmin.from("projects").update({
            client_info: {
              ...latestInfo,
              generationStatus: "logo_generating",
              generationMessage: `正在生成Logo (${i + 1}/${prompts.length})...`,
              logoGenerationStatus: {
                total: prompts.length,
                completed: i + 1,
                results: logoResults.map(r => ({
                  index: r.index,
                  prompt: r.prompt,
                  imageUrl: r.imageUrl,
                  error: r.error,
                })),
                startedAt: latestInfo.logoGenerationStatus?.startedAt || new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        } catch (updateErr) {
          console.error(`[generate-logo] Background: Progress update failed:`, updateErr);
        }

        // 间隔2秒避免限频
        if (i < prompts.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      const successCount = logoResults.filter(r => r.imageUrl).length;
      console.log(`[generate-logo] Background: Done: ${successCount}/${prompts.length} success`);

      // Final update: save results
      try {
        const { data: finalProj } = await supabaseAdmin
          .from("projects")
          .select("client_info")
          .eq("id", projectId)
          .single();

        const finalInfo = (finalProj?.client_info as Record<string, any>) || {};
        const finalBrandProfile = finalInfo.brandProfile || {};

        if (successCount > 0) {
          await supabaseAdmin.from("projects").update({
            status: "logo_generated",
            client_info: {
              ...finalInfo,
              generationStatus: "logo_generated",
              generationMessage: `Logo生成完成 (${successCount}/${prompts.length})`,
              brandProfile: {
                ...finalBrandProfile,
                logoGenerationResults: logoResults.map(r => ({
                  index: r.index,
                  prompt: r.prompt,
                  imageUrl: r.imageUrl,
                  error: r.error,
                })),
                logoGeneratedAt: new Date().toISOString(),
              },
              logoGenerationStatus: {
                total: prompts.length,
                completed: prompts.length,
                results: logoResults.map(r => ({
                  index: r.index,
                  prompt: r.prompt,
                  imageUrl: r.imageUrl,
                  error: r.error,
                })),
                completedAt: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        } else {
          await supabaseAdmin.from("projects").update({
            status: "submitted",
            client_info: {
              ...finalInfo,
              generationStatus: "failed",
              generationMessage: "Logo生成全部失败，请重试",
              logoGenerationStatus: {
                total: prompts.length,
                completed: prompts.length,
                results: logoResults.map(r => ({
                  index: r.index,
                  prompt: r.prompt,
                  imageUrl: r.imageUrl,
                  error: r.error,
                })),
                failedAt: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", projectId);
        }
      } catch (finalErr) {
        console.error(`[generate-logo] Background: Final update failed:`, finalErr);
      }
    })();

    // Immediately return 202
    return NextResponse.json({
      success: true,
      message: "Logo生成已启动，请稍候",
      projectId,
      companyName,
      totalLogos: prompts.length,
    }, { status: 202 });

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
            size: "1280*1280",
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
