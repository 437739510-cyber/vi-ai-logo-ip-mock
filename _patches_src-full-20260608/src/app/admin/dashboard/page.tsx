"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle, Wallet, Loader2, RefreshCw } from "lucide-react";
import type { Project } from "@/types";

interface ApiBalance {
  provider: string;
  balance: number | null;
  currency: string;
  error?: string;
  source?: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deepseekBalance, setDeepseekBalance] = useState<ApiBalance | null>(null);
  const [dashscopeBalance, setDashscopeBalance] = useState<ApiBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalances = async () => {
    setBalanceLoading(true);
    try {
      const [dsRes, dqRes] = await Promise.allSettled([
        fetch("/api/billing/deepseek-balance").then(r => r.json()),
        fetch("/api/billing/dashscope-balance").then(r => r.json()),
      ]);
      if (dsRes.status === "fulfilled") setDeepseekBalance(dsRes.value);
      if (dqRes.status === "fulfilled") setDashscopeBalance(dqRes.value);
    } catch { /* ignore */ }
    setBalanceLoading(false);
  };

  useEffect(() => {
    getProjects().then((list) => {
      setProjects(list);
      setLoading(false);
      fetchBalances();
    });
  }, []);

  const pendingCount = projects.filter((p) => p.status === "submitted").length;
  const inProgressCount = projects.filter(
    (p) => p.status === "ai_analysis" || p.status === "designing"
  ).length;
  const deliveredCount = projects.filter((p) => p.status === "delivered").length;
  const totalCount = projects.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider">概览</p>
          <h2 className="text-2xl font-bold text-neutral-900">工作台</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">概览</p>
          <h2 className="text-2xl font-bold text-neutral-900">工作台</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-lg">
          <span className="text-sm font-medium text-neutral-500">共 {totalCount} 个项目</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="待处理" value={pendingCount} description="新提交未分配" icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard title="进行中" value={inProgressCount} description="AI 分析 / 设计中" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="已交付" value={deliveredCount} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="项目总数" value={totalCount} icon={<FolderKanban className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-neutral-900">API 余额</h3>
          </div>
          <button
            onClick={fetchBalances}
            disabled={balanceLoading}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-100">
            <p className="text-xs font-medium text-blue-600 mb-1">DeepSeek</p>
            <p className="text-xl font-bold text-neutral-900">
              {deepseekBalance?.balance !== null && deepseekBalance?.balance !== undefined
                ? `¥${deepseekBalance.balance.toFixed(2)}`
                : deepseekBalance?.error
                  ? "获取失败"
                  : "—"}
            </p>
            {deepseekBalance?.error && <p className="text-xs text-red-400 mt-1">{deepseekBalance.error}</p>}
          </div>
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 border border-orange-100">
            <p className="text-xs font-medium text-orange-600 mb-1">通义万象</p>
            <p className="text-xl font-bold text-neutral-900">
              {dashscopeBalance?.balance !== null && dashscopeBalance?.balance !== undefined
                ? `¥${dashscopeBalance.balance.toFixed(2)}`
                : dashscopeBalance?.error
                  ? "获取失败"
                  : "—"}
            </p>
            {dashscopeBalance?.error && <p className="text-xs text-red-400 mt-1">{dashscopeBalance.error}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-900">最近动态</h3>
          <span className="text-xs text-neutral-400">实时</span>
        </div>
        <RecentActivityList />
      </div>
    </div>
  );
}
