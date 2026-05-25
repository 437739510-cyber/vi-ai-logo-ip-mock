// API Route: POST /api/ai/analyze-manual
// 使用 DeepSeek 分析参考 VI 手册 PDF，提取品牌色、字体、风格信息
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { pdfPath } = await req.json();
    if (!pdfPath) {
      return NextResponse.json({ error: "pdfPath required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // 无 API 密钥时返回默认分析结果
      return NextResponse.json({
        used: false,
        extractedColors: ["#1A73E8", "#34A853", "#FBBC04"],
        extractedFonts: ["Noto Sans SC", "Inter"],
        styleSummary: "现代简约风格，偏向科技感",
        analysisConfidence: 0,
      });
    }

    // 尝试读取 PDF 的部分内容（前 10KB）作为文本分析素材
    let pdfText = "";
    try {
      const fullPath = path.join(process.cwd(), "public", pdfPath);
      const buffer = await readFile(fullPath);
      // PDF 是二进制文件，提取可读文本片段
      const content = buffer.toString("utf-8");
      // 提取 PDF 中的文本内容（介于括号或 BT/ET 之间的文本）
      const textMatches = content.match(/\(([^)]*)\)/g) || [];
      pdfText = textMatches
        .map((m: string) => m.slice(1, -1))
        .filter((t: string) => t.length > 2)
        .join("\n")
        .slice(0, 8000);
    } catch {
      pdfText = "无法读取 PDF 内容，请根据文件名称和上下文推断风格。";
    }

    const prompt = `你是一位专业的品牌 VI 设计师。请分析以下 VI 手册参考材料，提取关键设计元素。

${
  pdfText && pdfText.length > 20
    ? `【手册内容片段】\n${pdfText}\n`
    : "【说明】手册内容无法直接读取，请基于行业通用规范进行分析。"
}

请以 JSON 格式返回分析结果：
{
  "used": true,
  "extractedColors": ["主色 HEX", "辅助色 HEX", "强调色 HEX"],
  "extractedFonts": ["中文字体名称", "英文字体名称"],
  "styleSummary": "简短描述整体风格（20字以内）",
  "analysisConfidence": 0-1 之间的置信度分数
}`;

    const deepseekRes = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是品牌 VI 设计专家，擅长分析品牌手册的设计语言。" },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      throw new Error(`DeepSeek API error: ${deepseekRes.status}`);
    }

    const data = await deepseekRes.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[API/analyze-manual] Error:", error);
    // 出错时返回默认分析
    return NextResponse.json({
      used: false,
      extractedColors: ["#1A73E8", "#34A853", "#FBBC04"],
      extractedFonts: ["思源黑体", "Inter"],
      styleSummary: "现代简约风格",
      analysisConfidence: 0.3,
    });
  }
}
