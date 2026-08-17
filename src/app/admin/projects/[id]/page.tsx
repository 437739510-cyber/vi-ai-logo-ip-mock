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
import { getProjectById, getSubmissionById, getPlansByProject } from "@/lib/core/mock";
import { supabaseAdmin } from "@/lib/core/supabase";
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
  const [pptxError, setPptxError] = useState("");
  const [plans, setPlans] = useState<AiGenerationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const router = useRouter();

  // Reference upload & analysis state
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<any>(null);
  const [refHistory, setRefHistory] = useState<RefItem[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [generatedManuals, setGeneratedManuals] = useState<any[]>([]);
  const [deletingManual, setDeletingManual] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);  // V32: 生成历史
  const [pptxResult, setPptxResult] = useState<{url: string; downloadUrl?: string; storageUrl?: string; pageCount: number; fileName: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDeleteLogo = async (fileName: string) => {
    if (!project || !window.confirm(`确定删除 ${fileName} 吗？`)) return;
    try {
      const res = await fetch('/api/admin/delete-logo', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({projectId: project.id, fileName}),
      });
      if (res.ok) { window.location.reload(); }
      else { alert('删除失败'); }
    } catch { alert('删除失败'); }
  };








  // V7: AI分析面板状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [logoResult, setLogoResult] = useState<any>(null);
  const [selectingLogo, setSelectingLogo] = useState(false);
  // Phase 3: IP 公仔生成
  const [mascotStatus, setMascotStatus] = useState<string>("");
  const [mascotProgress, setMascotProgress] = useState("");
  const [mascotAssets, setMascotAssets] = useState<any>(null);
 const [mascotError, setMascotError] = useState("");
  const [manualReviewStatus, setManualReviewStatus] = useState<string>("");
  const [reviewingMascot, setReviewingMascot] = useState(false);

  // TASK-010: IP 公仔模块开关
  const [ipEnabled, setIpEnabled] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("brandbrain_ip_enabled");
      if (saved !== null) setIpEnabled(saved === "true");
    }
  }, []);

  // V49: Auto-poll logo generation status when generating
  useEffect(() => {
    if (!project) return;
    const ci = (project as any)?.client_info || {};
    const genStatus = ci.generationStatus || "";
    // V90: project已完成时不再轮询
    if (project.status === "completed") return;
    const isGenerating = ["brand_analyzing", "logo_generating", "scene_rendering", "pptx_assembling"].includes(genStatus);
    if (!isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const freshRes = await fetch(`/api/get-project-data?projectId=${project.id}`);
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          if (freshData.project) {
            setProject({ ...project, ...freshData.project, status: project.status, client_info: freshData.project.client_info || (project as any).client_info } as any);
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [project?.id, (project as any)?.client_info?.generationStatus]);

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
        // Restore pptxResult and analysisResult from client_info
        const dataRes = await fetch(`/api/get-project-data?projectId=${p.id}`);
        if (dataRes.ok) {
          const projData = await dataRes.json();
          const ci = projData?.project?.client_info;
          // V49-fix: Store client_info on project so UI can access it
          if (ci) {
            (p as any).client_info = ci;
            setProject({ ...p });
          }
          if (ci?.pptxResult) {
            setPptxResult({ url: ci.pptxResult.url, downloadUrl: ci.pptxResult.downloadUrl || undefined, storageUrl: ci.pptxResult.storageUrl || undefined, pageCount: ci.pptxResult.pageCount, fileName: ci.pptxResult.fileName });
          }
          if (ci?.brandProfile?.analysisStatus === 'completed' && ci.brandProfile.brandPositioning) {
            const bp = ci.brandProfile;
            setAnalysisResult({
              industry: { icon: '🏪', label: p.industry || '', reason: '' },
              brandColors: { primary: '', analysis: '', source: 'AI' },
              sceneMaterials: {},
              pageCount: ci.pptxResult?.pageCount || 15,
              pageList: [],
            });
          }
        }
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

  // V32: 加载生成历史
  const loadGenerationHistory = async () => {
    if (!project) return;
    try {
      const res = await fetch(`/api/ai/generation-history?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setGenerationHistory(data.history || []);
      }
    } catch {}
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
      if (data.success) {
        setAnalysisResult(data.analysis);
        // If DeepSeek is running in background, poll for brandProfile completion
        if (data.analysis?.brandProfileStatus === "analyzing") {
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/ai/get-project-status?projectId=${project.id}`);
              const statusData = await statusRes.json();
              const bp = statusData.details?.brandProfile;
              if (bp?.analysisStatus === "completed" || bp?.analysisStatus === "failed") {
                clearInterval(pollInterval);
                // Reload project data to get brandProfile
                const dataRes = await fetch(`/api/get-project-data?projectId=${project.id}`);
                const freshData = await dataRes.json();
                if (freshData.project?.client_info?.brandProfile) {
                  setAnalysisResult((prev: any) => ({
                    ...prev,
                    brandProfile: freshData.project.client_info.brandProfile,
                    brandProfileStatus: freshData.project.client_info.brandProfile.analysisStatus,
                  }));
                }
              }
            } catch (e) {
              // Silently retry
            }
          }, 3000);
          // Safety timeout: 3 minutes
          setTimeout(() => clearInterval(pollInterval), 180000);
        }
      }
      else throw new Error(data.error || "分析失败");
    } catch (e: any) {
      setPptxError(e.message || "分析出错");
    } finally {
      setAnalyzing(false);
    }
  };

  // V10: 选择Logo
  const handleSelectLogo = async (logoIndex: number) => {
    if (!project || !logoResult) return;
    setSelectingLogo(true);
    try {
      const logo = logoResult.logos[logoIndex];
      const res = await fetch('/api/ai/select-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          logoImageUrl: logo.imageUrl,
          logoIndex,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLogoResult(null);
        // 重新加载项目数据（刷新submission以获取logo_assets）
        const projId = project.id;
        const freshProj = await getProjectById(projId);
        if (freshProj) {
          setProject(freshProj);
          const freshSub = await getSubmissionById(freshProj.submissionId);
          if (freshSub) setSubmission(freshSub);
        }
      } else {
        setPptxError(data.error || 'Logo选择失败');
      }
    } catch (e: any) {
      setPptxError(e.message || 'Logo选择出错');
    } finally {
      setSelectingLogo(false);
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

  // V43: 标记已付款
  // V111: 重构 — 支付确认抽到后端 API
  const handleMarkPaid = async () => {
    if (!project) return;
    setMarkingPaid(true);
    try {
      const res = await fetch("/api/admin/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProject({ ...project, status: data.status === "reverted" ? "submitted" : "paid" });
      } else {
        alert(data.error || "操作失败");
      }
    } catch (e) {
      console.error("Mark paid failed:", e);
      alert("网络错误，请重试");
    } finally {
      setMarkingPaid(false);
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
              <p className="text-neutral-700">{submission?.phone}</p>
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

      {/* V43: 付款状态 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">付款状态</h3>
          <button
            onClick={handleMarkPaid}
            disabled={markingPaid}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              project.status === "paid"
                ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            {markingPaid ? "处理中..." : project.status === "paid" ? "✓ 已确认付款 — 点击撤销" : project.status === "payment_uploaded" ? "确认付款" : "标记已付款"}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className={
            project.status === "paid" ? "text-green-600 font-medium" :
            project.status === "payment_uploaded" ? "text-yellow-600 font-medium" :
            "text-neutral-400"
          }>
            {project.status === "paid" ? "💰 已确认付款，可开始生成" :
             project.status === "payment_uploaded" ? "📸 客户已上传付款截图，请确认" :
             "⏳ 等待客户付款"}
          </span>
          {project.client_info?.viewPassword && (
            <span className="text-neutral-400">
              查看密码：<span className="font-mono font-medium text-neutral-600">{project.client_info?.viewPassword}</span>
            </span>
          )}
        </div>
        {/* 付款截图展示 */}
        {project.client_info?.paymentScreenshot && (
          <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
            <p className="text-xs text-neutral-500 mb-2">
              客户付款截图
              {project.client_info?.paymentUploadedAt && (
                <span className="ml-2">
                  ({new Date(project.client_info?.paymentUploadedAt).toLocaleString("zh-CN")})
                </span>
              )}
            </p>
            <a
              href={project.client_info?.paymentScreenshot}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src={project.client_info?.paymentScreenshot}
                alt="付款截图"
                className="max-h-48 rounded-lg border border-neutral-200 hover:opacity-80 transition-opacity"
              />
            </a>
          </div>
        )}
      </section>


      {/* V49: Logo生成状态 */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">🎨 Logo生成状态</h3>
          <button
            onClick={async () => {
              if (!project) return;
              try {
                const res = await fetch(`/api/ai/get-project-status?projectId=${project.id}`);
                if (res.ok) {
                  const data = await res.json();
                  // Refresh project data to pick up latest client_info
                  const freshRes = await fetch(`/api/get-project-data?projectId=${project.id}`);
                  if (freshRes.ok) {
                    const freshData = await freshRes.json();
                    if (freshData.project) {
                      setProject({ ...project, ...freshData.project, status: project.status, client_info: freshData.project.client_info || (project as any).client_info } as any);
                    }
                  }
                }
              } catch {}
            }}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>

        {(() => {
          const ci = (project as any)?.client_info || {};
          const genStatus = ci.generationStatus === "completed" || project.status === "completed" ? "completed" : (ci.generationStatus || "pending");
          const logoGenStatus = ci.logoGenerationStatus || {};
          const brandProfile = ci.brandProfile || {};
          const analysisStatus = brandProfile.analysisStatus || null;
          const logoResults = brandProfile.logoGenerationResults || [];
          const preferredLogo = brandProfile.preferredLogo || null;

          // Status config
          const statusConfig: Record<string, { label: string; color: string; icon: string; progress: number }> = {
            pending: { label: "等待处理", color: "neutral", icon: "⏳", progress: 0 },
            brand_analyzing: { label: "AI品牌分析中", color: "blue", icon: "🧠", progress: 20 },
            logo_generating: { label: "Logo生成中", color: "amber", icon: "🎨", progress: 40 },
            logo_generated: { label: "Logo生成完成", color: "green", icon: "✅", progress: 50 },
            logo_selecting: { label: "Logo选择中", color: "blue", icon: "👆", progress: 55 },
            scene_rendering: { label: "场景图渲染中", color: "purple", icon: "🖼️", progress: 70 },
            pptx_assembling: { label: "手册组装中", color: "purple", icon: "📖", progress: 90 },
            completed: { label: "全部完成", color: "green", icon: "🎉", progress: 100 },
            failed: { label: "生成失败", color: "red", icon: "❌", progress: 0 },
          };
          const cfg = statusConfig[genStatus] || statusConfig.pending;
          const isGenerating = ["brand_analyzing", "logo_generating", "scene_rendering", "pptx_assembling"].includes(genStatus);

          return (
            <div className="mt-3 space-y-3">
              {/* Status badge + progress */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  cfg.color === "green" ? "bg-green-50 text-green-700" :
                  cfg.color === "amber" ? "bg-amber-50 text-amber-700" :
                  cfg.color === "blue" ? "bg-blue-50 text-blue-700" :
                  cfg.color === "purple" ? "bg-purple-50 text-purple-700" :
                  cfg.color === "red" ? "bg-red-50 text-red-700" :
                  "bg-neutral-50 text-neutral-500"
                }`}>
                  {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                  {cfg.icon} {cfg.label}
                </span>
                {genStatus !== "pending" && (
                  <span className="text-xs text-neutral-400">{cfg.progress}%</span>
                )}
              </div>

              {/* Progress bar */}
              {genStatus !== "pending" && (
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cfg.color === "green" ? "bg-green-500" :
                      cfg.color === "amber" ? "bg-amber-500" :
                      cfg.color === "blue" ? "bg-blue-500" :
                      cfg.color === "purple" ? "bg-purple-500" :
                      cfg.color === "red" ? "bg-red-500" :
                      "bg-neutral-300"
                    }`}
                    style={{ width: `${cfg.progress}%` }}
                  />
                </div>
              )}

              {/* Brand analysis sub-status */}
              {analysisStatus && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">品牌分析：</span>
                  {analysisStatus === "completed" ? (
                    <span className="text-green-600 font-medium">✓ 已完成</span>
                  ) : analysisStatus === "analyzing" ? (
                    <span className="text-blue-600 font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 分析中...
                    </span>
                  ) : (
                    <span className="text-neutral-400">{analysisStatus}</span>
                  )}
                </div>
              )}

              {/* Logo generation progress detail */}
              {logoGenStatus.total > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">Logo进度：</span>
                  <span className="font-medium text-neutral-700">
                    {logoGenStatus.completed || 0} / {logoGenStatus.total}
                  </span>
                  {logoGenStatus.completedAt && (
                    <span className="text-neutral-400">
                      （完成于 {new Date(logoGenStatus.completedAt).toLocaleString("zh-CN")}）
                    </span>
                  )}
                  {logoGenStatus.failedAt && (
                    <span className="text-red-500">
                      （失败于 {new Date(logoGenStatus.failedAt).toLocaleString("zh-CN")}）
                    </span>
                  )}
                </div>
              )}

              {/* Logo thumbnails */}
              {logoResults.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-neutral-500 mb-2">已生成Logo方案：</p>
                  <div className="grid grid-cols-2 gap-3">
                    {logoResults.map((logo: any, i: number) => (
                      <div key={i} className={`relative rounded-lg border-2 overflow-hidden ${
                        preferredLogo === i ? "border-blue-500 ring-2 ring-blue-200" : "border-neutral-200"
                      }`}>
                        <div className="aspect-square bg-neutral-50 flex items-center justify-center p-4">
                          <img
                            src={logo.imageUrl || logo.url}
                            alt={`Logo方案${i + 1}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div className="p-2 border-t border-neutral-100">
                          <span className="text-xs font-medium text-neutral-700">方案 {i + 1}</span>
                          {preferredLogo === i && (
                            <span className="ml-1 text-xs text-blue-600">✓ 客人已选</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* V85: 客户Logo意见 */}
              {ci.regenerationFeedback && ci.regenerationFeedback.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-2">💬 客户Logo意见</p>
                  <div className="space-y-2">
                    {ci.regenerationFeedback.map((fb: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-[10px] text-neutral-400 shrink-0 mt-0.5">
                          {fb.at ? new Date(fb.at).toLocaleString("zh-CN") : `第${idx + 1}次`}
                        </span>
                        <p className="text-xs text-neutral-700">{fb.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed message */}
              {genStatus === "failed" && ci.generationMessage && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {ci.generationMessage}
                </div>
              )}

              {/* Pending status hint */}
              {genStatus === "pending" && project.status === "paid" && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  💡 已确认付款，品牌分析和Logo生成将在下方品牌大脑区域手动触发，或刷新页面查看最新状态。
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* brand assets */}

      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700">品牌素材</h3>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="space-y-2">
              <AssetPreview label="LOGO" files={submission?.logoAssets?.length ? submission.logoAssets : ((project as any)?.client_info?.selectedLogo ? [{url: (project as any).client_info.selectedLogo, fileName: (project as any).client_info.selectedLogoName || "logo.png", size: 0}] : [])} emptyText="未上传 LOGO" onDelete={(fn) => handleDeleteLogo(fn)} />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs cursor-pointer hover:bg-red-100 transition">
                <span>+ 上传Logo</span>
                <input type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !project) return;
                    const r = new FileReader();
                    r.onload = async () => {
                      try {
                        const res = await fetch('/api/admin/upload-logo', {
                          method: 'POST', headers: {'Content-Type':'application/json'},
                          body: JSON.stringify({projectId:project.id, logoData:r.result, logoName:file.name}),
                        });
                        if (res.ok) { window.location.reload(); }
                        else { alert('上传失败'); }
                      } catch { alert('上传失败'); }
                    };
                    r.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
            </div>
            {submission?.logoAssets?.length > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm("确定重新抠图处理这个 LOGO 吗？")) return;
                  try {
                    const res = await fetch("/api/ai/reprocess-image", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ originalPath: submission?.logoAssets?.[0].url }),
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
          {ipEnabled && submission?.mascotAssets?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-2">IP 公仔（{submission?.mascotAssets?.length} 个）</h4>
              {submission?.mascotAssets?.map((m, i) => (
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

      {/* AI 生成方案 - 已移除（功能合并到品牌大脑） */}

      {/* 参考 VI 手册 - 暂时隐藏（后端reference_mode未实现，待后续版本开放） */}

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
            </div>
            {/* V10: Logo生成区域 — 没有Logo时显示 */}
            {!submission?.logoAssets?.length && !logoResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <span>🎨</span> Logo 等待本地 Worker 处理
                </div>
                <p className="text-[11px] text-neutral-600">
                  付款确认后进入本地 Worker 队列。任务由本地 Worker 按订单状态自动处理，管理员无需手动启动生成。
                </p>
              </div>
            )}

            {/* V10: Logo方案展示和选择 */}
            {logoResult && logoResult.logos?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <span>🎨</span> Logo方案 — 点击选择一个
                </div>
                <p className="text-[11px] text-neutral-500">
                  风格：{logoResult.style} | 概念：{logoResult.concept}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {logoResult.logos.map((logo: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleSelectLogo(i)}
                      disabled={selectingLogo}
                      className="relative bg-white rounded-lg border-2 border-transparent hover:border-amber-400 transition-all p-2 text-left disabled:opacity-50"
                    >
                      <img src={logo.imageUrl} alt={`Logo方案${i + 1}`} className="w-full aspect-square object-contain rounded" />
                      <div className="mt-1 text-[10px] text-neutral-500">方案 {i + 1}</div>
                    </button>
                  ))}
                </div>
                {selectingLogo && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> 正在保存选中的Logo...
                  </div>
                )}
              </div>
            )}

            {/* V10: 有Logo时的提示 */}
            {(submission?.logoAssets?.length ?? 0) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700">Logo已就绪（{submission!.logoAssets!.length}个文件），客户选择后由现有状态机接力</span>
              </div>
            )}

            {/* Phase 1.5: IP 公仔生成（需客户选了公仔） */}
            {ipEnabled && (submission as any)?.wantMascot === "yes" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">Phase 1.5</span>
                  <span className="text-[11px] text-neutral-400">IP公仔生成</span>
                </div>

                {/* 分段进度条 */}
                {mascotAssets && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      {[
                        { label: "公仔生成", pct: 25, key: "mascot" },
                        { label: "人工审核", pct: 65, key: "review" },
                        { label: "手册生成", pct: 100, key: "manual" },
                      ].map((stage, i) => {
                        let active = false;
                        if (stage.key === "mascot") active = true;
                        if (stage.key === "review") active = manualReviewStatus === "manual_review_complete";
                        if (stage.key === "manual") active = (generatedManuals?.length ?? 0) > 0;
                        return (
                          <div key={stage.key} className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              active ? "bg-purple-600 text-white" : "bg-neutral-200 text-neutral-400"
                            }`}>
                              {active ? "✓" : i + 1}
                            </div>
                            <span className={`text-[10px] ${active ? "text-purple-700 font-semibold" : "text-neutral-400"}`}>
                              {stage.label}
                            </span>
                            <span className="text-[9px] text-neutral-300">{stage.pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="relative h-1 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${
                          manualReviewStatus === "manual_review_complete" ? 65 :
                          mascotAssets ? 25 : 0
                        }%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 尚未生成 */}
                {!mascotAssets && mascotStatus !== "mascot_generated" && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                      <span>🤖</span> IP 公仔等待本地 Worker 处理
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      客户选择 IP 后由现有状态机接力。任务由本地 Worker 按订单状态自动处理，管理员不得手动跳状态。
                    </p>
                  </div>
                )}

                {/* 生成完毕 — 预览 */}
                {mascotAssets && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>IP 公仔生成完成 {(mascotAssets as any).threeView ? "🎉" : ""}</span>
                      </div>
                    </div>

                    {/* 三视图合成大图 */}
                    {(mascotAssets as any).threeView && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-2">三视图合成</p>
                        <img src={(mascotAssets as any).threeView}
                          alt="三视图" className="w-full rounded-lg border border-purple-200" />
                      </div>
                    )}

                    {/* 三视图单张 */}
                    {((mascotAssets as any).front || (mascotAssets as any).side || (mascotAssets as any).back) && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-2">三视图</p>
                        <div className="grid grid-cols-3 gap-2">
                          {["front", "side", "back"].map((view) => (
                            <div key={view} className="bg-white rounded-lg p-2 border border-purple-200">
                              {(mascotAssets as any)[view] ? (
                                <img src={(mascotAssets as any)[view]} alt={`${view}视图`} className="w-full aspect-square object-contain" />
                              ) : (
                                <div className="w-full aspect-square bg-neutral-100 rounded flex items-center justify-center text-neutral-400 text-xs">{view}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 表情 */}
                    {(mascotAssets as any).emotions?.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-2">表情（{(mascotAssets as any).emotions.length}个）</p>
                        <div className="grid grid-cols-6 gap-2">
                          {(mascotAssets as any).emotions.map((em: any, i: number) => (
                            <div key={em.name || i} className="bg-white rounded-lg p-1 border border-purple-200">
                              <img src={em.url} alt={em.name} className="w-full aspect-square object-contain" />
                              <p className="text-[10px] text-neutral-400 text-center mt-0.5">{em.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 场景 */}
                    {(mascotAssets as any).scenes?.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-2">场景图（{(mascotAssets as any).scenes.length}个）</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(mascotAssets as any).scenes.map((sc: any, i: number) => (
                            <div key={sc.name || i} className="bg-white rounded-lg p-1 border border-purple-200">
                              <img src={sc.url} alt={sc.name} className="w-full aspect-square object-contain" />
                              <p className="text-[10px] text-neutral-400 text-center mt-0.5">{sc.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 人工审核门禁 */}
                    {manualReviewStatus !== "manual_review_complete" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold">
                          <span>⏳</span> 待人工审核
                        </div>
                        <button
                          onClick={async () => {
                            setReviewingMascot(true);
                            try {
                              const res = await fetch('/api/ai/set-manual-review-status', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ projectId: project.id, status: 'approved' }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setManualReviewStatus("manual_review_complete");
                              } else {
                                alert('审核失败：' + (data.error || '未知错误'));
                              }
                            } catch (e: any) {
                              alert('审核请求失败：' + (e.message || '网络错误'));
                            }
                            setReviewingMascot(false);
                          }}
                          disabled={reviewingMascot}
                          className="w-full py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                          {reviewingMascot ? (
                            <><span className="animate-spin inline-block">⏳</span> 提交审核中...</>
                          ) : (
                            <>✅ 通过审核</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                          <span>✅</span> 人工审核通过
                        </div>
                        <p className="text-[11px] text-neutral-600">审核结果已记录，VI 手册由现有状态机接力给本地 Worker。</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 生成失败 */}
                {mascotError && !mascotAssets && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>公仔生成失败</span>
                    </div>
                    <p className="text-xs text-red-600">{mascotError}</p>
                    <p className="text-[11px] text-neutral-600">请检查订单资料与本地 Worker；后台页面不会直接重试生产。</p>
                  </div>
                )}
              </div>
            )}

            {/* Phase 2: VI Manual delivery */}
            <div className="flex items-center gap-2 mt-2 mb-1">
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">Phase 2</span>
              <span className="text-[11px] text-neutral-400">VI 手册 PPTX 交付</span>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800">线上接单、本地 Worker 生产</p>
              <p className="mt-1 text-xs text-blue-700">任务由本地 Worker 按订单状态自动处理；页面只展示状态与 PPTX 交付结果，不会从浏览器启动或重试生成。</p>
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
              href={pptxResult.downloadUrl || pptxResult.storageUrl || pptxResult.url}
              download
              className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> 下载 PPTX
            </a>
          </div>
        )}
      </section>

      {/* V32: 生成历史 */}
      {generationHistory.length > 0 && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5">
          <h3 className="text-sm font-bold text-neutral-900 mb-3">生成历史</h3>
          <div className="space-y-2">
            {generationHistory.filter((h: any) => h.status === 'completed').map((h: any) => (
              <div key={h.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-700">{h.format?.toUpperCase() || 'PPTX'}</span>
                  <span className="text-xs text-neutral-400">{h.pageCount}页</span>
                  <span className="text-xs text-neutral-400">{h.completedAt ? new Date(h.completedAt).toLocaleString('zh-CN') : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href={h.downloadUrl || h.storageUrl} download className="px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100">下载</a>
                  <button onClick={async () => {
                    if (!confirm('确定删除此记录？')) return;
                    await fetch(`/api/ai/generation-history?projectId=${project.id}&entryId=${h.id}`, { method: 'DELETE' });
                    loadGenerationHistory();
                  }} className="px-2 py-1 text-[10px] font-medium text-red-500 bg-red-50 rounded hover:bg-red-100">删除</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 通义万相逐页生图 - 已移除（PptxGenJS方案更优） */}

      {/* 已生成的VI手册 - 已移除（功能合并到品牌大脑下载区） */}

      {/* timeline */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">项目时间线</h3>
        <div className="space-y-3">
          {(project.timeline || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, i) => {
            const labels: Record<string, string> = { submitted: "已提交", payment_uploaded: "待确认付款", paid: "已付款", confirmed: "需求确认中", ai_analysis: "AI 分析中", brand_analyzed: "品牌分析完成", logo_generated: "Logo生成完成", designing: "设计制作中", reviewing: "审核中", completed: "已完成", delivered: "已交付" };
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
