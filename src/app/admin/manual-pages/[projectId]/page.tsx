"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Loader2, Hand, Play, Trash2, Wand2 } from "lucide-react";
// Brand Brain imports
import type { BrandProfile } from "@/lib/brand-analyzer";
import type { ModulePlan, RecommendedModule } from "@/lib/module-planner";
import { modulePlanToPages } from "@/lib/module-to-page";
import { supabase } from "@/lib/supabase";
import { DecisionLayer } from "@/components/admin/DecisionLayer";
import { generateMascotPromptSet, type MascotPromptSet } from "@/lib/mascot-prompt-strategy";
import { generateIPCreationPlan } from "@/lib/ip-creation-plan";
import { estimateFullCost } from "@/lib/billing/cost-estimator";

interface ManualPage {
  pageId: string;
  label: string;
  url: string;
}

interface PagesData {
  projectId: string;
  pages: ManualPage[];
  errors: { pageId: string; label: string; error: string }[];
  generatedAt: string;
  totalPages: number;
  failedPages: number;
}

const PAGE_LABELS = [
  { id: "cover", label: "\u5c01\u9762" },
  { id: "brand-philosophy", label: "\u54c1\u724c\u6838\u5fc3\u7406\u5ff5" },
  { id: "logo-interpretation", label: "\u6807\u8bc6\u8be0\u91ca" },
  { id: "brand-colors", label: "\u6807\u51c6\u8272\u5f69\u89c4\u8303" },
  { id: "typography", label: "\u5b57\u4f53\u7cfb\u7edf" },
  { id: "basic-spec", label: "\u57fa\u7840\u89c4\u8303" },
  { id: "stationery", label: "\u529e\u516c\u5e94\u7528\u7cfb\u7edf" },
  { id: "packaging", label: "\u4ea7\u54c1\u5305\u88c5\u7cfb\u7edf" },
  { id: "marketing", label: "\u8425\u9500\u5c55\u793a\u7cfb\u7edf" },
  { id: "summary", label: "\u603b\u7ed3" },
  { id: "closing", label: "\u611f\u8c22\u89c2\u770b" },
];

