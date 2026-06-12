"use client";

import { motion } from "framer-motion";
import { FileText, Palette, Image, Type, Layout, BookOpen, Shield, PenTool, Frame, Grid3X3, Ruler, Scan } from "lucide-react";

const DELIVERABLES = [
  { icon: BookOpen, title: "品牌故事", desc: "品牌定位、核心价值、品牌主张" },
  { icon: Palette, title: "品牌色板", desc: "主色、辅色、渐变、应用色规范" },
  { icon: Type, title: "字体规范", desc: "中英文字体搭配、字号层级、行距规范" },
  { icon: Image, title: "品牌Logo", desc: "主标志+横版+竖版+单色版+最小使用规范" },
  { icon: Frame, title: "Logo安全区", desc: "最小尺寸、安全间距、禁用示例" },
  { icon: PenTool, title: "IP公仔形象", desc: "标准版(标准版含)、表情包、应用场景" },
  { icon: Layout, title: "名片模板", desc: "横竖双版本，含排版+色彩+字体规范" },
  { icon: Grid3X3, title: "社交媒体模板", desc: "小红书/朋友圈/抖音三套品牌化模板" },
  { icon: Ruler, title: "应用规范", desc: "门头、菜单、打包袋、工牌等延展" },
  { icon: Scan, title: "品牌图案", desc: "辅助图形、纹样、边框装饰元素" },
  { icon: FileText, title: "品牌话术", desc: "标准介绍、对外宣传语、客服话术" },
  { icon: Shield, title: "版权声明", desc: "商用授权书、源文件、版权归属证明" },
];

export function DeliverableSection() {
  return (
    <section className="py-20 bg-white" id="deliverables">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">
            交付什么，一目了然
          </h2>
          <p className="mt-3 text-neutral-500">
            VI手册15页内容全覆盖，拿到就能用
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DELIVERABLES.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                className="flex gap-3 p-5 rounded-xl border border-neutral-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">{item.title}</h4>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-8 p-5 bg-neutral-50 rounded-xl text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-neutral-600">
            📄 交付格式：<span className="font-medium text-neutral-900">PDF电子版 + PPTX可编辑源文件</span>（标准版含）
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            基础版交付PDF电子版，标准版含PPTX源文件可自行修改
          </p>
        </motion.div>
      </div>
    </section>
  );
}
