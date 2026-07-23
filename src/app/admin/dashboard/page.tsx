"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { RecentActivityList } from "@/components/admin/RecentActivityList";
import { getProjects } from "@/lib/core/mock";
import { FolderKanban, Clock, CheckCircle, AlertCircle, Wallet, RefreshCw, FileText, AlertTriangle, ImageIcon } from "lucide-react";
import type { Project } from "@/types";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ApiBalance {
  provider: string;
  balance: number | null;
  currency: string;
  status?: string;
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
  const [liblibaiBalance, setLiblibaiBalance] = useState<ApiBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [todayDeepseekSummary, setTodayDeepseekSummary] = useState<ProviderSummary | null>(null);
  const [todayArkSummary, setTodayArkSummary] = useState<ProviderSummary | null>(null);
  const [todayLiblibaiSummary, setTodayLiblibaiSummary] = useState<ProviderSummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const [dsRes, libRes] = await Promise.allSettled([
        fetch("/api/billing/deepseek-balance").then(r => r.json()),
        fetch("/api/billing/liblibai-balance").then(r => r.json()),
      ]);
      if (dsRes.status === "fulfilled") setDeepseekBalance(dsRes.value);
      if (libRes.status === "fulfilled") setLiblibaiBalance(libRes.value);

      // Fetch real ARK balance from API
      try {
        const arkRes = await fetch("/api/ai/ark-balance");
        if (arkRes.ok) setArkBalance(await arkRes.json());
      } catch { /* ignore */ }
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
        setTodayLiblibaiSummary(data.todayLiblibaiSummary || null);
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

  // Chart data: derive from projects and usageLogs
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const orderTrend = dayLabels.map((date) => ({
    date: date.slice(5),
    orders: projects.filter((p) => p.createdAt && p.createdAt.slice(0, 10) === date).length,
  }));

  const statusColors: Record<string, string> = {
    submitted: "#F59E0B", paid: "#3B82F6", confirmed: "#8B5CF6",
    brand_analyzing: "#EC4899", logo_generating: "#06B6D4",
    designing: "#10B981", delivered: "#22C55E", completed: "#22C55E",
    ai_analysis: "#F97316", brand_analyzed: "#A855F7", pending: "#9CA3AF",
  };
  const statusLabels: Record<string, string> = {
    submitted: "已提交", paid: "已付款", confirmed: "确认中",
    brand_analyzing: "分析中", logo_generating: "Logo生成", designing: "手册生成",
    delivered: "已交付", completed: "已完成", ai_analysis: "AI分析",
    brand_analyzed: "分析完成", pending: "待处理",
  };

  const statusCount = {} as Record<string, number>;
  projects.forEach((p) => {
    const s = p.client_info?.generationStatus || p.status || "pending";
    statusCount[s] = (statusCount[s] || 0) + 1;
  });
  const statusDist = Object.entries(statusCount).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value,
    color: statusColors[key] || "#9CA3AF",
  }));

  const industryCount = {} as Record<string, number>;
  projects.forEach((p) => {
    const ind = p.industry || p.client_info?.businessForm || "其他";
    industryCount[ind] = (industryCount[ind] || 0) + 1;
  });
  const industryDist = Object.entries(industryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value], i) => ({
      name: name.length > 6 ? name.slice(0, 6) + "..." : name,
      value,
      color: ["#2B5F8A", "#E8783A", "#06B6D4", "#8B5CF6", "#22C55E", "#F59E0B", "#EC4899", "#9CA3AF"][i],
    }));

  const apiTrendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);
    return {
      date: dayStr.slice(5),
      calls: usageLogs.filter((log) => log.created_at && log.created_at.slice(0, 10) === dayStr).length,
    };
  });

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 border border-emerald-100">
            <p className="text-xs font-medium text-emerald-600 mb-1">LiblibAI (Star-3 Alpha)</p>
            <p className="text-xl font-bold text-neutral-900">
              {liblibaiBalance?.balance !== null && liblibaiBalance?.balance !== undefined
                ? `${liblibaiBalance.balance} 积分`
                : liblibaiBalance?.status === "unavailable" ? "不可用"
                : liblibaiBalance?.status === "no_key" ? "未配置"
                : liblibaiBalance?.error ? "获取失败" : "—"}
            </p>
            {liblibaiBalance?.status === "unavailable" && <p className="text-xs text-neutral-400 mt-1">API 不提供余额查询</p>}
            {liblibaiBalance?.error && <p className="text-xs text-red-400 mt-1">{liblibaiBalance.error}</p>}
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
        {/* 今日 LiblibAI 调用 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-5"/></svg>
              <h3 className="text-sm font-bold text-neutral-900">今日 LiblibAI 调用</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {todayLiblibaiSummary?.totalCalls || 0} 次 · ¥{(todayLiblibaiSummary?.totalCost || 0).toFixed(4)}
            </span>
          </div>
          {/* 按模型汇总 */}
          {todayLiblibaiSummary && Object.keys(todayLiblibaiSummary.byModel).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-neutral-500 mb-2">模型明细</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(todayLiblibaiSummary.byModel).map(([model, info]) => (
                  <div key={model} className="rounded-lg bg-emerald-50/50 p-2.5 border border-emerald-100/50">
                    <p className="text-xs font-medium text-neutral-700 truncate" title={model}>{model}</p>
                    <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 按路由汇总 */}
          {todayLiblibaiSummary && Object.keys(todayLiblibaiSummary.byRoute).length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">路由明细</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(todayLiblibaiSummary.byRoute).map(([route, info]) => (
                  <div key={route} className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
                    <p className="text-xs font-medium text-neutral-700 truncate" title={route}>{route}</p>
                    <p className="text-xs text-neutral-400">{info.calls}次 · ¥{info.cost.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!todayLiblibaiSummary || todayLiblibaiSummary.totalCalls === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-3">今日暂无调用</p>
          ) : null}
        </div>
      </div>

      {/* 数据可视化 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-neutral-900 mb-4">📊 数据看板</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 7天订单趋势 */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">7天订单趋势</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={orderTrend.length > 0 ? orderTrend : [{ date: "-", orders: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#2B5F8A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* API调用趋势 */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">7天API调用趋势</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={apiTrendDays.length > 0 ? apiTrendDays : [{ date: "-", calls: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                <Tooltip />
                <Bar dataKey="calls" fill="#E8783A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* 行业分布（饼图） */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">行业分布</p>
            {industryDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={industryDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {industryDist.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-neutral-400 py-8 text-center">暂无行业数据</p>
            )}
          </div>
          {/* 状态分布（柱状图） */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">状态分布</p>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusDist.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-neutral-400 py-8 text-center">暂无项目状态数据</p>
            )}
          </div>
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
