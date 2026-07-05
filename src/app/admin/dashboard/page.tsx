"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/core/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle, Wallet, RefreshCw, FileText, AlertTriangle, ImageIcon } from "lucide-react";
import type { Project } from "@/types";

interface ApiBalance {
  provider: string;
  balance: number | null;
  currency: string;
  error?: string;
  source?: string;
}

interface UsageLog {
  id: number;
  created_at: string;
  route: string;
  method: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_cny: number;
  project_id: string | null;
  request_summary: string | null;
  response_status: number | null;
  error_message: string | null;
}

interface ProviderSummary {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byRoute: Record<string, { cost: number; calls: number }>;
  byModel: Record<string, { cost: number; calls: number }>;
}

interface TodaySummary {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byRoute: Record<string, { cost: number; calls: number }>;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deepseekBalance, setDeepseekBalance] = useState<ApiBalance | null>(null);
  const [arkBalance, setArkBalance] = useState<ApiBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [todayDeepseekSummary, setTodayDeepseekSummary] = useState<ProviderSummary | null>(null);
  const [todayArkSummary, setTodayArkSummary] = useState<ProviderSummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const [dsRes] = await Promise.allSettled([
        fetch("/api/billing/deepseek-balance").then(r => r.json()),
      ]);
      if (dsRes.status === "fulfilled") setDeepseekBalance(dsRes.value);
      setArkBalance({ provider: "ark-seedream", balance: 212.40, currency: "CNY" });
    } catch { /* ignore */ }
    setBalanceLoading(false);
  }, []);

  const fetchUsageLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/billing/usage-logs?limit=30");
      if (res.ok) {
        const data = await res.json();
        setUsageLogs(data.logs || []);
        setTodaySummary(data.todaySummary || null);
        setTodayDeepseekSummary(data.todayDeepseekSummary || null);
        setTodayArkSummary(data.todayDashscopeSummary || null);
      }
    } catch { /* ignore */ }
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    // All 3 data fetches are independent — run in parallel
    Promise.allSettled([
      getProjects(),
      fetchBalances(),
      fetchUsageLogs(),
    ]).then(([projectsResult]) => {
      if (projectsResult.status === "fulfilled") {
        setProjects(projectsResult.value);
      }
      setLoading(false);
    });
  }, [fetchBalances, fetchUsageLogs]);

  const pendingCount = projects.filter((p) => p.status === "submitted" || p.status === "paid").length;
  const inProgressCount = projects.filter(
    (p) =>
      p.status === "ai_analysis" || p.status === "brand_analyzed" || p.status === "logo_generated" || p.status === "designing"
  ).length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const deliveredCount = projects.filter((p) => p.status === "delivered").length;
  const totalCount = projects.length;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

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
        <StatCard title="待处理" value={pendingCount} description="新提交/已付款" icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard title="进行中" value={inProgressCount} description="分析/Logo/设计中" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="已完成" value={completedCount} description="VI手册已生成" icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="已交付" value={deliveredCount} icon={<FolderKanban className="w-5 h-5" />} />
      </div>

      {/* API 余额 */}
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
                : deepseekBalance?.error ? "获取失败" : "—"}
            </p>
            {deepseekBalance?.error && <p className="text-xs text-red-400 mt-1">{deepseekBalance.error}</p>}
          </div>
          <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 p-4 border border-red-100">
            <p className="text-xs font-medium text-red-600 mb-1">火山 Seedream 4.0</p>
            <p className="text-xl font-bold text-neutral-900">
              {arkBalance?.balance !== null && arkBalance?.balance !== undefined
                ? `¥${arkBalance.balance.toFixed(2)}`
                : arkBalance?.error ? "获取失败" : "—"}
            </p>
            {arkBalance?.error && <p className="text-xs text-red-400 mt-1">{arkBalance.error}</p>}
          </div>
        </div>
      </div>

      {/* 今日调用统计 - 双卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 今日 DeepSeek 调用 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-neutral-900">今日 DeepSeek 调用</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">
                {todayDeepseekSummary?.totalCalls || 0} 次 · ¥{(todayDeepseekSummary?.totalCost || 0).toFixed(4)}
              </span>
              <button
                onClick={fetchUsageLogs}
                disabled={logsLoading}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${logsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          {/* 预算进度条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500">日预算 ¥5.00</span>
              <span className={`text-xs font-medium ${(todayDeepseekSummary?.totalCost || 0) > 3 ? 'text-red-500' : 'text-green-600'}`}>
                ¥{(todayDeepseekSummary?.totalCost || 0).toFixed(4)} / ¥5.00
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (todayDeepseekSummary?.totalCost || 0) > 4 ? 'bg-red-500' : (todayDeepseekSummary?.totalCost || 0) > 3 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(((todayDeepseekSummary?.totalCost || 0) / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
          {/* 按路由汇总 */}
          {todayDeepseekSummary && Object.keys(todayDeepseekSummary.byRoute).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(todayDeepseekSummary.byRoute).map(([route, info]) => (
                <div key={route} className="rounded-lg bg-blue-50/50 p-2.5 border border-blue-100/50">
                  <p className="text-xs font-medium text-neutral-700 truncate" title={route}>{route}</p>
                  <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                </div>
              ))}
            </div>
          )}
          {!todayDeepseekSummary || todayDeepseekSummary.totalCalls === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-3">今日暂无调用</p>
          ) : null}
        </div>

        {/* 今日火山引擎调用 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-neutral-900">今日火山引擎调用</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {todayArkSummary?.totalCalls || 0} 次 · ¥{(todayArkSummary?.totalCost || 0).toFixed(4)}
            </span>
          </div>
          {/* 按模型汇总 */}
          {todayArkSummary && Object.keys(todayArkSummary.byModel).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-neutral-500 mb-2">模型明细</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(todayArkSummary.byModel).map(([model, info]) => (
                  <div key={model} className="rounded-lg bg-red-50/50 p-2.5 border border-red-100/50">
                    <p className="text-xs font-medium text-neutral-700 truncate" title={model}>{model}</p>
                    <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 按路由汇总 */}
          {todayArkSummary && Object.keys(todayArkSummary.byRoute).length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">路由明细</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(todayArkSummary.byRoute).map(([route, info]) => (
                  <div key={route} className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
                    <p className="text-xs font-medium text-neutral-700 truncate" title={route}>{route}</p>
                    <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!todayArkSummary || todayArkSummary.totalCalls === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-3">今日暂无调用</p>
          ) : null}
        </div>
      </div>

      {/* 调用日志明细 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-900">调用日志</h3>
          <span className="text-xs text-neutral-400">最近30条</span>
        </div>
        {usageLogs.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">暂无调用记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">时间</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">路由</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">模型</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">输入</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">输出</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">费用</th>
                  <th className="text-center py-2 px-2 text-neutral-400 font-medium">状态</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">项目</th>
                </tr>
              </thead>
              <tbody>
                {usageLogs.map((log) => (
                  <tr key={log.id} className={`border-b border-neutral-50 ${log.route.startsWith('[BLOCKED]') ? 'bg-red-50' : log.error_message ? 'bg-yellow-50' : ''}`}>
                    <td className="py-1.5 px-2 text-neutral-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    <td className="py-1.5 px-2 font-medium text-neutral-700 max-w-[120px] truncate" title={log.route}>
                      {log.route.startsWith('[BLOCKED]') && <AlertTriangle className="w-3 h-3 text-red-500 inline mr-1" />}
                      {log.route.replace('[BLOCKED] ', '⛔ ')}
                    </td>
                    <td className="py-1.5 px-2 text-neutral-500 max-w-[100px] truncate" title={log.model}>{log.model || '—'}</td>
                    <td className="py-1.5 px-2 text-right text-neutral-500">{log.input_tokens || '—'}</td>
                    <td className="py-1.5 px-2 text-right text-neutral-500">{log.output_tokens || '—'}</td>
                    <td className="py-1.5 px-2 text-right font-medium text-neutral-700">¥{(log.cost_cny || 0).toFixed(4)}</td>
                    <td className="py-1.5 px-2 text-center">
                      {log.response_status === 200 ? (
                        <span className="text-green-600">OK</span>
                      ) : log.response_status === 402 ? (
                        <span className="text-red-500">BLOCKED</span>
                      ) : log.error_message ? (
                        <span className="text-yellow-600">ERR</span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-neutral-400 max-w-[100px] truncate" title={log.project_id || ''}>{log.project_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 最近动态 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-900">最近动态</h3>
          <span className="text-xs text-neutral-400">实时</span>
        </div>
        <RecentActivityList projects={projects} />
      </div>
    </div>
  );
}
