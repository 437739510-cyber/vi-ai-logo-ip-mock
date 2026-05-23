"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiGenerationPlan } from "@/types";

interface PlanCardProps {
  plan: AiGenerationPlan;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleFavorite?: () => void;
}

export function PlanCard({ plan, isSelected, onSelect, onToggleFavorite }: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative bg-white border rounded-xl overflow-hidden transition-all cursor-pointer group",
        isSelected
          ? "border-primary ring-1 ring-primary shadow-sm"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
      )}
      onClick={onSelect}
    >
      {/* 缩略图 */}
      <div className="aspect-[4/3] bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
        <span className="text-sm text-neutral-400">{plan.styleLabel}</span>
      </div>

      {/* 信息 */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-neutral-900">{plan.styleLabel}</h4>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className={cn(
              "p-1 rounded transition-colors",
              plan.isFavorited
                ? "text-accent hover:text-amber-500"
                : "text-neutral-300 hover:text-neutral-400 opacity-0 group-hover:opacity-100"
            )}
          >
            <Star className="w-4 h-4" fill={plan.isFavorited ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {plan.referenceUsed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
              参考手册
            </span>
          )}
          <span className="text-[10px] text-neutral-400">
            {new Date(plan.generatedAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>

      {/* 选中指示 */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
