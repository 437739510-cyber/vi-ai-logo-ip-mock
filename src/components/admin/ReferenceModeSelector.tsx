"use client";

import { cn } from "@/lib/utils";
import { REFERENCE_MODE_LABELS, type ReferenceMode } from "@/types";

interface ReferenceModeSelectorProps {
  value: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
}

const MODE_DESCRIPTIONS: Record<ReferenceMode, string> = {
  strong: "严格遵循参考手册的色彩和字体规范",
  weak: "提取风格倾向，允许 AI 适度变化",
  none: "完全基于客户素材从零生成",
};

export function ReferenceModeSelector({ value, onChange }: ReferenceModeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">参考模式</label>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(REFERENCE_MODE_LABELS) as ReferenceMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={cn(
              "p-3 rounded-lg border text-left transition-all",
              value === mode
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-neutral-200 hover:border-neutral-300 bg-white"
            )}
          >
            <p className="text-sm font-medium text-neutral-900">{REFERENCE_MODE_LABELS[mode]}</p>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {MODE_DESCRIPTIONS[mode]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
