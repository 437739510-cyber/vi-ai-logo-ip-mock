"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2, Sparkles, Loader2, Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Eye, FileDown, Clock, Download} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AssetPreview } from "@/components/admin/AssetPreview";
import { ErrorState } from "@/components/shared/ErrorState";
import { ProcessedAssetsViewer } from "@/components/admin/ProcessedAssetsViewer";
import { getProjectById, getSubmissionById, getPlansByProject } from "@/lib/mock";
import type { Project, Submission, AiGenerationPlan } from "@/types";

interface RefItem {
  refId: string;
  fileName: string;
  analyzedAt: string;
  overallStyle: string;
  pageCount?: number;
  active: boolean;
}

/** Helper: strip leading slash for display */
function stripSlash(url: string) { return url.startsWith("/") ? url.slice(1) : url; }

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxError, setPptxError] = useState("");
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Reference upload & analysis state
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<any>(null);
  const [refHistory, setRefHistory] = useState<RefItem[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [generatedManuals, setGeneratedManuals] = useState<any[]>([]);
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [deletingManual, setDeletingManual] = useState<string | null>(null);
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const [pptxResult, setPptxResult] = useState<{url: string; pageCount: number; fileName: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // V7: AI分析面板状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  /** Load generated manual files for this project */
  const loadGeneratedManuals = async (projectId: string) => {
    try {
      const res = await fetch(`/api/ai/list-generated?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedManuals(data.manuals || []);
      }
    } catch { /* ignore */ }
  };

  // Load project data
  useEffect(() => {
    (async () => {
      try {
        const { id } = await params;
        const p = await getProjectById(id);
        if (!p) { setLoading(false); return; }
        setProject(p);
        const [sub, planList] = await Promise.all([
          getSubmissionById(p.submissionId),
          getPlansByProject(p.id),
        ]);
        setSubmission(sub);
        setPlans(planList);
        // Load reference history
        await loadRefHistory(p.id);
      await loadGeneratedManuals(p.id);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  /** Load reference history for this project */
  const loadRefHistory = async (projectId: string) => {
    try {
      const res = await fetch(`/api/ai/list-references?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.allRefs) {
          setRefHistory(data.allRefs);
          const active = data.allRefs.find((r: RefItem) => r.active);
          if (active) {
            setSelectedRefId(active.refId);
            setRefAnalysis(active);
          }
        }
      }
    } catch { /* silently ignore */ }
  };

  /** Upload and analyze reference PDF */
  const handleUploadRef = async () => {
    if (!refFile || !project) return;
    setRefUploading(true);
    setRefError(null);
    try {
      const formData = new FormData();
      formData.append("file", refFile);
      formData.append("projectId", project.id);
      const res = await fetch("/api/ai/analyze-reference-pdf", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "分析失败");
      }
      const data = await res.json();
      setRefAnalysis(data);
      setSelectedRefId(data.refId);
      setRefFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Reload history
      await loadRefHistory(project.id);
    } catch (err: any) {
      setRefError(err.message || "上传或分析失败");
    } finally {
      setRefUploading(false);
    }
  };

  /** Select an existing reference to use */
  const handleSelectRef = async (refId: string) => {
    if (!project) return;
    setSelectedRefId(refId);
    try {
      const res = await fetch("/api/ai/list-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (res.ok) {
        // Reload to show active state
        const data = await res.json();
        // Loaded from history
        await loadRefHistory(project.id);
      }
    } catch { /* ignore */ }
  };

  /** Render analysis result details */
  const renderAnalysis = () => {
    if (!refAnalysis) return null;
    const a = refAnalysis.overallStyle ? refAnalysis : (refAnalysis.analysis || refAnalysis);
    const style = a.overallStyle || a.overall_style || "";
    const pageCount = refAnalysis.pageCount || 0;
    const fileName = refAnalysis.fileName || "";
    const pageMapping = refAnalysis.pageMapping || a.pageMapping || {};
    const totalPages = Object.keys(pageMapping).length;
    const templateInfo = refAnalysis.template || null;

    return (
      <div className="space-y-3 mt-3">
        {/* Basic info */}
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>参考文档：{fileName}</span>
          <span>页数：{pageCount} 页 | 匹配：{totalPages} 个页面类型</span>
        </div>

        {/* Overall style */}
        {style && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">分析结果：风格描述</p>
            <p className="text-xs text-amber-700 leading-relaxed">{style}</p>
          </div>
        )}

        {/* Per-page analysis preview (collapsed) */}
        {totalPages > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-purple-600 font-medium hover:text-purple-700 text-xs">
              查看逐页分析详情（{totalPages} 页）
            </summary>
            <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
              {Object.entries(pageMapping).map(([pageId, info]: [string, any]) => (
                <div key={pageId} className="p-2 bg-white rounded border border-neutral-100">
                  <p className="font-semibold text-neutral-700 text-[11px]">{pageId}</p>
                  {info.analysis?.layout && <p className="text-neutral-500 mt-0.5 text-[10px]">布局：{info.analysis.layout.slice(0, 80)}...</p>}
                  {info.analysis?.visualMood && <p className="text-neutral-500 text-[10px]">风格：{info.analysis.visualMood}</p>}
                  {info.analysis?.colors && <p className="text-neutral-500 text-[10px]">色彩：{info.analysis.colors.join(", ").slice(0, 80)}</p>}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Template library info */}
        {templateInfo && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <p className="text-xs font-semibold text-blue-800 mb-1">
              模板库 - 结构化设计系统
              <span className="ml-2 text-[10px] font-normal text-blue-600">
                质量评分: {templateInfo.qualityScore}/100
              </span>
            </p>

            {templateInfo.matchedTemplates && templateInfo.matchedTemplates.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-blue-700 mb-1">
                  匹配已有模板（按相似度排序）:
                </p>
                <div className="space-y-1">
                  {templateInfo.matchedTemplates.map((mt: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[10px] bg-white rounded px-2 py-1 border border-blue-100">
                      <span className="text-neutral-600 truncate">{mt.sourceFile}</span>
                      <span className="ml-2 shrink-0">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                          mt.matchScore >= 70 ? "bg-green-100 text-green-700" :
                          mt.matchScore >= 40 ? "bg-amber-100 text-amber-700" :
                          "bg-neutral-100 text-neutral-500"
                        }`}>
                          {mt.matchScore}% 匹配
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /** Render reference history list */
  const renderRefHistory = () => {
    if (refHistory.length === 0) return null;
    return (
      <div className="mt-4">
        <p className="text-xs font-semibold text-neutral-600 mb-2">历史参考文档（{refHistory.length} 份）</p>
        <div className="space-y-1.5">
          {refHistory.map((ref) => (
            <div
              key={ref.refId}
              onClick={() => handleSelectRef(ref.refId)}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                ref.active
                  ? "bg-purple-50 border border-purple-300"
                  : "bg-neutral-50 border border-neutral-200 hover:bg-neutral-100"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className={`w-3.5 h-3.5 shrink-0 ${ref.active ? "text-purple-600" : "text-neutral-400"}`} />
                <span className="truncate text-neutral-700">{ref.fileName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-neutral-400 text-[10px]">{new Date(ref.analyzedAt).toLocaleDateString("zh-CN")}</span>
                {ref.active && <span className="text-[9px] text-purple-600 font-medium">使用中</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // V7: AI品牌分析
  const handleAnalyze = async () => {
    if (!project) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setPptxError("");
    try {
      const res = await fetch("/api/ai/analyze-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: submission?.companyName || submission?.clientName || "",
            industry: submission?.industry || "",
            brandVision: submission?.brandVision || "",
            coreValues: submission?.coreValues || "",
            targetMarket: submission?.targetMarket || "",
            logoPhilosophy: submission?.logoPhilosophy || "",
            mascotPhilosophy: submission?.mascotPhilosophy || "",
          },
          brandColors: submission?.brandColors || project.brandColors,
        }),
      });
      if (!res.ok) throw new Error("分析失败");
      const data = await res.json();
      if (data.success) setAnalysisResult(data.analysis);
      else throw new Error(data.error || "分析失败");
    } catch (e: any) {
      setPptxError(e.message || "分析出错");
    } finally {
      setAnalyzing(false);
    }
  };

  /** Generate PPTX via PptxGenJS engine + AI场景图 */
  const handleGeneratePptx = async () => {
    if (!project) return;
    setGeneratingPptx(true);
    setPptxError("");
    setPptxResult(null);
    try {
      const res = await fetch('/api/ai/generate-manual-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: submission?.companyName || submission?.clientName || project.name || '',
            brandVision: submission?.brandVision || '',
            coreValues: submission?.coreValues || '',
            targetMarket: submission?.targetMarket || '',
            industry: submission?.industry || '',
            logoPhilosophy: submission?.logoPhilosophy || '',
            mascotPhilosophy: submission?.mascotPhilosophy || '',
          },
          brandColors: submission?.brandColors || project.brandColors || {
            primary: { hex: '#1A73E8' },
            secondary: { hex: '#34A853' },
            accent: { hex: '#FBBC04' },
          },
          logoUrl: submission?.logoAssets?.[0]?.url || '',
          mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',
          mascotFiles: submission?.mascotAssets?.flatMap((m: any) => m.files || []) || [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPptxResult({ url: data.url, pageCount: data.pageCount, fileName: data.fileName });
        setAnalysisResult(null);
        await loadGeneratedManuals(project.id);
      } else {
        setPptxError(data.error || '生成失败');
      }
    } catch (e: any) {
      setPptxError(e.message || '网络错误');
    } finally {
      setGeneratingPptx(false);
    }
  };

  const handleExportPdf = async (manualId: string) => {
    setExportingPdf(manualId);
    try {
      const res = await fetch("/api/ai/export-pdf-v6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: manualId }),
      });
      if (!res.ok) throw new Error("导出失败");
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      alert("PDF 导出失败: " + (err.message || "未知错误"));
    } finally {
      setExportingPdf(null);
    }
  };

  /** Delete generated manual */
  const handleDeleteManual = async (manualId: string) => {
    if (!window.confirm("确定要删除该手册吗？此操作不可撤销。")) return;
    setDeletingManual(manualId);
    try {
      const res = await fetch("/api/ai/delete-generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: manualId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadGeneratedManuals(project!.id);
      } else {
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeletingManual(null);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm("确定要删除此项目吗？此操作不可撤销。")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin/projects");
      } else {
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-48" />
        <div className="h-48 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (!project) return notFound();


  return (
    <div className="space-y-6">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回项目列表
        </Link>
        {project && (
          <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-danger border border-danger/30 rounded-lg hover:bg-danger/5 disabled:opacity-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "删除中..." : "删除项目"}
          </button>
        )}
      </div>

      {/* project title */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-semibold text-neutral-900">项目详情</h2>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-neutral-400 font-mono">{project.id}</p>
        </div>
      </div>

      {/* client info */}
      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-700">客户信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-neutral-400">联系人</p>
              <p className="text-neutral-700">{submission.clientName}</p>
            </div>
            <div>
              <p className="text-neutral-400">公司</p>
              <p className="text-neutral-700">{submission.companyName}</p>
            </div>
            <div>
              <p className="text-neutral-400">手机</p>
              <p className="text-neutral-700">{submission.phone}</p>
            </div>
            <div>
              <p className="text-neutral-400">行业</p>
              <p className="text-neutral-700">{submission.industry}</p>
            </div>
          </div>
          {submission.description && (
            <div>
              <p className="text-sm text-neutral-400 mb-1">需求描述</p>
              <p className="text-sm text-neutral-700">{submission.description}</p>
            </div>
          )}
        </section>
      )}

      {/* brand assets */}
      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700">品牌素材</h3>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <AssetPreview label="LOGO" files={submission.logoAssets} emptyText="未上传 LOGO" />
            </div>
            {submission.logoAssets.length > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm("确定重新抠图处理这个 LOGO 吗？")) return;
                  try {
                    const res = await fetch("/api/ai/reprocess-image", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ originalPath: submission.logoAssets[0].url }),
                    });
                    const data = await res.json();
                    if (data.success) { alert("LOGO 重新抠图完成！"); }
                    else { alert("重抠失败: " + (data.error || "未知错误")); }
                  } catch { alert("网络错误，请重试"); }
                }}
                className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all flex items-center gap-1"
                title="已缓存抠图结果，不满意可重新处理"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重抠
              </button>
            )}
          </div>
          {submission.mascotAssets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-2">IP 公仔（{submission.mascotAssets.length} 个）</h4>
              {submission.mascotAssets.map((m, i) => (
                <div key={i} className="p-3 bg-neutral-50 rounded-lg mb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <AssetPreview label="" files={m.files} />
                    </div>
                    {m.files?.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!window.confirm("确定重新抠图处理这个 IP 公仔吗？")) return;
                          try {
                            const res = await fetch("/api/ai/reprocess-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ originalPath: m.files[0].url }),
                            });
                            const data = await res.json();
                            if (data.success) { alert("IP 公仔重新抠图完成！"); }
                            else { alert("重抠失败: " + (data.error || "未知错误")); }
                          } catch { alert("网络错误，请重试"); }
                        }}
                        className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all flex items-center gap-1"
                        title="已缓存抠图结果，不满意可重新处理"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重抠
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* brand text info */}
          {(submission.brandVision || submission.coreValues || submission.targetMarket) && (
            <div className="border-t border-neutral-100 pt-4 mt-2 space-y-3">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">品牌信息</h4>
              {submission.brandVision && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-600 mb-0.5">品牌愿景</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{submission.brandVision}</p>
                </div>
              )}
              {submission.coreValues && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-600 mb-0.5">核心价值</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{submission.coreValues}</p>
                </div>
              )}
              {submission.targetMarket && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-600 mb-0.5">目标市场</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{submission.targetMarket}</p>
                </div>
              )}
              {submission.logoPhilosophy && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-600 mb-0.5">LOGO 设计理念</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{submission.logoPhilosophy}</p>
                </div>
              )}
              {submission.mascotPhilosophy && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-600 mb-0.5">IP 公仔设计理念</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">{submission.mascotPhilosophy}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* processed assets visualization */}
      {submission && (
        <ProcessedAssetsViewer
          logoUrl={submission?.logoAssets?.[0]?.url}
          mascotFiles={submission?.mascotAssets?.flatMap((m: any) => m.files || [])}
        />
      )}

      {/* AI generate section 1: schemes */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">AI 生成方案</h3>
          <Link href={`/admin/projects/${project.id}/generate`} className="text-xs text-primary hover:underline">生成新方案</Link>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-neutral-400">尚未生成方案</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-neutral-100 rounded-lg p-3">
                <p className="text-sm font-medium text-neutral-700">{plan.styleLabel}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reference PDF upload + analysis section */}
      <section className="bg-white rounded-xl border border-amber-200 p-6 space-y-4 bg-gradient-to-br from-amber-50/60 to-transparent">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">参考 VI 手册</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">上传参考 VI 手册 PDF，AI 自动逐页分析并提取设计风格，用于生成时参考</p>
          </div>
        </div>

        {/* Upload area */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setRefFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 transition-all"
          />
          <button
            onClick={handleUploadRef}
            disabled={!refFile || refUploading}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
          >
            {refUploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 分析中...</>
            ) : (
              <><Upload className="w-4 h-4" /> 上传并分析</>
            )}
          </button>
        </div>

        {/* Error */}
        {refError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {refError}
          </div>
        )}

        {/* Analysis result */}
        {refAnalysis && renderAnalysis()}

        {/* Reference history */}
        {renderRefHistory()}
      </section>

      {/* V7: 品牌大脑 — AI分析 + PptxGenJS+AI场景图生成 */}
      <section className="bg-white rounded-xl border border-blue-200 p-6 space-y-4 bg-gradient-to-br from-blue-50 to-transparent">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">🧠 品牌大脑 · AI智能生成</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">先AI分析行业和品牌定位，确认后生成专业VI手册（PptxGenJS + AI写实场景图）</p>
          </div>
        </div>

        {!analysisResult ? (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> AI 分析中...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> 🧠 开始AI分析</>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            {/* 分析结果面板 */}
            <div className="bg-white rounded-xl border border-blue-100 p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <CheckCircle className="w-4 h-4" /> AI 分析完成
              </div>
              {/* 行业识别 */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">{analysisResult.industry?.icon}</span>
                <div>
                  <div className="font-bold text-sm">{analysisResult.industry?.label}</div>
                  <div className="text-[11px] text-neutral-500">{analysisResult.industry?.reason}</div>
                </div>
              </div>
              {/* 品牌色 */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: `#${(analysisResult.brandColors?.primary || '').replace('#', '')}` }} />
                <div>
                  <div className="text-xs font-bold">品牌主色 {analysisResult.brandColors?.primary}</div>
                  <div className="text-[11px] text-neutral-500">{analysisResult.brandColors?.analysis}（{analysisResult.brandColors?.source}）</div>
                </div>
              </div>
              {/* 场景物料 */}
              <div>
                <div className="text-xs font-bold text-neutral-700 mb-1.5">场景物料</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(analysisResult.sceneMaterials || {}).map(([key, mat]: [string, any]) => (
                    <div key={key} className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-[11px] font-bold text-neutral-700">{mat.title}</div>
                      {mat.items?.map((item: string, i: number) => (
                        <div key={i} className="text-[10px] text-neutral-500">· {item}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* 页面列表 */}
              <div className="text-[11px] text-neutral-500">
                共 {analysisResult.pageCount} 页：{analysisResult.pageList?.join(" → ")}
              </div>
              {/* 费用预估 */}
              <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">
                <span>💰</span>
                <span>预估费用：{analysisResult.costEstimate?.images}张AI场景图 × ¥{analysisResult.costEstimate?.costPerImage} = ¥{analysisResult.costEstimate?.total?.toFixed(2)}/份</span>
              </div>
            </div>
            {/* 确认按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleGeneratePptx}
                disabled={generatingPptx}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {generatingPptx ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...（AI图片需约2分钟）</>
                ) : (
                  <>✅ 确认并生成VI手册</>
                )}
              </button>
              <button
                onClick={() => setAnalysisResult(null)}
                disabled={generatingPptx}
                className="px-4 py-3 border border-neutral-300 text-neutral-600 font-medium rounded-xl hover:bg-neutral-50 transition-all disabled:opacity-50"
              >
                返回
              </button>
            </div>
          </div>
        )}

        {pptxError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {pptxError}
          </div>
        )}

        {pptxResult && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-700">生成成功！{pptxResult.pageCount} 页</p>
              </div>
            </div>
            <a
              href={pptxResult.url}
              download
              className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> 下载 PPTX
            </a>
          </div>
        )}
      </section>

      {/* AI generate section: Tongyi Wanxiang pages */}
      <section className="bg-white rounded-xl border border-purple-200 p-6 space-y-4 bg-gradient-to-br from-purple-50 to-transparent">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">AI 生成手册页面（通义万相）</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">调用通义万相 API，按页生成 VI 手册 页面图片。系统会自动使用已上传的参考手册分析结果</p>
          </div>
        </div>
        <Link href={`/admin/manual-pages/${project.id}`} className="inline-flex w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all items-center justify-center gap-2 shadow-lg shadow-purple-600/20">
          <Sparkles className="w-4 h-4" /> AI 生成手册页面
        </Link>
      </section>

      {/* Generated manuals section */}
      <section className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4 bg-gradient-to-br from-emerald-50/60 to-transparent">
        <div className="flex items-center gap-2.5">
          <FileDown className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">已生成的 VI 手册</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">查看、下载 PDF 或删除已生成的 VI 手册</p>
          </div>
        </div>
        {generatedManuals.length === 0 ? (
          <div className="py-6 text-center">
            <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">暂无已生成的手册，请先使用「AI 生成手册页面」生成</p>
          </div>
        ) : (
          <div className="space-y-2">
            {generatedManuals.map((manual: any) => (
              <div key={manual.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-100 hover:border-emerald-200 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#d1fae5" }}>
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-neutral-700">VI 手册 - {manual.id}</p>
                    <div className="flex items-center gap-3 text-[10px] text-neutral-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(manual.generatedAt).toLocaleString("zh-CN")}
                      </span>
                      <span>{manual.totalPages || 0} 页</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/admin/manual-pages/${manual.id}`}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-all flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> 预览
                  </a>
                  <button
                    onClick={() => handleExportPdf(manual.id)}
                    disabled={exportingPdf === manual.id}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    {exportingPdf === manual.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {exportingPdf === manual.id ? "生成中..." : "下载 PDF"}
                  </button>
                  <button
                    onClick={() => handleDeleteManual(manual.id)}
                    disabled={deletingManual === manual.id}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* timeline */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">项目时间线</h3>
        <div className="space-y-3">
          {project.timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, i) => {
            const labels: Record<string, string> = { submitted: "已提交", confirmed: "需求确认中", ai_analysis: "AI 分析中", designing: "设计制作中", reviewing: "审核中", delivered: "已交付" };
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-neutral-600">{labels[entry.status] || entry.status}</span>
                <span className="text-xs text-neutral-400">{new Date(entry.timestamp).toLocaleString("zh-CN")}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
