"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50 to-white">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-secondary/5" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl">
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            上传您的品牌素材
            <br />
            <span className="text-primary">AI 为您生成专业 VI 手册</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg md:text-xl text-neutral-600 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            上传 Logo 和 IP 公仔，AI 自动分析品牌风格，生成完整的视觉识别手册。
            专业团队精修交付，让您的品牌从第一步就与众不同。
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link
              href="/consultation"
              className="inline-flex items-center px-6 py-3 bg-primary text-white text-base font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
            >
              免费获取方案
            </Link>
            <Link
              href="/progress"
              className="inline-flex items-center px-6 py-3 border border-neutral-300 text-neutral-700 text-base font-medium rounded-xl hover:bg-neutral-50 transition-colors"
            >
              查询项目进度
            </Link>
          </motion.div>

          <motion.p
            className="mt-4 text-sm text-neutral-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            无需注册，免费提交需求
          </motion.p>
        </div>
      </div>
    </section>
  );
}
