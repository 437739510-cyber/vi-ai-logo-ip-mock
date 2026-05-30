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

/** Render an SVG preview card using the plan's color palette + font data */
function PlanPreviewSVG({ plan }: { plan: AiGenerationPlan }) {
  const { colorPalette, fontPairing, description, styleLabel } = plan;
  const p = colorPalette?.primary || "#6B7280";
  const s = colorPalette?.secondary || "#9CA3AF";
  const a = colorPalette?.accent || "#F59E0B";
  const headingFont = fontPairing?.heading || "";
  const bodyFont = fontPairing?.body || "";
  const desc = description || "";

  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="400" height="300" fill="#F9FAFB" rx="0" />

      {/* Top color bar */}
      <rect x="0" y="0" width="400" height="8" fill={p} />

      {/* Big color block */}
      <rect x="24" y="28" width="160" height="100" rx="12" fill={p} opacity="0.15" />
      <rect x="24" y="28" width="160" height="100" rx="12" fill={p} opacity="0.08" />

      {/* Small decorative circles */}
      <circle cx="36" cy="42" r="6" fill={p} />
      <circle cx="56" cy="42" r="4" fill={s} />
      <circle cx="36" cy="62" r="4" fill={a} />

      {/* Style label */}
      <text x="200" y="52" fontSize="14" fontWeight="700" fill="#111827" fontFamily="system-ui">
        {styleLabel}
      </text>

      {/* Description */}
      {desc && (
        <text x="200" y="72" fontSize="11" fill="#6B7280" fontFamily="system-ui">
          {desc.length > 28 ? desc.slice(0, 28) + "…" : desc}
        </text>
      )}

      {/* Color swatches */}
      <rect x="24" y="148" width="352" height="32" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
      {[
        { color: p, label: "主色" },
        { color: s, label: "辅助" },
        { color: a, label: "强调" },
      ].map((item, i) => {
        const cx = 36 + i * 120;
        return (
          <g key={i}>
            <rect x={cx} y="154" width="18" height="18" rx="4" fill={item.color} />
            <text x={cx + 24} y="166" fontSize="10" fill="#6B7280" fontFamily="system-ui" dominantBaseline="middle">
              {item.label}
            </text>
          </g>
        );
      })}

      {/* Font info */}
      {headingFont && (
        <text x="24" y="204" fontSize="11" fontWeight="600" fill="#374151" fontFamily="system-ui">
          标题: {headingFont}
        </text>
      )}
      {bodyFont && (
        <text x="24" y="222" fontSize="11" fill="#6B7280" fontFamily="system-ui">
          正文: {bodyFont}
        </text>
      )}

      {/* Bottom accent line */}
      <rect x="24" y="248" width="352" height="2" rx="1" fill={a} opacity="0.4" />
    </svg>
  );
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
      {/* SVG Preview */}
      <div className="aspect-[4/3] bg-neutral-50 flex items-center justify-center overflow-hidden">
        <PlanPreviewSVG plan={plan} />
      </div>

      {/* Info */}
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

      {/* Selected indicator */}
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
