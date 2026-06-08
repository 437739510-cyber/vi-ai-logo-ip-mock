"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, CalendarDays, ChevronDown, ChevronUp, CircleDollarSign } from "lucide-react";

interface BillingSummary {
  balance: {
    remainingCredits: number;
    totalCredits: number;
    usedCredits: number;
    companyName: string;
  } | null;
  today: { total: number; count: number };
  month: { total: number; count: number };
  breakdown: { action: string; label: string; cost: number; count: number; provider: string }[];
  providers: { provider: string; cost: number; count: number }[];
}

export default function BillingPage() {
  const [data, setData] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Billing</h1>
      </div>

      {/* Balance Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-neutral-500 mb-1">当前余额</p>
            <div className="text-3xl font-bold text-primary">
              ¥{(data?.balance?.remainingCredits ?? 0).toFixed(2)}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              已用 ¥{(data?.balance?.usedCredits ?? 0).toFixed(2)} / 总额 ¥{(data?.balance?.totalCredits ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
        </div>
        {data?.balance && (
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  ((data.balance.usedCredits) / data.balance.totalCredits) * 100
                )}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Today */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">今日消耗</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            ¥{(data?.today?.total ?? 0).toFixed(2)}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {data?.today?.count ?? 0} 次调用
          </p>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">本月消耗</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            ¥{(data?.month?.total ?? 0).toFixed(2)}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {data?.month?.count ?? 0} 次调用
          </p>
        </div>
      </div>

      {/* Provider Breakdown (expandable) */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between p-5 hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-sm font-semibold text-neutral-800">消耗明细</span>
          </div>
          {showBreakdown ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {showBreakdown && data && (
          <div className="px-5 pb-5 space-y-5 border-t border-neutral-100 pt-4">
            {/* By Provider */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                按服务商
              </h3>
              <div className="space-y-2">
                {data.providers.map((p) => (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-xl"
                  >
                    <span className="text-sm font-medium text-neutral-800">{p.provider}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-neutral-400">{p.count} 次</span>
                      <span className="text-sm font-semibold text-neutral-900">
                        ¥{p.cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Action */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                按操作类型
              </h3>
              <div className="space-y-1.5">
                {data.breakdown.map((item) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between py-2 px-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-700">{item.label}</span>
                      <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {item.provider}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-neutral-400">{item.count} 次</span>
                      <span className="text-sm font-medium text-neutral-900">
                        ¥{item.cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!data && (
        <div className="text-center py-16">
          <CircleDollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">暂无账单数据</p>
        </div>
      )}
    </div>
  );
}
