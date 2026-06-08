/**
 * Brand Discovery 聊天 API
 * 
 * 处理品牌发现对话的API端点
 * POST /api/discovery/chat
 */

import { NextRequest, NextResponse } from "next/server";
import {
  DiscoveryState,
  ExtractedData,
  STATE_MACHINE,
  updateSessionState,
  addConversationTurn,
  getNextStateFromCurrent,
  getProgressFromState,
  getPhaseFromState,
  formatQuestion,
} from "@/lib/discovery/state-machine";
import { getOrCreateSession, saveSession } from "@/lib/discovery/session-store";

// ============================================
// DeepSeek API 配置
// ============================================

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL_NAME = "deepseek-chat";

// ============================================
// DeepSeek API 调用
// ============================================

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10), // 只保留最近10条历史
    { role: "user", content: userMessage },
  ];

  const response = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 从用户回复中提取结构化信息
 */
async function extractStructuredData(
  state: DiscoveryState,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  previousData: ExtractedData
): Promise<Partial<ExtractedData>> {
  const stateNode = STATE_MACHINE[state];
  if (!stateNode || !stateNode.extractionPrompt) {
    return {};
  }

  const systemPrompt = `你是品牌信息提取专家。你的任务是从用户回复中提取结构化的品牌信息。

提取规则：
1. 严格按照 extraction_prompt 的要求提取信息
2. 如果是选择题，用户可能用不同方式表达（如序号、数字、简写等），需要识别并映射到正确选项
3. 提取时要保留原话的关键表述
4. 如果用户没有提供明确信息，返回空对象 {}

当前状态: ${state}
提取要求: ${stateNode.extractionPrompt}

历史上下文:
${Object.entries(previousData)
  .filter(([_, v]) => v !== undefined && v !== null)
  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  .join("\n")}

请返回JSON格式的提取结果，不要添加任何解释：
{
  // 根据提取要求返回对应字段
}`;

  try {
    const result = await callDeepSeek(systemPrompt, userMessage, conversationHistory);
    
    // 尝试解析 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[extractStructuredData] Error:", error);
  }

  return {};
}

/**
 * 生成 AI 回复
 */
async function generateAIReply(
  state: DiscoveryState,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  extractedData: ExtractedData
): Promise<string> {
  const stateNode = STATE_MACHINE[state];
  const currentQuestion = formatQuestion(state, extractedData);

  const systemPrompt = `你是品牌顾问"小Brand"，正在和一位老店老板进行品牌发现对话。

对话风格要求：
1. 口语化、亲切自然，像朋友聊天一样
2. 温暖友好，让对方感到被尊重和理解
3. 简单易懂，避免专业术语
4. 适当时给予肯定和共鸣
5. 回复控制在 100 字以内
6. 如果用户回答很长，可以简短复述并自然过渡到下一个问题
7. 多用"～""呀""啦"等语气词
8. 可以用 emoji 增添亲切感

当前问题: ${currentQuestion}

选项信息（如果是选择题）:
${stateNode.options ? stateNode.options.map((o, i) => `${i + 1}. ${o}`).join("\n") : "无"}

请生成一个自然的回复，引导用户回答问题。如果用户已经回答了，可以复述确认并自然过渡。`;

  try {
    return await callDeepSeek(systemPrompt, userMessage, conversationHistory);
  } catch (error) {
    console.error("[generateAIReply] Error:", error);
    // 如果 API 调用失败，返回友好的降级回复
    return getFallbackReply(state, userMessage, extractedData);
  }
}

/**
 * 降级回复（当 API 不可用时）
 */
function getFallbackReply(
  state: DiscoveryState,
  userMessage: string,
  _data: ExtractedData
): string {
  const replies: Record<DiscoveryState, string> = {
    WELCOME: "好的，很高兴认识您！请问您的店开了多久啦？",
    PHASE1_Q1: "明白了～那是谁开了这家店呢？",
    PHASE1_Q2: "好的，客人来您这儿主要是因为什么呢？",
    PHASE1_Q3: "原来如此！您开店这么多年，有没有什么特别骄傲的事情呀？",
    PHASE2_Q4: "太棒了！有没有客人说过什么让您感动的话呢？",
    PHASE2_Q5: "这个精神真的很棒！店里有什么特别的物件吗？",
    PHASE2_Q6: "这个物件真有故事！能拍张照给我看看吗？",
    PHASE3_Q7: "谢谢您的照片！能再拍一张店面照吗？",
    PHASE3_Q8: "太好了！最后想问问，您希望店铺给年轻人什么感觉呢？",
    PHASE3_Q9: "好的！您选择了这个风格。感谢您的分享～",
    PHASE4_Q10: "🎉 恭喜完成品牌发现之旅！",
    COMPLETE: "品牌档案已生成，点击下方按钮开始生成VI手册吧～",
  };

  // 使用用户消息避免 unused 警告
  void userMessage;
  
  return replies[state] || "好的，继续聊～";
}

