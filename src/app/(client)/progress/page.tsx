"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, FileQuestion, Eye, Phone, Key, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: "submitted", label: "已提交" },
  { key: "paid", label: "已付款" },
  { key: "confirmed", label: "需求确认中" },
  { key: "brand_analyzing", label: "AI 品牌分析中" },
  { key: "logo_generating", label: "Logo 生成中" },
  { key: "logo_generated", label: "Logo 已生成" },
  { key: "designing", label: "VI手册制作中" },
  { key: "delivered", label: "已交付" },
];

function getCurrentStep(status: string): number {
  return Math.max(0, STATUS_STEPS.findIndex((s) => s.key === status));
}

interface ProjectResult {
  id: string;
  status: string;
  companyName: string;
  industry: string;
  generationStatus: string;
}

function ProgressPageContent() {
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("pwd");
  const submittedPhone = searchParams.get("phone") || "";
  const submittedPwd = searchParams.get("pwd") || "";
  const submittedId = searchParams.get("id") || "";

  const [phone, setPhone] = useState(justSubmitted ? submittedPhone : "");
  const [viewPassword, setViewPassword] = useState(justSubmitted ? submittedPwd : "");
  const [project, setProject] = useState<ProjectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (phone.length < 11 || viewPassword.length < 4) return;
    setLoading(true);
    setError(null);
    setProject(null);

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
      setProject(data.project);
    } catch {
      setError("网络连接不稳定，请点击重试");
    } finally {
      setLoading(false);
    }
  };

  const statusForSteps = project?.generationStatus || project?.status || "submitted";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">查询项目进度</h1>
        <p className="mt-3 text-neutral-500">
          输入手机号和查看密码，查询当前进度
        </p>
      </div>

      {/* V79: 刚提交成功 - 显示确认卡 */}
      {justSubmitted && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 shadow-sm mb-8">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-green-800 mb-2">提交成功！</h2>
            <p className="text-sm text-green-700 mb-4">我们已收到您的VI设计需求，AI正在分析中</p>
            <div className="bg-white rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">项目编号</span>
                <span className="font-mono text-sm font-medium">{submittedId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">手机号</span>
                <span className="text-sm">{submittedPhone}</span>
              </div>
              <div className="border-t border-neutral-100 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">查看密码</span>
                  <span className="font-mono text-lg font-bold tracking-widest text-primary">{submittedPwd}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-3">⚠️ 请截图保存查看密码，后续查询进度和查看Logo方案时需要</p>
          </div>
        </div>
      )}

      {/* 查询输入 */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-8">
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
              placeholder="4位查看密码"
              value={viewPassword}
              onChange={(e) => setViewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={phone.length < 11 || viewPassword.length < 4 || loading}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                查询中...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                查询进度
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

      {/* 查询结果 */}
      {project && (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm">
          {/* 项目信息 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-neutral-400 mb-1">项目编号</p>
              <p className="font-mono font-medium">{project.id}</p>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {STATUS_STEPS.find(s => s.key === statusForSteps)?.label || statusForSteps}
            </span>
          </div>

          {/* 进度时间线 */}
          <div className="relative">
            {STATUS_STEPS.map((step, index) => {
              const currentStep = getCurrentStep(statusForSteps);
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={step.key} className="flex items-start gap-4 pb-6 last:pb-0">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        isCompleted
                          ? "bg-primary border-primary"
                          : "bg-white border-neutral-300"
                      } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
                    />
                    {index < STATUS_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 h-full mt-1 ${
                          isCompleted ? "bg-primary" : "bg-neutral-200"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-primary mt-0.5">当前进度</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 查看Logo入口 */}
          <div className="mt-6 pt-6 border-t border-neutral-100">
            <Link
              href="/view"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
            >
              <Eye className="w-4 h-4" />
              查看Logo方案
            </Link>
            <p className="text-xs text-neutral-400 mt-1">
              用手机号和查看密码登录查看
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-400">加载中...</div>}>
      <ProgressPageContent />
    </Suspense>
  );
}
