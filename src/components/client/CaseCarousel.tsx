"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CASES = [
  {
    company: "星云科技",
    industry: "科技 / AI",
    style: "极简科技蓝",
    description: "从零搭建完整 VI 体系，AI 参考客户提供的竞品风格文档，生成了 3 套方案，最终选定科技蓝+霓虹紫的撞色方案。",
  },
  {
    company: "茶语品牌",
    industry: "餐饮 / 茶饮",
    style: "清新国潮",
    description: "客户上传了品牌 Logo 和 IP 公仔「茶小语」，AI 提取了茶绿色为主色，配合国潮插画风格完成整套设计。",
  },
  {
    company: "启航教育",
    industry: "教育 / 培训",
    style: "活力橙",
    description: "集团旗下三个子品牌需要统一 VI，AI 协助梳理了品牌层级关系，生成了可扩展的模块化 VI 系统。",
  },
];

export function CaseCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % CASES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  };

  const prev = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + CASES.length) % CASES.length);
  };

  const next = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % CASES.length);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <section className="py-20 bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-neutral-900 text-center mb-4">成功案例</h2>
        <p className="text-center text-neutral-500 mb-12">已为多家企业完成 VI 手册交付</p>

        <div className="relative bg-white rounded-2xl border border-neutral-100 p-8 md:p-12 min-h-[280px]">
          {/* 案例卡片 */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: "easeInOut" }}
              >
                <div className="flex items-start gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {CASES[current].industry}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-accent/20 text-amber-800 text-xs font-medium">
                    {CASES[current].style}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-3">{CASES[current].company}</h3>
                <p className="text-neutral-600 leading-relaxed">{CASES[current].description}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 左右箭头 */}
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-600" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shadow-sm"
          >
            <ChevronRight className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        {/* 指示点 */}
        <div className="flex justify-center gap-2 mt-6">
          {CASES.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === current ? "bg-primary w-6" : "bg-neutral-300"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
