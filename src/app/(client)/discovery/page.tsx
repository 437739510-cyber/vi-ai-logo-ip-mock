/**
 * Brand Discovery 对话页面
 * 
 * 品牌发现对话的聊天界面，适合老店老板使用
 * 大字体、简单操作、温暖风格
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Camera, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import {
  DiscoveryPhase,
  DiscoveryState,
  ExtractedData,
  PHASE_META,
  STYLE_OPTIONS,
  CUSTOMER_REASON_OPTIONS,
  BRAND_SPIRIT_OPTIONS,
} from "@/lib/discovery/state-machine";

// ============================================
// 类型定义
// ============================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatResponse {
  reply: string;
  phase: DiscoveryPhase;
  progress: number;
  state: DiscoveryState;
  isComplete: boolean;
  extractedData: ExtractedData;
}

// ============================================
// 组件定义
// ============================================

export default function DiscoveryPage() {
  // 状态管理
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [currentPhase, setCurrentPhase] = useState<DiscoveryPhase>("warmup");
  const [progress, setProgress] = useState(0);
  const [currentState, setCurrentState] = useState<DiscoveryState>("WELCOME");
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState<string[]>([]);
  const [showStyles, setShowStyles] = useState(false);
  const [briefData, setBriefData] = useState<any>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 初始化对话
  useEffect(() => {
    initConversation();
  }, []);

  // 初始化对话
  const initConversation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/discovery/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: "开始对话",
        }),
      });

      const data: ChatResponse = await response.json();
      
      // 添加助手消息
      setMessages([
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);
      
      updateUI(data);
    } catch (error) {
      console.error("初始化对话失败:", error);
      // 添加友好的错误消息
      setMessages([
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "抱歉，服务连接有点问题，请刷新页面重试～",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 更新UI状态
  const updateUI = (data: ChatResponse) => {
    setCurrentState(data.state);
    setCurrentPhase(data.phase);
    setProgress(data.progress);
    setIsComplete(data.isComplete);
    setExtractedData(data.extractedData);

    // 根据状态显示选项
    updateOptionsForState(data.state);
  };

  // 根据状态更新选项显示
  const updateOptionsForState = (state: DiscoveryState) => {
    setShowOptions([]);
    setShowStyles(false);

    switch (state) {
      case "PHASE1_Q2":
        setShowOptions(CUSTOMER_REASON_OPTIONS);
        break;
      case "PHASE2_Q5":
        setShowOptions(BRAND_SPIRIT_OPTIONS.map((s) => s.name));
        break;
      case "PHASE3_Q7":
      case "PHASE3_Q8":
      case "PHASE3_Q9":
        // 照片模式，不显示文字选项
        break;
      case "PHASE4_Q10":
        setShowStyles(true);
        break;
    }
  };

  // 发送消息
  const sendMessage = async (messageText?: string, photoBase64?: string) => {
    const text = messageText || inputValue.trim();
    if (!text && !photoBase64) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: text || "📷 [发送了一张照片]",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/discovery/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          photoBase64,
        }),
      });

      const data: ChatResponse = await response.json();

      // 添加助手回复
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      updateUI(data);

      // 如果完成，生成简报
      if (data.isComplete) {
        generateBrief();
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "抱歉，消息发送失败了，请稍后重试～",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成品牌简报
  const generateBrief = async () => {
    setIsGeneratingBrief(true);
    try {
      const response = await fetch("/api/discovery/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      if (data.brief) {
        setBriefData(data.brief);
      }
    } catch (error) {
      console.error("生成简报失败:", error);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // 处理快捷选项点击
  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  // 处理拍照
  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 转换为 base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await sendMessage(undefined, base64);
    };
    reader.readAsDataURL(file);

    // 清空 input
    e.target.value = "";
  };

  // 处理键盘提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 获取阶段名称
  const getPhaseName = (phase: DiscoveryPhase): string => {
    return PHASE_META[phase]?.name || "品牌发现";
  };

  // 判断是否显示拍照按钮
  const showCamera = ["PHASE3_Q7", "PHASE3_Q8", "PHASE3_Q9"].includes(currentState);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* 顶部进度条 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* 阶段指示器 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-800">
              {getPhaseName(currentPhase)}
            </span>
            <span className="text-sm text-amber-600">{progress}%</span>
          </div>
          
          {/* 进度条 */}
          <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 阶段标签 */}
          <div className="flex justify-between mt-2 text-xs text-amber-600">
            <span className={currentPhase === "warmup" ? "font-bold" : ""}>热身</span>
            <span className={currentPhase === "core" ? "font-bold" : ""}>核心故事</span>
            <span className={currentPhase === "visual" ? "font-bold" : ""}>视觉素材</span>
            <span className={currentPhase === "style" ? "font-bold" : ""}>风格确认</span>
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 text-base leading-relaxed ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-md"
                    : "bg-white text-neutral-800 rounded-bl-md shadow-sm border border-neutral-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* 加载指示器 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-5 py-3 shadow-sm border border-neutral-100">
                <div className="flex items-center gap-2 text-amber-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">正在思考...</span>
                </div>
              </div>
            </div>
          )}

          {/* 快捷选项 */}
          {!isLoading && showOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {showOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  className="px-4 py-2.5 bg-white border-2 border-amber-200 text-amber-800 rounded-full text-sm font-medium hover:border-amber-400 hover:bg-amber-50 transition-all active:scale-95"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* 风格选择卡片 */}
          {!isLoading && showStyles && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleOptionClick(`${style.emoji} ${style.name}`)}
                  className="p-4 bg-white border-2 border-amber-200 rounded-xl text-left hover:border-amber-400 hover:shadow-md transition-all active:scale-98"
                >
                  <div className="text-2xl mb-1">{style.emoji}</div>
                  <div className="font-medium text-amber-900">{style.name}</div>
                  <div className="text-xs text-amber-600 mt-1">{style.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* 完成后的简报摘要 */}
          {isComplete && briefData && (
            <div className="mt-6 p-5 bg-white rounded-2xl shadow-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-bold text-amber-900">品牌档案已生成</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 font-medium min-w-[70px]">品牌精神：</span>
                  <span className="text-neutral-700">{briefData.brand_story?.brand_spirit}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 font-medium min-w-[70px]">视觉风格：</span>
                  <span className="text-neutral-700">{briefData.visual_dna?.style}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 font-medium min-w-[70px]">推荐口号：</span>
                  <span className="text-neutral-700">{briefData.slogan_candidates?.[0]}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 font-medium min-w-[70px]">推荐套餐：</span>
                  <span className="text-neutral-700">
                    {briefData.package_recommendation?.package}（¥{briefData.package_recommendation?.price}）
                  </span>
                </div>
              </div>

              <button className="w-full mt-5 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all">
                <span>开始生成VI手册</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {isGeneratingBrief && (
            <div className="mt-6 p-5 bg-white rounded-2xl shadow-lg border border-amber-200 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-amber-700 font-medium">正在生成您的品牌档案...</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 底部输入区 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* 拍照按钮 */}
            {showCamera && (
              <button
                onClick={handlePhotoCapture}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full hover:bg-amber-200 transition-colors"
                title="拍照上传"
              >
                <Camera className="w-6 h-6" />
              </button>
            )}

            {/* 文字输入框 */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入您的回答..."
                className="w-full px-5 py-3 text-base bg-neutral-100 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                disabled={isLoading || isComplete}
              />
            </div>

            {/* 发送按钮 */}
            <button
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isLoading || isComplete}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* 底部提示 */}
          <p className="text-center text-xs text-amber-500 mt-2">
            {isComplete ? "品牌发现已完成" : "品牌顾问 小Brand 为您服务～"}
          </p>
        </div>
      </footer>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
