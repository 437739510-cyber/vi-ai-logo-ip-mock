"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2, Clock, Download } from "lucide-react";
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
  generationStatus: string;
  projectId: string;
  projectData: any;
  onStatusChange: (newStatus: string) => void;
}

function countWorkdaysFromNow(): string {
  // 从今天起算 3 个工作日后的日期（跳过周末）
  const now = new Date();
  let daysAdded = 0;
  const result = new Date(now);
  while (daysAdded < 3) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) { // 不是周末
      daysAdded++;
    }
  }
  return `${result.getMonth() + 1}月${result.getDate()}日`;
}

export function MascotSection({ generationStatus, projectId, projectData, onStatusChange }: MascotSectionProps) {
  const [samples, setSamples] = useState<MascotSample[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");

  useEffect(() => {
    setDeliveryDate(countWorkdaysFromNow());
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
        body: JSON.stringify({ projectId, selectedSampleId: id }),
      });
      if (res.ok) {
        setSaved(true);
        onStatusChange("mascot_pending");
      }
    } catch {}
    setSaving(false);
  };

  // 状态判断
  const showSamples = ["mascot_generated", "mascot_samples_ready"].includes(generationStatus);
  const showSelected = ["mascot_pending", "mascot_generating", "mascot_generated", "mascot_full_fail"].includes(generationStatus);
  const showReview = generationStatus === "waiting_manual_review";
  const showComplete = generationStatus === "manual_review_complete";
  const showFailed = ["mascot_failed", "mascot_sample_fail", "mascot_full_fail", "mascot_render_fail"].includes(generationStatus);

  if (!showSamples && !showSelected && !showReview && !showComplete && !showFailed) return null;

  return (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-xl font-bold mb-4">IP 品牌公仔</h2>

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
      {saved && showSelected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">已选择公仔方向：{selectedId?.toUpperCase()} 款</span>
          </div>
          <p className="text-green-600 text-sm mt-1">等待管理员为您生成全套公仔素材</p>
        </div>
      )}

      {/* 3天交付倒计时 */}
      {showReview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-medium">人工校准中</span>
          </div>
          <p className="text-amber-600 text-sm">
            您的品牌 Logo 与 IP 公仔形象已确认，工作人员正在统一校准配色与规范细节。
          </p>
          <p className="text-amber-700 font-bold mt-2">
            预计交付日期：{deliveryDate}（3 个工作日内）
          </p>
        </div>
      )}

      {/* 人工校验完成，可下载 */}
      {showComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">VI 手册已就绪</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.open(`/api/ai/download-manual?projectId=${projectId}&type=basic`, "_blank")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Download className="w-4 h-4" />
              基础 VI 手册（14页）
            </button>
            <button
              onClick={() => window.open(`/api/ai/download-manual?projectId=${projectId}&type=full`, "_blank")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              <Download className="w-4 h-4" />
              完整 IP-VI 手册（22页）
            </button>
          </div>
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
