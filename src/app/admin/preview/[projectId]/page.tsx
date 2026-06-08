"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { getManualByProject } from "@/lib/mock";
import type { ViManual } from "@/types";

// Define the page structure based on real VI manual content
const PAGES = [
  "封面",
  "Logo 标识诠释",
  "标准组合与网格",
  "标识颜色",
  "错误用法",
  "品牌色彩系统",
  "字体规范",
  "辅助图形",
  "应用系统",
] as const;

function ColorSwatch({ name, hex, cmyk, rgb }: { name: string; hex: string; cmyk?: string; rgb?: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-neutral-100">
      <div className="w-10 h-10 rounded-lg shrink-0 border" style={{ backgroundColor: hex }} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-800">{name}</p>
        <p className="text-[10px] text-neutral-400 font-mono">{hex}</p>
        {cmyk && <p className="text-[10px] text-neutral-400 font-mono">{cmyk}</p>}
      </div>
    </div>
  );
}

function IncorrectUsageCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-red-200 rounded-lg p-3 bg-red-50/50">
      <div className="w-full h-16 bg-white rounded border border-red-100 mb-2 flex items-center justify-center">
        <span className="text-red-300 text-[10px]">[错误示例]</span>
      </div>
      <p className="text-xs font-medium text-red-700 mb-0.5">{title}</p>
      <p className="text-[10px] text-red-500">{description}</p>
    </div>
  );
}

