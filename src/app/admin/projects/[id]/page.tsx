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
import { supabaseAdmin } from "@/lib/supabase";
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
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [deletingManual, setDeletingManual] = useState<string | null>(null);
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const [generationFormat, setGenerationFormat] = useState<'pdf'|'pptx'>('pdf');  // V32: 格式选择
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);  // V32: 生成历史
  const [arkBalance, setArkBalance] = useState<any>(null);  // V32: 方舟余额
  const [pptxResult, setPptxResult] = useState<{url: string; downloadUrl?: string; storageUrl?: string; pageCount: number; fileName: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // V7: AI分析面板状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [logoResult, setLogoResult] = useState<any>(null);
  const [selectingLogo, setSelectingLogo] = useState(false);

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
              costEstimate: { images: 5, costPerImage: 0.16, total: 0.8 },
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

  // V32: 加载方舟余额
  const loadArkBalance = async () => {
    try {
      const res = await fetch('/api/ai/ark-balance');
      if (res.ok) {
        const data = await res.json();
        setArkBalance(data);
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

  // V10: AI生成Logo（异步轮询模式 — 避免Zeabur 60秒超时）
  const handleGenerateLogo = async () => {
    if (!project) return;
    setGeneratingLogo(true);
    setPptxError("");
    try {
      const res = await fetch('/api/ai/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      
      if (data.error) {
        setPptxError(data.error);
        setGeneratingLogo(false);
        return;
      }

      // If already completed (edge case), show results directly
      if (data.success && data.logos) {
        setLogoResult(data);
        setGeneratingLogo(false);
        return;
      }

      // Async mode: API returned 202, poll for completion
      if (data.success || res.status === 202) {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/ai/get-project-status?projectId=${project.id}`);
            const statusData = await statusRes.json();
            
            // Update progress message
            const genMsg = statusData.statusMessage || "";
            if (genMsg.includes("Logo")) {
              setPptxProgress(genMsg);
            }

            // Check if logo generation is done
            if (statusData.status === "logo_generated" || statusData.status === "failed") {
              clearInterval(pollInterval);
              setPptxProgress("");
              
              if (statusData.status === "logo_generated") {
                // Load full project data to get logo results
                const dataRes = await fetch(`/api/get-project-data?projectId=${project.id}`);
                const freshData = await dataRes.json();
                const bp = freshData.project?.client_info?.brandProfile;
                
                if (bp?.logoGenerationResults) {
                  const successLogos = bp.logoGenerationResults.filter((r: any) => r.imageUrl);
                  if (successLogos.length > 0) {
                    setLogoResult({
                      success: true,
                      projectId: project.id,
                      companyName: data.companyName || freshData.project?.client_name,
                      style: bp.logoDesignSuggestions?.style || "",
                      concept: bp.logoDesignSuggestions?.concept || "",
                      logos: successLogos.map((r: any) => ({
                        index: r.index,
                        prompt: r.prompt,
                        imageUrl: r.imageUrl,
                      })),
                    });
                  } else {
                    setPptxError("Logo生成全部失败，请重试");
                  }
                }
              } else {
                setPptxError("Logo生成失败，请重试");
              }
              
              setGeneratingLogo(false);
              // Refresh project data
              const freshProj = await getProjectById(project.id);
              if (freshProj) {
                setProject(freshProj);
                const freshSub = await getSubmissionById(freshProj.submissionId);
                if (freshSub) setSubmission(freshSub);
              }
            }
          } catch (e) {
            // Silently retry
          }
        }, 3000);
        
        // Safety timeout: 5 minutes (4 logos × ~60s each + polling)
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingLogo(false);
          setPptxProgress("");
        }, 300000);
      }
    } catch (e: any) {
      setPptxError(e.message || 'Logo生成出错');
      setGeneratingLogo(false);
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

  /** Generate PPTX via PptxGenJS engine + AI场景图 */
  const [pptxProgress, setPptxProgress] = useState("");
  const [pptxPercent, setPptxPercent] = useState(0);

  const handleGeneratePptx = async () => {
    if (!project) return;
    setGeneratingPptx(true);
    setPptxError("");
    setPptxResult(null);
    setPptxProgress("正在提交生成任务...");
    setPptxPercent(0);
    try {
      // Step 1: 启动生成任务（立即返回202）
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
          format: generationFormat,  // V32: 格式选择
          logoUrl: submission?.logoAssets?.[0]?.url || '',
          mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',
          mascotFiles: submission?.mascotAssets?.flatMap((m: any) => m.files || []) || [],
        }),
      });

      if (res.status !== 202 && !res.ok) {
        throw new Error(`服务器错误: ${res.status}`);
      }

      setPptxProgress("生成任务已启动，正在后台处理...");

      // Step 2: 轮询项目状态
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/ai/get-project-status?projectId=${project.id}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();

          if (statusData.statusMessage) setPptxProgress(statusData.statusMessage);
          if (statusData.progress) setPptxPercent(statusData.progress);

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            // 从client_info获取pptxResult
            const projRes = await fetch(`/api/get-project-data?projectId=${project.id}`);
            if (projRes.ok) {
              const projData = await projRes.json();
              const pptxRes = projData?.project?.client_info?.pptxResult;
              if (pptxRes) {
                setPptxResult({ url: pptxRes.url, downloadUrl: pptxRes.downloadUrl || undefined, storageUrl: pptxRes.storageUrl || undefined, pageCount: pptxRes.pageCount, fileName: pptxRes.fileName });
              }
            }
            await loadGeneratedManuals(project.id);
            setPptxProgress("完成！");
            setPptxPercent(100);
            setGeneratingPptx(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setPptxError(statusData.statusMessage || '生成失败');
            setGeneratingPptx(false);
          }
        } catch { /* polling error, retry next interval */ }
      }, 3000); // 每3秒轮询一次

      // 安全超时：10分钟后自动停止
      setTimeout(() => {
        clearInterval(pollInterval);
        setGeneratingPptx((prev) => {
          if (prev) {
            setPptxError('生成超时，请刷新页面查看状态');
          }
          return false;
        });
      }, 600000);

    } catch (e: any) {
      setPptxError('生成失败：' + (e.message || '网络错误'));
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

  // V43: 标记已付款
  const handleMarkPaid = async () => {
    if (!project) return;
    setMarkingPaid(true);
    try {
      // If already paid, revert to submitted (undo)
      if (project.status === "paid") {
        const { error } = await supabaseAdmin
          .from("projects")
          .update({ status: "submitted", updated_at: new Date().toISOString() })
          .eq("id", project.id);
        if (error) throw error;
        setProject({ ...project, status: "submitted" });
        return;
      }

      // Mark as paid
      const { error } = await supabaseAdmin
        .from("projects")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", project.id);
      if (error) throw error;
      setProject({ ...project, status: "paid" });

      // Auto-trigger: Brand analysis → Logo generation
      try {
        const ci = (project as any).client_info || {};
        const bp = ci.brandProfile || {};
        const needsAnalysis = !bp.logoDesignSuggestions?.prompts || bp.logoDesignSuggestions.prompts.length === 0;

        if (needsAnalysis) {
          // Step 1: Run brand analysis first
          console.log("[MarkPaid] No brand analysis found, running brand analysis...");
          const analysisRes = await fetch("/api/ai/brand-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              clientInfo: {
                companyName: ci.companyName || (project as any).client_name || "",
                industry: ci.industry || (project as any).industry || "",
                province: ci.province || "",
                city: ci.city || "",
                brandVision: ci.brandVision || "",
                coreValues: ci.coreValues || "",
                targetMarket: ci.targetMarket || "",
                mainProducts: ci.mainProducts || "",
                description: ci.description || "",
                logoPhilosophy: ci.logoPhilosophy || "",
                mascotPhilosophy: ci.mascotPhilosophy || "",
              },
            }),
          });
          if (analysisRes.ok) {
            console.log("[MarkPaid] Brand analysis completed, now triggering logo generation...");
            // Step 2: Generate logo after analysis
            const logoRes = await fetch("/api/ai/generate-logo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: project.id }),
            });
            if (logoRes.ok) {
              console.log("[MarkPaid] Logo generation auto-triggered");
            } else {
              console.warn("[MarkPaid] Logo generation failed:", await logoRes.text());
            }
          } else {
            console.warn("[MarkPaid] Brand analysis failed:", await analysisRes.text());
          }
        } else {
          // Brand analysis already done, just generate logo
          const logoRes = await fetch("/api/ai/generate-logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: project.id }),
          });
          if (logoRes.ok) {
            console.log("[MarkPaid] Logo generation auto-triggered");
          } else {
            console.warn("[MarkPaid] Logo generation failed:", await logoRes.text());
          }
        }
      } catch (e) {
        console.warn("[MarkPaid] Auto-trigger error:", e);
      }
    } catch (e) {
      console.error("Mark paid failed:", e);
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
          {(project as any).client_info?.viewPassword && (
            <span className="text-neutral-400">
              查看密码：<span className="font-mono font-medium text-neutral-600">{(project as any).client_info?.viewPassword}</span>
            </span>
          )}
        </div>
        {/* 付款截图展示 */}
        {(project as any).client_info?.paymentScreenshot && (
          <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
            <p className="text-xs text-neutral-500 mb-2">
              客户付款截图
              {(project as any).client_info?.paymentUploadedAt && (
                <span className="ml-2">
                  ({new Date((project as any).client_info.paymentUploadedAt).toLocaleString("zh-CN")})
                </span>
              )}
            </p>
            <a
              href={(project as any).client_info.paymentScreenshot}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src={(project as any).client_info.paymentScreenshot}
                alt="付款截图"
                className="max-h-48 rounded-lg border border-neutral-200 hover:opacity-80 transition-opacity"
              />
            </a>
          </div>
        )}
      </section>

      {/* brand assets */}
      {submission && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700">品牌素材</h3>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <AssetPreview label="LOGO" files={submission?.logoAssets || []} emptyText="未上传 LOGO" />
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
          {submission?.mascotAssets?.length > 0 && (
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
              {/* 费用预估 */}
              <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">
                <span>💰</span>
                <span>预估费用：{analysisResult.costEstimate?.images}张AI场景图 × ¥{analysisResult.costEstimate?.costPerImage} = ¥{analysisResult.costEstimate?.total?.toFixed(2)}/份</span>
              </div>
            </div>
            {/* V10: Logo生成区域 — 没有Logo时显示 */}
            {!submission?.logoAssets?.length && !logoResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <span>🎨</span> 客户未上传Logo — AI帮您生成
                </div>
                <p className="text-[11px] text-neutral-600">
                  品牌分析已提取Logo设计建议，点击下方按钮AI将生成4个Logo方案供选择。
                </p>
                <button
                  onClick={handleGenerateLogo}
                  disabled={generatingLogo}
                  className="w-full py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {generatingLogo ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {pptxProgress || "AI 生成Logo中（约1-2分钟）"}</>
                  ) : (
                    <>🎨 AI生成Logo方案</>
                  )}
                </button>
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
                <span className="text-xs text-emerald-700">Logo已就绪（{submission!.logoAssets!.length}个文件），可直接生成VI手册</span>
              </div>
            )}

            {/* V32: 格式选择 + 确认按钮 */}
            <div className="flex gap-2">
              <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
                <button
                  onClick={() => setGenerationFormat('pdf')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${generationFormat === 'pdf' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >PDF</button>
                <button
                  onClick={() => setGenerationFormat('pptx')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${generationFormat === 'pptx' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >PPTX</button>
              </div>
              <button
                onClick={handleGeneratePptx}
                disabled={generatingPptx}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {generatingPptx ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {pptxProgress || "生成中..."} {pptxPercent > 0 && <span className="text-blue-200 text-xs">({pptxPercent}%)</span>}</>
                ) : (
                  <>✅ 生成VI手册({generationFormat.toUpperCase()})</>
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

      {/* V32: 方舟余额 */}
      {arkBalance && (
        <section className="bg-white rounded-xl border border-neutral-100 p-5">
          <h3 className="text-sm font-bold text-neutral-900 mb-3">方舟Seedream余额</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {arkBalance.models?.map((m: any) => (
              <div key={m.model} className="bg-neutral-50 rounded-lg p-2.5">
                <p className="text-[10px] text-neutral-500">{m.model.split('doubao-seedream-')[1]}</p>
                <p className="text-sm font-bold text-neutral-900">{m.remaining}<span className="text-[10px] text-neutral-400">/{m.freeQuota}</span></p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 mt-2">总计剩余 {arkBalance.summary?.totalRemaining}/{arkBalance.summary?.totalFree} 张 (免费额度)</p>
        </section>
      )}

      {/* 通义万相逐页生图 - 已移除（PptxGenJS方案更优） */}

      {/* 已生成的VI手册 - 已移除（功能合并到品牌大脑下载区） */}

      {/* timeline */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">项目时间线</h3>
        <div className="space-y-3">
          {(project.timeline || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, i) => {
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
