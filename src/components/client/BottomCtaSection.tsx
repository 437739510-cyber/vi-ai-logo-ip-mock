"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function BottomCtaSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-primary/5">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">
            准备好让你的店被认真看见了吗？
          </h2>
          <p className="mt-4 text-neutral-500 text-lg">
            3分钟提交需求，AI 为你生成专属 VI 方案
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/interview"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white text-base font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Sparkles className="w-5 h-5" />
              免费获取VI方案
            </Link>
            <Link
              href="/member/login"
              className="inline-flex items-center px-8 py-3.5 border border-primary text-primary text-base font-medium rounded-xl hover:bg-primary/5 transition-colors"
            >
              开通品牌管家 ¥299/月
            </Link>
          </div>
          <p className="text-sm text-neutral-400 mt-4">
            品牌管家注册即享2条免费体验 · 无需绑定 · 停发即停费
          </p>
        </motion.div>
      </div>
    </section>
  );
}
