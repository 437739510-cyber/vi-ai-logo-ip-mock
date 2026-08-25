"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Sparkles, Loader2, FileText, CheckCircle, AlertCircle, RefreshCw, Eye, Download, Upload, Users, Package, Factory, Palette, ShieldAlert, UserPlus, StickyNote, Maximize2, History, Ban, AlertTriangle, ChevronDown, MessageSquare, ListOrdered } from "lucide-react";
import { AssetPreview } from "@/components/admin/AssetPreview";
import { ErrorState } from "@/components/shared/ErrorState";
import { ProcessedAssetsViewer } from "@/components/admin/ProcessedAssetsViewer";
import { getProjectById, getSubmissionById, getPlansByProject } from "@/lib/core/mock";
import {
  getBusinessStatusInfo,
  nextPrimaryAction,
  getGenerationStatus,
  getWorkbenchClientInfo,
  maskPhone,
  formatDate,
  formatDateTime,
  waitingDuration,
  technicalStatusItems,
  type PrimaryActionKey,
} from "@/lib/core/project-workbench";
import { PlanCard } from "@/components/admin/PlanCard";
import { supabaseAdmin } from "@/lib/core/supabase";
import type { Project, Submission, AiGenerationPlan } from "@/types";


function SummaryCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5 min-w-0">
      <p className="text-[10px] text-neutral-400">{label}</p>
      <p className={`text-xs text-neutral-700 truncate mt-0.5 ${mono ? "font-mono" : ""}`} title={value}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-neutral-400 text-xs mb-0.5">{label}</p>
      <p className="text-neutral-700 break-words">{value || "-"}</p>
    </div>
  );
}

function pipeTone(status: string): string {
  if (!status || status === "-" || status === "未开始") return "bg-neutral-100 text-neutral-500";
  if (status.includes("失败")) return "bg-red-50 text-red-600";
  if (status.includes("完成") || status.includes("已交付")) return "bg-green-50 text-green-600";
  if (status.includes("中") || status.includes("等待") || status.includes("待")) return "bg-amber-50 text-amber-600";
  if (status.includes("审核")) return "bg-orange-50 text-orange-600";
  return "bg-blue-50 text-blue-600";
}

