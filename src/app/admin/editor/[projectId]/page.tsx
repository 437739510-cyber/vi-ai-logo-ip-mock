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
  tableOfContents: [],
  logoSpecs: {
    explanation: "",
    conceptKeywords: [],
    standardCombinations: [],
    gridSpec: { imageUrl: "", proportions: "", baseUnit: "", description: "" },
    clearSpace: { rule: "", minimumSizes: [] },
    logoColors: [{ name: "品牌蓝", hex: "#1A73E8", cmyk: "", rgb: "" }],
    monochromeBlack: null,
    reversedOut: null,
    backgroundControl: { allowedBackgrounds: [], prohibitedBackgrounds: [] },
    incorrectUsages: [],
  },
  brandColors: {
    primary: { name: "品牌蓝", hex: "#1A73E8", cmyk: "C87 M53 Y0 K0", rgb: "26,115,232" },
    secondary: { name: "辅助绿", hex: "#34A853", cmyk: "C75 M0 Y100 K0", rgb: "52,168,83" },
    accent: { name: "强调黄", hex: "#FBBC04", cmyk: "C0 M18 Y100 K0", rgb: "251,188,4" },
    neutrals: [{ name: "背景", hex: "#F8F9FA", cmyk: "", rgb: "" }, { name: "文字", hex: "#202124", cmyk: "", rgb: "" }],
    hierarchy: [],
    matchingRules: "",
  },
  typography: {
    chinese: {
      brandFont: { font: "Noto Sans SC", weights: [700, 500] },
      bodyFont: { font: "Noto Sans SC", weights: [400] },
      sizeHierarchy: [],
    },
    english: {
      brandFont: { font: "Inter", weights: [700, 600] },
      bodyFont: { font: "Inter", weights: [400] },
      sizeHierarchy: [],
    },
    principles: [],
  },
  auxiliaryGraphics: {
    concept: "",
    graphics: [],
  },
  applications: {
    office: [],
    signage: [],
    digital: [],
  },
};

export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [manual, setManual] = useState<ViManual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { projectId: id } = await params;
        setProjectId(id);
        const m = await getManualByProject(id);
        setManual(m || { ...DEFAULT_MANUAL, projectId: id, id: `MANUAL-${id}` });
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-8">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-64 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!manual) return notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目详情
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/preview/${projectId}`}
            className="px-3 py-1.5 border border-neutral-200 text-sm rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            预览手册
          </Link>
          <Link
            href={`/admin/export/${projectId}`}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            导出交付
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Left: Canvas */}
        <div className="space-y-4">
          <CanvasPreview manual={manual} onChange={setManual} />
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          <ColorPalette
            colors={manual.brandColors}
            onChange={(colors) => setManual({ ...manual, brandColors: { ...colors, hierarchy: colors.hierarchy || [], matchingRules: colors.matchingRules || "", primary: { ...colors.primary, cmyk: colors.primary.cmyk || '', rgb: colors.primary.rgb || '' }, secondary: { ...colors.secondary, cmyk: colors.secondary.cmyk || '', rgb: colors.secondary.rgb || '' }, accent: { ...colors.accent, cmyk: colors.accent.cmyk || '', rgb: colors.accent.rgb || '' }, neutrals: colors.neutrals.map(n => ({ ...n, cmyk: n.cmyk || '', rgb: n.rgb || '' })) } })}
          />
          <FontSelector
            typography={manual.typography}
            onChange={(t) => setManual({ ...manual, typography: t })}
          />
          <AIChatPanel
            manual={manual}
            onUpdate={(updates) => setManual({ ...manual, ...updates })}
          />
        </div>
      </div>
    </div>
  );
}
