"use client";

import { cn } from "@/lib/utils";
import type { ReferenceMode } from "@/types";

interface ReferenceModeSelectorProps {
  value: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
}

const MODES: { value: ReferenceMode; label: string; desc: string }[] = [
  { value: "strong", label: "强参考", desc: "严格遵循参考手册的色彩和字体规范" },
  { value: "weak", label: "弱参考", desc: "提取风格倾向，允许大胆变化" },
  { value: "none", label: "不参考", desc: "基于 Logo 和行业属性从零生成" },
];

export function ReferenceModeSelector({ value, onChange }: ReferenceModeSelectorProps) {
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
    </div>
  );
}
