"use client";

import { useEffect, useState } from "react";
import { Coins, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

interface SettlementRecord {
  id: string;
  contentId: string;
  memberId: string;
  studentId: string;
  studentName?: string;
  brandName?: string;
  unitPrice: number;
  studentRatio: number;
  platformRatio: number;
  studentAmount: number;
  platformAmount: number;
  totalAmount: number;
  studentLevel: string;
  tier: string;
  status: string;
  settledAt: string;
  paidAt?: string | null;
  paidBy?: string | null;
}

interface EarningsSummary {
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  orderCount: number;
}

interface EarningsData {
  summary: EarningsSummary;
  records: SettlementRecord[];
  level: { tier: string; ratio: number; level: string };
  rules: {
    base: { ratio: number; level: string };
    silver: { ratio: number; level: string };
    gold: { ratio: number; level: string };
    silverOrders: number;
    goldOrders: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "待结算",
  paid: "已到账",
};

function fmtMoney(n: number): string {
  return `¥${(Number(n) || 0).toFixed(2)}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return d;
  }
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/earnings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setData({
            summary: d.summary,
            records: d.records || [],
            level: d.level || { tier: "base", ratio: 72, level: "新手合伙人" },
            rules: d.rules,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const summary = data?.summary || { totalEarned: 0, pendingAmount: 0, paidAmount: 0, orderCount: 0 };
  const records = data?.records || [];
  const level = data?.level || { tier: "base", ratio: 72, level: "新手合伙人" };
  const rules = data?.rules || {
    base: { ratio: 72, level: "新手合伙人" },
    silver: { ratio: 78, level: "银级合伙人" },
    gold: { ratio: 83, level: "金级合伙人" },
    silverOrders: 20,
    goldOrders: 50,
  };

  const orderCount = summary.orderCount;
  const nextInfo =
    level.tier === "gold"
      ? null
      : level.tier === "silver"
        ? { level: rules.gold.level, orders: rules.goldOrders, ratio: rules.gold.ratio }
        : { level: rules.silver.level, orders: rules.silverOrders, ratio: rules.silver.ratio };
  const progressTarget = nextInfo ? nextInfo.orders : Math.max(1, orderCount);
  const progressPct = Math.min(100, Math.round((orderCount / progressTarget) * 100));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <Coins className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">我的收入</h1>
            <p className="text-xs text-neutral-500">提成记录与等级进度（真实流水）</p>
          </div>
        </div>
      </div>

      {/* 收入总览 */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white">
        <p className="text-white/60 text-sm mb-1">累计收入（学生大头）</p>
        <div className="text-4xl font-bold mb-4">{fmtMoney(summary.totalEarned)}</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/40 text-xs">待结算</p>
            <p className="text-lg font-semibold">{fmtMoney(summary.pendingAmount)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">已到账</p>
            <p className="text-lg font-semibold">{fmtMoney(summary.paidAmount)}</p>
          </div>
        </div>
      </div>

      {/* 等级进度 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h3 className="font-bold text-neutral-900 mb-4">合伙人等级</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-lg font-bold text-primary">{level.level}</span>
            <span className="ml-2 text-sm text-neutral-500">{level.ratio}%提成</span>
          </div>
          <div className="text-right">
            <span className="text-sm text-neutral-600">{orderCount}单</span>
            <span className="text-xs text-neutral-400 ml-1">
              {nextInfo ? `/ ${nextInfo.orders}单升级` : "已达最高等级"}
            </span>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2 mb-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-500"
            style={{ width: `${nextInfo ? progressPct : 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-neutral-400">
          <span>{rules.base.level} {rules.base.ratio}%</span>
          <span>{rules.silver.level} {rules.silver.ratio}%（{rules.silverOrders}单）</span>
          <span>{rules.gold.level} {rules.gold.ratio}%（{rules.goldOrders}单）</span>
        </div>
      </div>

      {/* 提成记录 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h3 className="font-bold text-neutral-900 mb-4">提成记录</h3>
        {records.length === 0 ? (
          <div className="text-center py-8">
            <Coins className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">暂无提成记录</p>
            <p className="text-xs text-neutral-300 mt-1">客户确认内容后自动记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-left">
                  <th className="px-3 py-2 font-medium text-neutral-500">客户</th>
                  <th className="px-3 py-2 font-medium text-neutral-500">金额</th>
                  <th className="px-3 py-2 font-medium text-neutral-500">分成</th>
                  <th className="px-3 py-2 font-medium text-neutral-500">状态</th>
                  <th className="px-3 py-2 font-medium text-neutral-500">结算时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-50">
                    <td className="px-3 py-3 text-neutral-900 font-medium">{r.brandName || r.memberId}</td>
                    <td className="px-3 py-3 text-neutral-700 font-medium">{fmtMoney(r.studentAmount)}</td>
                    <td className="px-3 py-3 text-neutral-500 text-xs">{r.studentRatio}% / 平台{r.platformRatio}%</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status === "paid" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-500 text-xs">{fmtDate(r.status === "paid" ? r.paidAt : r.settledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
        <p className="text-xs text-neutral-500">
          • 提成在客户确认内容后自动计算并记录（学生拿大头）<br />
          • 待结算流水由管理员在后台确认打款后转为「已到账」<br />
          • 等级按累计已确认单数自动晋升（20单银级 / 50单金级）
        </p>
      </div>
    </div>
  );
}
