"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, CheckCircle } from "lucide-react";
import { HeroVisual } from "./HeroVisual";

const TRUST_ITEMS = [
  "已服务 200+ 店铺",
  "3 工作日出方案",
  "无需注册",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-neutral-50">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-50/50 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-50/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ===== LEFT: TEXT AREA ===== */}
          <div className="max-w-xl">
            {/* Label badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                AI 驱动 · 品牌顾问
              </span>
            </motion.div>

            {/* Main headline */}
            <motion.h1
              className="mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 leading-[1.1] tracking-tight"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              老店，也值得
              <br />
              被认真看见
              <br />
              <span className="text-gradient-warm">
                AI 帮你把招牌变成品牌
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="mt-5 text-base md:text-lg text-neutral-600 leading-relaxed max-w-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              不是你的错，是没人帮你。我们用 AI 生成 LOGO、IP 公仔、VI 手册，
              低至 ¥39，让小巷深处的老店变成整条街最靓的铺。
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Link
                href="/consultation"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent-500 text-white text-base font-semibold rounded-xl hover:bg-accent-600 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                免费品牌诊断
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center gap-1.5 px-6 py-3.5 border-2 border-brand-200 text-brand-700 text-base font-semibold rounded-xl hover:bg-brand-50 transition-colors"
              >
                查看方案
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Trust bar */}
            <motion.div
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {TRUST_ITEMS.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 text-sm text-neutral-500"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ===== RIGHT: VISUAL AREA ===== */}
          <motion.div
            className="hidden lg:flex justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <HeroVisual />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
