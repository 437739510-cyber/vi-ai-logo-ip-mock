"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, RefreshCw, CheckCircle2, KeyRound, AlertCircle, TrendingUp } from "lucide-react";

interface ApiBalance {
  provider: string;
  balance: number | null;
  currency: string;
  status?: string;
  error?: string;
  detail?: string;
  source?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "正常", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  key_configured: { label: "已配置Key", color: "text-yellow-600 bg-yellow-50", icon: KeyRound },
  error: { label: "异常", color: "text-red-600 bg-red-50", icon: AlertCircle },
  not_configured: { label: "未配置", color: "text-neutral-400 bg-neutral-100", icon: KeyRound },
};

export default function BillingPage() {
  const [deepseekBalance, setDeepseekBalance] = useState<ApiBalance | null>(null);
  const [dashscopeBalance, setDashscopeBalance] = useState<ApiBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dsRes, dqRes] = await Promise.allSettled([
        fetch("/api/billing/deepseek-balance").then(r => r.json()),
        fetch("/api/billing/dashscope-balance").then(r => r.json()),
      ]);
      if (dsRes.status === "fulfilled") setDeepseekBalance(dsRes.value);
      if (dqRes.status === "fulfilled") setDashscopeBalance(dqRes.value);
    } catch { /* ignore */ }
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const providers = [deepseekBalance, dashscopeBalance].filter(Boolean) as ApiBalance[];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">消耗明细</h1>
        <button onClick={fetchBalances} disabled={refreshing}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {providers.length === 0 && (
        <div className="text-center py-16">
          <Wallet className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">暂无账单数据</p>
        </div>
      )}

      {providers.map((p) => {
        const statusKey = p.status || (p.error ? "error" : p.balance !== null && p.balance >= 0 ? "active" : "not_configured");
        const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP.not_configured;
        const StatusIcon = statusInfo.icon;
        return (
          <div key={p.provider} className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-500 mb-1">{p.provider}</p>
                <div className="text-3xl font-bold text-primary">
                  {p.balance !== null && p.balance >= 0 ? `¥${p.balance.toFixed(2)}` : "—"}
                </div>
                {p.balance !== null && p.balance >= 0 && (
                  <p className="text-xs text-neutral-400 mt-1">余额（{p.currency || "CNY"}）</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusInfo.label}
                </span>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
            {(p.detail || p.error) && (
              <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-2">{p.detail || p.error}</p>
            )}
          </div>
        );
      })}

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-neutral-700">费用说明</span>
        </div>
        <div className="text-xs text-neutral-400 space-y-1 pl-12">
          <p>• DeepSeek V4-Flash：品牌分析、文案生成、排版决策</p>
          <p>• 通义万相：Logo场景图生成</p>
          <p>• 单项目综合成本约 ¥1.84</p>
        </div>
      </div>
    </div>
  );
}
