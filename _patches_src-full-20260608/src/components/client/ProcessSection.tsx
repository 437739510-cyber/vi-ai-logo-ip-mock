"use client";

import { Upload, Sparkles, FileCheck } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  {
    icon: Upload,
    title: "提交素材",
    description: "上传您的品牌 Logo、IP 公仔，以及参考 VI 手册（可选），填写基本信息即可",
  },
  {
    icon: Sparkles,
    title: "AI 分析生成",
    description: "AI 自动提取品牌色、字体特征，参考您上传的手册风格，生成多套 VI 方案",
  },
  {
    icon: FileCheck,
    title: "专业交付",
    description: "设计师精修确认后，交付完整 VI 手册（PDF + 可编辑源文件）",
  },
];

export function ProcessSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">三步获得专业 VI 手册</h2>
          <p className="mt-3 text-neutral-500">简单的流程，专业的结果</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                className="relative flex flex-col items-center text-center p-8 rounded-2xl bg-neutral-50 border border-neutral-100"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                {/* 步骤编号 */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                  {index + 1}
                </div>

                {/* 图标 */}
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-primary" />
                </div>

                <h3 className="text-lg font-semibold text-neutral-900 mb-2">{step.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{step.description}</p>

                {/* 连接线（仅桌面端） */}
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-neutral-200" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
