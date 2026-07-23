"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface PlanConfig {
  price: string;
  name: string;
  period: string;
  desc: string;
  enabled: boolean;
  features?: string[];
  cta?: string;
  href?: string;
  highlight?: boolean;
}

type PricingData = Record<string, PlanConfig>;

// 默认（API不可用时的fallback）
const FALLBACK_PLANS: PlanConfig[] = [
  {
    name: "VI 手册", price: "39", period: "一次性", desc: "AI 生成品牌 VI，新店老店都能用", enabled: true,
    features: ["AI 生成品牌 Logo（多方案可选）", "品牌色板 + 字体规范", "完整 VI 手册（22+ 页）", "Logo 场景预览（白底/深色底/名片）", "PDF + PPTX 可编辑源文件", "商用版权全归你", "3 个工作日交付"],
    cta: "提交设计需求", href: "/consultation?plan=vi", highlight: true,
  },
  {
    name: "品牌管家", price: "99", period: "/月", desc: "持续运营，拍照我们搞定", enabled: true,
    features: ["每月 12 条品牌化内容", "每条 3-6 张成品图 + 文案", "AI 套品牌模板自动生成", "大学生代发小红书/抖音", "内容日历 + 排期管理", "停发即停费，不绑死"],
    cta: "开通品牌管家", href: "/member/login", highlight: false,
  },
];
// key到features/cta/href的映射
const PLAN_EXTRAS: Record<string, { features: string[]; cta: string; href: string; highlight: boolean }> = {
  vi: {
    features: ["AI 生成品牌 Logo（多方案可选）", "品牌色板 + 字体规范", "完整 VI 手册（22+ 页）", "Logo 场景预览（白底/深色底/名片）", "PDF + PPTX 可编辑源文件", "商用版权全归你", "3 个工作日交付"],
    cta: "提交设计需求", href: "/consultation?plan=vi", highlight: true,
  },
  manager: {
    features: ["每月 12 条品牌化内容", "每条 3-6 张成品图 + 文案", "AI 套品牌模板自动生成", "大学生代发小红书/抖音", "内容日历 + 排期管理", "停发即停费，不绑死"],
    cta: "开通品牌管家", href: "/member/login", highlight: false,
  },
};

export function PricingSection() {
  const [plans, setPlans] = useState<PlanConfig[]>(FALLBACK_PLANS);

  useEffect(() => {
    fetch("/api/config/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) {
          const dynamic = Object.entries(d.pricing as PricingData)
            .filter(([, p]) => p.enabled)
            .map(([key, p]) => {
              const extras = PLAN_EXTRAS[key] || { features: [], cta: "立即购买", href: "/consultation?plan=" + key, highlight: false };
              return { ...p, features: extras.features, cta: extras.cta, href: extras.href, highlight: extras.highlight };
            });
          if (dynamic.length > 0) setPlans(dynamic);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-20 bg-neutral-50" id="pricing">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">
            明码标价，没有套路
          </h2>
          <p className="mt-3 text-neutral-500">
            先做品牌基建，再做持续运营，越用越值
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`relative flex flex-col p-8 rounded-2xl border ${
                plan.highlight
                  ? "border-primary bg-white shadow-lg shadow-primary/10"
                  : "border-neutral-200 bg-white"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-medium rounded-full">
                  最受欢迎
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {plan.name}
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {plan.desc}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-neutral-900">
                  ¥{plan.price}
                </span>
                <span className="text-sm text-neutral-500 ml-1">
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-neutral-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href || "#"}
                className={`w-full py-3 rounded-xl text-center text-sm font-medium transition-colors ${
                  plan.highlight
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-neutral-400 mt-8">
          加急 24h 交付加收 50% ｜ 额外内容 ¥30/条 ｜ 修改超出免费次数 ¥50/次
        </p>
      </div>
    </section>
  );
}