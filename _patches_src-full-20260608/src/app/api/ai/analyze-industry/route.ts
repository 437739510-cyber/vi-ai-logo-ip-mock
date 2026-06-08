// API Route: POST /api/ai/analyze-industry
// 使用 DeepSeek 分析客户行业信息，生成设计方向建议总结
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const MOCK_SUMMARY =
  "该行业品牌设计通常偏向专业、可信赖的风格，建议采用稳重的中性色调配合简洁的排版，适当运用行业标志性元素增强品牌识别度。";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ summary: MOCK_SUMMARY, analyzed: false });
    }

    // 1. 加载项目数据，查找客户信息
    const mockDir = path.join(process.cwd(), "public", "mock");
    let companyName = "";
    let industry = "";
    let description = "";

    try {
      const projs = JSON.parse(
        await readFile(path.join(mockDir, "projects.json"), "utf-8")
      );
      const project = projs.find((p: any) => p.id === projectId);
      if (project?.submissionId) {
        const subs = JSON.parse(
          await readFile(path.join(mockDir, "submissions.json"), "utf-8")
        );
        const sub = subs.find((s: any) => s.id === project.submissionId);
        if (sub) {
          companyName = sub.companyName || sub.company_name || "";
          industry = sub.industry || "";
          description = sub.description || "";
        }
      }
    } catch {
      return NextResponse.json({ summary: MOCK_SUMMARY, analyzed: false });
    }

    if (!industry && !description) {
      return NextResponse.json({
        summary: "暂未获取到客户行业信息，无法生成分析。",
        analyzed: false,
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ summary: MOCK_SUMMARY, analyzed: false });
    }

    // 2. 调用 DeepSeek 分析行业
    const prompt = `你是一位品牌 VI 设计策略专家。请根据以下客户信息，分析该行业品牌视觉设计的关键方向。

客户公司：${companyName || "未提供"}
所属行业：${industry || "未提供"}
需求描述：${description || "未提供"}

请以专业的品牌策略角度分析：
1. 该行业品牌视觉的常见风格趋势
2. 该客户可能适合的设计方向（色彩倾向、字体风格、整体调性）
3. 需要避免的设计误区

以一段流畅的中文总结输出（100-150字），直接输出总结内容，不要带标题和编号。`;

    const deepseekRes = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是专业的品牌VI设计策略分析师，擅长根据客户行业特征提供精准的设计方向建议。输出简洁、专业、有洞察力。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!deepseekRes.ok) {
      throw new Error(`DeepSeek error: ${deepseekRes.status}`);
    }

    const data = await deepseekRes.json();
    const summary = data.choices[0].message.content.trim();

    return NextResponse.json({ summary, analyzed: true, industry, companyName });
  } catch (error) {
    console.error("[API/analyze-industry] Error:", error);
    return NextResponse.json({ summary: MOCK_SUMMARY, analyzed: false });
  }
}
