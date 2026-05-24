// API Route: POST /api/ai/generate-scheme
// 基于客户素材生成多套 VI 方案建议（使用 DeepSeek API）

import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(MOCK_SCHEMES);
  }

  try {
    const params = await req.json();

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
            content: `
你是一个品牌 VI 设计师。根据客户提供的行业、Logo 描述和参考模式，生成 3 套 VI 方案建议。
每套方案包含：风格名称、色板（主色/辅助色/强调色）、字体搭配（中英文）、方案描述。
以 JSON 数组格式返回。`,
          },
          {
            role: "user",
            content: JSON.stringify(params),
          },
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
