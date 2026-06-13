"use client";

import { useState } from "react";
import { Search, Eye, CheckCircle, Loader2, ArrowLeft, ImageIcon, Phone, Key } from "lucide-react";
import Link from "next/link";

interface LogoItem {
  index: number;
  imageUrl: string;
  prompt?: string;
}

interface ProjectData {
  id: string;
  status: string;
  companyName: string;
  industry: string;
  mainProducts: string;
  generationStatus: string;
  logos: LogoItem[];
  selectedLogo: {
    imageUrl: string;
    index: number;
    selectionMethod: string;
  } | null;
}

export default function ViewLogoPage() {
  const [phone, setPhone] = useState("");
  const [viewPassword, setViewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const handleView = async () => {
    if (!phone.trim() || viewPassword.length < 6) return;
    setLoading(true);
    setError(null);
    setProjectData(null);
    setSelectedIdx(null);
    setConfirmSuccess(false);

    try {
      const res = await fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          viewPassword: viewPassword.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "查询失败");
        return;
      }
      setProjectData(data.project);
      if (data.project.selectedLogo) {
        setSelectedIdx(data.project.selectedLogo.index);
      }
    } catch (e: any) {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLogo = async () => {
    if (selectedIdx === null || !projectData) return;
    setConfirming(true);
    try {
      const logo = projectData.logos.find((l) => l.index === selectedIdx);
      if (!logo) return;

      const res = await fetch("/api/ai/select-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectData.id,
          logoImageUrl: logo.imageUrl,
          logoIndex: selectedIdx,
          companyName: projectData.companyName,
          industry: projectData.industry,
        }),
      });

      if (res.ok) {
        setConfirmSuccess(true);
      }
    } catch (e) {
      // Silently fail - non-critical
    } finally {
      setConfirming(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: "等待处理",
      brand_analyzing: "AI品牌分析中",
      logo_generating: "Logo生成中",
      logo_generated: "Logo已生成",
      submitted: "已提交",
      confirmed: "需求确认中",
      designing: "设计制作中",
      reviewing: "审核中",
      delivered: "已交付",
      paid: "已付款",
    };
    return map[status] || status;
  };

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
                placeholder="6位查看密码"
                value={viewPassword}
                onChange={(e) =>
                  setViewPassword(e.target.value.toUpperCase().slice(0, 6))
                }
                maxLength={6}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-neutral-400">
                提交时系统自动生成，请查看提交成功页面
              </p>
            </div>
            <button
              onClick={handleView}
              disabled={phone.length < 11 || viewPassword.length < 6 || loading}
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
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
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
                {getStatusText(projectData.generationStatus)}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-sm text-neutral-600">
              {projectData.companyName && <span>{projectData.companyName}</span>}
              {projectData.industry && <span>{projectData.industry}</span>}
              {projectData.mainProducts && (
                <span>主营: {projectData.mainProducts}</span>
              )}
            </div>
          </div>

          {/* Logo生成中 */}
          {(projectData.generationStatus === "logo_generating" ||
            projectData.generationStatus === "brand_analyzing") && (
            <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                Logo正在生成中
              </h3>
              <p className="text-neutral-500 text-sm">
                AI正在为您设计Logo方案，请稍后刷新查看
              </p>
              <button
                onClick={handleView}
                className="mt-4 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                刷新查看
              </button>
            </div>
          )}

          {/* 等待付款/处理中 */}
          {(projectData.generationStatus === "submitted" || 
            projectData.generationStatus === "pending") && (
            <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
              <ImageIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                方案准备中
              </h3>
              <p className="text-neutral-500 text-sm">
                确认付款后3个工作日内出Logo方案，请耐心等待
              </p>
            </div>
          )}

          {/* Logo展示区 */}
          {projectData.logos.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Logo设计方案
                <span className="text-sm font-normal text-neutral-400 ml-2">
                  (共{projectData.logos.length}个方案)
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {projectData.logos.map((logo, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedIdx(logo.index)}
                    className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
                      selectedIdx === logo.index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-neutral-200 hover:border-primary/50"
                    }`}
                  >
                    <div className="aspect-square bg-neutral-50 flex items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.imageUrl}
                        alt={`Logo方案 ${i + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="p-3 border-t border-neutral-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">
                          方案 {i + 1}
                        </span>
                        {selectedIdx === logo.index && (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            已选择
                          </span>
                        )}
                        {projectData.selectedLogo?.index === logo.index &&
                          projectData.selectedLogo.index !== selectedIdx && (
                            <span className="text-xs text-neutral-400">
                              AI推荐
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 确认按钮 */}
              {!confirmSuccess ? (
                <button
                  onClick={handleConfirmLogo}
                  disabled={selectedIdx === null || confirming}
                  className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      确认中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      确认选择并生成VI手册
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center p-6 bg-green-50 rounded-xl">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">已确认选择！</p>
                  <p className="text-green-600 text-sm mt-1">
                    我们将为您生成完整的VI手册
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 无Logo（非生成中、非待处理状态） */}
          {projectData.logos.length === 0 &&
            projectData.generationStatus !== "logo_generating" &&
            projectData.generationStatus !== "brand_analyzing" &&
            projectData.generationStatus !== "submitted" &&
            projectData.generationStatus !== "pending" && (
              <div className="bg-white border border-neutral-100 rounded-2xl p-12 shadow-sm text-center">
                <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  暂无Logo方案
                </h3>
                <p className="text-neutral-500 text-sm">
                  Logo方案正在准备中，请稍后刷新查看
                </p>
              </div>
            )}

          {/* 返回按钮 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setProjectData(null);
                setSelectedIdx(null);
                setConfirmSuccess(false);
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              重新查询
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
