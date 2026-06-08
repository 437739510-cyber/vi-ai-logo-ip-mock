"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { getManualByProject } from "@/lib/mock";
import type { ViManual } from "@/types";

export default function PrintPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [manual, setManual] = useState<ViManual | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { projectId: id } = await params;
        setProjectId(id);
        const m = await getManualByProject(id);
        if (m) setManual(m);
      } catch {}
      setLoading(false);
    })();
  }, [params]);

  if (loading || !manual) return null;

  const { cover, brandColors, logoSpecs, typography, auxiliaryGraphics } = manual;
  const pc = brandColors.primary.hex;

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <Link href={`/admin/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-4 h-4"/>返回
        </Link>
        <button onClick={()=>window.print()} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors">
          <Printer className="w-4 h-4"/>打印 / 导出 PDF
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto py-8 space-y-8 print:space-y-0 print:py-0">

        {/* === 第1页：封面 === */}
        <section className="bg-white shadow-sm print:shadow-none overflow-hidden" style={{pageBreakAfter:"always"}}>
          <div className="flex flex-col min-h-[297mm] relative">
            <div className="absolute inset-0" style={{background:`linear-gradient(160deg,${pc} 0%,#0d47a1 100%)`}}/>
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{background:brandColors.secondary.hex}}/>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-16 text-center">
              <div className="w-24 h-24 rounded-2xl bg-white/15 backdrop-blur-sm mb-10 flex items-center justify-center border border-white/20">
                <svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="22" fill="white" opacity="0.25"/><path d="M14,32 Q25,8 36,32 Q47,56 58,32" fill="none" stroke="white" strokeWidth="2.5" opacity="0.6" strokeLinecap="round"/></svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">{cover.title}</h1>
              <p className="text-lg text-white/70 mb-1 font-light tracking-wider">{cover.subtitle}</p>
              <div className="w-16 h-0.5 bg-white/40 my-8"/>
              <p className="text-sm text-white/60 font-mono tracking-widest">版本 {cover.version}</p>
              <p className="text-sm text-white/60 font-mono">{cover.date}</p>
            </div>
            <div className="relative z-10 px-16 pb-12">
              <div className="border-t border-white/20 pt-4 flex items-center justify-between">
                <span className="text-xs text-white/50 tracking-wider">{cover.companyName}</span>
                <span className="text-xs text-white/30 font-mono">CONFIDENTIAL</span>
              </div>
            </div>
          </div>
        </section>

        {/* === 第2页：Logo 规范（含网格图、错误用法等视觉元素） === */}
        <section className="bg-white shadow-sm print:shadow-none" style={{pageBreakAfter:"always"}}>
          <div className="min-h-[297mm] p-12 md:p-16 flex flex-col">

            {/* 页眉 */}
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded" style={{backgroundColor:pc}}/>
                <span className="text-xs text-neutral-400 font-medium tracking-wider">{cover.companyName} · VI Guidelines</span>
              </div>
              <span className="text-[10px] text-neutral-300 font-mono">{cover.title} v{cover.version}</span>
            </div>

            <span className="text-[10px] text-neutral-400 font-mono tracking-widest mb-2">01</span>
            <h2 className="text-2xl font-bold mb-3" style={{color:pc}}>Logo 标识规范</h2>
            <p className="text-xs text-neutral-500 max-w-xl leading-relaxed mb-8">{logoSpecs.explanation}</p>

            {/* 标准组合 — SVG 绘制 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">标准组合</h3>
            <div className="grid grid-cols-2 gap-6 mb-8">
              {logoSpecs.standardCombinations.map((c,i)=>(
                <div key={i} className="border border-neutral-100 rounded-lg p-6 text-center">
                  <svg width="160" height="50" viewBox="0 0 160 50" className="mx-auto mb-2">
                    <rect x="0" y="8" width="34" height="34" rx="4" fill={pc} opacity="0.1"/>
                    <circle cx="17" cy="25" r="9" fill={pc} opacity="0.25"/>
                    <path d="M7,28 Q17,14 27,28" fill="none" stroke={pc} strokeWidth="1.5" opacity="0.4"/>
                    <rect x="44" y="14" width={c.type==="horizontal"?90:50} height="6" rx="2" fill={pc} opacity="0.15"/>
                    <rect x="44" y="24" width={c.type==="horizontal"?64:50} height="4" rx="1" fill="#ccc" opacity="0.25"/>
                    <rect x="44" y="32" width={c.type==="horizontal"?50:40} height="3" rx="1" fill="#ddd" opacity="0.2"/>
                  </svg>
                  <p className="text-xs font-medium text-neutral-700 mb-0.5">{c.label}</p>
                  <p className="text-[9px] text-neutral-400">{c.description}</p>
                </div>
              ))}
            </div>

            {/* 网格比例图 — SVG 绘制 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">标识网格比例</h3>
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-100 mb-8 text-center">
              <svg width="300" height="120" viewBox="0 0 300 120" className="mx-auto">
                <defs>
                  <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M20 0L0 0 0 20" fill="none" stroke="#DDD" strokeWidth="0.5"/>
                  </pattern>
                  <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={pc}/>
                    <stop offset="100%" stopColor="#0d47a1"/>
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="300" height="120" fill="url(#g)" rx="2"/>
                <rect x="0.5" y="0.5" width="299" height="119" fill="none" stroke="#BBB" strokeWidth="1" strokeDasharray="4,3" rx="2"/>
                <text x="10" y="15" fontSize="5" fill="#999" fontFamily="monospace">8X</text>
                <text x="298" y="70" fontSize="5" fill="#999" fontFamily="monospace">3.5X</text>
                <g transform="translate(50,20) scale(1.3)">
                  <rect x="0" y="0" width="42" height="42" rx="4" fill="url(#lg)" opacity="0.08"/>
                  <circle cx="21" cy="21" r="14" fill="url(#lg)" opacity="0.15"/>
                  <path d="M7,28 Q21,10 35,28" fill="none" stroke={pc} strokeWidth="2" opacity="0.5" strokeLinecap="round"/>
                  <rect x="48" y="12" width="70" height="6" rx="2" fill={pc} opacity="0.12"/>
                  <rect x="48" y="22" width="50" height="3" rx="1" fill="#CCC" opacity="0.2"/>
                  <text x="0" y="58" fontSize="4" fill="#AAA">X</text>
                  <text x="42" y="58" fontSize="4" fill="#AAA">2X</text>
                </g>
              </svg>
              <p className="text-[9px] text-neutral-500 mt-3">{logoSpecs.gridSpec.description}</p>
            </div>

            {/* 最小尺寸 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">最小尺寸与保护空间</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {logoSpecs.clearSpace.minimumSizes.map((m,i)=>(
                <div key={i} className="border border-neutral-100 rounded-lg p-4 text-center bg-neutral-50/50">
                  <div className="text-xl font-bold mb-1" style={{color:pc}}>{m.minSize}</div>
                  <p className="text-[10px] font-medium text-neutral-700 mb-1">{m.scenario}</p>
                  <p className="text-[8px] text-neutral-400">{m.note}</p>
                </div>
              ))}
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-8">
              <p className="text-[10px] text-amber-700">保护空间: {logoSpecs.clearSpace.rule} · 标识四周应保留足够空白区域，不得放置文字或图形</p>
            </div>

            {/* 标识颜色 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">标识颜色</h3>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {logoSpecs.logoColors.map((cl,i)=>(
                <div key={i} className="text-center">
                  <div className="w-full aspect-square rounded-xl mb-2 border border-neutral-100" style={{backgroundColor:cl.hex}}/>
                  <p className="text-[9px] font-medium text-neutral-700">{cl.name}</p>
                  <p className="text-[7px] text-neutral-400 font-mono">{cl.hex}</p>
                  <p className="text-[7px] text-neutral-400 font-mono">{cl.cmyk}</p>
                </div>
              ))}
            </div>

            {/* 单色黑与反白 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">单色黑与反白标识</h3>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="border border-neutral-100 rounded-lg p-4">
                <svg width="100%" height="40" viewBox="0 0 180 40">
                  <rect x="10" y="4" width="28" height="28" rx="3" fill="#333" opacity="0.8"/>
                  <circle cx="24" cy="18" r="7" fill="#555"/>
                  <rect x="44" y="12" width="90" height="4" rx="1" fill="#333" opacity="0.6"/>
                  <rect x="44" y="20" width="60" height="2.5" rx="1" fill="#333" opacity="0.4"/>
                </svg>
                <p className="text-[9px] text-neutral-500 mt-1">适用于单色印刷、传真、雕刻等单色场景</p>
              </div>
              <div className="border border-neutral-100 rounded-lg p-4 bg-neutral-900">
                <svg width="100%" height="40" viewBox="0 0 180 40">
                  <rect x="10" y="4" width="28" height="28" rx="3" fill="white" opacity="0.15"/>
                  <circle cx="24" cy="18" r="7" fill="white" opacity="0.35"/>
                  <rect x="44" y="12" width="90" height="4" rx="1" fill="white" opacity="0.5"/>
                  <rect x="44" y="20" width="60" height="2.5" rx="1" fill="white" opacity="0.35"/>
                </svg>
                <p className="text-[9px] text-neutral-400 mt-1">适用于深色背景、视频片尾、暗色界面</p>
              </div>
            </div>

            {/* 错误用法 — SVG 图例 */}
            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">错误用法示例</h3>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                {t:"c",l:"改变颜色",desc:"不得更改标准色"},
                {t:"s",l:"拉伸比例",desc:"不得拉伸压缩"},
                {t:"r",l:"旋转方向",desc:"不得旋转翻转"},
                {t:"f",l:"替换字体",desc:"不得替换标准字"},
                {t:"h",l:"添加阴影",desc:"不得添加效果"},
                {t:"o",l:"放入轮廓",desc:"不得任意框选"},
                {t:"k",l:"对比不足",desc:"避免低对比背景"},
                {t:"p",l:"重复装饰",desc:"不得作为底纹"},
              ].map(({t,l,desc},i)=>(
                <div key={i} className="border border-red-200 rounded-lg p-2 bg-red-50/30 text-center">
                  <svg width="100%" height="50" viewBox="0 0 80 50" className="mx-auto">
                    {t==="c"&&<><circle cx="35" cy="22" r="12" fill="#FF6B6B" opacity="0.5"/></>}
                    {t==="s"&&<><ellipse cx="35" cy="22" rx="18" ry="8" fill={pc} opacity="0.2"/></>}
                    {t==="r"&&<g transform="rotate(25,35,22)"><circle cx="35" cy="22" r="12" fill={pc} opacity="0.2"/></g>}
                    {t==="f"&&<><circle cx="28" cy="22" r="10" fill={pc} opacity="0.2"/><text x="42" y="26" fontSize="12" fontFamily="serif" fill="#333">品</text></>}
                    {t==="h"&&<><circle cx="35" cy="22" r="12" fill={pc} opacity="0.2"/><line x1="5" y1="40" x2="75" y2="40" stroke="#999" strokeWidth="0.5"/></>}
                    {t==="o"&&<><circle cx="35" cy="22" r="12" fill={pc} opacity="0.2"/><rect x="18" y="4" width="44" height="36" fill="none" stroke="#fca5a5" strokeWidth="1" strokeDasharray="2,1"/></>}
                    {t==="k"&&<><rect x="18" y="4" width="44" height="36" rx="2" fill={pc}/><circle cx="35" cy="22" r="12" fill={pc} opacity="0.8" stroke="#fca5a5" strokeWidth="1"/></>}
                    {t==="p"&&<><circle cx="20" cy="20" r="8" fill={pc} opacity="0.12"/><circle cx="35" cy="20" r="8" fill={pc} opacity="0.12"/><circle cx="50" cy="20" r="8" fill={pc} opacity="0.12"/><circle cx="27" cy="8" r="6" fill={pc} opacity="0.12"/><circle cx="43" cy="8" r="6" fill={pc} opacity="0.12"/></>}
                    <line x1="4" y1="4" x2="14" y2="14" stroke="#ef4444" strokeWidth="1.5"/>
                    <line x1="14" y1="4" x2="4" y2="14" stroke="#ef4444" strokeWidth="1.5"/>
                  </svg>
                  <p className="text-[8px] font-medium text-red-700 mt-0.5">{l}</p>
                  <p className="text-[7px] text-red-400">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-100 flex justify-between text-[9px] text-neutral-300">
              <span>{cover.companyName}</span>
              <span>{cover.title} · Logo 规范 · 第 2 页</span>
            </div>
          </div>
        </section>

        {/* === 第3页：品牌色彩系统 === */}
        <section className="bg-white shadow-sm print:shadow-none" style={{pageBreakAfter:"always"}}>
          <div className="min-h-[297mm] p-12 md:p-16 flex flex-col">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-3"><div className="w-6 h-6 rounded" style={{backgroundColor:pc}}/><span className="text-xs text-neutral-400 font-medium tracking-wider">{cover.companyName} · VI Guidelines</span></div>
              <span className="text-[10px] text-neutral-300 font-mono">{cover.title} v{cover.version}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest mb-2">02</span>
            <h2 className="text-2xl font-bold mb-6" style={{color:pc}}>品牌色彩系统</h2>

            <div className="grid grid-cols-3 gap-5 mb-8">
              {[brandColors.primary,brandColors.secondary,brandColors.accent].map((cl,i)=>(
                <div key={i} className="rounded-xl overflow-hidden border border-neutral-100">
                  <div className="h-24 flex items-end p-3" style={{backgroundColor:cl.hex}}>
                    <span className="text-[10px] font-medium text-white drop-shadow-sm">{cl.name}</span>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-[9px] text-neutral-500 font-mono">{cl.hex}</p>
                    <p className="text-[9px] text-neutral-500 font-mono">{cl.cmyk}</p>
                    {cl.usage&&<p className="text-[8px] text-neutral-400">{cl.usage}</p>}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">中性色</h3>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {brandColors.neutrals.map((cl,i)=>(
                <div key={i} className="text-center">
                  <div className="w-full aspect-[3/2] rounded-lg mb-2 border" style={{backgroundColor:cl.hex,borderColor:cl.hex==="#F8F9FA"?"#E8EAED":"transparent"}}/>
                  <p className="text-[10px] font-medium text-neutral-700">{cl.name}</p>
                  <p className="text-[8px] text-neutral-400 font-mono">{cl.hex}</p>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">色彩优先使用级</h3>
            <div className="space-y-2 mb-6">
              {brandColors.hierarchy.map((h,i)=>(
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-neutral-50">
                  <span className="text-[10px] font-medium text-neutral-600 w-16 shrink-0">{h.level}</span>
                  <div className="flex gap-1.5 flex-1 flex-wrap">
                    {h.colors.map((s,j)=>{const m=s.match(/#[A-Fa-f0-9]{6}/);const hx=m?m[0]:"#ccc";return <div key={j} className="w-4 h-4 rounded border border-neutral-200" style={{backgroundColor:hx}} title={s}/>})}
                  </div>
                  <span className="text-[9px] text-neutral-400 flex-1 text-right">{h.usage}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100 mb-8">
              <h3 className="text-xs font-semibold text-neutral-700 mb-2">配色原则</h3>
              <p className="text-[10px] text-neutral-600 leading-relaxed">{brandColors.matchingRules}</p>
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-100 flex justify-between text-[9px] text-neutral-300">
              <span>{cover.companyName}</span>
              <span>{cover.title} · 色彩系统 · 第 3 页</span>
            </div>
          </div>
        </section>

        {/* === 第4页：字体规范 === */}
        <section className="bg-white shadow-sm print:shadow-none" style={{pageBreakAfter:"always"}}>
          <div className="min-h-[297mm] p-12 md:p-16 flex flex-col">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-3"><div className="w-6 h-6 rounded" style={{backgroundColor:pc}}/><span className="text-xs text-neutral-400 font-medium tracking-wider">{cover.companyName} · VI Guidelines</span></div>
              <span className="text-[10px] text-neutral-300 font-mono">{cover.title} v{cover.version}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest mb-2">03</span>
            <h2 className="text-2xl font-bold mb-6" style={{color:pc}}>字体规范</h2>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">中文字体</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-neutral-100 rounded-lg p-4">
                <p className="text-[9px] text-neutral-400 mb-1">专用字体</p>
                <p className="text-lg font-bold" style={{fontFamily:typography.chinese.brandFont.font}}>{typography.chinese.brandFont.font}</p>
                <p className="text-[9px] text-neutral-400">Weight: {typography.chinese.brandFont.weights.join("/")}</p>
              </div>
              <div className="border border-neutral-100 rounded-lg p-4">
                <p className="text-[9px] text-neutral-400 mb-1">通用正文</p>
                <p className="text-lg font-medium" style={{fontFamily:typography.chinese.bodyFont.font}}>{typography.chinese.bodyFont.font}</p>
                <p className="text-[9px] text-neutral-400">Weight: {typography.chinese.bodyFont.weights.join("/")}</p>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">字号层级</h3>
            <div className="space-y-1 mb-8">
              {typography.chinese.sizeHierarchy.map((l,i)=>(
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                  <div>
                    <p className="text-sm font-bold text-neutral-700" style={{fontSize:l.fontSize,fontWeight:l.fontWeight,fontFamily:typography.chinese.brandFont.font}}>Aa 示例文字</p>
                    <p className="text-[9px] text-neutral-400">{l.level} · {l.usage}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-primary">{l.fontSize}</p>
                    <p className="text-[9px] text-neutral-400">{l.fontWeight} / {l.lineHeight}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-700 mb-2">使用原则</h3>
              <ul className="space-y-1">
                {typography.principles.map((p,i)=>(<li key={i} className="text-[10px] text-neutral-600 flex items-start gap-2"><span className="text-primary">•</span>{p}</li>))}
              </ul>
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-100 flex justify-between text-[9px] text-neutral-300">
              <span>{cover.companyName}</span>
              <span>{cover.title} · 字体规范 · 第 4 页</span>
            </div>
          </div>
        </section>

        {/* === 第5页：辅助图形（含SVG绘制的几何图案） === */}
        <section className="bg-white shadow-sm print:shadow-none" style={{pageBreakAfter:"always"}}>
          <div className="min-h-[297mm] p-12 md:p-16 flex flex-col">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-3"><div className="w-6 h-6 rounded" style={{backgroundColor:pc}}/><span className="text-xs text-neutral-400 font-medium tracking-wider">{cover.companyName} · VI Guidelines</span></div>
              <span className="text-[10px] text-neutral-300 font-mono">{cover.title} v{cover.version}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest mb-2">04</span>
            <h2 className="text-2xl font-bold mb-6" style={{color:pc}}>辅助图形</h2>
            <p className="text-xs text-neutral-500 leading-relaxed mb-8">{auxiliaryGraphics.concept}</p>

            {/* SVG辅助图形展示 */}
            <svg width="100%" height="120" viewBox="0 0 400 120" className="w-full mb-8">
              <defs>
                <pattern id="ap" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill={pc} opacity="0.06"/>
                  <line x1="0" y1="10" x2="20" y2="10" stroke={pc} strokeWidth="0.3" opacity="0.03"/>
                </pattern>
              </defs>
              <rect width="400" height="120" fill="url(#ap)" rx="8"/>
              <path d="M80,60 Q120,20 160,60 Q200,100 240,60 Q280,20 320,60" fill="none" stroke={pc} strokeWidth="1.5" opacity="0.2"/>
              <circle cx="120" cy="50" r="3" fill={pc} opacity="0.3"/>
              <circle cx="200" cy="60" r="4" fill={brandColors.secondary.hex} opacity="0.25"/>
              <circle cx="280" cy="50" r="3" fill={pc} opacity="0.3"/>
              <circle cx="160" cy="30" r="2" fill={pc} opacity="0.15"/>
              <circle cx="240" cy="90" r="2" fill={pc} opacity="0.15"/>
              {[60,100,140,180,220,260,300,340].map((x,j)=>(
                <circle key={j} cx={x} cy={80+Math.sin(x*0.03)*15} r="1.5" fill={pc} opacity={0.1+Math.sin(x)*0.08}/>
              ))}
            </svg>

            <div className="grid grid-cols-2 gap-6">
              {auxiliaryGraphics.graphics.map((g,i)=>(
                <div key={i} className="border border-neutral-100 rounded-lg p-6">
                  <svg width="100%" height="80" viewBox="0 0 200 80">
                    <rect width="200" height="80" fill="url(#ap)" rx="4"/>
                    <path d="M50,40 Q75,20 100,40 Q125,60 150,40" fill="none" stroke={pc} strokeWidth="1" opacity="0.25"/>
                    <circle cx="100" cy="40" r="2.5" fill={pc} opacity="0.4"/>
                  </svg>
                  <p className="text-xs font-medium text-neutral-700 mt-3 mb-1">{g.name}</p>
                  <p className="text-[9px] text-neutral-500">{g.applicationRules}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-100 flex justify-between text-[9px] text-neutral-300">
              <span>{cover.companyName}</span>
              <span>{cover.title} · 辅助图形 · 第 5 页</span>
            </div>
          </div>
        </section>

        {/* === 第6页：应用系统（含名片/信纸/PPT等SVG设计稿） === */}
        <section className="bg-white shadow-sm print:shadow-none" style={{pageBreakAfter:"always"}}>
          <div className="min-h-[297mm] p-12 md:p-16 flex flex-col">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-3"><div className="w-6 h-6 rounded" style={{backgroundColor:pc}}/><span className="text-xs text-neutral-400 font-medium tracking-wider">{cover.companyName} · VI Guidelines</span></div>
              <span className="text-[10px] text-neutral-300 font-mono">{cover.title} v{cover.version}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest mb-2">05</span>
            <h2 className="text-2xl font-bold mb-6" style={{color:pc}}>应用系统</h2>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">名片</h3>
            <div className="border border-neutral-100 rounded-lg p-6 mb-8 max-w-sm mx-auto">
              <svg width="270" height="162" viewBox="0 0 270 162" className="w-full">
                <defs><linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff"/><stop offset="100%" stopColor="#f5f5f5"/></linearGradient></defs>
                <rect width="270" height="162" fill="url(#card)" rx="4" stroke="#ddd" strokeWidth="0.5"/>
                <rect x="16" y="16" width="36" height="36" rx="4" fill={pc} opacity="0.12"/>
                <circle cx="34" cy="34" r="10" fill={pc} opacity="0.3"/>
                <text x="62" y="30" fontSize="10" fontWeight="bold" fill="#333">{cover.companyName}</text>
                <text x="62" y="42" fontSize="5.5" fill="#999">TECHNOLOGY CO., LTD</text>
                <line x1="16" y1="62" x2="254" y2="62" stroke={pc} strokeWidth="0.5" opacity="0.2"/>
                <text x="16" y="86" fontSize="11" fontWeight="bold" fill="#333">张 三</text>
                <text x="16" y="98" fontSize="6.5" fill="#888">首席执行官 CEO</text>
                <text x="16" y="118" fontSize="6" fill="#999">T: 138-0000-0000</text>
                <text x="16" y="130" fontSize="6" fill="#999">E: contact@example.com</text>
                <rect x="0" y="155" width="270" height="7" fill={pc} rx="2"/>
              </svg>
              <p className="text-[9px] text-neutral-500 text-center mt-3">90×54mm · 300DPI · 名片正面设计</p>
            </div>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">信纸</h3>
            <div className="border border-neutral-100 rounded-lg p-4 mb-8 max-w-sm mx-auto">
              <svg width="100%" height="150" viewBox="0 0 210 150" className="w-full">
                <rect width="210" height="150" fill="#fff" rx="2" stroke="#eee"/>
                <line x1="0" y1="32" x2="210" y2="32" stroke={pc} strokeWidth="0.8" opacity="0.15"/>
                <rect x="12" y="6" width="24" height="22" rx="3" fill={pc} opacity="0.1"/>
                <text x="42" y="17" fontSize="7" fontWeight="bold" fill="#444">{cover.companyName}</text>
                <text x="42" y="25" fontSize="4.5" fill="#aaa">TECHNOLOGY CO., LTD</text>
                {[46,56,66,76,86,96,106].map((y,i)=>(<rect key={i} x={12} y={y} width={150-i*12} height="3" rx="1" fill="#eee"/>))}
                <line x1="0" y1="138" x2="210" y2="138" stroke={pc} strokeWidth="0.8" opacity="0.15"/>
                <text x="12" y="144" fontSize="4.5" fill="#ccc">上海市浦东新区 · {cover.companyName} · T: 021-XXXX-XXXX</text>
              </svg>
              <p className="text-[9px] text-neutral-500 text-center mt-2">A4 · 210×297mm</p>
            </div>

            <h3 className="text-xs font-semibold text-neutral-700 mb-4 tracking-wider">PPT 模板</h3>
            <div className="border border-neutral-100 rounded-lg p-4 mb-8 max-w-md mx-auto">
              <svg width="100%" height="120" viewBox="0 0 240 120" className="w-full">
                <rect width="240" height="120" fill="#fff" rx="3" stroke="#ddd"/>
                <rect width="240" height="24" fill={pc} opacity="0.06"/>
                <text x="14" y="16" fontSize="7" fontWeight="bold" fill="#444">{cover.title}</text>
                <rect x="20" y="38" width="100" height="7" rx="2" fill={pc} opacity="0.15"/>
                <rect x="20" y="50" width="70" height="5" rx="1" fill="#ddd" opacity="0.3"/>
                <rect x="20" y="66" width="200" height="2" rx="1" fill="#eee"/>
                <rect x="20" y="74" width="180" height="2" rx="1" fill="#eee"/>
                <rect x="20" y="82" width="160" height="2" rx="1" fill="#eee"/>
                <rect x="0" y="0" width="3" height="120" fill={pc} opacity="0.12"/>
                <rect x="202" y="108" width="28" height="7" rx="2" fill={pc} opacity="0.08"/>
              </svg>
              <p className="text-[9px] text-neutral-500 text-center mt-2">16:9 宽屏 · 1920×1080</p>
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-100 flex justify-between text-[9px] text-neutral-300">
              <span>{cover.companyName}</span>
              <span>{cover.title} · 应用系统 · 第 6 页</span>
            </div>
          </div>
        </section>

      </div>
      <style jsx global>{`@media print{body{background:white!important;margin:0!important}.sticky{display:none!important}@page{margin:0}}`}</style>
    </div>
  );
}
