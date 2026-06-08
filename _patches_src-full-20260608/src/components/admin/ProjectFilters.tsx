"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/types";
import type { ProjectFilters } from "@/types";

const STATUS_TABS: { key: ProjectStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "submitted", label: "已提交" },
  { key: "ai_analysis", label: "AI 分析中" },
  { key: "designing", label: "设计制作中" },
  { key: "reviewing", label: "审核中" },
  { key: "delivered", label: "已交付" },
];

interface ProjectFiltersBarProps {
  filters: ProjectFilters;
  onChange: (filters: ProjectFilters) => void;
}

export function ProjectFiltersBar({ filters, onChange }: ProjectFiltersBarProps) {
  return (
    <div className="space-y-4">
      {/* 状态标签 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange({ ...filters, status: tab.key })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filters.status === tab.key
                ? "bg-primary text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="搜索项目编号..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
