"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import type { CanonicalGenerationState } from "@/lib/core/generation-state";
import { filterMascotSamples } from "@/lib/vi-manual/customer-logo-filter";

interface MascotSample {
  id: string;
  imageUrl: string;
  label: string;
  desc?: string;
  status?: string;
  vision?: { status?: string; reason?: string } | null;
}

interface MascotSectionProps {
  generationStatus: CanonicalGenerationState | null;
  projectId: string;
  projectData: any;
  phone: string;
  viewPassword: string;
  onStatusChange: (newStatus: CanonicalGenerationState) => void;
}

export function MascotSection({ generationStatus, projectId, projectData, phone, viewPassword, onStatusChange }: MascotSectionProps) {
  const [samples, setSamples] = useState<MascotSample[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // 工单 050：读取真实样稿并过滤（vision passed/skipped 展示；失败/待审隐藏）
    const ci = projectData?.client_info || {};
    if (ci.mascotSamples && Array.isArray(ci.mascotSamples)) {
      setSamples(filterMascotSamples(ci.mascotSamples));
    }
    if (ci.mascotSelectedId) {
      setSelectedId(ci.mascotSelectedId);
      setSaved(true);
    }
  }, [projectData]);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setSaving(true);
    try {
      const res = await fetch("/api/ai/save-mascot-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, selectedSampleId: id, phone, viewPassword }),
      });
      if (res.ok) {
        setSaved(true);
        onStatusChange("mascot_full_generating");
      }
    } catch {}
    setSaving(false);
  };

  // 状态判断
  const showSampleGeneration = generationStatus === "mascot_generating";
  const showSamples = generationStatus === "mascot_samples_ready";
  const showFullGeneration = generationStatus === "mascot_full_generating";
  const showManualStage = generationStatus === "pending_manual" || generationStatus === "manual_generating";
  const showPaused = generationStatus === "paused_comfyui";
  const showReview = generationStatus === "needs_review";
  const showComplete = generationStatus === "completed";
  const showFailed = generationStatus === "failed";

  if (!showSampleGeneration && !showSamples && !showFullGeneration && !showManualStage && !showPaused && !showReview && !showComplete && !showFailed) return null;

  return (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-xl font-bold mb-4">IP 品牌公仔</h2>

      {showSampleGeneration && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
          公仔样稿正在本地生产中，请稍后刷新查看。
        </div>
      )}

      {/* 选择样稿 */}
      {showSamples && !saved && (
        <div>
          <p className="text-gray-600 mb-4">请选择您偏好的公仔风格方向：</p>
          {samples.length === 0 ? (
            <p className="text-gray-500 text-sm">公仔样稿生成中，请稍后刷新查看</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  disabled={saving}
                  className={`relative border-2 rounded-lg p-4 text-center transition-all hover:shadow-md ${
                    selectedId === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="w-full aspect-square rounded-md mb-2 overflow-hidden bg-gray-100">
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt={s.label || "公仔样稿"} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">样稿生成中</div>
                    )}
                  </div>
                  <div className="font-medium text-sm">{s.label || "样稿"}</div>
                  {s.desc ? <div className="text-xs text-gray-500">{s.desc}</div> : null}
                  {saving && selectedId === s.id && (
                    <Loader2 className="absolute top-2 right-2 w-4 h-4 animate-spin text-blue-500" />
                  )}
                  {selectedId === s.id && !saving && (
                    <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-blue-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 已选择确认 */}
      {saved && showFullGeneration && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">已选择公仔方向：{selectedId?.toUpperCase()} 款</span>
          </div>
          <p className="text-green-600 text-sm mt-1">完整公仔素材正在本地生产中</p>
        </div>
      )}

      {showFullGeneration && !saved && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
          已进入完整公仔素材生成阶段，请稍后刷新查看。
        </div>
      )}

      {showManualStage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
          公仔素材已进入 VI 手册制作阶段。
        </div>
      )}

      {showPaused && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
          本地生产暂时暂停，正在等待恢复，请稍后刷新查看。
        </div>
      )}

      {showReview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-2">
            <span className="font-medium">人工复核中</span>
          </div>
          <p className="text-amber-600 text-sm">
            当前素材需要进一步核查，工作人员确认后会更新状态。
          </p>
        </div>
      )}

      {showComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">VI 手册已完成</span>
          </div>
          <p className="text-green-600 text-sm mt-1">下载请以正式 PPTX 交付记录为准。</p>
        </div>
      )}

      {/* 生成失败 */}
      {showFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">公仔生成过程中出现异常，请联系客服或稍后重试</p>
        </div>
      )}
    </div>
  );
}
