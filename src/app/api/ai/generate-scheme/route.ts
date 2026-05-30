// API Route: POST /api/ai/generate-scheme
// 基于客户素材 + 参考 VI 手册分析 + 行业分析生成多套 VI 方案建议（使用 DeepSeek API）
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MOCK_DIR = path.join(process.cwd(), "public", "mock");

const MOCK_SCHEMES = [
  {
    styleLabel: "极简科技蓝",
    colorPalette: { primary: "#1A73E8", secondary: "#34A853", accent: "#FBBC04" },
    fontPairing: { heading: "Noto Sans SC", body: "Inter" },
    description: "以蓝色为主调的科技感方案，适合互联网/AI 行业",
  },
  {
    styleLabel: "赛博霓虹",
    colorPalette: { primary: "#0D47A1", secondary: "#E84343", accent: "#00E5FF" },
    fontPairing: { heading: "Poppins", body: "Roboto" },
    description: "充满未来感的霓虹风格，适合年轻化品牌",
  },
  {
    styleLabel: "自然生态",
    colorPalette: { primary: "#2E7D32", secondary: "#558B2F", accent: "#AEEA00" },
    fontPairing: { heading: "思源宋体", body: "Noto Sans SC" },
    description: "以绿色为主调的自然风格，适合食品/环保行业",
  },
];

/** 从 PDF 文件中提取可读文本片段 */
async function extractPdfText(pdfPath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), "public", pdfPath);
    const buffer = await readFile(fullPath);
    const content = buffer.toString("utf-8");
    const textMatches = content.match(/\(([^)]*)\)/g) || [];
    return textMatches
      .map((m: string) => m.slice(1, -1))
      .filter((t: string) => t.length > 2)
      .join("\n")
      .slice(0, 8000);
  } catch {
    return "";
  }
}

/** 通过 DeepSeek 分析参考手册的色彩/字体/风格 */
async function analyzeManualWithDeepSeek(
  pdfText: string,
  apiKey: string
): Promise<{ extractedColors: string[]; extractedFonts: string[]; styleSummary: string }> {
  try {
    if (!pdfText || pdfText.length < 20) {
      return { extractedColors: [], extractedFonts: [], styleSummary: "" };
    }

    const resp = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是品牌 VI 设计专家，擅长分析品牌手册的设计语言。" },
          {
            role: "user",
            content: `请分析以下 VI 手册内容片段，提取关键设计元素。
【手册内容片段】
${pdfText}

请以 JSON 格式返回分析结果：
{
  "extractedColors": ["主色 HEX", "辅助色 HEX", "强调色 HEX"],
  "extractedFonts": ["中文字体名称", "英文字体名称"],
  "styleSummary": "简短描述整体风格（20字以内）"
}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`DeepSeek error: ${resp.status}`);
    const data = await resp.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { extractedColors: [], extractedFonts: [], styleSummary: "" };
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(MOCK_SCHEMES);
  }

  try {
    const params = await req.json();
    const { projectId, referenceMode, industryAnalysis } = params;

    // 1. 查找项目对应的提交信息，获取参考手册路径
    let referenceData: {
      pdfText: string;
      colors: string[];
      fonts: string[];
      styleSummary: string;
    } = { pdfText: "", colors: [], fonts: [], styleSummary: "" };

    if (referenceMode !== "none" && projectId) {
      try {
        const projsPath = path.join(MOCK_DIR, "projects.json");
        const projs = JSON.parse(await readFile(projsPath, "utf-8"));
        const project = projs.find((p: any) => p.id === projectId);

        if (project?.submissionId) {
          const subsPath = path.join(MOCK_DIR, "submissions.json");
          const subs = JSON.parse(await readFile(subsPath, "utf-8"));
          const sub = subs.find((s: any) => s.id === project.submissionId);

          if (sub?.referenceManual?.url) {
            const pdfText = await extractPdfText(sub.referenceManual.url);
            const analysis = await analyzeManualWithDeepSeek(pdfText, apiKey);

            referenceData = {
              pdfText,
              colors: analysis.extractedColors || [],
              fonts: analysis.extractedFonts || [],
              styleSummary: analysis.styleSummary || "",
            };
          }
        }
      } catch {
        // 加载失败继续用默认值
      }
    }

    // 2. 构建包含参考手册分析的 prompt
    const hasReference = referenceData.colors.length > 0 || referenceData.fonts.length > 0 || referenceData.styleSummary.length > 0;

    let systemPrompt = `你是一个品牌 VI 设计师。根据客户提供的行业、素材和参考手册风格，生成 3 套 VI 方案建议。
每套方案包含：风格名称、色板（主色/辅助色/强调色）、字体搭配（中英文）、方案描述。
以 JSON 数组格式返回。格式: [{ styleLabel, colorPalette: { primary, secondary, accent }, fontPairing: { heading, body }, description }]`;

    if (hasReference) {
      systemPrompt += `\n\n【参考手册分析结果（请优先参考）】
提取的色彩：${referenceData.colors.join(", ") || "未提取"}
提取的字体：${referenceData.fonts.join(", ") || "未提取"}
整体风格描述：${referenceData.styleSummary || "未提取"}`;

      if (referenceMode === "strong") {
        systemPrompt += `\n【参考模式：强参考】请严格遵守参考手册的色彩和字体规范，仅在此基础上做微调。`;
      } else {
        systemPrompt += `\n【参考模式：弱参考】提取参考手册的风格倾向，允许大胆变化和创新。`;
      }
    }

    // 3. 添加行业 AI 分析建议
    if (industryAnalysis) {
      systemPrompt += `\n\n【AI 行业分析建议（请在设计时参考）】\n${industryAnalysis}`;
    }

    const deepseekRes = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(params) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      return NextResponse.json(MOCK_SCHEMES);
    }

    const data = await deepseekRes.json();
    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK_SCHEMES);
  }
}
