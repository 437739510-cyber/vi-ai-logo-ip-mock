"use client";

import { useState, useEffect } from "react";
import { FileDown, Eye, Loader2, Package, Image as ImageIcon, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ViManual {
  id: string;
  format: string;
  pageCount: number;
  completedAt: string;
  downloadUrl: string | null;
  fileName: string;
}

interface ManualProject {
  projectId: string;
  companyName: string;
  industry: string;
  status: string;
  createdAt: string;
  selectedLogo: { imageUrl: string; selectedAt: string } | null;
  logoCount: number;
  viManuals: ViManual[];
}

export default function ViManualsPage() {
  const [projects, setProjects] = useState<ManualProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/member/vi-manuals")
      .then(r => r.json())
      .then(data => {
        if (data.success) setProjects(data.manuals || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, { text: string; color: string }> = {
    submitted: { text: "已提交", color: "text-yellow-600 bg-yellow-50" },
    payment_uploaded: { text: "待确认付款", color: "text-yellow-600 bg-yellow-50" },
    paid: { text: "已付款", color: "text-blue-600 bg-blue-50" },
    logo_generating: { text: "Logo生成中", color: "text-blue-600 bg-blue-50" },
    logo_generated: { text: "Logo已生成", color: "text-green-600 bg-green-50" },
    completed: { text: "VI手册已生成", color: "text-green-600 bg-green-50" },
    delivered: { text: "已交付", color: "text-green-600 bg-green-50" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">我的VI手册</h2>
        <p className="text-sm text-neutral-500">查看和下载品牌VI设计手册</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />加载中...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-neutral-100">
          <Package className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
          <p className="text-sm text-neutral-400">暂无VI手册</p>
          <p className="text-xs text-neutral-300 mt-1">提交品牌需求后，VI手册将在这里展示</p>
          <Link href="/" className="inline-block mt-3 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg">
            提交品牌需求
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(proj => {
            const st = statusLabel[proj.status] || { text: proj.status, color: "text-neutral-600 bg-neutral-50" };
            const hasManual = proj.viManuals.length > 0;
            return (
              <div key={proj.projectId} className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-start gap-3">
                  {/* Logo thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-neutral-50 border border-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {proj.selectedLogo?.imageUrl ? (
                      <img src={proj.selectedLogo.imageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-neutral-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{proj.companyName}</p>
                    {proj.industry && <p className="text-xs text-neutral-400">{proj.industry}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.text}</span>
                      {proj.logoCount > 0 && <span className="text-[10px] text-neutral-400">{proj.logoCount}个Logo方案</span>}
                    </div>
                  </div>
                </div>

                {/* VI Manuals */}
                {hasManual ? (
                  <div className="border-t border-neutral-50 px-4 py-3 space-y-2">
                    {proj.viManuals.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileDown className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-xs font-medium text-neutral-700">
                              VI手册 · {m.format.toUpperCase()}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {m.pageCount}页 · {m.completedAt ? new Date(m.completedAt).toLocaleDateString("zh-CN") : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (m.downloadUrl) window.open(m.downloadUrl, "_blank");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            下载
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-neutral-50 px-4 py-3">
                    <p className="text-xs text-neutral-400 text-center">
                      {proj.status === "logo_generating"
                        ? "Logo生成中，完成后将自动生成VI手册"
                        : proj.selectedLogo
                          ? "VI手册生成中，请稍候..."
                          : "Logo确认后，VI手册将自动生成"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 查看Logo方案入口 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5 text-center">
        <p className="text-sm text-neutral-500 mb-3">查看Logo方案和项目进度</p>
        <Link
          href="/view"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
        >
          <Eye className="w-4 h-4" />
          查看Logo方案
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
