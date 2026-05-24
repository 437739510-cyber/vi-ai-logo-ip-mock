"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Download } from "lucide-react";
import { ColorPalette } from "@/components/admin/editor/ColorPalette";
import { FontSelector } from "@/components/admin/editor/FontSelector";
import { CanvasPreview } from "@/components/admin/editor/CanvasPreview";
import { AIChatPanel } from "@/components/admin/editor/AIChatPanel";
import { ErrorState } from "@/components/shared/ErrorState";
import { getManualByProject } from "@/lib/mock";
import type { ViManual } from "@/types";

const DEFAULT_MANUAL: ViManual = {
  id: "",
  projectId: "",
  cover: { title: "品牌视觉识别手册", subtitle: "Visual Identity Guidelines", version: "v1.0", date: "2026-05", companyName: "品牌名称" },
  brandColors: { primary: { name: "品牌色", hex: "#1A73E8" }, secondary: { name: "辅助色", hex: "#34A853" }, accent: { name: "强调色", hex: "#FBBC04" }, neutrals: [{ name: "背景", hex: "#F8F9FA" }, { name: "文字", hex: "#202124" }] },
  typography: { chinese: { heading: { font: "Noto Sans SC", weights: [700, 500] }, body: { font: "Noto Sans SC", weights: [400] } }, english: { heading: { font: "Inter", weights: [700, 600] }, body: { font: "Inter", weights: [400] } } },
  logoVariants: [],
  auxiliaryGraphics: [],
  applications: [],
};

export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [manual, setManual] = useState<ViManual>(DEFAULT_MANUAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { projectId: id } = await params;
        setProjectId(id);
        const m = await getManualByProject(id);
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
      <div className="flex gap-6 h-[calc(100vh-8rem)] animate-pulse">
        <div className="w-72 bg-neutral-100 rounded-xl" />
        <div className="flex-1 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="h-full flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/projects/${projectId}`}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-lg font-semibold text-neutral-900">VI 编辑器</h2>
          <span className="text-xs text-neutral-400 font-mono">{projectId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            预览手册
          </button>
          <button className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 编辑器主体 */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* 左侧面板 */}
        <div className="w-72 shrink-0 overflow-y-auto space-y-6 bg-white rounded-xl border border-neutral-100 p-4">
          <ColorPalette
            colors={manual.brandColors}
            onChange={(brandColors) => setManual({ ...manual, brandColors })}
          />
          <FontSelector
            typography={manual.typography}
            onChange={(typography) => setManual({ ...manual, typography })}
          />
        </div>

        {/* 右侧预览 */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-neutral-100 p-6 flex items-start justify-center">
          <CanvasPreview manual={manual} className="max-w-[500px]" />
        </div>
      </div>

      {/* AI 对话助手 */}
      <AIChatPanel isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </div>
  );
}
