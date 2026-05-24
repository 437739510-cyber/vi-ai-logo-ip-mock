"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Monitor, FolderDown, FileDown, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  format: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { id: "pdf", label: "PDF 文档", description: "300 DPI 打印级，含出血位和裁切线", icon: <FileText className="w-6 h-6" />, format: "PDF" },
  { id: "ppt", label: "PPT 源文件", description: "每页为独立幻灯片，可继续编辑", icon: <Monitor className="w-6 h-6" />, format: "PPTX" },
  { id: "web", label: "Web 展示链接", description: "在线浏览版，适合手机上预览", icon: <Monitor className="w-6 h-6" />, format: "链接" },
  { id: "zip", label: "素材包 ZIP", description: "Logo 变体 + 色板文件 + 字体文件", icon: <FolderDown className="w-6 h-6" />, format: "ZIP" },
];

export default function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");

  // 解析 params Promise（Next.js 15 App Router）
  useEffect(() => {
    params.then((p) => setProjectId(p.projectId));
  }, [params]);

  const handleExport = async (id: string) => {
    setExporting(id);
    setDone(null);
    // 模拟导出进度
    await new Promise((r) => setTimeout(r, 2000));
    setExporting(null);
    setDone(id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/admin/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目
      </Link>

      <h2 className="text-xl font-semibold text-neutral-900">导出工作台</h2>
      <p className="text-sm text-neutral-400">选择导出格式，生成后即可下载</p>

      <div className="grid gap-4">
        {EXPORT_OPTIONS.map((opt) => {
          const isExporting = exporting === opt.id;
          const isDone = done === opt.id;
          return (
            <button
              key={opt.id}
              disabled={isExporting}
              onClick={() => handleExport(opt.id)}
              className={cn(
                "flex items-center gap-4 p-5 bg-white rounded-xl border text-left transition-all",
                isDone
                  ? "border-green-300 bg-green-50"
                  : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                isDone ? "bg-green-100 text-green-600" : "bg-neutral-100 text-neutral-500"
              )}>
                {isDone ? <CheckCircle className="w-6 h-6" /> : isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-neutral-900">{opt.label}</h4>
                <p className="text-xs text-neutral-400 mt-0.5">{opt.description}</p>
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded",
                isDone ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              )}>
                {isDone ? "已完成" : opt.format}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