function PipeCard({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
      <p className="text-[11px] text-neutral-400">{label}</p>
      <p className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pipeTone(status)}`}>{status}</p>
    </div>
  );
}

const TABS = [
  { key: "customer" as const, label: "客户与需求", icon: Users },
  { key: "production" as const, label: "生产进度", icon: Factory },
  { key: "plan" as const, label: "方案审核", icon: Palette },
  { key: "delivery" as const, label: "交付文件", icon: Package },
];

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

  // 作业台工作区状态（TICKET-130-R33）
  const [activeTab, setActiveTab] = useState<"customer" | "production" | "plan" | "delivery">("customer");
  const [notes, setNotes] = useState<any[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showRawSubmission, setShowRawSubmission] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [enlargeLogo, setEnlargeLogo] = useState<{ index: number; url: string } | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [assignOwnerOpen, setAssignOwnerOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [generatedManuals, setGeneratedManuals] = useState<any[]>([]);
  const [deletingManual, setDeletingManual] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);  // V32: 生成历史
  const [pptxResult, setPptxResult] = useState<{url: string; downloadUrl?: string; storageUrl?: string; pageCount: number; fileName: string} | null>(null);
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
  // Phase 3: IP 公仔生成（mascotAssets / manualReviewStatus 从 client_info 派生）
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
        // 作业台数据组装（TICKET-130-R33）：生成历史 / 内部备注 / 公仔资产 / 人工审核状态
        loadGenerationHistory();
        await loadNotes(p.id);
        const ci0 = (p as any)?.client_info || {};
        if (ci0.mascotAssets) setMascotAssets(ci0.mascotAssets);
        if (ci0.manualReviewStatus) setManualReviewStatus(ci0.manualReviewStatus);
        else if (ci0.generationStatus === "manual_review_complete") setManualReviewStatus("manual_review_complete");
      await loadGeneratedManuals(p.id);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  // ========== 作业台操作（TICKET-130-R33） ==========
  /** 加载生成历史（V32） */
  const loadGenerationHistory = async () => {
    if (!project) return;
    try {
      const res = await fetch(`/api/ai/generation-history?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setGenerationHistory(data.history || []);
      }
    } catch { /* ignore */ }
  };

  /** 加载内部备注 */
  const loadNotes = async (projectId: string) => {
    try {
      const res = await fetch(`/api/admin/project-notes?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch { /* ignore */ }
  };

  /** 添加内部备注 */
  const handleAddNote = async () => {
    if (!project || !noteDraft.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/admin/project-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, note: noteDraft }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes || []);
        setNoteDraft("");
      } else {
        alert(data.error || "保存备注失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSavingNote(false);
    }
  };

  /** 刷新项目数据（只读：重新拉取 client_info / submission / plans） */
  const handleRefresh = async () => {
    if (!project) return;
    try {
      const res = await fetch(`/api/get-project-data?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        const fresh = data.project;
        if (fresh) {
          setProject((prev) => ({ ...(prev || fresh), ...fresh }) as any);
          if (data.submission) setSubmission(data.submission);
          if (Array.isArray(data.plans) && data.plans.length > 0) setPlans(data.plans);
          const ci = fresh.client_info || {};
          if (ci.mascotAssets) setMascotAssets(ci.mascotAssets);
          if (ci.manualReviewStatus) setManualReviewStatus(ci.manualReviewStatus);
          else if (ci.generationStatus === "manual_review_complete") setManualReviewStatus("manual_review_complete");
          if (ci.pptxResult) {
            setPptxResult({
              url: ci.pptxResult.url,
              downloadUrl: ci.pptxResult.downloadUrl || undefined,
              storageUrl: ci.pptxResult.storageUrl || undefined,
              pageCount: ci.pptxResult.pageCount,
              fileName: ci.pptxResult.fileName,
            });
          }
        }
      }
    } catch { /* ignore */ }
  };

  /** 分配负责人 */
  const handleAssignOwner = async () => {
    if (!project || !ownerName.trim()) return;
    setAssigningOwner(true);
    try {
      const res = await fetch("/api/admin/project-assign-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, ownerName: ownerName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const ci = { ...getWorkbenchClientInfo(project), assignedTo: data.assignedTo };
        setProject({ ...project, client_info: ci } as any);
        setAssignOwnerOpen(false);
        setOwnerName("");
        await handleRefresh();
      } else {
        alert(data.error || "保存负责人失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setAssigningOwner(false);
    }
  };

  /** 下一步主操作分发（按顶部摘要主按钮触发） */
  const handlePrimaryAction = (key: PrimaryActionKey) => {
    switch (key) {
      case "assign_owner":
        setAssignOwnerOpen(true);
        break;
      case "mark_paid":
        handleMarkPaid();
        break;
      case "approve_review":
        handleApproveReview();
        break;
      case "enter_anomaly":
        setShowTechDetails(true);
        break;
      case "view_feedback":
        setActiveTab("plan");
        break;
      case "download":
        setActiveTab("delivery");
        break;
      case "refresh":
      default:
        handleRefresh();
        break;
    }
  };

  /** 人工审核通过：仅 waiting_manual_review → manual_review_complete（状态机由 R34 负责） */
  const handleApproveReview = async () => {
    if (!project) return;
    setReviewingMascot(true);
    try {
      const res = await fetch("/api/ai/set-manual-review-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, status: "manual_review_complete" }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setManualReviewStatus("manual_review_complete");
        await handleRefresh();
      } else {
        alert(data.error || "审核提交失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setReviewingMascot(false);
    }
  };

  /** 重试 IP 公仔生成 */
  const handleRetryMascot = async () => {
    if (!project) return;
    try {
      const res = await fetch("/api/ai/regenerate-mascot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        await handleRefresh();
      } else {
        alert(data.error || "重试失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  /** 方案审核：选定 Logo 方案（仅 logo_generated 状态服务端放行） */
  const handleSelectScheme = async (index: number) => {
    if (!project) return;
    const logo = logoResults[index];
    if (!logo) return;
    setSelectingLogo(true);
    try {
      const res = await fetch("/api/ai/select-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          logoImageUrl: logo.imageUrl || logo.url,
          logoIndex: index,
        }),
      });
      const data = await res.json();
      if (data.success || !data.error) {
        await handleRefresh();
      } else {
        alert(data.error || "选定失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSelectingLogo(false);
    }
  };

  /** 提交修改意见（代客提交，重新生成 Logo） */
  const handleSubmitRevision = async () => {
    if (!project || !feedbackDraft.trim()) return;
    const ci = getWorkbenchClientInfo(project);
    if (!submission?.phone || !ci.viewPassword) {
      alert("缺少客户联系方式或访问口令，无法代客提交");
      return;
    }
    setSubmittingRevision(true);
    try {
      const res = await fetch("/api/ai/regenerate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: submission.phone,
          viewPassword: ci.viewPassword,
          feedback: feedbackDraft.trim(),
          logoTextLanguage: "chinese",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackDraft("");
        await handleRefresh();
      } else {
        alert(data.error || "提交失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSubmittingRevision(false);
    }
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

  // ========== 作业台派生数据（TICKET-130-R33，只读推导，状态机由 R34 负责） ==========
  const clientInfo = getWorkbenchClientInfo(project);
  const owner = clientInfo.assignedTo?.name || project.assignedTo?.name || project.studentName || "-";
  const genStatus = getGenerationStatus(project);
  const bizInfo = getBusinessStatusInfo(project);
  const bizKey = bizInfo.key;
  const primaryAction = nextPrimaryAction(project);
  const PAID_AFTER: string[] = [
    "paid", "confirmed", "ai_analysis", "designing", "reviewing", "delivered",
    "brand_analyzed", "brand_analyzing", "logo_generated", "logo_generating",
    "mascot_generating", "mascot_generated", "mascot_failed", "mascot_sample_fail",
    "mascot_full_fail", "waiting_manual_review", "manual_review_complete",
    "manual_render_fail", "manual_pending", "manual_generating", "scene_rendering",
    "pptx_assembling", "completed", "failed",
  ];
  const paymentLabel = clientInfo.paymentConfirmed || PAID_AFTER.includes(project.status)
    ? "已付款"
    : project.status === "payment_uploaded"
      ? "待确认付款"
      : project.status === "submitted"
        ? "未付款"
        : project.status || "-";
  const plan = clientInfo.paidPlan || "-";
  const techItems = technicalStatusItems(project);
  const brandProfile = clientInfo.brandProfile || {};
  const logoGenStatus = clientInfo.logoGenerationStatus || {};
  const logoResults = Array.isArray(brandProfile.logoGenerationResults) ? brandProfile.logoGenerationResults : [];
  const selectedLogoIndex = typeof brandProfile.selectedLogo?.index === "number"
    ? brandProfile.selectedLogo.index
    : (brandProfile.selectedLogo?.imageUrl
        ? Math.max(0, logoResults.findIndex((l: any) => (l.imageUrl || l.url) === brandProfile.selectedLogo.imageUrl))
        : -1);
  const selectedLogoUrl = brandProfile.selectedLogo?.imageUrl
    || brandProfile.preferredLogo?.imageUrl
    || (logoResults[selectedLogoIndex]?.imageUrl || logoResults[selectedLogoIndex]?.url)
    || "";
  const isGenerating = [
    "brand_analyzing", "logo_generating", "mascot_pending", "mascot_generating",
    "mascot_full_generating", "scene_rendering", "manual_generating", "pptx_assembling",
    "designing", "ai_analysis",
  ].includes(genStatus);
  const genProgress = logoGenStatus.total > 0
    ? Math.min(100, Math.round(((logoGenStatus.completed || 0) / logoGenStatus.total) * 100))
    : (isGenerating ? 60 : 100);
  const GEN_CFG: Record<string, { label: string; icon: string; tone: string }> = {
    pending: { label: "等待开始", icon: "⏳", tone: "bg-neutral-100 text-neutral-600" },
    brand_analyzing: { label: "品牌分析中", icon: "🧠", tone: "bg-blue-50 text-blue-700" },
    logo_generating: { label: "Logo 生成中", icon: "🎨", tone: "bg-amber-50 text-amber-700" },
    mascot_pending: { label: "公仔等待生成", icon: "🤖", tone: "bg-purple-50 text-purple-700" },
    mascot_generating: { label: "公仔生成中", icon: "🤖", tone: "bg-purple-50 text-purple-700" },
    mascot_full_generating: { label: "公仔全量生成中", icon: "🤖", tone: "bg-purple-50 text-purple-700" },
    scene_rendering: { label: "场景渲染中", icon: "🖼️", tone: "bg-pink-50 text-pink-700" },
    manual_generating: { label: "手册生成中", icon: "📄", tone: "bg-blue-50 text-blue-700" },
    pptx_assembling: { label: "PPTX 组装中", icon: "📦", tone: "bg-blue-50 text-blue-700" },
    waiting_manual_review: { label: "待人工审核", icon: "🔍", tone: "bg-orange-50 text-orange-700" },
    pending_manual: { label: "待人工审核", icon: "🔍", tone: "bg-orange-50 text-orange-700" },
    manual_pending: { label: "待人工审核", icon: "🔍", tone: "bg-orange-50 text-orange-700" },
    logo_generated: { label: "Logo 已生成", icon: "✅", tone: "bg-green-50 text-green-700" },
    manual_review_complete: { label: "人工审核通过", icon: "✅", tone: "bg-green-50 text-green-700" },
    completed: { label: "已完成", icon: "✅", tone: "bg-green-50 text-green-700" },
    failed: { label: "生成失败", icon: "❌", tone: "bg-red-50 text-red-700" },
    mascot_failed: { label: "公仔生成失败", icon: "❌", tone: "bg-red-50 text-red-700" },
    mascot_sample_fail: { label: "公仔样图失败", icon: "❌", tone: "bg-red-50 text-red-700" },
    mascot_full_fail: { label: "公仔全量失败", icon: "❌", tone: "bg-red-50 text-red-700" },
    manual_render_fail: { label: "手册渲染失败", icon: "❌", tone: "bg-red-50 text-red-700" },
  };
  const genCfg = GEN_CFG[genStatus] || { label: genStatus, icon: "•", tone: "bg-neutral-100 text-neutral-600" };
  const mascotAssetsData = clientInfo.mascotAssets || null;
  const inReviewGate = ["waiting_manual_review", "pending_manual", "manual_pending"].includes(genStatus)
    || project.status === "manual_pending"
    || project.status === "waiting_manual_review";
  const wantMascot = (submission as any)?.wantMascot === "yes";
  const mascotGenerating = ["mascot_pending", "mascot_generating", "mascot_full_generating"].includes(genStatus);
  const brandAnalysisStatus = brandProfile.analysisStatus === "completed"
    ? "已完成"
    : brandProfile.analysisStatus === "analyzing" || genStatus === "brand_analyzing"
      ? "分析中"
      : brandProfile.analysisStatus === "failed" || genStatus === "failed"
        ? "失败"
        : project.status === "paid" || genStatus !== "pending"
          ? "等待 Worker"
          : "未开始";
  const logoPipeStatus = logoGenStatus.total > 0 && logoGenStatus.completed === logoGenStatus.total
    ? "已完成"
    : (logoGenStatus.completed || 0) > 0
      ? `生成中 ${logoGenStatus.completed}/${logoGenStatus.total}`
      : logoGenStatus.failedAt || genStatus === "failed"
        ? "失败"
        : genStatus === "logo_generating"
          ? "生成中"
          : genStatus === "logo_generated"
            ? "已完成"
            : brandProfile.analysisStatus === "completed" || project.status === "paid"
              ? "等待 Worker"
              : "未开始";
  const mascotPipeStatus = mascotAssetsData?.threeView || manualReviewStatus === "manual_review_complete"
    ? "已完成"
    : mascotGenerating
      ? "生成中"
      : ["mascot_failed", "mascot_sample_fail", "mascot_full_fail"].includes(genStatus) || genStatus === "failed"
        ? "失败"
        : wantMascot
          ? "等待 Worker"
          : "未选择";
  const scenePipeStatus = mascotAssetsData?.scenes?.length > 0
    ? "已完成"
    : genStatus === "scene_rendering"
      ? "渲染中"
      : wantMascot && (project.status === "paid" || genStatus !== "pending")
        ? "等待 Worker"
        : "未开始";
  const manualPipeStatus = pptxResult
    ? "已完成"
    : ["manual_generating", "pptx_assembling"].includes(genStatus)
      ? "生成中"
      : manualReviewStatus === "manual_review_complete" || genStatus === "manual_review_complete"
        ? "等待 Worker"
        : inReviewGate
          ? "待审核"
          : genStatus === "failed" || genStatus === "manual_render_fail"
            ? "失败"
            : "未开始";
  const qcStatus = pptxResult
    ? "已生成"
    : manualReviewStatus === "manual_review_complete" || genStatus === "manual_review_complete"
      ? "已审核待生成"
      : inReviewGate
        ? "待审核"
        : ["failed", "manual_render_fail", "mascot_failed", "mascot_full_fail"].includes(genStatus)
          ? "失败"
          : "未开始";
  return (
    <div className="space-y-6 pb-16">
      {/* ============================================================
          顶部摘要（固定）：客户 / 项目 / 套餐 / 付款 / 阶段 / 负责人 / SLA + 主操作
          ============================================================ */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b border-neutral-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Link>
          <div className="w-px h-5 bg-neutral-200" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900 truncate">
                {project.clientName || submission?.clientName || submission?.companyName || project.name || "未命名客户"}
              </h2>
              <span className={`inline-flex items-center shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${bizInfo.color}`}>
                {bizInfo.label}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5 truncate">
              {project.id}
              {plan !== "-" && <span className="ml-2 font-sans text-neutral-500">套餐：{plan}</span>}
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => handlePrimaryAction(primaryAction.key)}
            disabled={(primaryAction.key === "mark_paid" && markingPaid)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark shadow disabled:opacity-50 transition-colors"
            title={primaryAction.description}
          >
            {primaryAction.key === "refresh" && <RefreshCw className="w-4 h-4" />}
            {primaryAction.key === "mark_paid" && (markingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />)}
            {primaryAction.key === "assign_owner" && <UserPlus className="w-4 h-4" />}
            {primaryAction.key === "enter_anomaly" && <ShieldAlert className="w-4 h-4" />}
            {primaryAction.key === "approve_review" && <CheckCircle className="w-4 h-4" />}
            {primaryAction.key === "view_feedback" && <MessageSquare className="w-4 h-4" />}
            {primaryAction.key === "download" && <Download className="w-4 h-4" />}
            {primaryAction.label}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 mt-3 text-xs">
          <SummaryCell label="付款状态" value={paymentLabel} />
          <SummaryCell label="当前阶段" value={bizInfo.label} />
          <SummaryCell label="负责人" value={owner} />
          <SummaryCell label="创建时间" value={formatDate(project.createdAt)} />
          <SummaryCell label="最后更新" value={formatDate(project.updatedAt)} />
          <SummaryCell label="SLA/等待" value={waitingDuration(project.updatedAt || project.createdAt)} />
        </div>

        {/* 内部技术状态（收进“异常/详情”展开区） */}
        <details className="mt-2" open={showTechDetails ? true : undefined}>
          <summary className="inline-flex items-center gap-1 text-xs text-neutral-500 cursor-pointer hover:text-neutral-700 select-none">
            <ChevronDown className="w-3.5 h-3.5" />
            异常 / 详情（内部技术状态）
          </summary>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            {techItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5">
                <p className="text-neutral-400">{item.label}</p>
                <p className="text-neutral-700 font-mono truncate mt-0.5" title={item.value}>{item.value}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* ============================================================
          四分区 Tabs
          ============================================================ */}
      <div className="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                active ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============ 1/4 客户与需求 ============ */}
      {activeTab === "customer" && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-400" /> 客户与需求
              </h3>
              <button
                onClick={() => setShowRawSubmission((v) => !v)}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                {showRawSubmission ? "收起原始提交" : "查看原始提交"}
              </button>
            </div>

            {/* 联系方式（脱敏） */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="联系人" value={submission?.clientName} />
              <Field label="手机" value={maskPhone(submission?.phone || "")} />
              <Field label="微信" value={submission?.wechat || "-"} />
              <Field label="邮箱" value={submission?.email || "-"} />
              <Field label="公司" value={submission?.companyName || "-"} />
              <Field label="行业" value={submission?.industry || project.industry || "-"} />
              <Field label="经营形态" value={(submission as any)?.businessForm || "-"} />
              <Field label="主营产品" value={(submission as any)?.mainProducts || "-"} />
            </div>

            {/* 需求摘要 / 视觉偏好 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-400 text-xs mb-1">需求摘要</p>
                <p className="text-neutral-700 whitespace-pre-line">{submission?.description || "-"}</p>
              </div>
              <div className="space-y-2">
                <Field label="视觉偏好" value={(submission as any)?.logoStyle || (submission as any)?.brandPersonality || "-"} />
                <Field label="LOGO 用途" value={(submission as any)?.logoUsage || "-"} />
                <Field label="预算范围" value={submission?.budgetRange || "-"} />
              </div>
            </div>

            {/* 品牌信息 */}
            {(submission?.brandVision || submission?.coreValues || submission?.targetMarket) && (
              <div className="mt-4 border-t border-neutral-100 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">品牌信息</h4>
                {submission.brandVision && <Field label="品牌愿景" value={submission.brandVision} />}
                {submission.coreValues && <Field label="核心价值" value={submission.coreValues} />}
                {submission.targetMarket && <Field label="目标市场" value={submission.targetMarket} />}
                {submission.logoPhilosophy && <Field label="LOGO 设计理念" value={submission.logoPhilosophy} />}
                {submission.mascotPhilosophy && <Field label="IP 公仔设计理念" value={submission.mascotPhilosophy} />}
              </div>
            )}

            {/* 上传素材 */}
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">上传素材</h4>
              <div className="space-y-4">
                <div>
                  <AssetPreview
                    label="LOGO"
                    files={submission?.logoAssets?.length ? submission.logoAssets : (selectedLogoUrl ? [{ url: selectedLogoUrl, fileName: "selected-logo.png", size: 0 }] : [])}
                    emptyText="未上传 LOGO"
                    onDelete={(fn) => handleDeleteLogo(fn)}
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs cursor-pointer hover:bg-red-100 transition">
                    <Upload className="w-3.5 h-3.5" /> + 上传Logo
                    <input type="file" accept="image/png,image/jpeg" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !project) return;
                        const r = new FileReader();
                        r.onload = async () => {
                          try {
                            const res = await fetch('/api/admin/upload-logo', {
                              method: 'POST', headers: {'Content-Type':'application/json'},
                              body: JSON.stringify({projectId: project.id, logoData: r.result, logoName: file.name}),
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

                {ipEnabled && (submission as any)?.mascotAssets?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-2">IP 公仔（{(submission as any).mascotAssets.length} 个）</h4>
                    {(submission as any).mascotAssets.map((m: any, i: number) => (
                      <div key={i} className="p-3 bg-neutral-50 rounded-lg mb-3">
                        <AssetPreview label={m.name || `公仔 ${i + 1}`} files={m.files || []} />
                      </div>
                    ))}
                  </div>
                )}

                {(submission as any)?.storePhotos?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-2">门店照片（{(submission as any).storePhotos.length} 个）</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {(submission as any).storePhotos.map((p: any, i: number) => (
                        <a key={i} href={typeof p === "string" ? p : p.url} target="_blank" rel="noopener noreferrer"
                           className="aspect-square rounded-lg bg-neutral-50 border border-neutral-200 overflow-hidden flex items-center justify-center">
                          <img src={typeof p === "string" ? p : p.url} alt="门店照片" className="max-w-full max-h-full object-contain" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 素材处理后可视化 */}
          {submission && (
            <ProcessedAssetsViewer
              logoUrl={submission?.logoAssets?.[0]?.url}
              mascotFiles={submission?.mascotAssets?.flatMap((m: any) => m.files || [])}
            />
          )}

          {/* 原始提交 JSON */}
          {showRawSubmission && submission && (
            <section className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">原始提交数据</h3>
              <pre className="text-[11px] leading-relaxed text-neutral-600 bg-neutral-50 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(submission, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}
      {/* ============ 2/4 生产进度 ============ */}
      {activeTab === "production" && (
        <div className="space-y-4">
          {/* 生产管线状态卡 */}
          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Factory className="w-4 h-4 text-neutral-400" /> 生产进度
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handleRefresh} className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 刷新
                </button>
                <button onClick={() => setShowTechDetails(true)} className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-1">
                  <ListOrdered className="w-3 h-3" /> 查看日志/详情
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <PipeCard label="品牌分析" status={brandAnalysisStatus} />
              <PipeCard label="Logo" status={logoPipeStatus} />
              <PipeCard label="IP 公仔" status={mascotPipeStatus} />
              <PipeCard label="公仔场景" status={scenePipeStatus} />
              <PipeCard label="VI 手册" status={manualPipeStatus} />
              <PipeCard label="质检" status={qcStatus} />
            </div>
          </section>

          {/* AI 品牌分析 / Logo 生成区 */}
          <section className="bg-white rounded-xl border border-blue-200 p-5 bg-gradient-to-br from-blue-50 to-transparent">
            <div className="flex items-center gap-2.5 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-neutral-900">🧠 品牌大脑 · AI 分析与 Logo 生成</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">先 AI 分析行业和品牌定位，确认后由本地 Worker 生成 Logo 与 VI 手册</p>
              </div>
            </div>

            {!analysisResult ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> AI 分析中...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> 🧠 开始 AI 分析</>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-xl border border-blue-100 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                    <CheckCircle className="w-4 h-4" /> AI 分析完成
                  </div>
                  {analysisResult.industry && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <span className="text-2xl">{analysisResult.industry.icon}</span>
                      <div>
                        <div className="font-bold text-sm">{analysisResult.industry.label}</div>
                        <div className="text-[11px] text-neutral-500">{analysisResult.industry.reason}</div>
                      </div>
                    </div>
                  )}
                  {analysisResult.brandColors?.primary && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: `#${String(analysisResult.brandColors.primary).replace('#', '')}` }} />
                      <div>
                        <div className="text-xs font-bold">品牌主色 {analysisResult.brandColors.primary}</div>
                        <div className="text-[11px] text-neutral-500">{analysisResult.brandColors.analysis}（{analysisResult.brandColors.source}）</div>
                      </div>
                    </div>
                  )}
                  {analysisResult.sceneMaterials && Object.keys(analysisResult.sceneMaterials).length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-neutral-700 mb-1.5">场景物料</div>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(analysisResult.sceneMaterials).map(([key, mat]: [string, any]) => (
                          <div key={key} className="bg-neutral-50 rounded-lg p-2">
                            <div className="text-[11px] font-bold text-neutral-700">{mat.title}</div>
                            {mat.items?.map((item: string, i: number) => (
                              <div key={i} className="text-[10px] text-neutral-500">· {item}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisResult.pageCount ? (
                    <div className="text-[11px] text-neutral-500">
                      共 {analysisResult.pageCount} 页：{(analysisResult.pageList || []).join(" → ")}
                    </div>
                  ) : null}
                </div>

                {!submission?.logoAssets?.length && !logoResult && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                      <span>🎨</span> Logo 等待本地 Worker 处理
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      付款确认后进入本地 Worker 队列。任务由本地 Worker 按订单状态自动处理，管理员无需手动启动生成。
                    </p>
                  </div>
                )}

                {logoResult && logoResult.logos?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                      <span>🎨</span> Logo方案 — 点击选择一个
                    </div>
                    <p className="text-[11px] text-neutral-500">风格：{logoResult.style} | 概念：{logoResult.concept}</p>
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
              </div>
            )}
          </section>

          {/* Logo 生成状态（client_info 实时） */}
          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-700">🎨 Logo 生成状态</h3>
              <button onClick={handleRefresh} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> 刷新
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${genCfg.tone}`}>
                  {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                  {genCfg.icon} {genCfg.label}
                </span>
                {genStatus !== "pending" && (
                  <span className="text-xs text-neutral-400">{genProgress}%</span>
                )}
              </div>
              {genStatus !== "pending" && (
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${genCfg.tone.split(" ")[0]}`} style={{ width: `${genProgress}%` }} />
                </div>
              )}

              {brandProfile.analysisStatus && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">品牌分析：</span>
                  {brandProfile.analysisStatus === "completed" ? (
                    <span className="text-green-600 font-medium">✓ 已完成</span>
                  ) : brandProfile.analysisStatus === "analyzing" ? (
                    <span className="text-blue-600 font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 分析中...
                    </span>
                  ) : (
                    <span className="text-neutral-400">{brandProfile.analysisStatus}</span>
                  )}
                </div>
              )}

              {logoGenStatus.total > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">Logo进度：</span>
                  <span className="font-medium text-neutral-700">
                    {logoGenStatus.completed || 0} / {logoGenStatus.total}
                  </span>
                  {logoGenStatus.completedAt && (
                    <span className="text-neutral-400">（完成于 {new Date(logoGenStatus.completedAt).toLocaleString("zh-CN")}）</span>
                  )}
                  {logoGenStatus.failedAt && (
                    <span className="text-red-500">（失败于 {new Date(logoGenStatus.failedAt).toLocaleString("zh-CN")}）</span>
                  )}
                </div>
              )}

              {logoResults.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-neutral-500 mb-2">已生成Logo方案：</p>
                  <div className="grid grid-cols-2 gap-3">
                    {logoResults.map((logo: any, i: number) => (
                      <div key={i} className={`relative rounded-lg border-2 overflow-hidden ${selectedLogoIndex === i ? "border-blue-500 ring-2 ring-blue-200" : "border-neutral-200"}`}>
                        <button onClick={() => setEnlargeLogo({ index: i, url: logo.imageUrl || logo.url })} className="w-full aspect-square bg-neutral-50 flex items-center justify-center p-4 hover:bg-neutral-100 transition-colors">
                          <img src={logo.imageUrl || logo.url} alt={`Logo方案${i + 1}`} className="max-w-full max-h-full object-contain" />
                        </button>
                        <div className="p-2 border-t border-neutral-100">
                          <span className="text-xs font-medium text-neutral-700">方案 {i + 1}</span>
                          {selectedLogoIndex === i && <span className="ml-1 text-xs text-blue-600">✓ 客人已选</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clientInfo.regenerationFeedback && clientInfo.regenerationFeedback.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-2">💬 客户Logo意见</p>
                  <div className="space-y-2">
                    {clientInfo.regenerationFeedback.map((fb: any, idx: number) => (
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

              {genStatus === "failed" && clientInfo.generationMessage && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {clientInfo.generationMessage}
                </div>
              )}

              {genStatus === "pending" && project.status === "paid" && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  💡 已确认付款，品牌分析和Logo生成将由本地 Worker 自动处理，刷新页面查看最新状态。
                </div>
              )}
            </div>
          </section>

          {/* IP 公仔生成 */}
          {ipEnabled && (submission as any)?.wantMascot === "yes" && (
            <section className="bg-white rounded-xl border border-neutral-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">Phase 1.5</span>
                <h3 className="text-sm font-semibold text-neutral-700">IP 公仔生成</h3>
                {mascotAssetsData && (
                  <button onClick={handleRetryMascot} className="ml-auto px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> 重试生成
                  </button>
                )}
              </div>
              {!mascotAssetsData ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                    <span>🤖</span> IP 公仔等待本地 Worker 处理
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    客户选择 IP 后由现有状态机接力。任务由本地 Worker 按订单状态自动处理，管理员不得手动跳状态。
                  </p>
                </div>
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                    <CheckCircle className="w-4 h-4" /> IP 公仔生成完成 {mascotAssetsData.threeView ? "🎉" : ""}
                  </div>
                  {mascotAssetsData.threeView && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">三视图合成</p>
                      <img src={mascotAssetsData.threeView} alt="三视图" className="w-full rounded-lg border border-purple-200" />
                    </div>
                  )}
                  {(mascotAssetsData.front || mascotAssetsData.side || mascotAssetsData.back) && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">三视图</p>
                      <div className="grid grid-cols-3 gap-2">
                        {["front", "side", "back"].map((view) => (
                          <div key={view} className="bg-white rounded-lg p-2 border border-purple-200">
                            {mascotAssetsData[view] ? (
                              <img src={mascotAssetsData[view]} alt={`${view}视图`} className="w-full aspect-square object-contain" />
                            ) : (
                              <div className="w-full aspect-square bg-neutral-100 rounded flex items-center justify-center text-neutral-400 text-xs">{view}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {mascotAssetsData.emotions?.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">表情（{mascotAssetsData.emotions.length}个）</p>
                      <div className="grid grid-cols-6 gap-2">
                        {mascotAssetsData.emotions.map((em: any, i: number) => (
                          <div key={em.name || i} className="bg-white rounded-lg p-1 border border-purple-200">
                            <img src={em.url} alt={em.name} className="w-full aspect-square object-contain" />
                            <p className="text-[10px] text-neutral-400 text-center mt-0.5">{em.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {mascotAssetsData.scenes?.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">场景图（{mascotAssetsData.scenes.length}个）</p>
                      <div className="grid grid-cols-3 gap-2">
                        {mascotAssetsData.scenes.map((sc: any, i: number) => (
                          <div key={sc.name || i} className="bg-white rounded-lg p-1 border border-purple-200">
                            <img src={sc.url} alt={sc.name} className="w-full aspect-square object-contain" />
                            <p className="text-[10px] text-neutral-400 text-center mt-0.5">{sc.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manualReviewStatus === "manual_review_complete" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                        <span>✅</span> 人工审核通过
                      </div>
                      <p className="text-[11px] text-neutral-600">已解锁手册渲染，由本地 Worker 接力生成 PPTX 交付文件。</p>
                    </div>
                  ) : inReviewGate ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold">
                        <span>⏳</span> 待人工审核
                      </div>
                      <button
                        onClick={handleApproveReview}
                        disabled={reviewingMascot}
                        className="w-full py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                      >
                        {reviewingMascot ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> 提交审核中...</>
                        ) : (
                          <>✅ 通过审核</>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {mascotError && <p className="mt-2 text-xs text-red-600">{mascotError}</p>}
            </section>
          )}

          {/* VI 手册交付说明 */}
          <section className="bg-white rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">Phase 2</span>
              <h3 className="text-sm font-semibold text-blue-800">VI 手册 PPTX 交付</h3>
            </div>
            <p className="mt-1 text-xs text-blue-700">
              线上接单、本地 Worker 生产。任务由本地 Worker 按订单状态自动处理；页面只展示状态与 PPTX 交付结果，不会从浏览器启动或重试生成。
            </p>
            {pptxError && (
              <div className="flex items-center gap-2 mt-3 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pptxError}
              </div>
            )}
          </section>
        </div>
      )}
      {/* ============ 3/4 方案审核 ============ */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-neutral-400" /> 方案审核 · Logo
              </h3>
              {logoResults.length > 0 && <span className="text-xs text-neutral-400">{logoResults.length} 个方案</span>}
            </div>

            {logoResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {logoResults.map((logo: any, i: number) => (
                  <div key={i} className={`relative rounded-xl border-2 overflow-hidden transition-all ${selectedLogoIndex === i ? "border-blue-500 ring-2 ring-blue-200" : "border-neutral-200"}`}>
                    <button
                      onClick={() => setEnlargeLogo({ index: i, url: logo.imageUrl || logo.url })}
                      className="w-full aspect-square bg-neutral-50 flex items-center justify-center p-4 hover:bg-neutral-100 transition-colors"
                    >
                      <img src={logo.imageUrl || logo.url} alt={`Logo方案${i + 1}`} className="max-w-full max-h-full object-contain" />
                    </button>
                    <div className="p-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-neutral-700">方案 {i + 1}</span>
                        {selectedLogoIndex === i && <span className="ml-1 text-xs text-blue-600">✓ 已选</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEnlargeLogo({ index: i, url: logo.imageUrl || logo.url })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors" title="放大">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        {genStatus === "logo_generated" && (
                          <button onClick={() => handleSelectScheme(i)} disabled={selectingLogo}
                            className="px-2 py-1 text-[10px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {selectingLogo ? "保存中..." : "选定方案"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">暂无已生成的 Logo 方案（Logo 由本地 Worker 生成后显示在这里）。</p>
            )}

            {clientInfo.regenerationFeedback && clientInfo.regenerationFeedback.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> 客户 Logo 意见
                </p>
                <div className="space-y-2">
                  {clientInfo.regenerationFeedback.map((fb: any, idx: number) => (
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

            <div className="mt-4 rounded-lg border border-neutral-200 p-3">
              <p className="text-xs font-medium text-neutral-600 mb-2">提交修改意见（代客提交，将重新生成 Logo）</p>
              <div className="flex gap-2">
                <input
                  value={feedbackDraft}
                  onChange={(e) => setFeedbackDraft(e.target.value)}
                  placeholder="例如：主色换成暖色调，字体更圆润"
                  className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={handleSubmitRevision} disabled={submittingRevision || !feedbackDraft.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
                  {submittingRevision ? "提交中..." : "提交修改"}
                </button>
              </div>
            </div>
          </section>

          {plans.length > 0 && (
            <section className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">AI 方案（配色与字体）</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {plans.map((planItem) => (
                  <PlanCard key={planItem.id} plan={planItem} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============ 4/4 交付文件 ============ */}
      {activeTab === "delivery" && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-neutral-400" /> 交付文件
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">校验状态：{qcStatus}</span>
                <button onClick={loadGenerationHistory} className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 刷新
                </button>
              </div>
            </div>

            {pptxResult ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-medium text-blue-700">
                      生成成功！{pptxResult.pageCount} 页{pptxResult.fileName ? `（${pptxResult.fileName}）` : ""}
                    </p>
                    <p className="text-[10px] text-blue-500">{formatDateTime(clientInfo.paidAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(pptxResult.url || pptxResult.storageUrl) && (
                    <a href={pptxResult.url || pptxResult.storageUrl} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> 预览
                    </a>
                  )}
                  <a href={pptxResult.downloadUrl || pptxResult.storageUrl || pptxResult.url} download
                    className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> 下载 PPTX
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">暂无已生成的 PPTX 交付文件（生成完成后显示在这里）。</p>
            )}

            {clientInfo.pdfUrl && (
              <div className="mt-3 flex items-center justify-between p-3 bg-neutral-50 border border-neutral-100 rounded-lg">
                <p className="text-xs text-neutral-700">PDF 版本</p>
                <a href={clientInfo.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-[11px] font-medium text-white bg-neutral-700 rounded-lg hover:bg-neutral-800 transition-all flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> 下载 PDF
                </a>
              </div>
            )}
          </section>

          {generationHistory.length > 0 && (
            <section className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="text-sm font-bold text-neutral-900 mb-3">生成历史（版本）</h3>
              <div className="space-y-2">
                {generationHistory.filter((h: any) => h.status === 'completed').map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-700">{h.format?.toUpperCase() || 'PPTX'}</span>
                      <span className="text-xs text-neutral-400">{h.pageCount}页</span>
                      <span className="text-xs text-neutral-400">{h.completedAt ? new Date(h.completedAt).toLocaleString('zh-CN') : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={h.downloadUrl || h.storageUrl || h.pptxResult?.downloadUrl || h.pptxResult?.storageUrl || h.pptxResult?.url} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100">预览/下载</a>
                      <button onClick={async () => {
                        if (!confirm('确定删除此记录？')) return;
                        await fetch(`/api/ai/generation-history?projectId=${project.id}&generationId=${h.id}`, { method: 'DELETE' });
                        loadGenerationHistory();
                      }} className="px-2 py-1 text-[10px] font-medium text-red-500 bg-red-50 rounded hover:bg-red-100">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {generatedManuals.length > 0 && (
            <section className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="text-sm font-bold text-neutral-900 mb-3">VI 手册记录</h3>
              <div className="space-y-2">
                {generatedManuals.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs text-neutral-700">{m.totalPages} 页</span>
                      <span className="text-xs text-neutral-400">{m.generatedAt ? new Date(m.generatedAt).toLocaleString('zh-CN') : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.pdfUrl && (
                        <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100">下载 PDF</a>
                      )}
                      <button onClick={() => handleDeleteManual(m.id)} disabled={deletingManual === m.id}
                        className="px-2 py-1 text-[10px] font-medium text-red-500 bg-red-50 rounded hover:bg-red-100">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white rounded-xl border border-neutral-100 p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">交付操作</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <button
                type="button"
                onClick={() => alert("交付动作由现有交付 API 承接，本工单仅激活入口按钮")}
                disabled={bizKey !== "delivering"}
                title={bizKey === "delivering" ? "标记为已交付" : "仅「交付中」可执行交付"}
                className={bizKey === "delivering" ? "px-3 py-1.5 font-medium text-white bg-primary rounded-lg hover:bg-primary-dark" : "px-3 py-1.5 font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed"}
              >
                交付
              </button>
              <button
                type="button"
                onClick={() => alert("撤回动作由现有交付 API 承接，本工单仅激活入口按钮")}
                disabled={bizKey !== "delivering" && bizKey !== "delivered"}
                title={bizKey === "delivering" || bizKey === "delivered" ? "撤回交付" : "仅「交付中/已交付」可撤回"}
                className={bizKey === "delivering" || bizKey === "delivered" ? "px-3 py-1.5 font-medium text-white bg-neutral-700 rounded-lg hover:bg-neutral-800" : "px-3 py-1.5 font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed"}
              >
                撤回
              </button>
              <button
                type="button"
                onClick={() => alert("重新上传动作由现有交付 API 承接，本工单仅激活入口按钮")}
                disabled={bizKey !== "delivering" && bizKey !== "delivered"}
                title={bizKey === "delivering" || bizKey === "delivered" ? "重新上传交付文件" : "仅「交付中/已交付」可重新上传"}
                className={bizKey === "delivering" || bizKey === "delivered" ? "px-3 py-1.5 font-medium text-white bg-neutral-700 rounded-lg hover:bg-neutral-800" : "px-3 py-1.5 font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed"}
              >
                重新上传
              </button>
              <button
                type="button"
                onClick={() => alert("退款需人工处理：请线下确认后退款并锁定下载，再由管理员人工变更状态")}
                disabled={bizKey !== "awaiting_customer" && bizKey !== "delivered"}
                title={bizKey === "awaiting_customer" || bizKey === "delivered" ? "发起退款（退款中会锁定文件下载）" : "仅「待客户确认/已交付」可发起退款"}
                className={bizKey === "awaiting_customer" || bizKey === "delivered" ? "px-3 py-1.5 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700" : "px-3 py-1.5 font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed"}
              >
                退款
              </button>
              <span className="text-[11px] text-neutral-400">交付/撤回/重新上传/退款按钮状态与业务状态机绑定；动作本身走现有 API，退款暂需人工处理。</span>
            </div>
          </section>
        </div>
      )}
      {/* ============ 时间线 ============ */}
      <section className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-neutral-400" /> 时间线与沟通记录
        </h3>
        <div className="space-y-3">
          {(project.timeline || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, i) => {
            const labels: Record<string, string> = {
              submitted: "已提交", payment_uploaded: "待确认付款", paid: "已付款", confirmed: "需求确认中",
              ai_analysis: "AI 分析中", brand_analyzed: "品牌分析完成", logo_generated: "Logo生成完成",
              designing: "设计制作中", reviewing: "审核中", completed: "已完成", delivered: "已交付",
            };
            return (
              <div key={`${entry.timestamp}-${i}`} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-neutral-600">{labels[entry.status] || entry.status}</span>
                {entry.note && <span className="text-xs text-neutral-400">（{entry.note}）</span>}
                <span className="text-xs text-neutral-400 ml-auto">{formatDateTime(entry.timestamp)}</span>
              </div>
            );
          })}
          {(!project.timeline || project.timeline.length === 0) && (
            <p className="text-sm text-neutral-400">暂无时间线记录</p>
          )}
        </div>

        {/* 内部备注 */}
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5" /> 内部备注
          </h4>
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              placeholder="添加内部备注（仅管理员可见）"
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={handleAddNote} disabled={savingNote || !noteDraft.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {savingNote ? "保存中..." : "添加"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {notes.length === 0 && <p className="text-xs text-neutral-400">暂无内部备注</p>}
            {notes.map((n: any) => (
              <div key={n.id} className="flex items-start gap-2 text-xs bg-neutral-50 rounded-lg px-3 py-2">
                <span className="text-neutral-400 shrink-0 mt-0.5">{formatDateTime(n.at)}</span>
                <p className="text-neutral-700 flex-1">{n.note}</p>
                <span className="text-neutral-400 shrink-0">{n.author}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 沟通记录 */}
        {clientInfo.regenerationFeedback && clientInfo.regenerationFeedback.length > 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> 客户沟通记录（Logo 修改意见）
            </h4>
            <div className="space-y-2">
              {clientInfo.regenerationFeedback.map((fb: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-neutral-400 shrink-0">{fb.at ? formatDateTime(fb.at) : `第${idx + 1}次`}</span>
                  <p className="text-neutral-700">{fb.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ 危险区 ============ */}
      <section className="bg-white rounded-xl border border-red-100 p-5">
        <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> 危险区
        </h3>
        <p className="mt-1 text-xs text-neutral-500">以下操作不可撤销，请谨慎执行。</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => setDeleteModalOpen(true)} disabled={deleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
            <Trash2 className="w-4 h-4" /> 删除项目
          </button>
          <button disabled title="R34 状态机接入"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed">
            <Ban className="w-4 h-4" /> 重置生产状态（R34）
          </button>
          <span className="text-[11px] text-neutral-400">删除需二次确认（输入项目编号）；重置由 R34 状态机接入。</span>
        </div>
      </section>

      {/* ============ 分配负责人 Modal ============ */}
      {assignOwnerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setAssignOwnerOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-neutral-900">分配负责人</h3>
            <p className="mt-1 text-xs text-neutral-500">当前负责人：{owner}</p>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAssignOwner(); }}
              placeholder="输入负责人姓名"
              autoFocus
              className="mt-3 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setAssignOwnerOpen(false)} className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50">取消</button>
              <button onClick={handleAssignOwner} disabled={assigningOwner || !ownerName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50">
                {assigningOwner ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除确认 Modal ============ */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> 删除项目确认
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              此操作不可撤销，将删除项目 {project.id} 及其关联数据。请输入项目编号以确认：
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={project.id}
              className="mt-3 w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white">
              <option value="">选择删除原因</option>
              <option value="误操作">误操作</option>
              <option value="测试数据">测试数据</option>
              <option value="客户要求">客户要求</option>
              <option value="其他">其他</option>
            </select>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50">取消</button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== project.id) { alert("项目编号不匹配"); return; }
                  setDeleteModalOpen(false);
                  await handleDelete();
                }}
                disabled={deleting || deleteConfirmText !== project.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Logo 放大 Lightbox ============ */}
      {enlargeLogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setEnlargeLogo(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white mb-2">
              <span className="text-sm font-medium">Logo 方案 {enlargeLogo.index + 1}</span>
              <button onClick={() => setEnlargeLogo(null)} className="text-sm text-neutral-300 hover:text-white">关闭 ✕</button>
            </div>
            <img src={enlargeLogo.url} alt={`Logo方案${enlargeLogo.index + 1}`} className="w-full rounded-xl bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}