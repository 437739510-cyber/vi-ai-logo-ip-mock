"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaseCard } from "./CaseCard";

interface FilterOption {
  key: string;
  label: string;
}

interface CaseItem {
  id: string;
  company: string;
  industry: string;        // 用于筛选
  industryLabel: string;   // 显示标签
  deliverables: string[];  // 亮点标签
  pageCount: number;       // 手册页数
  coverImage: string;      // 主缩略图
  images: string[];        // 更多截图（后续 lightbox 用）
}


const CASES: CaseItem[] = [
  {
    id: "bailiaocui-manual",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["VI 手册", "23 页完整设计"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/01-logo-primary.png",
    images: [],
  },
  {
    id: "bailiaocui-bottle",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["产品包装", "精油瓶贴设计"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/06-mockup-oil-bottle.jpg",
    images: [],
  },
  {
    id: "bailiaocui-gift",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["包装设计", "礼盒包装"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/07-mockup-gift-box.jpg",
    images: [],
  },
  {
    id: "bailiaocui-card",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["会员体系", "会员卡设计"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/05-mockup-membership-card.jpg",
    images: [],
  },
  {
    id: "bailiaocui-nail",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["物料设计", "美甲色板卡"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/04-mockup-nail-card.jpg",
    images: [],
  },
  {
    id: "bailiaocui-palette",
    company: "百疗萃",
    industry: "beauty",
    industryLabel: "美容养生",
    deliverables: ["VI 体系", "品牌色彩规范"],
    pageCount: 23,
    coverImage: "/cases/bailiaocui/02-color-palette.png",
    images: [],
  },
];


const FILTERS = [
  { key: "all", label: "全部" },
  { key: "beauty", label: "美容养生" },
  { key: "food", label: "餐饮" },
  { key: "education", label: "教育" },
  { key: "tech", label: "科技" },
];

// ======== COMPONENT ========
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
                {!hasItems && f.key !== "all" && (
                  <span className="ml-1 text-xs opacity-50">即将上线</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Case grid */}
        {isEmpty ? (
          <div className="text-center py-20 text-neutral-400">
            <p className="text-lg mb-2">该行业案例即将上线</p>
            <p className="text-sm">我们正在收集更多真实客户的 VI 手册</p>
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
                <CaseCard
                  key={c.id}
                  company={c.company}
                  industryLabel={c.industryLabel}
                  deliverables={c.deliverables}
                  pageCount={c.pageCount}
                  coverImage={c.coverImage}
                  onClick={() => {
                    // 后续可接 lightbox/详情 Modal
                    // 当前版本点击无操作，hover 有提示
                  }}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}