export default function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [manual, setManual] = useState<ViManual | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { projectId: id } = await params;
        setProjectId(id);
        const [m] = await Promise.all([getManualByProject(id)]);
        if (m) setManual(m);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse space-y-4">
          <div className="w-64 h-80 bg-neutral-100 rounded-xl" />
          <div className="h-4 bg-neutral-100 rounded w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!manual) return <ErrorState message="尚未生成手册，请先在项目中生成" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目
        </Link>
        <span className="text-sm text-neutral-400">
          {currentPage + 1} / {PAGES.length}
        </span>
        <Link
          href={`/admin/export/${projectId}`}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1.5 ml-auto"
        >
          <Download className="w-4 h-4" />
          导出交付
        </Link>
      </div>

      {/* Page Viewer */}
      <div className="relative bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="aspect-[210/297] max-h-[75vh] p-8 md:p-12 flex flex-col overflow-y-auto">
          {/* === Page 0: Cover === */}
          {currentPage === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-xl mb-6" style={{ backgroundColor: manual.brandColors.primary.hex }} />
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: manual.brandColors.primary.hex }}
              >
                {manual.cover.title}
              </h1>
              <p className="text-sm text-neutral-500 mb-8">{manual.cover.subtitle}</p>
              <div className="border-t border-neutral-200 pt-6 w-48 text-center">
                <p className="text-xs text-neutral-400">版本 {manual.cover.version}</p>
                <p className="text-xs text-neutral-400">{manual.cover.date}</p>
                <p className="text-xs text-neutral-500 mt-2 font-medium">{manual.cover.companyName}</p>
              </div>
            </div>
          )}

          {/* === Page 1: Logo Explanation === */}
          {currentPage === 1 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                1.1 标识诠释
              </h2>
              <div className="flex items-center justify-center py-6">
                {manual.logoSpecs.standardCombinations[0]?.imageUrl ? (
                  <img src={manual.logoSpecs.standardCombinations[0].imageUrl} alt="Logo" className="h-20 object-contain" />
                ) : (
                  <div className="w-20 h-20 bg-neutral-100 rounded-lg flex items-center justify-center text-xs text-neutral-400">Logo</div>
                )}
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">
                {manual.logoSpecs.explanation}
              </p>
              <div className="flex flex-wrap gap-2">
                {manual.logoSpecs.conceptKeywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full">{kw}</span>
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-neutral-700">标准组合</h3>
                <div className="grid grid-cols-2 gap-3">
                  {manual.logoSpecs.standardCombinations.map((combo, i) => (
                    <div key={i} className="border border-neutral-100 rounded-lg p-3 text-center">
                      <div className="h-12 flex items-center justify-center mb-2 bg-neutral-50 rounded">
                        <img src={combo.imageUrl} alt={combo.label} className="h-8 object-contain" />
                      </div>
                      <p className="text-xs font-medium">{combo.label}</p>
                      <p className="text-[10px] text-neutral-400">{combo.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === Page 2: Grid + Clear Space === */}
          {currentPage === 2 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                标识网格与保护空间
              </h2>

              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-3">1.3 标识网格比例</h3>
                <div className="bg-neutral-50 rounded-lg p-6 flex items-center justify-center border border-neutral-100">
                  <div className="w-48 h-20 border-2 border-dashed border-primary/40 rounded relative flex items-center justify-center bg-white">
                    <span className="text-[10px] text-neutral-400">网格比例图</span>
                    <span className="absolute -top-3 left-0 text-[10px] text-neutral-400">{manual.logoSpecs.gridSpec.proportions}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-2">{manual.logoSpecs.gridSpec.description}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-3">1.4 最小尺寸与保护空间</h3>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-xs text-amber-700">保护空间: {manual.logoSpecs.clearSpace.rule}</p>
                </div>
                <div className="space-y-2">
                  {manual.logoSpecs.clearSpace.minimumSizes.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-neutral-700">{item.scenario}</p>
                        <p className="text-[10px] text-neutral-400">{item.note}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">{item.minSize}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === Page 3: Logo Colors === */}
          {currentPage === 3 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                1.5 标识颜色
              </h2>
              <p className="text-xs text-neutral-500">标识颜色是品牌识别的核心资产,优先使用标准蓝色标识。以下为标准色的具体数值:</p>
              <div className="grid grid-cols-2 gap-3">
                {manual.logoSpecs.logoColors.map((color, i) => (
                  <ColorSwatch key={i} {...color} />
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-neutral-700">单色黑与反白标识</h3>
                <div className="grid grid-cols-2 gap-3">
                  {manual.logoSpecs.monochromeBlack && (
                    <div className="border border-neutral-100 rounded-lg p-3">
                      <p className="text-xs font-medium mb-1">单色黑标识</p>
                      <p className="text-[10px] text-neutral-500">{manual.logoSpecs.monochromeBlack.usageRules}</p>
                    </div>
                  )}
                  {manual.logoSpecs.reversedOut && (
                    <div className="border border-neutral-100 rounded-lg p-3 bg-neutral-900 text-white">
                      <p className="text-xs font-medium mb-1">反白标识</p>
                      <p className="text-[10px] text-neutral-300">{manual.logoSpecs.reversedOut.usageRules}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === Page 4: Incorrect Usages === */}
          {currentPage === 4 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                1.9 标识错误用法
              </h2>
              <p className="text-xs text-neutral-500">标识比例、结构、颜色和标准字均经过统一设定,任何情况下不得擅自改变:</p>
              <div className="grid grid-cols-2 gap-2">
                {manual.logoSpecs.incorrectUsages.map((item, i) => (
                  <IncorrectUsageCard key={i} title={item.title} description={item.description} />
                ))}
              </div>
            </div>
          )}

          {/* === Page 5: Color System === */}
          {currentPage === 5 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                2. 品牌色彩系统
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <ColorSwatch {...manual.brandColors.primary} />
                <ColorSwatch {...manual.brandColors.secondary} />
                <ColorSwatch {...manual.brandColors.accent} />
                {manual.brandColors.neutrals.map((c, i) => (
                  <ColorSwatch key={i} {...c} />
                ))}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-3">色彩优先使用级</h3>
                <div className="space-y-2">
                  {manual.brandColors.hierarchy.map((h, i) => (
                    <div key={i} className="p-2 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-neutral-700 w-16">{h.level}</span>
                        <span className="text-[10px] text-neutral-500 flex-1">{h.colors.join(", ")}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">{h.usage}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">配色原则</h3>
                <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-3 leading-relaxed">
                  {manual.brandColors.matchingRules}
                </p>
              </div>
            </div>
          )}

          {/* === Page 6: Typography === */}
          {currentPage === 6 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                3. 字体规范
              </h2>

              {/* Chinese */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">3.1 中文字体</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="border border-neutral-100 rounded-lg p-2">
                    <p className="text-[10px] text-neutral-400">专用字体</p>
                    <p className="text-sm font-bold">{manual.typography.chinese.brandFont.font}</p>
                    <p className="text-[10px] text-neutral-400">Weight: {manual.typography.chinese.brandFont.weights.join("/")}</p>
                  </div>
                  <div className="border border-neutral-100 rounded-lg p-2">
                    <p className="text-[10px] text-neutral-400">通用字体</p>
                    <p className="text-sm font-medium">{manual.typography.chinese.bodyFont.font}</p>
                    <p className="text-[10px] text-neutral-400">Weight: {manual.typography.chinese.bodyFont.weights.join("/")}</p>
                  </div>
                </div>

                <h3 className="text-xs font-semibold text-neutral-700 mb-2">字号层级</h3>
                <div className="space-y-1">
                  {manual.typography.chinese.sizeHierarchy.map((level, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-neutral-700">{level.level}</p>
                        <p className="text-[10px] text-neutral-400">{level.usage}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-primary">{level.fontSize}</p>
                        <p className="text-[10px] text-neutral-400">{level.fontWeight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* English */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">3.2 英文字体</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="border border-neutral-100 rounded-lg p-2">
                    <p className="text-[10px] text-neutral-400">Brand Font</p>
                    <p className="text-sm font-bold">{manual.typography.english.brandFont.font}</p>
                  </div>
                  <div className="border border-neutral-100 rounded-lg p-2">
                    <p className="text-[10px] text-neutral-400">Body Font</p>
                    <p className="text-sm font-medium">{manual.typography.english.bodyFont.font}</p>
                  </div>
                </div>
                {manual.typography.english.sizeHierarchy.map((level, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg mb-1">
                    <p className="text-xs text-neutral-600">{level.level}</p>
                    <p className="text-xs font-mono text-primary">{level.fontSize}</p>
                  </div>
                ))}
              </div>

              {/* Principles */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">字体使用原则</h3>
                <ul className="space-y-1">
                  {manual.typography.principles.map((p, i) => (
                    <li key={i} className="text-xs text-neutral-600 flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* === Page 7: Auxiliary Graphics === */}
          {currentPage === 7 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                4. 辅助图形
              </h2>
              <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 rounded-lg p-4">
                {manual.auxiliaryGraphics.concept}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {manual.auxiliaryGraphics.graphics.map((g, i) => (
                  <div key={i} className="border border-neutral-100 rounded-lg p-4">
                    <div className="h-24 bg-neutral-50 rounded-lg mb-2 flex items-center justify-center">
                      <img src={g.imageUrl} alt={g.name} className="h-16 object-contain opacity-60" />
                    </div>
                    <p className="text-xs font-medium text-neutral-700">{g.name}</p>
                    <p className="text-[10px] text-neutral-500 mt-1">{g.applicationRules}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Page 8: Applications === */}
          {currentPage === 8 && (
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-bold text-neutral-900" style={{ color: manual.brandColors.primary.hex }}>
                5. 应用系统
              </h2>

              {/* Office */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">5.1 办公用品</h3>
                <div className="grid grid-cols-2 gap-2">
                  {manual.applications.office.map((app, i) => (
                    <div key={i} className="border border-neutral-100 rounded-lg p-3">
                      <div className="h-16 bg-neutral-50 rounded mb-2 flex items-center justify-center">
                        <img src={app.imageUrl} alt={app.label} className="h-12 object-contain" />
                      </div>
                      <p className="text-xs font-medium text-neutral-700">{app.label}</p>
                      <p className="text-[10px] text-neutral-400">{app.specs}</p>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">{app.designRules}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signage */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">5.2 外部标识</h3>
                <div className="grid grid-cols-2 gap-2">
                  {manual.applications.signage.map((app, i) => (
                    <div key={i} className="border border-neutral-100 rounded-lg p-3">
                      <p className="text-xs font-medium">{app.label}</p>
                      <p className="text-[10px] text-neutral-400">{app.specs}</p>
                      <p className="text-[10px] text-neutral-500 mt-1">{app.designRules}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-700 mb-2">5.3 数字媒体</h3>
                <div className="grid grid-cols-2 gap-2">
                  {manual.applications.digital.map((app, i) => (
                    <div key={i} className="border border-neutral-100 rounded-lg p-3">
                      <p className="text-xs font-medium">{app.label}</p>
                      <p className="text-[10px] text-neutral-400">{app.specs}</p>
                      <p className="text-[10px] text-neutral-500 mt-1">{app.designRules}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Page footer */}
        <div className="px-8 py-3 border-t border-neutral-100 text-[10px] text-neutral-400 flex justify-between">
          <span>{manual.cover.companyName}</span>
          <span>{manual.cover.title} v{manual.cover.version}</span>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex gap-1.5">
          {PAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentPage ? "bg-primary w-5" : "bg-neutral-300"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentPage((p) => Math.min(PAGES.length - 1, p + 1))}
          disabled={currentPage === PAGES.length - 1}
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
