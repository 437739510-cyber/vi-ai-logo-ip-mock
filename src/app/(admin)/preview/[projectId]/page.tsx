"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { getManualByProject, getProjectById } from "@/lib/mock";
import type { ViManual } from "@/types";

const PAGES = [
  "封面",
  "品牌色板",
  "字体规范",
  "Logo 标准用法",
  "Logo 变体",
  "辅助图形",
  "名片应用",
  "信纸应用",
  "PPT 模板",
  "招牌应用",
  "封底",
] as const;

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
  if (!manual) return notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
      </div>

      {/* 手册翻页 */}
      <div className="relative bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* 页面 */}
        <div className="aspect-[210/297] max-h-[75vh] p-8 md:p-12 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-neutral-400 mb-4">{PAGES[currentPage]}</p>

            {currentPage === 0 && (
              <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: manual.brandColors.primary.hex }}>
                  {manual.cover.title}
                </h1>
                <p className="text-sm text-neutral-500 mb-8">{manual.cover.subtitle}</p>
                <div className="flex gap-4">
                  {[manual.brandColors.primary, manual.brandColors.secondary, manual.brandColors.accent].map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-full border-2 border-neutral-200" style={{ backgroundColor: c.hex }} />
                      <span className="text-xs text-neutral-500">{c.hex}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {currentPage === 1 && (
              <div className="text-left w-full max-w-md space-y-3">
                <h3 className="font-semibold text-neutral-900">品牌色板</h3>
                {[manual.brandColors.primary, manual.brandColors.secondary, manual.brandColors.accent, ...manual.brandColors.neutrals].map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-neutral-200" style={{ backgroundColor: c.hex }} />
                    <span className="text-sm text-neutral-700 w-20">{c.name}</span>
                    <span className="text-xs font-mono text-neutral-400">{c.hex}</span>
                  </div>
                ))}
              </div>
            )}

            {(currentPage >= 2 && currentPage <= 10) && (
              <div className="text-center">
                <p className="text-neutral-400 text-sm">{PAGES[currentPage]} — 规范内容展示</p>
                <p className="text-xs text-neutral-300 mt-2">完整内容将在最终 PDF 中呈现</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-100 text-[10px] text-neutral-400 flex justify-between">
            <span>{manual.cover.companyName}</span>
            <span>{manual.cover.title} · v{manual.cover.version}</span>
          </div>
        </div>
      </div>

      {/* 翻页控制 */}
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
