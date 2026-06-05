import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

const SYSTEM_PROMPT = `你是品牌大脑的AI品牌顾问，正在和一位老店店主进行品牌访谈。
你的角色：亲切、接地气、有洞察力的品牌顾问。
访谈规则：
1. 根据店主的回答深度挖掘，不要机械问下一题
2. 如果店主提到有趣的点，追问细节（比如"开了20年"→追问"当初为什么开这家店"）
3. 每次只问一个问题
4. 语言要口语化、亲切，像朋友聊天
5. 适当肯定和鼓励店主
6. 从店主的回答中提取品牌关键词和定位线索

你必须根据上下文和当前问题，生成一个自然的追问。`;

const FALLBACK_QUESTIONS = [
  '您的店铺开了多少年了？当初为什么会选择开这家店？',
  '您觉得您的店最大的特色是什么？顾客最常夸您什么？',
  '您的目标客户主要是哪些人？他们有什么特点？',
  '目前店里的视觉形象（招牌、包装、宣传物料）是谁帮您设计的？您满意吗？',
  '如果让您用一个词形容您店铺的气质，您会用哪个词？',
  '您有没有自己画过或者想象中的品牌形象？比如颜色、图案、吉祥物？',
  '您希望品牌化之后，店铺给顾客的第一印象是什么？',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, questionIndex = 0 } = body;

    if (!DEEPSEEK_API_KEY) {
      // Fallback to preset questions
      const fallbackIndex = Math.min(questionIndex, FALLBACK_QUESTIONS.length - 1);
      return NextResponse.json({
        message: FALLBACK_QUESTIONS[fallbackIndex],
        source: 'fallback',
      });
    }

    // Build conversation for DeepSeek
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(-10), // Keep last 10 messages for context
      {
        role: 'user',
        content: `基于以上对话，请自然地追问下一个问题。参考方向：${
          FALLBACK_QUESTIONS[Math.min(questionIndex, FALLBACK_QUESTIONS.length - 1)]
        }。注意要根据对方刚才的回答来追问，不要机械重复参考问题。`,
      },
    ];

    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: chatMessages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const fallbackIndex = Math.min(questionIndex, FALLBACK_QUESTIONS.length - 1);
      return NextResponse.json({
        message: FALLBACK_QUESTIONS[fallbackIndex],
        source: 'fallback',
      });
    }

    const data = await res.json();
    const aiMessage = data.choices?.[0]?.message?.content || FALLBACK_QUESTIONS[Math.min(questionIndex, FALLBACK_QUESTIONS.length - 1)];

    return NextResponse.json({ message: aiMessage, source: 'deepseek' });
  } catch (error: unknown) {
    const fallbackIndex = 0;
    return NextResponse.json({
      message: FALLBACK_QUESTIONS[fallbackIndex],
      source: 'fallback',
    });
  }
}