// ============================================
// API 路由处理
// ============================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, message, photoBase64 } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // 获取或创建会话
    let session = getOrCreateSession(sessionId);

    // 如果已完成，不再处理新消息
    if (session.isComplete) {
      return NextResponse.json({
        reply: "品牌发现已经完成啦！感谢您的参与～",
        phase: "complete",
        progress: 100,
        state: "COMPLETE",
        isComplete: true,
        extractedData: session.extractedData,
      });
    }

    // 记录用户消息
    session = addConversationTurn(session, "user", message);

    // 获取当前状态节点
    const currentStateNode = STATE_MACHINE[session.currentState];

    // 构建对话历史（用于上下文）
    const conversationHistory = session.conversationHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    // 提取结构化数据
    let newExtractedData: Partial<ExtractedData> = {};
    
    if (photoBase64) {
      // 处理照片
      if (session.currentState === "PHASE3_Q7") {
        newExtractedData.signatureItemPhoto = photoBase64;
      } else if (session.currentState === "PHASE3_Q8") {
        newExtractedData.signboardPhoto = photoBase64;
      } else if (session.currentState === "PHASE3_Q9") {
        newExtractedData.storefrontPhoto = photoBase64;
      }
    } else {
      // 提取文本数据
      newExtractedData = await extractStructuredData(
        session.currentState,
        message,
        conversationHistory,
        session.extractedData
      );
    }

    // 更新会话数据
    session = updateSessionState(session, session.currentState, newExtractedData);

    // 如果是 WELCOME 状态，生成欢迎回复并进入下一个问题
    let reply: string;
    let nextState: DiscoveryState;

    if (session.currentState === "WELCOME") {
      // 首次进入，生成欢迎问题
      reply = formatQuestion("WELCOME", {});
      nextState = "PHASE1_Q1";
      session = updateSessionState(session, nextState, {});
    } else {
      // 生成 AI 回复
      reply = await generateAIReply(
        session.currentState,
        message,
        conversationHistory,
        session.extractedData
      );

      // 确定下一个状态
      nextState = getNextStateFromCurrent(session.currentState, session.extractedData);

      // 特殊处理：Q1 回答后提取年限并更新
      if (session.currentState === "PHASE1_Q1") {
        const years = newExtractedData.yearsInBusiness || 
          (message.match(/\d+/g) ? parseInt(message.match(/\d+/g)[0]) : 5);
        session = updateSessionState(session, nextState, { yearsInBusiness: years });
      } else {
        session = updateSessionState(session, nextState, {});
      }
    }

    // 记录 AI 回复
    session = addConversationTurn(session, "assistant", reply, nextState);

    // 判断是否完成
    const isComplete = nextState === "COMPLETE";
    if (isComplete) {
      session.isComplete = true;
    }

    // 保存会话
    saveSession(session);

    // 返回响应
    return NextResponse.json({
      reply,
      phase: getPhaseFromState(nextState),
      progress: getProgressFromState(nextState),
      state: nextState,
      isComplete,
      extractedData: session.extractedData,
    });
  } catch (error) {
    console.error("[API/discovery/chat] Error:", error);
    return NextResponse.json(
      {
        reply: "抱歉，服务遇到了一些问题，请稍后再试～",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 } // 返回 200 让客户端可以处理友好提示
    );
  }
}

/**
 * GET 请求 - 获取会话状态
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  const session = getOrCreateSession(sessionId);

  return NextResponse.json({
    sessionId,
    exists: true,
    currentState: session.currentState,
    progress: getProgressFromState(session.currentState),
    phase: getPhaseFromState(session.currentState),
    isComplete: session.isComplete,
    extractedData: session.extractedData,
  });
}
