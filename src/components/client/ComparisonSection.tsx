"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const COMPARISON_ROWS = [
  { label: "完整 VI 手册成册交付", designer: "多为零散素材", agency: "有但贵", bb: "22+ 页成册手册" },
  { label: "行业知识库（美甲/洗车/餐饮不串味）", designer: "通用套路", agency: "部分", bb: "按行业定制" },
  { label: "中文核字与质量门（不乱码）", designer: "靠个人经验", agency: "人工把关", bb: "双重质量门+视觉核字" },
  { label: "IP 公仔（三视图/表情/场景）", designer: "很少做", agency: "额外收费", bb: "标准版含" },
  { label: "需要自己动手", designer: "要", agency: "反复沟通", bb: "填表即可" },
  { label: "价格", designer: "约 ¥1,000-5,000/套", agency: "约 ¥10,000-50,000/套", bb: "¥49 起/套（一次性）" },
  { label: "交付时间", designer: "1-2 周", agency: "1-2 月", bb: "3-5 个工作日" },
  { label: "版权归属", designer: "视约定", agency: "归客户", bb: "商用版权 100% 归客户" },
];

export function ComparisonSection() {
  return (
    <section className="py-20 bg-white" id="comparison">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">
            为什么选 Brand Brain？
          </h2>
          <p className="mt-3 text-neutral-500">
            对比设计师和品牌公司，填一张表，几天收到一本成品手册
          </p>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="w-[26%] bg-neutral-50 px-6 py-5 text-left font-semibold text-neutral-900">
                    对比项
                  </th>
                  <th className="w-[23%] bg-neutral-50 px-6 py-5 text-center font-medium text-neutral-500">
                    独立设计师
                  </th>
                  <th className="w-[23%] bg-neutral-50 px-6 py-5 text-center font-medium text-neutral-500">
                    品牌策划公司
                  </th>
                  <th className="w-[28%] bg-primary px-6 py-5 text-center text-white border-x-2 border-primary/40">
                    <span className="inline-flex items-center gap-1 mb-1.5 px-3 py-0.5 bg-white text-primary text-xs font-semibold rounded-full">
                      <Sparkles className="w-3.5 h-3.5" />
                      我们的优势
                    </span>
                    <span className="block text-base font-bold">Brand Brain</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-neutral-100">
                    <td className="bg-neutral-50 px-6 py-4 text-left font-medium text-neutral-700">
                      {row.label}
                    </td>
                    <td className="px-6 py-4 text-center text-neutral-600">
                      {row.designer}
                    </td>
                    <td className="px-6 py-4 text-center text-neutral-600">
                      {row.agency}
                    </td>
                    <td className="border-x-2 border-primary/40 bg-primary/5 px-6 py-4 text-center font-semibold text-neutral-900">
                      {row.bb}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.p
          className="mt-6 text-center text-xs text-neutral-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          AI 生成 + 设计师精修把关；交付为品牌视觉氛围示意，不承诺 1:1 实景还原。
        </motion.p>

        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link
            href="/consultation"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-white text-sm font-medium transition-colors hover:bg-primary-dark"
          >
            提交设计需求
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
