"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "ai" | "user";
  content: string;
}

const MOCK_REPLIES: Record<string, string> = {
  蓝色: "已将主色调从 #1A73E8 调整为 #1565C0（更深一度），您看一下预览区的变化。",
  字体: "已将所有标题字体切换为 Noto Sans SC Bold，正文保持 Regular。需要调整字号吗？",
  加: "已为您增加一页「名片应用规范」，包含标准布局、Logo 位置和字体字号标注。",
  红色: "已将强调色从 #FBBC04 调整为 #E84343。预览区已实时更新，请查看效果。",
  删除: "已将选中的辅助图形「pattern-1」从手册中移除。",
};

function getMockReply(input: string): string {
  for (const [keyword, reply] of Object.entries(MOCK_REPLIES)) {
    if (input.includes(keyword)) return reply;
  }
  return "好的，已按您的需求调整。请查看预览区的实时效果，如有进一步修改需求请继续告诉我。";
}

interface AIChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AIChatPanel({ isOpen, onToggle }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "你好！我是 VI 设计助手。你可以告诉我需要修改什么，比如「把蓝色调暖一些」或「加一页名片应用规范」。", },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsThinking(true);

    await new Promise((r) => setTimeout(r, 1000));

    const reply = getMockReply(userMsg);
    setMessages((prev) => [...prev, { role: "ai", content: reply }]);
    setIsThinking(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors flex items-center justify-center z-50"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 h-96 bg-white rounded-xl shadow-xl border border-neutral-200 flex flex-col z-50">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-neutral-700">AI 设计助手</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-neutral-100 text-neutral-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 text-sm",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "ai" && (
              <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            )}
            <div
              className={cn(
                "max-w-[80%] px-3 py-2 rounded-lg leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-neutral-100 text-neutral-700 rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <User className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-2">
            <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="bg-neutral-100 text-neutral-500 text-sm px-3 py-2 rounded-lg rounded-bl-sm">
              <span className="animate-pulse">思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-neutral-100">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="输入修改指令..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
