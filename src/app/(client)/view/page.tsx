"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Eye, CheckCircle, Loader2, ArrowLeft, ImageIcon, Phone, Key, RefreshCw, History, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MascotSection } from "@/components/client/MascotSection";
import { LogoLightbox } from "@/components/client/LogoLightbox";
import type { CustomerFormEcho } from "@/lib/vi-manual/customer-form-echo";
import {
  getGenerationStateLabel,
  type CanonicalGenerationState,
  type GenerationStateSource,
} from "@/lib/core/generation-state";
import Link from "next/link";

  interface LogoItem {
    index: number;
    imageUrl: string;
    prompt?: string;
    slotLabel?: string;
  }

interface LogoRound {
  logos: LogoItem[];
  savedAt: string;
  round: number;
}

interface ProjectData {
  id: string;
  status: string;
  companyName: string;
  industry: string;
  mainProducts: string;
  generationStatus: CanonicalGenerationState | null;
  generationStateSource: GenerationStateSource;
  generationStateNeedsReview: boolean;
  generationStateMirrorMatches: boolean;
  logos: LogoItem[];
  selectedLogo: {
    imageUrl: string;
    index: number;
  } | null;
  preferredLogo: {
    index: number;
    imageUrl: string;
    savedAt: string;
  } | null;
  logoHistory: LogoRound[];
  client_info?: {
    wantMascot?: string;
    mascotSamples?: unknown[];
    mascotSelectedId?: string | null;
    formEcho?: CustomerFormEcho;
  };
}

