"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Trash2, Grid3X3, Search, X, Loader2, ExternalLink, Star, CheckCircle, AlertCircle } from "lucide-react";

interface TemplateItem {
  templateId: string;
  sourceFile: string;
  industry: string;
  styleTags: string[];
  qualityScore: number;
  moodSummary: string;
  createdAt: string;
}

interface TemplateDetail {
  templateId: string;
  sourceFile: string;
  industry: string;
  styleTags: string[];
  qualityScore: number;
  extractedSystem: {
    colors: { primary: { hex: string; name: string }; secondary: { hex: string; name: string }; accent: { hex: string; name: string } };
    typography: { headingFont: string; bodyFont: string; sizeHierarchy: Record<string, string> };
    layoutPattern: { cover: string; innerPage: string };
    moodKeywords: string[];
    perPageMapping: Record<string, any>;
  };
  createdAt: string;
  sourceProjectId?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-neutral-600 bg-neutral-50 border-neutral-200";
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/ai/templates/${id}`);
      if (!res.ok) throw new Error("Failed to load detail");
      const data = await res.json();
      setDetail(data.template);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除此模板吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/ai/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadTemplates();
      if (detail?.templateId === id) setDetail(null);
    } catch {
      alert("删除失败");
    }
  };

  // Collect unique industries for filter
  const industries = [...new Set(templates.map(t => t.industry))].sort();

  // Filter templates
  const filtered = templates.filter(t => {
    if (industryFilter !== "all" && t.industry !== industryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.sourceFile.toLowerCase().includes(q) ||
        t.industry.toLowerCase().includes(q) ||
        t.styleTags.some(s => s.toLowerCase().includes(q)) ||
        t.moodSummary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回仪表盘
        </Link>
        <h2 className="text-lg font-semibold text-neutral-900">模板库</h2>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text" placeholder="搜索模板..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600" />
            </button>
          )}
        </div>
        <select
          value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="all">全部行业</option>
          {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        <span className="text-xs text-neutral-400">{filtered.length} 个模板</span>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Grid3X3 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-400">暂无模板</p>
          <p className="text-xs text-neutral-300 mt-1">上传并分析参考 VI 手册后将自动生成模板</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tpl => (
            <div
              key={tpl.templateId}
              onClick={() => loadDetail(tpl.templateId)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                detail?.templateId === tpl.templateId ? "border-purple-300 ring-2 ring-purple-200" : "border-neutral-200"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-xs font-medium text-neutral-700 truncate">{tpl.sourceFile}</span>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getScoreColor(tpl.qualityScore)}`}>
                  {tpl.qualityScore}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">{tpl.industry}</span>
                {tpl.moodSummary && (
                  <span className="text-[10px] text-neutral-400 truncate">{tpl.moodSummary}</span>
                )}
              </div>

              {tpl.styleTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tpl.styleTags.slice(0, 4).map(tag => (
                    <span key={tag} className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{new Date(tpl.createdAt).toLocaleDateString("zh-CN")}</span>
                <span>{tpl.templateId?.slice(0, 16)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {detailLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
        </div>
      )}

      {detail && !detailLoading && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              {detail.sourceFile}
            </h3>
            <button onClick={() => handleDelete(detail.templateId)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quality score */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getScoreColor(detail.qualityScore)}`}>
            <Star className="w-3.5 h-3.5" />
            质量评分：{detail.qualityScore}/100
          </div>

          {/* Color system */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 mb-2">色彩系统</p>
            <div className="flex gap-3">
              {[detail.extractedSystem.colors.primary, detail.extractedSystem.colors.secondary, detail.extractedSystem.colors.accent].map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg border border-neutral-200" style={{ background: c.hex }} />
                  <div>
                    <p className="text-[11px] font-medium text-neutral-700">{c.name || c.hex}</p>
                    <p className="text-[10px] text-neutral-400">{c.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 mb-2">字体系统</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-[10px] text-neutral-400">标题字体</p>
                <p className="text-xs font-medium text-neutral-700 mt-0.5">{detail.extractedSystem.typography.headingFont || "未提取"}</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-[10px] text-neutral-400">正文字体</p>
                <p className="text-xs font-medium text-neutral-700 mt-0.5">{detail.extractedSystem.typography.bodyFont || "未提取"}</p>
              </div>
            </div>
            {Object.keys(detail.extractedSystem.typography.sizeHierarchy).length > 0 && (
              <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
                <p className="text-[10px] text-neutral-400 mb-1">字号层级</p>
                {Object.entries(detail.extractedSystem.typography.sizeHierarchy).map(([level, size]) => (
                  <div key={level} className="flex justify-between text-xs text-neutral-600">
                    <span>{level}</span>
                    <span className="text-neutral-400">{size}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Layout */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 mb-2">布局模式</p>
            <div className="space-y-2">
              {detail.extractedSystem.layoutPattern.cover && (
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-[10px] text-neutral-400">封面</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{detail.extractedSystem.layoutPattern.cover.slice(0, 200)}</p>
                </div>
              )}
              {detail.extractedSystem.layoutPattern.innerPage && (
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-[10px] text-neutral-400">内页</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{detail.extractedSystem.layoutPattern.innerPage.slice(0, 200)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Mood keywords */}
          {detail.extractedSystem.moodKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-700 mb-2">风格标签</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.extractedSystem.moodKeywords.map((kw, i) => (
                  <span key={i} className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Per-page mapping count */}
          {detail.extractedSystem.perPageMapping && (
            <div>
              <p className="text-xs font-semibold text-neutral-700 mb-1">页面映射</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(detail.extractedSystem.perPageMapping).map(([pageId, info]: [string, any]) => (
                  <div key={pageId} className="px-2 py-1 bg-blue-50 rounded border border-blue-100 text-[10px] text-blue-700">
                    {pageId}
                    <span className="ml-1 text-blue-400">({info.refPages?.join(",") || "?"})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="text-[10px] text-neutral-400 pt-3 border-t border-neutral-100 flex items-center justify-between">
            <span>创建：{new Date(detail.createdAt).toLocaleString("zh-CN")}</span>
            <span>ID：{detail.templateId}</span>
          </div>
        </div>
      )}
    </div>
  );
}
