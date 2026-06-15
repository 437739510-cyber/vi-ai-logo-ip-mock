"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

interface ProviderBalance {
  provider: string;
  balance: number;
  currency: string;
  status: string;
  detail?: string;
}

interface BillingData {
  deepseek: ProviderBalance;
  dashscope: ProviderBalance;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "正常", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  key_configured: { label: "已配置Key", color: "text-yellow-600 bg-yellow-50", icon: KeyRound },
  error: { label: "异常", color: "text-red-600 bg-red-50", icon: AlertCircle },
  not_configured: { label: "未配置", color: "text-neutral-400 bg-neutral-100", icon: KeyRound },
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/summary")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const providers = data ? [data.deepseek, data.dashscope].filter(Boolean) : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">消耗明细</h1>
      </div>

      {providers.length === 0 && (
        <div className="text-center py-16">
          <Wallet className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">暂无账单数据</p>
        </div>
      )}

      {providers.map((p) => {
        const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.not_configured;
        const StatusIcon = statusInfo.icon;
        return (
          <div key={p.provider} className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-500 mb-1">{p.provider}</p>
                <div className="text-3xl font-bold text-primary">
                  {p.balance >= 0 ? `¥${p.balance.toFixed(2)}` : "—"}
                </div>
                {p.balance >= 0 && <p className="text-xs text-neutral-400 mt-1">余额（{p.currency}）</p>}
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
            {p.detail && (
              <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-2">{p.detail}</p>
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
