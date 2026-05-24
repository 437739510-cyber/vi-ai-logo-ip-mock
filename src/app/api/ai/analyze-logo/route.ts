// API Route: POST /api/ai/analyze-logo
// 分析 Logo 图片，提取品牌色和风格标签（使用 DeepSeek API）

import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const MOCK_RESPONSE = {
  primaryColors: [
    { hex: "#1A73E8", name: "科技蓝", ratio: 0.6 },
    { hex: "#34A853", name: "生长绿", ratio: 0.25 },
    { hex: "#FBBC04", name: "活力黄", ratio: 0.15 },
  ],
  styleTags: ["极简", "现代", "科技感"],
  description: "以蓝色为主调的科技风格 Logo，线条简洁",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    // 无 Key 时返回 Mock 数据
    return NextResponse.json(MOCK_RESPONSE);
  }

  try {
    const { imageUrl } = await req.json();

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
            content:
              "你是一个品牌视觉分析师。分析用户提供的 Logo 描述，提取主色（HEX 格式）、风格标签和简短描述。以 JSON 格式返回。",
          },
          {
            role: "user",
            content: `分析这个 Logo 的风格和配色：${imageUrl}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      const error = await deepseekRes.text();
      console.error("[DeepSeek API Error]", error);
      return NextResponse.json(MOCK_RESPONSE);
    }

    const data = await deepseekRes.json();
    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[AI Route Error]", err);
    return NextResponse.json(MOCK_RESPONSE);
  }
}
