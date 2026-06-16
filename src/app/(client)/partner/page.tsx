"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  DollarSign,
  Award,
  Clock,
  Smartphone,
  TrendingUp,
  Users,
  MessageCircle,
  ChevronRight,
  Star,
  Zap,
} from "lucide-react";
import { PARTNER_CONFIG } from "@/lib/core/partner-config";

const { contact, training } = PARTNER_CONFIG;

const steps = [
  {
    icon: Smartphone,
    title: "注册申请",
    desc: "填写基本信息，提交校园合伙人申请",
  },
  {
    icon: Zap,
    title: "在线培训",
    desc: `${training.duration}分钟掌握全套流程，AI工具帮你搞定设计`,
  },
  {
    icon: TrendingUp,
    title: "接单赚钱",
    desc: "周边小店、街边商户都是你的客户",
  },
];

const tasks = [
  { icon: Smartphone, title: "上门采集", desc: "到店拍照，采集店铺素材" },
  { icon: MessageCircle, title: "代提需求", desc: "帮老板填写品牌设计表单" },
  { icon: Star, title: "交付成果", desc: "把AI生成的VI方案交付客户" },
  { icon: Users, title: "维护关系", desc: "跟进客户满意度，促成复购" },
];


export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 顶栏 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a className="text-lg font-bold text-neutral-900" href="/">
            Brand Brain
          </a>
          <nav className="flex items-center gap-4">
            <a
              className="text-sm text-neutral-600 hover:text-neutral-900"
              href="/member/login"
            >
              品牌管家登录
            </a>
            <a
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
              href="/consultation"
            >
              提交设计需求
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-white">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-secondary/5" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6">
                <GraduationCap className="w-4 h-4" />
                校园合伙人计划
              </span>
              <h1 className="text-3xl md:text-5xl font-bold text-neutral-900 leading-tight">
                课余时间，帮身边小店变好看
                <br />
                <span className="text-primary">还能赚到生活费</span>
              </h1>
              <p className="mt-6 text-lg text-neutral-600 max-w-2xl mx-auto">
                零投入·零设计基础·AI全程加持，你只需要跑腿和沟通，
                设计的事交给 Brand Brain
              </p>
            </motion.div>
          </div>
        </section>

        {/* 三步加入 */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-neutral-900 text-center mb-12">
              三步成为合伙人
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  className="text-center p-6 rounded-2xl bg-neutral-50 border border-neutral-100"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-sm font-bold text-primary mb-2">
                    Step {i + 1}
                  </div>
                  <h3 className="font-bold text-neutral-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-neutral-500">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 你做什么 */}
        <section className="py-16 bg-neutral-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-neutral-900 text-center mb-12">
              你做什么
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {tasks.map((task) => (
                <div
                  key={task.title}
                  className="p-5 rounded-xl bg-white border border-neutral-100 text-center"
                >
                  <task.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-bold text-neutral-900 text-sm mb-1">
                    {task.title}
                  </h3>
                  <p className="text-xs text-neutral-500">{task.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-neutral-400 text-sm mt-6">
              不需要设计基础 — AI 负责生成，你负责跑腿和沟通
            </p>
          </div>
        </section>

        {/* 你能得到什么 */}
        <section className="py-16 bg-neutral-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-neutral-900 text-center mb-12">
              为什么选我们
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 mb-1">
                    零投入启动
                  </h3>
                  <p className="text-sm text-neutral-500">
                    不用垫钱，不用设计软件，一部手机就能开工
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 mb-1">
                    时间灵活
                  </h3>
                  <p className="text-sm text-neutral-500">
                    课余时间随时接单，不影响学业
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 mb-1">
                    越做越高
                  </h3>
                  <p className="text-sm text-neutral-500">
                    完成越多单，提成比例越高
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 底部CTA */}
        <section className="py-16 bg-primary">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              加入校园合伙人
            </h2>
            <p className="text-white/80 mb-8">
              添加微信 <span className="font-bold text-white">{contact.wechat}</span>，备注"校园合伙人"
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href={`https://wx.qq.com/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary font-medium rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                微信咨询
              </a>
              <a
                href="/member/login"
                className="inline-flex items-center gap-2 px-8 py-3 border-2 border-white/30 text-white font-medium rounded-xl hover:bg-white/10 transition-colors"
              >
                品牌管家登录
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-neutral-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-400">
            <a
              className="hover:text-neutral-600 transition-colors"
              href="/disclaimer"
            >
              免责声明
            </a>
            <span className="text-neutral-200">|</span>
            <a
              className="hover:text-neutral-600 transition-colors"
              href="/consultation"
            >
              联系我们
            </a>
          </div>
          <p className="text-xs text-neutral-400">
            © 2026 Brand Brain 品牌脑. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
