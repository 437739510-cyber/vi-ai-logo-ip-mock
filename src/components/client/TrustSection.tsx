"use client";

import { motion } from "framer-motion";
import { Shield, Lock, FileCheck, RotateCcw, Copyright, Scale } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "商业保密",
    desc: "品牌资料严格保密，不向任何第三方透露您的商业信息",
  },
  {
    icon: FileCheck,
    title: "NDA签署",
    desc: "可签署保密协议，法律层面保障您的信息安全",
  },
  {
    icon: Copyright,
    title: "商用授权归您",
    desc: "交付文件可自由商用，不用于其他客户",
  },
  {
    icon: RotateCcw,
    title: "7天售后保障",
    desc: "未进入人工服务可全额退，已交付源文件按规则修改或退款",
  },
  {
    icon: Lock,
    title: "数据安全",
    desc: "企业级数据加密，阿里云+Supabase双重保障",
  },
  {
    icon: Scale,
    title: "合规保障",
    desc: "AI生成内容符合广告法，避免宣传违规风险",
  },
];

export function TrustSection() {
  return (
    <section className="py-20 bg-neutral-50" id="trust">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">
            放心交给我们
          </h2>
          <p className="mt-3 text-neutral-500">
            6重保障，让您无后顾之忧
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                className="text-center p-6 bg-white rounded-2xl border border-neutral-100 hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-base font-semibold text-neutral-900">{item.title}</h4>
                <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-neutral-400">
            已交付真实 VI 手册 ｜ 7 天售后保障，规则透明
          </p>
        </motion.div>
      </div>
    </section>
  );
}