/** 工单 087：我的填写资料只读回显（纯文本展示，无任何编辑控件）。 */
function FormEchoSection({ echo }: { echo?: CustomerFormEcho }) {
  if (!echo) return null;
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | undefined | null | Array<string> | { primary?: string | null; secondary?: string | null; accent?: string | null }) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string") {
      if (value.trim()) rows.push({ label, value });
      return;
    }
    if (Array.isArray(value)) {
      const joined = value.map((v) => String(v)).filter(Boolean).join("、");
      if (joined) rows.push({ label, value: joined });
      return;
    }
    if (typeof value === "object") {
      const parts: string[] = [];
      if (value.primary) parts.push(`主色 ${value.primary}`);
      if (value.secondary) parts.push(`辅助色 ${value.secondary}`);
      if (value.accent) parts.push(`强调色 ${value.accent}`);
      if (parts.length) rows.push({ label, value: parts.join(" / ") });
    }
  };
  push("Logo 风格", echo.logoStyle);
  push("Logo 用途", echo.logoUsage);
  push("品牌色", echo.brandColors);
  push("Logo 文字语言", echo.logoTextLanguage);
  push("上传的 Logo 文件", echo.logoFileNames);
  push("是否选择公仔", echo.wantMascot);
  push("公仔类型偏好", echo.mascotTypePref);
  push("公仔风格偏好", echo.mascotStylePref);
  push("公仔人设/性格偏好", echo.mascotPersonalityPref);
  push("公仔颜色提示", echo.mascotColorHint);
  push("公仔期望应用场景", echo.mascotUsageScenes);
  push("公仔参考图/灵感", echo.mascotRefIdea);
  push("提交时间", echo.submittedAt ? new Date(echo.submittedAt).toLocaleString("zh-CN") : undefined);
  if (rows.length === 0) return null;
  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-6">
      <h2 className="text-base font-semibold text-neutral-900 mb-4">我的填写资料</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        {rows.map((row) => (
          <div key={row.label} className="text-sm">
            <span className="block text-xs text-neutral-400">{row.label}</span>
            <span className="block mt-0.5 text-neutral-700 break-words">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-400">
        以上为提交时填写的资料（只读），如需更正请通过客服或重新提交流程处理。
      </p>
    </div>
  );
}

export default function ViewLogoPage() {
  const [phone, setPhone] = useState("");
  const [viewPassword, setViewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [historyRound, setHistoryRound] = useState<number | null>(null); // null = current, 1/2/3... = history round
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenConfirmType, setRegenConfirmType] = useState<"no_selection" | "has_selection">("no_selection");
  const [regenMode, setRegenMode] = useState<"feedback" | "pinyin">("feedback");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);
  const [deliveryConfirmType, setDeliveryConfirmType] = useState<"logo" | "mascot">("logo");
  const [ipEnabled, setIpEnabled] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("brandbrain_ip_enabled");
      if (saved !== null) setIpEnabled(saved === "true");
    }
  }, []);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleView = async () => {
    if (phone.length < 11 || viewPassword.length < 4) return;
    setLoading(true);
    setError(null);
    setProjectData(null);
    setSelectedIdx(null);
    setConfirmSuccess(false);
    setSaveSuccess(false);
    setHistoryRound(null);

    try {
      // V84: 带重试的fetch，解决Zeabur冷启动超时问题
      const fetchWithRetry = async (retries = 2): Promise<Response> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch("/api/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phone.trim(),
              viewPassword: viewPassword.trim(),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return res;
        } catch (e: any) {
          clearTimeout(timeout);
          if (retries > 0 && (e?.name === "AbortError" || e?.name === "TypeError")) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(retries - 1);
          }
          throw e;
        }
      };
      const res = await fetchWithRetry();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "查询失败");
        return;
      }
      setProjectData(data.project);
      if (data.project.preferredLogo) {
        setSelectedIdx(data.project.preferredLogo.index);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreference = async () => {
    if (selectedIdx === null || !projectData) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/ai/save-logo-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          viewPassword: viewPassword.trim(),
          logoIndex: selectedIdx,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLogo = async () => {
    if (selectedIdx === null || !projectData) return;
    setConfirming(true);
    try {
      const currentLogos = historyRound !== null
        ? (projectData.logoHistory?.find(h => h.round === historyRound)?.logos || projectData.logos)
        : projectData.logos;
      const logo = currentLogos.find((l) => l.index === selectedIdx);
      if (!logo) return;

      const res = await fetch("/api/ai/select-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectData.id,
          phone: phone.trim(),
          viewPassword: viewPassword.trim(),
          logoImageUrl: logo.imageUrl,
          logoIndex: selectedIdx,
          companyName: projectData.companyName,
          industry: projectData.industry,
        }),
      });

      if (res.ok) {
        // ▼ TASK-009: 无IP版交付承诺弹窗
        const hasMascot = (projectData as any)?.submission?.wantMascot === "yes";
        if (!hasMascot) {
          setDeliveryConfirmType("logo");
          setShowDeliveryConfirm(true);
          return;
        }
        setConfirmSuccess(true);
      }
    } catch {
      // Silently fail
    } finally {
      setConfirming(false);
    }
  };

  const handleRegenerate = async (mode: "feedback" | "pinyin" = "feedback") => {
    if (!projectData) return;
    setRegenMode(mode);
    // 未选择Logo时的强提醒
    if (selectedIdx === null) {
      setRegenConfirmType("no_selection");
      setShowRegenConfirm(true);
      return;
    }
    setRegenConfirmType("has_selection");
    setShowRegenConfirm(true);
  };

  // Get the logos to display based on current history round
  const displayLogos = historyRound !== null
    ? (projectData?.logoHistory?.find(h => h.round === historyRound)?.logos || [])
    : (projectData?.logos || []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">查看Logo方案</h1>
        <p className="mt-3 text-neutral-500">
          输入手机号和查看密码，查看您的品牌Logo设计
        </p>
      </div>

      {/* 查询输入 */}
      {!projectData && (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-8 max-w-lg mx-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                手机号
              </label>
              <input
                type="tel"
                placeholder="提交时填写的手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                maxLength={11}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                查看密码
              </label>
              <input
                type="text"
                placeholder="4位数字查看密码"
                value={viewPassword}
                onChange={(e) => setViewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-neutral-400">
                提交时系统自动生成，请查看提交成功页面
              </p>
            </div>
            <button
              onClick={handleView}
              disabled={!mounted || phone.length < 11 || viewPassword.length < 4 || loading}
              className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  查询中...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  查看Logo
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}
        </div>
      )}

      {/* Logo展示 */}
      {projectData && (
        <div>
          {/* 项目信息 */}
          <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400">项目编号</p>
                <p className="font-mono font-medium">{projectData.id}</p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                {getGenerationStateLabel(projectData.generationStatus)}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-sm text-neutral-600">
              {projectData.companyName && <span>{projectData.companyName}</span>}
              {projectData.industry && <span>{projectData.industry}</span>}
              {projectData.mainProducts && <span>主营: {projectData.mainProducts}</span>}
            </div>
          </div>

          {/* 工单 087：我的填写资料只读回显 */}
          <FormEchoSection echo={projectData.client_info?.formEcho} />

          {(projectData.generationStatus === null || projectData.generationStateNeedsReview) && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              项目状态正在同步，部分进度待核查。请稍后刷新；如长时间未更新，请联系客服。
            </div>
          )}

          {/* Logo生成中 */}
          {projectData.generationStatus === "logo_generating" && (
            <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Logo正在生成中</h3>
              <p className="text-neutral-500 text-sm">本地生产流程正在准备您的 Logo 方案</p>
              <button
                onClick={handleView}
                className="mt-4 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                刷新查看
              </button>
            </div>
          )}

          {/* 等待付款/确认中 */}
          {(projectData.generationStatus === "submitted" ||
            projectData.generationStatus === "pending_logo") && (
            <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
              {projectData.status === "payment_uploaded" ? (
                <>
                  <CheckCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">付款截图已上传</h3>
                  <p className="text-neutral-500 text-sm">我们正在确认您的付款，确认后进入 Logo 生产队列</p>
                </>
              ) : (
                <>
                  <ImageIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">方案准备中</h3>
                  <p className="text-neutral-500 text-sm">确认付款后将进入 Logo 生产队列</p>
                </>
              )}
            </div>
          )}

          {/* Logo展示区 */}
          {displayLogos.length > 0 && (
            <div>
              {/* 历史轮次切换 */}
              {projectData.logoHistory && projectData.logoHistory.length > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <History className="w-4 h-4 text-neutral-400" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setHistoryRound(null)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        historyRound === null
                          ? "bg-primary text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      最新方案
                    </button>
                    {[...projectData.logoHistory].reverse().map((h) => (
                      <button
                        key={h.round}
                        onClick={() => setHistoryRound(h.round)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          historyRound === h.round
                            ? "bg-primary text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        第{h.round}轮
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 当前轮次标签 */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {historyRound !== null ? `第${historyRound}轮方案` : "Logo设计方案"}
                  <span className="text-sm font-normal text-neutral-400 ml-2">
                    (共{displayLogos.length}个)
                  </span>
                </h2>
                {historyRound !== null && (
                  <span className="text-xs text-neutral-400 bg-neutral-50 px-2 py-1 rounded">
                    历史方案 · 仍可选择确认
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {displayLogos.map((logo, i) => (
                  <div
                    key={`${historyRound}-${logo.index}`}
                    onClick={() => {
                      setSelectedIdx(logo.index);
                      setSaveSuccess(false);
                    }}
                    className={`relative group cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
                      selectedIdx === logo.index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-neutral-200 hover:border-primary/50"
                    }`}
                  >
                    <div className="aspect-square bg-neutral-50 flex items-center justify-center p-4">
                      <img
                        src={logo.imageUrl}
                        alt={`Logo方案 ${i + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxIndex(i);
                          setLightboxOpen(true);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                        title="放大查看"
                      >
                        <Eye className="w-4 h-4 text-neutral-600" />
                      </button>
                    </div>
                    <div className="p-3 border-t border-neutral-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">
                          方案 {i + 1}
                          {logo.slotLabel && (
                            <span className="ml-2 text-xs font-normal text-neutral-500 border border-neutral-200 rounded px-1.5 py-0.5">{logo.slotLabel}</span>
                          )}
                        </span>
                        {selectedIdx === logo.index && (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            已选
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 操作按钮组 */}
              {!confirmSuccess ? (
                <div className="space-y-3">
                  {/* 保存偏好 + 确认生成VI */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSavePreference}
                      disabled={selectedIdx === null || saving}
                      className="flex-1 py-3 border-2 border-primary text-primary font-medium rounded-xl hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
                      ) : saveSuccess ? (
                        <><CheckCircle className="w-4 h-4" /> 已保存</>
                      ) : (
                        "先保存，再看看"
                      )}
                    </button>
                    <button
                      onClick={handleConfirmLogo}
                      disabled={selectedIdx === null || confirming}
                      className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {confirming ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> 确认中...</>
                      ) : (
                        <><CheckCircle className="w-4 h-4" /> 确认选择，生成VI手册</>
                      )}
                    </button>
                  </div>

                  {/* 工单 038：生成拼音LOGO（本地免费）；ARK 升级已下线（禁止付费回退） */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRegenerate("pinyin")}
                      disabled={regenerating}
                      className="flex-1 py-2.5 border-2 border-primary text-primary text-sm font-medium rounded-xl hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {regenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : "生成拼音LOGO"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowFeedback(!showFeedback)}
                      className="w-full py-2.5 border border-neutral-300 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {showFeedback ? "收起意见栏" : "不满意？提意见重新生成"}
                    </button>

                    {showFeedback && (
                      <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs text-amber-700">
                          ✏️ 告诉我们您的想法，AI会根据您的意见调整设计方向
                        </p>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
                          placeholder="例如：希望颜色更鲜艳、不要用书法风格、加个皇冠元素、更简洁现代一些..."
                          rows={3}
                          maxLength={500}
                          className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">{feedback.length}/500</span>
                          <button
                            onClick={() => handleRegenerate("feedback")}
                            disabled={regenerating}
                            className="px-6 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                          >
                            {regenerating ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
                            ) : (
                              <><RefreshCw className="w-4 h-4" /> 提交意见并重新生成</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400 text-center">
                    💡 保存偏好后仍可更改；确认选择后将开始生成VI手册
                  </p>
                </div>
              ) : (
                <div className="text-center p-6 bg-green-50 rounded-xl">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">已确认选择！</p>
                  <p className="text-green-600 text-sm mt-1">我们将为您生成完整的VI手册</p>
                </div>
              )}
            </div>
          )}

          {/* 无Logo（非生成/待处理） */}
          {displayLogos.length === 0 &&
            projectData.generationStatus !== null &&
            !projectData.generationStateNeedsReview &&
            projectData.generationStatus !== "logo_generating" &&
            projectData.generationStatus !== "submitted" &&
            projectData.generationStatus !== "pending_logo" && (
              <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
                <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">暂无Logo方案</h3>
                <p className="text-neutral-500 text-sm">Logo方案正在准备中，请稍后刷新查看</p>
              </div>
            )}

          {/* ▼ TASK-009: IP公仔区块 */}
          {ipEnabled && (projectData as any)?.submission?.wantMascot === "yes" && projectData && (
            <MascotSection
              generationStatus={projectData.generationStatus}
              projectId={projectData.id}
              projectData={projectData}
              phone={phone.trim()}
              viewPassword={viewPassword.trim()}
              onStatusChange={(newStatus) => {
                setProjectData((current) => current ? { ...current, generationStatus: newStatus } : current);
              }}
            />
          )}

          {/* 返回按钮 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setProjectData(null);
                setSelectedIdx(null);
                setConfirmSuccess(false);
                setHistoryRound(null);
                setSaveSuccess(false);
                setFeedback("");
                setShowFeedback(false);
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              重新查询
            </button>
          </div>
        </div>
      )}
      <LogoLightbox
        logos={displayLogos.map(l => l.imageUrl)}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />


      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={async () => {
          if (!projectData) return;
          setShowRegenConfirm(false);
          setRegenerating(true);
          try {
            const res = await fetch("/api/ai/regenerate-logo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: phone.trim(),
                viewPassword: viewPassword.trim(),
                feedback: feedback.trim(),
                logoTextLanguage: regenMode === "pinyin" ? "pinyin" : undefined,
              }),
            });
            const data = await res.json();
            if (res.ok) {
              setProjectData({
                ...projectData,
                generationStatus: "logo_generating",
              });
              setHistoryRound(null);
              setSelectedIdx(null);
              setTimeout(() => handleView(), 10000);
            } else {
              setError(data.error || "重新生成失败");
            }
          } catch {
            setError("网络错误");
          } finally {
            setRegenerating(false);
          }
        }}
        title={regenConfirmType === "no_selection" ? "跳过选择？" : "确认重新生成？"}
        description={regenConfirmType === "no_selection"
          ? "⚠️ 您还没有选择偏好的Logo方案。\n\n建议先点击一个喜欢的Logo，这样下一轮刷新后仍可在「历史轮次」中找回。\n\n确定跳过选择直接刷新吗？"
          : "⚠️ 重新生成后，当前4个Logo方案将被替换。\n\n已选方案会保留在「历史轮次」中，可随时找回。\n\n确定要继续吗？"
        }
        confirmLabel="确定"
        cancelLabel="取消"
        variant={regenConfirmType === "no_selection" ? "danger" : "default"}
      />

      {/* ▼ TASK-009: 交付承诺弹窗（不可跳过） */}
      {showDeliveryConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mt-3">
              {deliveryConfirmType === "logo" ? "Logo 确认完成" : "IP 公仔确认完成"}
            </h3>
            <p className="mt-3 text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
              {deliveryConfirmType === "logo"
                ? "您的 Logo 已确认，本地生产流程将继续制作 VI 手册。您可以随时在本页面查看状态。"
                : "您的品牌 Logo 与 IP 公仔方向已确认，本地生产流程将继续制作完整素材和 VI 手册。"}
            </p>
            <button
              onClick={() => {
                setShowDeliveryConfirm(false);
                if (deliveryConfirmType === "logo") {
                  setConfirmSuccess(true);
                }
              }}
              className="mt-6 px-8 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
