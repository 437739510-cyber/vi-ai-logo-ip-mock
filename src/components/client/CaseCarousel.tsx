"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CASES, getCaseIndustries, type CaseInfo } from "@/lib/cases";

const FILTERS = [
  { key: "all", label: "全部" },
  ...getCaseIndustries().map((industry) => ({ key: industry, label: industry })),
];

function CaseCard({ item }: { item: CaseInfo }) {
  return (
    <motion.div layout className="group h-full">
      <Link
        href={`/cases/${item.slug}`}
        className="block h-full bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Cover image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-50">
          <Image
            src={item.cover}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5">
              查看案例 <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {item.industry}
            </span>
            {item.city ? (
              <span className="text-xs text-neutral-400">{item.city}</span>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">{item.name}</h3>
          <p className="text-xs text-neutral-500 line-clamp-2">{item.tagline}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export function CaseCarousel() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredCases = useMemo(() => {
    if (activeFilter === "all") return CASES;
    return CASES.filter((c) => c.industry === activeFilter);
  }, [activeFilter]);

  const isEmpty = filteredCases.length === 0;

  return (
    <section className="py-20 md:py-28 bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
            客户案例
          </h2>
          <p className="text-neutral-500 max-w-lg mx-auto">
            看看我们交付的真实 VI 手册——不是模板套出来的，每一个品牌都独一无二
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex justify-center gap-1.5 mb-10 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const hasItems = f.key === "all" || CASES.some((c) => c.industry === f.key);
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                disabled={!hasItems}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-brand-500 text-white shadow-sm"
                    : hasItems
                    ? "bg-white text-neutral-600 border border-neutral-200 hover:border-brand-200 hover:text-brand-700"
                    : "bg-white text-neutral-300 border border-neutral-100 cursor-not-allowed"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Case grid */}
        {isEmpty ? (
          <div className="text-center py-20 text-neutral-400">
            <p className="text-lg mb-2">该行业暂未收录案例</p>
            <p className="text-sm">更多真实客户 VI 手册正在整理中</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter}
              className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {filteredCases.map((c) => (
                <CaseCard key={c.slug} item={c} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}