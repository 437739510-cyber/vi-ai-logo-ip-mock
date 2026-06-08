// API Route: POST /api/ai/chat
// 编辑器内的 AI 设计助手，使用 DeepSeek 进行实时对话
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { messages, projectId, manualContext } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      // 无 API 密钥时返回固定提示
      return NextResponse.json({
        reply: "抱歉，AI 助手尚未配置 API 密钥，暂时无法回答您的问题。请在 .env.local 中设置 DEEPSEEK_API_KEY。",
      });
    }

    const systemPrompt = `你是 VI 品牌手册编辑器的 AI 设计助手。你的职责是协助用户完成 VI 手册的设计和编辑。

当前编辑的项目信息：
${manualContext ? JSON.stringify(manualContext, null, 2) : "暂无"}

你可以帮助用户：
1. 调整品牌色板（主色、辅助色、强调色、中性色）
2. 推荐中英文字体搭配
3. 添加或修改 Logo 变体
4. 生成辅助图形建议
5. 建议应用场景（名片、信纸、PPT 模板等）
6. 回答关于品牌 VI 设计的问题

请用中文回复，简洁专业，每次回答控制在 100 字以内。
如果用户要求修改颜色或字体，请直接给出具体的颜色 HEX 值或字体名称。
如果用户的要求超出你的能力范围，请诚实告知。`;

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
          ...messages.slice(-10), // 只保留最近 10 条消息作为上下文
        ],
      }),
    });

    if (!deepseekRes.ok) {
      throw new Error(`DeepSeek API error: ${deepseekRes.status}`);
    }

    const data = await deepseekRes.json();
    const reply = data.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[API/ai/chat] Error:", error);
    return NextResponse.json(
      { reply: "抱歉，我暂时遇到了一些问题，请稍后再试。" },
      { status: 200 }
    );
  }
}
