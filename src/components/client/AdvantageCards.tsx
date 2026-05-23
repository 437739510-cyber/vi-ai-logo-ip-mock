"use client";

import { Zap, Users, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";

const ADVANTAGES = [
  {
    icon: Zap,
    title: "AI 加速",
    description: "AI 在数分钟内完成风格分析、色板提取和多方案生成，大幅缩短设计周期",
  },
  {
    icon: Users,
    title: "专业团队",
    description: "资深品牌设计师精修把关，确保每一份交付的 VI 手册达到专业水准",
  },
  {
    icon: Shield,
    title: "保密保障",
    description: "客户提交的品牌素材严格保密，交付后可根据需求签署 NDA",
  },
  {
    icon: Clock,
    title: "高效交付",
    description: "标准交付周期 3-5 个工作日，急单可加急处理",
  },
];

export function AdvantageCards() {
  return (
    <section className="py-20 bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">为什么选择我们</h2>
          <p className="mt-3 text-neutral-500">技术 + 专业，让品牌设计更高效</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ADVANTAGES.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                className="p-6 bg-white rounded-2xl border border-neutral-100 hover:shadow-sm transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
