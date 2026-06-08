"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { ReferenceMode } from "@/types";

interface ReferenceModeSelectorProps {
  value: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
  industryAnalysis?: string;
  industryAnalysisLoading?: boolean;
}

const MODES: { value: ReferenceMode; label: string; desc: string }[] = [
  { value: "strong", label: "强参考", desc: "严格遵守参考手册的色彩和字体规范" },
  { value: "weak", label: "弱参考", desc: "提取风格倾向，允许大胆变化" },
  { value: "none", label: "不参考", desc: "基于 Logo 和行业属性从零生成" },
];

export function ReferenceModeSelector({ value, onChange, industryAnalysis, industryAnalysisLoading }: ReferenceModeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        参考模式
      </label>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const isActive = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={cn(
                "p-3 rounded-xl text-left transition-all duration-200 border",
                isActive
                  ? "bg-primary-lighter border-primary/20 text-primary shadow-sm"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
              )}
            >
              <div className="text-sm font-semibold">{mode.label}</div>
              <div className="text-[11px] mt-0.5 opacity-70">{mode.desc}</div>
            </button>
          );
        })}
      </div>

      {/* 行业 AI 分析总结 */}
      {industryAnalysisLoading && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-blue-700">AI 正在分析客户行业特征...</span>
          </div>
        </div>
      )}
      {industryAnalysis && !industryAnalysisLoading && (
        <div className="mt-3 p-3 bg-gradient-to-r from-primary/5 to-purple-50 border border-primary/10 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-neutral-700">AI 行业分析建议</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">{industryAnalysis}</p>
        </div>
      )}
    </div>
  );
}
