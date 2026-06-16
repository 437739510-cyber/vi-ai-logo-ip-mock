"use client";

import { useEffect, useState } from "react";
import { Coins, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

interface EarningSummary {
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  orderCount: number;
  level: string;
  commissionRate: number;
  nextLevel: string;
  nextLevelOrders: number;
  ordersToNext: number;
  records: { id: string; brand_name: string; amount: number; status: string; date: string }[];
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    // 获取分成配置
    fetch("/api/config/pricing")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.commission || null);
      })
      .catch(() => {});

    // 模拟收入数据（后续接真实提成系统）
    setData({
      totalEarned: 0,
      pendingAmount: 0,
      paidAmount: 0,
      orderCount: 0,
      level: "新手合伙人",
      commissionRate: 30,
      nextLevel: "银级合伙人",
      nextLevelOrders: 20,
      ordersToNext: 20,
      records: [],
    });
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const comm = config || { base: 30, silver: 40, gold: 50, upgradeOrders: { silver: 20, gold: 50 } };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <Coins className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">我的收入</h1>
            <p className="text-xs text-neutral-500">提成记录与等级进度</p>
          </div>
        </div>
      </div>

      {/* 收入总览 */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white">
        <p className="text-white/60 text-sm mb-1">累计收入</p>
        <div className="text-4xl font-bold mb-4">¥{(data?.totalEarned ?? 0).toFixed(2)}</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/40 text-xs">待结算</p>
            <p className="text-lg font-semibold">¥{(data?.pendingAmount ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">已到账</p>
            <p className="text-lg font-semibold">¥{(data?.paidAmount ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* 等级进度 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h3 className="font-bold text-neutral-900 mb-4">合伙人等级</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-lg font-bold text-primary">{data?.level || "新手合伙人"}</span>
            <span className="ml-2 text-sm text-neutral-500">{data?.commissionRate || comm.base}%提成</span>
          </div>
          <div className="text-right">
            <span className="text-sm text-neutral-600">{data?.orderCount || 0}单</span>
            <span className="text-xs text-neutral-400 ml-1">/ {data?.nextLevelOrders || comm.upgradeOrders.silver}单升级</span>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2 mb-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-500"
            style={{ width: `${Math.min(100, ((data?.orderCount || 0) / (data?.nextLevelOrders || comm.upgradeOrders.silver)) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-neutral-400">
          <span>新手 {comm.base}%</span>
          <span>银级 {comm.silver}%（{comm.upgradeOrders.silver}单）</span>
          <span>金级 {comm.gold}%（{comm.upgradeOrders.gold}单）</span>
        </div>
      </div>

      {/* 提成记录 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h3 className="font-bold text-neutral-900 mb-4">提成记录</h3>
        {(!data?.records || data.records.length === 0) && (
          <div className="text-center py-8">
            <Coins className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">暂无提成记录</p>
            <p className="text-xs text-neutral-300 mt-1">客户付款后自动记录</p>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
        <p className="text-xs text-neutral-500">
          • 提成在客户付款后自动计算并记录<br/>
          • 每月1号结算上月待结算金额<br/>
          • 等级按累计完成单数自动晋升
        </p>
      </div>
    </div>
  );
}
