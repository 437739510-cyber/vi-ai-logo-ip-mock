"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { INDUSTRY_OPTIONS } from "@/lib/core/consultation-schema";
import type { Industry } from "@/types";
import { Search, ChevronDown } from "lucide-react";

interface FavoriteFiltersProps {
  industry: string;
  onIndustryChange: (industry: string) => void;
}

function getParentCategory(opt: string): string {
  const idx = opt.indexOf(":");
  if (idx > 0) return opt.slice(0, idx);
  if (opt === "其他（请填写）") return "其他";
  return opt;
}

function getShortName(opt: string): string {
  const idx = opt.indexOf(":");
  if (idx > 0) return opt.slice(idx + 1);
  return opt;
}

export function FavoriteFilters({ industry, onIndustryChange }: FavoriteFiltersProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("全部行业");
  const ref = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    INDUSTRY_OPTIONS.forEach((opt) => {
      const cat = getParentCategory(opt);
      if (!map[cat]) map[cat] = [];
      map[cat].push(opt);
    });
    return map;
  }, []);

  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const filtered = useMemo(() => {
    if (!query) return { categories, grouped };
    const q = query.toLowerCase();
    const result: Record<string, string[]> = {};
    const resultCats: string[] = [];
    categories.forEach((cat) => {
      const matched = grouped[cat].filter(
        (opt) => opt.toLowerCase().includes(q) || getShortName(opt).toLowerCase().includes(q)
      );
      if (matched.length > 0) {
        result[cat] = matched;
        resultCats.push(cat);
      }
    });
    return { categories: resultCats, grouped: result };
  }, [query, categories, grouped]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setSelectedLabel(!industry ? "全部行业" : industry.includes(":") ? getShortName(industry) : industry);
  }, [industry]);

  const handleSelect = (opt: string) => {
    onIndustryChange(opt);
    setSelectedLabel(opt.includes(":") ? getShortName(opt) : opt);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white hover:border-neutral-300 transition-colors w-full max-w-xs"
      >
        <span className="flex-1 text-left truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="搜索行业..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <button
              onClick={() => { onIndustryChange(""); setSelectedLabel("全部行业"); setOpen(false); setQuery(""); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                industry === "" ? "bg-primary/10 text-primary font-medium" : "text-neutral-700"
              }`}
            >
              全部行业
            </button>

            {filtered.categories.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">未找到匹配行业</p>
            ) : (
              filtered.categories.map((cat) => (
                <div key={cat}>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{cat}</p>
                  {filtered.grouped[cat].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors ${
                        industry === opt ? "bg-primary/10 text-primary font-medium" : "text-neutral-700"
                      }`}
                    >
                      {getShortName(opt)}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
