"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle, Wallet, Loader2, RefreshCw, FileText, AlertTriangle } from "lucide-react";
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
  const [dashscopeBalance, setDashscopeBalance] = useState<ApiBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const fetchUsageLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/billing/usage-logs?limit=30");
      if (res.ok) {
        const data = await res.json();
        setUsageLogs(data.logs || []);
        setTodaySummary(data.todaySummary || null);
      }
    } catch { /* ignore */ }
    setLogsLoading(false);
  };

  useEffect(() => {
    getProjects().then((list) => {
      setProjects(list);
      setLoading(false);
      fetchBalances();
      fetchUsageLogs();
    });
  }, []);

  const pendingCount = projects.filter((p) => p.status === "submitted").length;
  const inProgressCount = projects.filter(
    (p) => p.status === "ai_analysis" || p.status === "designing"
  ).length;
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
        <StatCard title="待处理" value={pendingCount} description="新提交未分配" icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard title="进行中" value={inProgressCount} description="AI 分析 / 设计中" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="已交付" value={deliveredCount} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard title="项目总数" value={totalCount} icon={<FolderKanban className="w-5 h-5" />} />
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
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 border border-orange-100">
            <p className="text-xs font-medium text-orange-600 mb-1">通义万象</p>
            <p className="text-xl font-bold text-neutral-900">
              {dashscopeBalance?.balance !== null && dashscopeBalance?.balance !== undefined
                ? `¥${dashscopeBalance.balance.toFixed(2)}`
                : dashscopeBalance?.error ? "获取失败" : "—"}
            </p>
            {dashscopeBalance?.error && <p className="text-xs text-red-400 mt-1">{dashscopeBalance.error}</p>}
          </div>
        </div>
      </div>

      {/* 今日 DeepSeek 调用统计 */}
      {todaySummary && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-neutral-900">今日 DeepSeek 调用</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">
                {todaySummary.totalCalls} 次 · ¥{todaySummary.totalCost.toFixed(4)}
              </span>
              <button
                onClick={fetchUsageLogs}
                disabled={logsLoading}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${logsLoading ? "animate-spin" : ""}`} />
                刷新
              </button>
            </div>
          </div>
          {/* 预算进度条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500">日预算 ¥5.00</span>
              <span className={`text-xs font-medium ${todaySummary.totalCost > 3 ? 'text-red-500' : 'text-green-600'}`}>
                ¥{todaySummary.totalCost.toFixed(4)} / ¥5.00
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  todaySummary.totalCost > 4 ? 'bg-red-500' : todaySummary.totalCost > 3 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((todaySummary.totalCost / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
          {/* 按路由汇总 */}
          {Object.keys(todaySummary.byRoute).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {Object.entries(todaySummary.byRoute).map(([route, info]) => (
                <div key={route} className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
                  <p className="text-xs font-medium text-neutral-700 truncate" title={route}>{route}</p>
                  <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 调用日志明细 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-900">调用日志</h3>
          <span className="text-xs text-neutral-400">最近30条</span>
        </div>
        {usageLogs.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">暂无调用记录（表尚未创建，请先在 Supabase 执行建表 SQL）</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">时间</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">路由</th>
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
                      {log.route.replace('[BLOCKED] ', '\u{1F6AB} ')}
                    </td>
                    <td className="py-1.5 px-2 text-right text-neutral-500">{log.input_tokens || '—'}</td>
                    <td className="py-1.5 px-2 text-right text-neutral-500">{log.output_tokens || '—'}</td>
                    <td className="py-1.5 px-2 text-right font-medium text-neutral-700">\u00A5{(log.cost_cny || 0).toFixed(4)}</td>
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
        <RecentActivityList />
      </div>
    </div>
  );
}
