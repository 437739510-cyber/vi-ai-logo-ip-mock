"use client";

import { useEffect, useState, useCallback } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Eye,
} from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { getProjectById, getManualByProject } from "@/lib/mock";
import type { Project, ViManual } from "@/types";

type ExportFormat = "pdf-300" | "pdf-screen" | "ppt";
type ExportState =
  | { status: "idle" }
  | { status: "exporting"; progress: string }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string; icon: typeof FileText }[] = [
  { value: "pdf-300", label: "PDF 高清 (300DPI)", desc: "适合印刷，文件较大", icon: FileText },
  { value: "pdf-screen", label: "PDF 屏幕版 (72DPI)", desc: "适合屏幕浏览，文件较小", icon: FileText },
  { value: "ppt", label: "PPT 可编辑版", desc: "可继续在 PowerPoint 中编辑", icon: FileDown },
];

export default function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [manual, setManual] = useState<ViManual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [format, setFormat] = useState<ExportFormat>("pdf-300");
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });

  useEffect(() => {
    (async () => {
      try {
        const { projectId: id } = await params;
        setProjectId(id);
        const [p, m] = await Promise.all([
          getProjectById(id),
          getManualByProject(id),
        ]);
        if (!p) {
          setLoading(false);
          return;
        }
        setProject(p);
        setManual(m);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  const handleExport = useCallback(async () => {
    setExportState({ status: "exporting", progress: "正在生成..." });
    try {
      if (format === "ppt") {
        // PPT mock: simulate delayed result
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setExportState({
          status: "done",
          url: "#",
        });
        return;
      }

      const res = await fetch("/api/ai/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, dpi: format === "pdf-300" ? 300 : 72 }),
      });
      const data = await res.json();
      if (data.success) {
        setExportState({ status: "done", url: data.url });
      } else {
        setExportState({
          status: "error",
          message: data.error || "导出失败，请重试",
        });
      }
    } catch {
      setExportState({ status: "error", message: "网络错误，请重试" });
    }
  }, [format, projectId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-64 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/projects/${projectId}`}
          className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">导出交付</h2>
          <p className="text-xs text-neutral-400 font-mono">{projectId}</p>
        </div>
      </div>

      {/* Project summary */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">项目信息</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-neutral-400">项目状态</p>
            <p className="text-neutral-700">
              {project.status === "delivered" ? "已交付" : "未交付"}
            </p>
          </div>
          <div>
            <p className="text-neutral-400">手册名称</p>
            <p className="text-neutral-700">
              {manual?.cover.title || "尚未生成手册"}
            </p>
          </div>
        </div>
      </div>

      {/* Format selection */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-700">
          选择导出格式
        </h3>
        <div className="space-y-3">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  format === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-neutral-100 hover:border-neutral-200"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-900">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Export action */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        {exportState.status === "idle" && (
          <button
            onClick={handleExport}
            disabled={!manual}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            开始导出
          </button>
        )}

        {exportState.status === "exporting" && (
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-neutral-600">{exportState.progress}</p>
          </div>
        )}

        {exportState.status === "done" && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-medium text-neutral-900">
              导出成功
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href={exportState.url}
                download
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载文件
              </a>
              <Link
                href={`/admin/preview/${projectId}`}
                className="px-4 py-2 border border-neutral-200 text-sm rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                预览手册
              </Link>
            </div>
          </div>
        )}

        {exportState.status === "error" && (
          <div className="text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-sm text-red-600">{exportState.message}</p>
            <button
              onClick={() => {
                setExportState({ status: "idle" });
              }}
              className="px-4 py-2 border border-neutral-200 text-sm rounded-lg hover:bg-neutral-50 transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {!manual && (
          <p className="text-xs text-amber-600 text-center">
            请先在项目中生成 VI 手册后再导出
          </p>
        )}
      </div>
    </div>
  );
}