export default function ManualPagesViewer({ params }: { params: Promise<{ projectId: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [pagesData, setPagesData] = useState<PagesData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [progress, setProgress] = useState({ done: 0, total: 11 });
  const [livePages, setLivePages] = useState<ManualPage[]>([]);
  const [liveErrors, setLiveErrors] = useState<{ pageId: string; label: string; error: string }[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [mascotUrl, setMascotUrl] = useState<string | undefined>(undefined);
  const [refId, setRefId] = useState<string | undefined>(undefined);
  const [realBrandColors, setRealBrandColors] = useState<any>(null);
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [currentGenPage, setCurrentGenPage] = useState(0);
  const [waitingForReview, setWaitingForReview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // ===== Brand Brain - Decision Layer =====
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [brandAnalysis, setBrandAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedModules, setSelectedModules] = useState<RecommendedModule[]>([]);
  const [generationConfirmed, setGenerationConfirmed] = useState(false);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [genPlan, setGenPlan] = useState<{pages: number; images: number; minutes: number} | null>(null);
  const [mascotPromptSet, setMascotPromptSet] = useState<MascotPromptSet | null>(null);
  const [mascotAccepted, setMascotAccepted] = useState(true);

  const [businessProfile, setBusinessProfile] = useState<{businessStage: string; businessGoal: string; budgetLevel: string} | null>(null);


  useEffect(() => {
    params.then(async (p) => {
      setProjectId(p.projectId);
      await loadData(p.projectId);
      setLoading(false);
    });
  }, [params]);

  // Auto-generate mascot prompt set when entering Step 3
  useEffect(() => {
    if (step === 3 && !mascotPromptSet && brandAnalysis) {
      // Guard: mascotProfile may be missing from brand analysis response
      if (!brandAnalysis.mascotProfile) {
        setMascotPromptSet({
          mode: "not_needed",
          strategyPrompt: "品牌分析暂未生成IP策略，可继续下一步。",
          imagePrompt: null,
          negativePrompt: "",
          usageNotes: [],
          restrictions: [],
        });
        return;
      }
      const promptSet = generateMascotPromptSet({
        mascotProfile: brandAnalysis.mascotProfile,
        brandProfile: brandAnalysis.profile,
        businessProfile: (businessProfile as any) || undefined,
        industryProfile: brandAnalysis.industryProfile,
      });
      setMascotPromptSet(promptSet);
    }
  }, [step, brandAnalysis, businessProfile]);


    const loadData = async (pid: string) => {
    // --- Load generated manual pages ---
    // Try Supabase first (production), fall back to mock files (local dev)
    let loadedFromSupabase = false;

    try {
      const { data: manuals } = await supabase
        .from("vi_manuals")
        .select("pages, generated_at")
        .eq("project_id", pid)
        .order("generated_at", { ascending: false })
        .limit(1);
      if (manuals && manuals.length > 0 && manuals[0].pages) {
        const pages = manuals[0].pages;
        setPagesData({
          projectId: pid,
          pages: pages,
          errors: [],
          generatedAt: manuals[0].generated_at,
          totalPages: pages.length,
          failedPages: 0,
        });
        setLivePages(pages);
        loadedFromSupabase = true;
      }
    } catch {}

    // Fallback: mock files (local dev)
    if (!loadedFromSupabase) {
      try {
        const res = await fetch("/mock/manual-pages-" + pid + ".json");
        if (res.ok) {
          const data = await res.json();
          setPagesData(data);
          setLivePages(data.pages || []);
          setLiveErrors(data.errors || []);
        }
      } catch {}
    }

    // --- Load submission / client info ---
    try {
      const { data: projects } = await supabase
        .from("projects")
        .select("submission_id")
        .eq("id", pid)
        .limit(1);
      if (projects && projects.length > 0 && projects[0].submission_id) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", projects[0].submission_id)
          .limit(1);
        if (subs && subs.length > 0) {
          const sub = subs[0];
          setClientInfo(sub);
          if (sub?.logoAssets?.length > 0) setLogoUrl(sub.logoAssets[0].url);
          if (sub?.mascotAssets?.length > 0) {
            const f = sub.mascotAssets[0]?.files;
            if (f?.length > 0) setMascotUrl(f[0].url);
          }
          const priColor = sub?.brandColors?.primary?.hex || "#1A73E8";
          const secColor = sub?.brandColors?.secondary?.hex || "#34A853";
          const accColor = sub?.brandColors?.accent?.hex || "#FBBC04";
          setRealBrandColors({
            primary: { name: "品牌色", hex: priColor },
            secondary: { name: "辅助色", hex: secColor },
            accent: { name: "强调色", hex: accColor },
          });
        }
      }
    } catch {}

    // Fallback: mock submission files (local dev)
    if (!loadedFromSupabase) {
      try {
        const projRes = await fetch("/mock/projects.json");
        if (!projRes.ok) return;
        const projects = await projRes.json();
        const project = projects.find((p: any) => p.id === pid);
        if (!project) return;
        const subRes = await fetch("/mock/submissions.json");
        if (!subRes.ok) return;
        const subs = await subRes.json();
        const sub = subs.find((s: any) => s.id === project.submissionId);
        if (!sub) return;
        setClientInfo(sub);
        if (sub?.logoAssets?.length > 0) setLogoUrl(sub.logoAssets[0].url);
        if (sub?.mascotAssets?.length > 0) {
          const f = sub.mascotAssets[0]?.files;
          if (f?.length > 0) setMascotUrl(f[0].url);
        }
        const priColor = sub?.brandColors?.primary?.hex || "#1A73E8";
        const secColor = sub?.brandColors?.secondary?.hex || "#34A853";
        const accColor = sub?.brandColors?.accent?.hex || "#FBBC04";
        setRealBrandColors({
          primary: { name: "品牌色", hex: priColor },
          secondary: { name: "辅助色", hex: secColor },
          accent: { name: "强调色", hex: accColor },
        });
      } catch {}
    }

    // --- Load reference file (optional, 404 is OK) ---
    try {
      const idxRes = await fetch("/mock/reference/ref-" + pid + ".json");
      if (idxRes.ok) {
        const refData = await idxRes.json();
        if (refData.refId) setRefId(refData.refId);
      }
    } catch {}
  };

  // Manual mode: generate one page at a time
  const startManualGenerate = async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setWaitingForReview(false);
    setCurrentGenPage(0);
    setLivePages([]);
    setLiveErrors([]);
    setCurrentPage(0);
    setProgress({ done: 0, total: 11 });
    await generateOnePage(0);
  };

  const generateOnePage = async (pageIndex: number) => {
    if (pageIndex >= PAGE_LABELS.length) {
      setGenerating(false);
      setWaitingForReview(false);
      setPagesData({
        projectId,
        pages: livePages,
        errors: liveErrors,
        generatedAt: new Date().toISOString(),
        totalPages: livePages.length,
        failedPages: liveErrors.length,
      });
      return;
    }

    setCurrentGenPage(pageIndex);
    setWaitingForReview(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/generate-manual-pages-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientInfo: clientInfo || { companyName: "\u54c1\u724c\u540d\u79f0", industry: "\u672a\u6307\u5b9a" },
          logoUrl, mascotUrl, refId: refId || undefined,
          maxPages: 1,
          startPage: pageIndex,
          brandColors: realBrandColors || {
            primary: { name: "\u54c1\u724c\u8272", hex: "#1A73E8" },
            secondary: { name: "\u8f85\u52a9\u8272", hex: "#34A853" },
            accent: { name: "\u5f3a\u8c03\u8272", hex: "#FBBC04" },
          },
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleManualEvent(currentEvent, data, pageIndex);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e && e.name !== "AbortError") {
        alert("\u751f\u6210\u5931\u8d25: " + (e.message || String(e)));
      }
    } finally {
      // In manual mode, keep generating=true after success for review flow
      // handleContinue/handleStop/startManualGenerate manage the generating state
      abortRef.current = null;
    }
  };

  const handleManualEvent = (event: string, data: any, pageIndex: number) => {
    switch (event) {
      case "page:done":
        setLivePages((prev) => {
          const updated = [...prev];
          updated[pageIndex] = { pageId: data.pageId || 'page-' + pageIndex, label: PAGE_LABELS[pageIndex]?.label || data.label, url: data.url };
          return updated.filter(Boolean);
        });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        setCurrentPage(pageIndex);
        setWaitingForReview(true);
        break;
      case "page:fail":
        setLiveErrors((prev) => [...prev, { pageId: data.pageId, label: data.label, error: data.error }]);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        setWaitingForReview(true);
        break;
      case "done":
        break;
    }
  };

  const handleContinue = () => {
    const nextIdx = currentGenPage + 1;
    if (nextIdx >= PAGE_LABELS.length) {
      setGenerating(false);
      setWaitingForReview(false);
      setPagesData({
        projectId,
        pages: livePages,
        errors: liveErrors,
        generatedAt: new Date().toISOString(),
        totalPages: livePages.length,
        failedPages: liveErrors.length,
      });
    } else {
      setWaitingForReview(false);
      generateOnePage(nextIdx);
    }
  };

  const handleRegenerate = () => {
    setLivePages((prev) => prev.filter((_, i) => i !== currentGenPage));
    setLiveErrors((prev) => prev.filter((_, i) => i !== currentGenPage));
    setProgress((p) => ({ ...p, done: Math.max(0, p.done - 1) }));
    setWaitingForReview(false);
    generateOnePage(currentGenPage);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setGenerating(false);
    setWaitingForReview(false);
    setPagesData({
      projectId,
      pages: livePages,
      errors: liveErrors,
      generatedAt: new Date().toISOString(),
      totalPages: livePages.length,
      failedPages: liveErrors.length,
    });
  };

  const handleClearPages = async () => {
    if (!window.confirm("\u786e\u5b9a\u8981\u5220\u9664\u5df2\u751f\u6210\u7684\u6240\u6709\u9875\u9762\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002")) return;
    try {
      const res = await fetch("/api/ai/clear-generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setPagesData(null);
        setLivePages([]);
        setLiveErrors([]);
        setProgress({ done: 0, total: 11 });
      } else {
        alert("\u5220\u9664\u5931\u8d25: " + (data.error || "\u672a\u77e5\u9519\u8bef"));
      }
    } catch {
      alert("\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5");
    }
  };

  const runBrandAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientInfo: clientInfo || { companyName: "品牌名称", industry: "未指定" }, projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setBrandAnalysis(data.data);
        const plan = data.data.modulePlan;
        setSelectedModules(plan.modules.filter((m: RecommendedModule) => m.priority === "essential" || m.priority === "recommended"));
        setStep(2);
      }
    } catch (e) {
      console.error("Brand analysis failed:", e);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleModule = (modId: string) => {
    setSelectedModules((prev) => prev.filter((m) => m.id !== modId));
  };

  const handleAcceptMascot = () => {
      setMascotAccepted(true);
      setStep(4);
    };

    const handleDeclineMascot = () => {
      setMascotAccepted(false);
      setSelectedModules((prev) => prev.filter((m) => m.id !== "ip-specs"));
      setStep(4);
    };

    const handleEnterSandbox = async () => {
      if (!mascotPromptSet || !brandAnalysis) return;
      try {
        const plan = generateIPCreationPlan({
          mascotProfile: brandAnalysis.mascotProfile,
          brandProfile: brandAnalysis.profile,
          businessProfile: businessProfile as any || undefined,
        });
        const res = await fetch("/api/ip-sandbox/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectId,
            accountId: "acc-default-001",
            plan,
          }),
        });
        const data = await res.json();
        if (data.session) {
          router.push("/admin/ip-sandbox/" + data.session.sessionId);
        }
      } catch (e) {
        console.error("Failed to create sandbox session:", e);
      }
    };

    const handleConfirmModules = async () => {
    const totalPages = selectedModules.reduce((sum, m) => sum + m.estimatedPages, 0);
    const imagesToGenerate = selectedModules.filter((m) => m.priority !== "essential" || m.estimatedPages > 1).length + 1;
    // Fetch real DashScope balance from server-side API
    let currentBalance = 0;
    try {
      const balRes = await fetch("/api/billing/dashscope-balance");
      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData.balance !== null && balData.balance !== undefined) {
          currentBalance = balData.balance;
        }
      }
    } catch {}
    const est = estimateFullCost(totalPages, {
      hasBrandAnalyze: true,
      hasMascotStrategy: !!mascotPromptSet,
      currentBalance,
    });
    setGenPlan({ pages: totalPages, images: imagesToGenerate, minutes: Math.ceil(totalPages * 0.8) });
    setCostEstimate(est);
    setStep(5);
  };

  const handleStartGeneration = () => {
    setGenerationConfirmed(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse space-y-4">
          <div className="w-64 h-80 bg-neutral-100 rounded-xl" />
        </div>
      </div>
    );
  }
  // ===== Decision Layer: Step Wizard =====
  if (!generationConfirmed) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <DecisionLayer
          step={step}
          analyzing={analyzing}
          brandAnalysis={brandAnalysis}
          selectedModules={selectedModules}
          genPlan={genPlan}
          clientInfo={clientInfo}
          onRunAnalysis={runBrandAnalysis}
          onToggleModule={toggleModule}
          onAddModule={(mod: RecommendedModule) => setSelectedModules((prev) => [...prev, mod])}
          onGoToStep={setStep}
          onConfirmModules={handleConfirmModules}
          onStartGeneration={handleStartGeneration}
          businessProfile={businessProfile || undefined}
          onBusinessProfileChange={setBusinessProfile}
          mascotPromptSet={mascotPromptSet}
          onAcceptMascot={handleAcceptMascot}
          onDeclineMascot={handleDeclineMascot}
          onEnterSandbox={handleEnterSandbox}
          costEstimate={costEstimate}
        />
      </div>
    );
  }


  const displayPages = generating ? livePages : (pagesData?.pages || []);
  const displayErrors = generating ? liveErrors : (pagesData?.errors || []);

  const safeIdx = Math.min(currentPage, Math.max(0, displayPages.length - 1));
  const currentImage = displayPages.length > 0 ? displayPages[safeIdx] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={"/admin/projects/" + projectId} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {"\u8fd4\u56de\u9879\u76ee"}
        </Link>
        <span className="text-sm text-neutral-400">{"\u9879\u76ee\uff1a"}{projectId}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-neutral-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode("manual")}
            className={"px-3 py-1.5 text-sm rounded-md transition-all " + (mode === "manual" ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700")}
          >
            <Hand className="w-3.5 h-3.5 inline mr-1" />
            {"\u624b\u52a8\u9010\u5f20"}
          </button>
          <button
            onClick={() => setMode("auto")}
            className={"px-3 py-1.5 text-sm rounded-md transition-all " + (mode === "auto" ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700")}
          >
            <Play className="w-3.5 h-3.5 inline mr-1" />
            {"\u81ea\u52a8\u5168\u90e8"}
          </button>
        </div>
        <span className="text-xs text-neutral-400">
          {mode === "manual" ? "\u6bcf\u751f\u6210\u4e00\u9875\uff0c\u786e\u8ba4\u6ee1\u610f\u518d\u7ee7\u7eed\uff0c\u7701API\u8d39\u7528" : "\u4e00\u6b21\u6027\u751f\u6210\u5168\u90e811\u9875"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">VI {"\u624b\u518c\u9875\u9762"}</h2>
          <p className="text-sm text-neutral-400 mt-1">
            {!generating
              ? (displayPages.length > 0 ? "\u5df2\u751f\u6210 " + displayPages.length + " \u9875\uff0c\u5931\u8d25 " + displayErrors.length + " \u9875" : "\u5c1a\u672a\u751f\u6210")
              : (mode === "manual"
                  ? "\u6b63\u5728\u751f\u6210\u7b2c " + (currentGenPage + 1) + "/11 \u9875..."
                  : "\u6b63\u5728\u751f\u6210 " + progress.done + "/" + progress.total + " \u9875..")}
          </p>
        </div>

        <div className="flex gap-2">
          {mode === "auto" && (
            <button onClick={() => {}/*auto generate*/} disabled={generating}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> {"\u751f\u6210\u4e2d"}{progress.done}/{progress.total}</> : <><Sparkles className="w-4 h-4" /> {displayPages.length > 0 ? "\u91cd\u65b0\u751f\u6210" : "AI \u751f\u6210\u5168\u90e8"}</>}
            </button>
          )}
          {mode === "manual" && !generating && (
            <button onClick={startManualGenerate}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Hand className="w-4 h-4" /> {displayPages.length > 0 ? "\u7ee7\u7eed\u751f\u6210" : "\u5f00\u59cb\u9010\u5f20\u751f\u6210"}
            </button>
          )}
          {displayPages.length > 0 && !generating && (
            <button onClick={handleClearPages}
              className="px-3 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> {"\u5220\u9664\u5df2\u751f\u6210"}
            </button>
          )}
        </div>
      </div>

      {generating && mode === "manual" && !waitingForReview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            <span className="text-sm font-medium text-amber-800">{"\u6b63\u5728\u751f\u6210\u7b2c "}{currentGenPage + 1}{" \u9875\uff1a"}{PAGE_LABELS[currentGenPage]?.label}</span>
          </div>
        </div>
      )}

      {generating && mode === "manual" && waitingForReview && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">{"\u7b2c "}{currentGenPage + 1}{" \u9875\u5df2\u751f\u6210"}</p>
              <p className="text-xs text-green-600 mt-0.5">{"\u6ee1\u610f\u8fd9\u5f20\u56fe\u5417\uff1f\u9009\u62e9\u4e0b\u4e00\u6b65\u64cd\u4f5c"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRegenerate}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
              >
                {"\u91cd\u65b0\u751f\u6210\u8fd9\u5f20"}
              </button>
              {currentGenPage + 1 < PAGE_LABELS.length ? (
                <button onClick={handleContinue}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {"\u6ee1\u610f\uff0c\u7ee7\u7eed\u4e0b\u4e00\u5f20 ("}{currentGenPage + 2}/{PAGE_LABELS.length}{")"}
                </button>
              ) : (
                <button onClick={handleContinue}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {"\u5b8c\u6210\u5168\u90e8 "}{PAGE_LABELS.length}{" \u9875"}
                </button>
              )}
              <button onClick={handleStop}
                className="px-4 py-2 border border-neutral-300 text-neutral-600 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
              >
                {"\u505c\u6b62"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(displayPages.length > 0 || generating) && (
        <>
          <div className="bg-neutral-100 rounded-xl p-4">
            <div className="aspect-[1/1] max-h-[70vh] bg-white rounded-lg overflow-hidden flex items-center justify-center shadow-sm relative">
              {currentImage ? (
                <>
                  <img src={currentImage.url + "?t=" + Date.now()} alt={currentImage.label} className="max-w-full max-h-full object-contain" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
                    <span className="text-white text-lg font-bold drop-shadow-lg">
                      {"\u7b2c"}{safeIdx + 1}/{displayPages.length}{"\u9875 \u2014 "}{currentImage.label}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">{"\u7b49\u5f85\u7b2c\u4e00\u9875\u751f\u6210..."}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={safeIdx === 0 || displayPages.length === 0}
                className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
                {displayPages.map((page, i) => (
                  <button key={i} onClick={() => setCurrentPage(i)}
                    className={"text-xs px-2.5 py-1 rounded-full transition-all " + (i === safeIdx ? "bg-primary text-white" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300")}>
                    {page.label}
                  </button>
                ))}
              </div>

              <button onClick={() => setCurrentPage((p) => Math.min(displayPages.length - 1, p + 1))} disabled={safeIdx >= displayPages.length - 1}
                className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-sm text-neutral-400">{displayPages.length > 0 ? (safeIdx + 1) + " / " + displayPages.length : "0 / 0"}</span>
          </div>

          {displayErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800">{"\u6709"}{displayErrors.length}{" \u9875\u751f\u6210\u5931\u8d25\uff1a"}</p>
              <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                {displayErrors.map((e) => (
                  <li key={e.pageId}>{e.label}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!generating && displayPages.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-16 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-500">{"\u9009\u62e9\u4e0a\u65b9\u201c\u624b\u52a8\u9010\u5f20\u201d\u6216\u201c\u81ea\u52a8\u5168\u90e8\u201d\u6a21\u5f0f\uff0c\u7136\u540e\u70b9\u51fb\u751f\u6210\u6309\u94ae"}</p>
          <p className="text-xs text-neutral-400 mt-1">{"\u624b\u52a8\u6a21\u5f0f\u6bcf\u751f\u6210\u4e00\u9875\u4f1a\u6682\u505c\u786e\u8ba4\uff0c\u81ea\u52a8\u6a21\u5f0f\u4e00\u6b21\u6027\u751f\u6210\u5168\u90e8 11 \u9875"}</p>
        </div>
      )}
    </div>
  );
}
