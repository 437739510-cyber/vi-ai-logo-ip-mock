"use client";

import { useState } from "react";
import { Search, FileQuestion, Eye, Phone, Key, Loader2 } from "lucide-react";
import Link from "next/link";

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

export default function ProgressPage() {
  const [phone, setPhone] = useState("");
  const [viewPassword, setViewPassword] = useState("");
  const [project, setProject] = useState<ProjectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (phone.length < 11 || viewPassword.length < 4) return;
    setLoading(true);
    setError(null);
    setProject(null);

    try {
      const res = await fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          viewPassword: viewPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "查询失败");
        return;
      }
      setProject(data.project);
    } catch {
      setError("网络错误，请稍后重试");
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
              onChange={(e) => setViewPassword(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
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
