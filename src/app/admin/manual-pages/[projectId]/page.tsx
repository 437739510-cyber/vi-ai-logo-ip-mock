"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Loader2, Hand, Play, Trash2 } from "lucide-react";

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
  { id: "cover", label: "封面" },
  { id: "brand-colors", label: "品牌色板" },
  { id: "typography", label: "字体规范" },
  { id: "logo-usage", label: "Logo 规范" },
  { id: "logo-variants", label: "Logo 变体" },
  { id: "auxiliary", label: "辅助图形" },
  { id: "business-card", label: "名片" },
  { id: "letterhead", label: "信纸" },
  { id: "ppt-template", label: "PPT 模板" },
  { id: "signage", label: "招牌" },
  { id: "closing", label: "封底" },
];

export default function ManualPagesViewer({ params }: { params: Promise<{ projectId: string }> }) {
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
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [currentGenPage, setCurrentGenPage] = useState(0);
  const [waitingForReview, setWaitingForReview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      setProjectId(p.projectId);
      await loadData(p.projectId);
      setLoading(false);
    });
  }, [params]);

  const loadData = async (pid: string) => {
    try {
      const res = await fetch("/mock/manual-pages-" + pid + ".json");
      if (res.ok) {
        const data = await res.json();
        setPagesData(data);
        setLivePages(data.pages || []);
        setLiveErrors(data.errors || []);
      }
    } catch {}

    try {
      const projRes = await fetch("/mock/projects.json");
      const projects = await projRes.json();
      const project = projects.find((p: any) => p.id === pid);
      if (project) {
        const subRes = await fetch("/mock/submissions.json");
        const subs = await subRes.json();
        const sub = subs.find((s: any) => s.id === project.submissionId);
        if (sub) setClientInfo(sub);
        if (sub?.logoAssets?.length > 0) {
          setLogoUrl(sub.logoAssets[0].url);
        }
        if (sub?.mascotAssets?.length > 0) {
          const firstMascotFiles = sub.mascotAssets[0]?.files;
          if (firstMascotFiles?.length > 0) {
            setMascotUrl(firstMascotFiles[0].url);
          }
        }
      }
    } catch {}
  };

  // Auto mode: generate all pages in one stream
  const startAutoGenerate = async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setWaitingForReview(false);
    setLivePages([]);
    setLiveErrors([]);
    setCurrentPage(0);
    setProgress({ done: 0, total: 11 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/generate-manual-pages-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientInfo: clientInfo || { companyName: "品牌名称", industry: "未指定" },
          logoUrl, mascotUrl,
          brandColors: {
            primary: { name: "品牌色", hex: "#1A73E8" },
            secondary: { name: "辅助色", hex: "#34A853" },
            accent: { name: "强调色", hex: "#FBBC04" },
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
              handleAutoEvent(currentEvent, data);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e && e.name !== "AbortError") {
        alert("生成失败: " + (e.message || String(e)));
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleAutoEvent = (event: string, data: any) => {
    switch (event) {
      case "page:start":
        setProgress((p) => ({ ...p, total: data.total }));
        break;
      case "page:done":
        setLivePages((prev) => {
          const exists = prev.find((p) => p.pageId === data.pageId);
          if (exists) return prev.map((p) => p.pageId === data.pageId ? { pageId: data.pageId, label: data.label, url: data.url } : p);
          return [...prev, { pageId: data.pageId, label: data.label, url: data.url }];
        });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        setCurrentPage((prev) => prev + 1);
        break;
      case "page:fail":
        setLiveErrors((prev) => [...prev, { pageId: data.pageId, label: data.label, error: data.error }]);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        break;
      case "done":
        setPagesData({
          projectId,
          pages: livePages,
          errors: liveErrors,
          generatedAt: new Date().toISOString(),
          totalPages: livePages.length,
          failedPages: liveErrors.length,
        });
        break;
    }
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
          clientInfo: clientInfo || { companyName: "品牌名称", industry: "未指定" },
          logoUrl, mascotUrl,
          maxPages: 1,
          brandColors: {
            primary: { name: "品牌色", hex: "#1A73E8" },
            secondary: { name: "辅助色", hex: "#34A853" },
            accent: { name: "强调色", hex: "#FBBC04" },
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
        alert("生成失败: " + (e.message || String(e)));
      }
    }
  };

  const handleManualEvent = (event: string, data: any, pageIndex: number) => {
    switch (event) {
      case "page:done":
        setLivePages((prev) => {
          const exists = prev.find((p) => p.pageId === data.pageId);
          if (exists) return prev.map((p) => p.pageId === data.pageId ? { pageId: data.pageId, label: data.label, url: data.url } : p);
          return [...prev, { pageId: data.pageId, label: data.label, url: data.url }];
        });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        setCurrentPage(livePages.length);
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
    const currentLabel = PAGE_LABELS[currentGenPage].id;
    setLivePages((prev) => prev.filter((p) => p.pageId !== currentLabel));
    setLiveErrors((prev) => prev.filter((p) => p.pageId !== currentLabel));
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
    if (!window.confirm("确定要删除已生成的所有页面吗？此操作不可撤销。")) return;
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
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch {
      alert("网络错误，请重试");
    }
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

  const displayPages = generating ? livePages : (pagesData?.pages || []);
  const displayErrors = generating ? liveErrors : (pagesData?.errors || []);

  const displayIdx = (mode === "manual" && generating) ? Math.max(0, livePages.length - 1) : currentPage;
  const safeIdx = Math.min(displayIdx, Math.max(0, displayPages.length - 1));
  const currentImage = displayPages.length > 0 ? displayPages[safeIdx] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={"/admin/projects/" + projectId} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回项目
        </Link>
        <span className="text-sm text-neutral-400">项目：{projectId}</span>
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-3">
        <div className="flex bg-neutral-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode("manual")}
            className={"px-3 py-1.5 text-sm rounded-md transition-all " + (mode === "manual" ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700")}
          >
            <Hand className="w-3.5 h-3.5 inline mr-1" />
            手动逐张
          </button>
          <button
            onClick={() => setMode("auto")}
            className={"px-3 py-1.5 text-sm rounded-md transition-all " + (mode === "auto" ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700")}
          >
            <Play className="w-3.5 h-3.5 inline mr-1" />
            自动全部
          </button>
        </div>
        <span className="text-xs text-neutral-400">
          {mode === "manual" ? "每生成一页，确认满意再继续，省API费用" : "一次性生成全部11页"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">VI 手册页面</h2>
          <p className="text-sm text-neutral-400 mt-1">
            {!generating
              ? (displayPages.length > 0 ? "已生成 " + displayPages.length + " 页，失败 " + displayErrors.length + " 页" : "尚未生成")
              : (mode === "manual"
                  ? "正在生成第 " + (currentGenPage + 1) + "/11 页..."
                  : "正在生成 " + progress.done + "/" + progress.total + " 页..")}
          </p>
        </div>

        <div className="flex gap-2">
          {mode === "auto" && (
            <button onClick={startAutoGenerate} disabled={generating}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中{progress.done}/{progress.total}</> : <><Sparkles className="w-4 h-4" /> {displayPages.length > 0 ? "重新生成" : "AI 生成全部"}</>}
            </button>
          )}
          {mode === "manual" && !generating && (
            <button onClick={startManualGenerate}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Hand className="w-4 h-4" /> {displayPages.length > 0 ? "继续生成" : "开始逐张生成"}
            </button>
          )}
          {displayPages.length > 0 && !generating && (
            <button onClick={handleClearPages}
              className="px-3 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> 删除已生成
            </button>
          )}
        </div>
      </div>

      {generating && mode === "auto" && (
        <div className="bg-white rounded-xl border border-primary/20 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-neutral-700">AI 正在逐页生成...</span>
            <span className="text-xs text-neutral-400 ml-auto">{progress.done}/{progress.total} 页</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: (progress.total > 0 ? (progress.done / progress.total) * 100 : 0) + "%" }} />
          </div>
        </div>
      )}

      {generating && mode === "manual" && !waitingForReview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            <span className="text-sm font-medium text-amber-800">正在生成第 {currentGenPage + 1} 页：{PAGE_LABELS[currentGenPage]?.label}</span>
          </div>
        </div>
      )}

      {generating && mode === "manual" && waitingForReview && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">第 {currentGenPage + 1} 页已生成</p>
              <p className="text-xs text-green-600 mt-0.5">满意这张图吗？选择下一步操作</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRegenerate}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
              >
                重新生成这张
              </button>
              {currentGenPage + 1 < PAGE_LABELS.length ? (
                <button onClick={handleContinue}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  满意，继续下一张 ({currentGenPage + 2}/{PAGE_LABELS.length})
                </button>
              ) : (
                <button onClick={handleContinue}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  完成全部 {PAGE_LABELS.length} 页
                </button>
              )}
              <button onClick={handleStop}
                className="px-4 py-2 border border-neutral-300 text-neutral-600 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
              >
                停止
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
                  <img src={currentImage.url} alt={currentImage.label} className="max-w-full max-h-full object-contain" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
                    <span className="text-white text-lg font-bold drop-shadow-lg">{currentImage.label}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">等待第一页生成...</span>
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
                  <button key={page.pageId} onClick={() => setCurrentPage(i)}
                    className={"text-xs px-2.5 py-1 rounded-full transition-all " + (i === safeIdx ? "bg-primary text-white" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300")}>
                    {page.label}
                  </button>
                ))}
                {generating && mode === "auto" && Array.from({ length: progress.total - displayPages.length }).map((_, i) => (
                  <span key={"ph-" + i} className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-300 animate-pulse">等待中</span>
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
              <p className="text-sm font-medium text-amber-800">有{displayErrors.length} 页生成失败：</p>
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
          <p className="text-sm text-neutral-500">选择上方“手动逐张”或“自动全部”模式，然后点击生成按钮</p>
          <p className="text-xs text-neutral-400 mt-1">手动模式每生成一页会暂停确认，自动模式一次性生成全部 11 页</p>
        </div>
      )}
    </div>
  );
}
