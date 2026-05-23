"use client";

import { INDUSTRY_OPTIONS } from "@/lib/consultation-schema";
import type { Industry } from "@/types";

interface FavoriteFiltersProps {
  industry: string;
  onIndustryChange: (industry: string) => void;
}

export function FavoriteFilters({ industry, onIndustryChange }: FavoriteFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onIndustryChange("")}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          industry === ""
            ? "bg-primary text-white"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
        }`}
      >
        全部
      </button>
      {INDUSTRY_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onIndustryChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            industry === opt
              ? "bg-primary text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
