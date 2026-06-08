"use client";

import { cn } from "@/lib/utils";
import type { ViManual } from "@/types";

interface CanvasPreviewProps {
  manual: ViManual;
  className?: string;
  onChange?: React.Dispatch<React.SetStateAction<ViManual | null>>;
}

export function CanvasPreview({ manual, className }: CanvasPreviewProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* A4 比例预览 */}
      <div
        className="w-full max-w-[210mm] aspect-[210/297] bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden"
        style={{ fontFamily: manual.typography.chinese.brandFont.font }}
      >
        {/* 页面内容 */}
        <div className="p-8 flex flex-col h-full">
          {/* 封面区域 */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: manual.brandColors.primary.hex }}
            >
              {manual.cover.title}
            </h1>
            {manual.cover.subtitle && (
              <p className="text-sm text-neutral-500 mb-6">{manual.cover.subtitle}</p>
            )}

            {/* 品牌色展示 */}
            <div className="flex gap-3 mb-6">
              {[
                manual.brandColors.primary,
                manual.brandColors.secondary,
                manual.brandColors.accent,
                ...manual.brandColors.neutrals,
              ].map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full border border-neutral-200"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[10px] text-neutral-400">{c.hex}</span>
                </div>
              ))}
            </div>

            {/* 字体展示 */}
            <div className="text-xs text-neutral-400">
              <p>标题：{manual.typography.chinese.brandFont.font}</p>
              <p>正文：{manual.typography.chinese.bodyFont.font}</p>
            </div>
          </div>

          {/* 页脚 */}
          <div className="pt-4 border-t border-neutral-100 text-[10px] text-neutral-400 flex justify-between">
            <span>{manual.cover.companyName}</span>
            <span>v{manual.cover.version} · {manual.cover.date}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-neutral-400">
        A4 比例预览 · 实际效果以 PDF 为准
      </p>
    </div>
  );
}
