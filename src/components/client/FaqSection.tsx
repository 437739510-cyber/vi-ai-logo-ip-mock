"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "VI 手册包含哪些内容？",
    a: "一般包括：封面、品牌色板（主色/辅助色/中性色）、字体规范（中英文）、Logo 标准用法及变体、辅助图形系统、应用场景规范（名片、信纸、PPT 模板、招牌等）。具体内容可根据您的行业和需求定制。",
  },
  {
    q: "需要我提前准备什么？",
    a: "提供品牌 Logo（AI/PNG/SVG 格式）和 IP 公仔形象即可。如果有参考 VI 手册或品牌风格偏好文档，也建议上传，AI 会优先学习参考。",
  },
  {
    q: "AI 生成后还需要人工修改吗？",
    a: "需要。AI 负责初稿生成（多方案、高效率），我们的专业设计师会进行精修和细节调整，确保交付质量达到专业水准。",
  },
  {
    q: "整个流程需要多长时间？",
    a: "标准流程 3-5 个工作日，包含：需求确认（1天）、AI 分析生成（数小时）、设计师精修（1-2天）、内部审核（1天）。急单可加急处理。",
  },
  {
    q: "价格怎么算？",
    a: "基础 VI 手册套餐 5000 元起，根据 Logo 复杂度、IP 使用方式、应用场景数量等因素定价。提交需求后我们会根据具体情况报价。",
  },
  {
    q: "版权归谁？",
    a: "交付后的 VI 手册版权归客户所有。我们承诺不会将客户的品牌素材和手册用于其他项目。",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">常见问题</h2>

        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border border-neutral-200 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50 transition-colors"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm text-neutral-600 leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
