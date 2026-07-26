"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "你们展示的案例为什么这么少？别的公司都标「服务过上千家」。",
    a: "我们宁可少、也要真。网站上每个案例都是真实客户、真实交付的 VI 手册，且都拿到客户本人书面授权才公开。我们过去也用过「服务 200+ 家」这类数字，但那不是真实能背书的，已全部删掉。案例会随我们拿到更多客户授权而一个个解锁——稳，但每一个都经得起查。",
  },
  {
    q: "「授权」是什么？为什么这么重要？",
    a: "授权就是客户书面同意我们把他的 VI 手册（含 IP 公仔）挂在平台展示。没有书面同意，我们绝不公开客户的名字和作品——这是底线，也是对你未来作品的承诺：你的品牌资料，同样只经你同意才使用。",
  },
  {
    q: "你们说「7 天不满意全额退款」，怎么退？",
    a: "简单。购买后 7 天内，任何理由，直接联系我们微信说一声「要退款」，我们全额退，不扯皮、不扣手续费。目前是人工处理，请保留好我们的联系方式。",
  },
  {
    q: "生成的 logo 和 IP 公仔，版权归谁？能商用、能注册商标吗？",
    a: "100% 归您。下载的文件您随便印、随便用，也能拿去申请注册商标。能否注册成功取决于商标局审查及在先权利，建议您定稿后做查重评估，我们可协助对接商标代理。",
  },
  {
    q: "我填的店名、电话、地址，安全吗？",
    a: "只用来给您做手册，绝不外传、不卖给任何人。您想删，随时一句话我们全删掉，放心。",
  },
  {
    q: "AI 做的会不会很土、和别家撞款？",
    a: "不是套模板。按您店的行业、名字、调性量身生成 + 人工精修，撞款概率低；真不满意可改到满意。",
  },
  {
    q: "交付里包含什么？",
    a: "一套真实可用的 VI 品牌手册（封面、品牌色板、字体规范、Logo 标准用法及变体、辅助图形、应用场景规范等）+ 专属 IP 公仔形象（可用于门头、物料、朋友圈）。按您的店量身生成，不是模板套壳。",
  },
  {
    q: "最快多久能拿到方案？",
    a: "最快 3 个工作日出第一版 VI 方案。具体视您提供的资料与行业复杂度。",
  },
  {
    q: "需要我提前准备什么？",
    a: "提供品牌名称、行业、想要的风格方向，以及店名 / 招牌照片即可。如果有参考 VI 手册或喜欢的品牌风格，也建议发我们，AI 会优先学习参考。",
  },
  {
    q: "AI 生成后还会有人工精修吗？",
    a: "会。AI 负责初稿生成（多方案、高效率），我们的专业设计师会进行精修和细节调整，确保交付达到专业水准，不是直接丢个半成品给您。",
  },
  {
    q: "做出来不满意，能改吗？改几次？",
    a: "能改。标准版含 2 次免费修改；品牌管家月费期内不限次改，随时调色调字，直到您满意。",
  },
  {
    q: "怎么收费？",
    a: "基础版 ¥49 / 标准版 ¥99 / 品牌管家 ¥299/月。新手建议先从标准版体验。",
  },
  {
    q: "品牌管家 ¥299/月，比 ¥99 标准版多了啥？",
    a: "多了「有人管」：按月更新物料、换季出新图、随时改，不用您自己折腾，适合想长期经营的店。",
  },
  {
    q: "适合什么样的店？",
    a: "尤其适合实体小店（美容养生、餐饮、零售等）想低成本拥有品牌感。已展示真实案例：美容养生行业「百疗萃」。",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white" id="faq">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-neutral-900 text-center mb-3">常见问题</h2>
        <p className="text-center text-neutral-500 mb-12">
          关于信任、版权、退款，我们把您最担心的都讲在前面
        </p>

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
