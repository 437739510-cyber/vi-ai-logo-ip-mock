"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Package } from "lucide-react";

interface Order {
  id: string;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function MemberOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/member/me")
      .then((r) => r.json())
      .then(() => {
        // MVP：订单数据暂时硬编码示例
        setOrders([
          {
            id: "ORD-20260601",
            plan: "品牌管家 ¥299/月",
            amount: 299,
            status: "active",
            created_at: "2026-06-01",
          },
        ]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const PLAN_LABELS: Record<string, string> = {
    active: "生效中",
    expired: "已过期",
    cancelled: "已取消",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">订单记录</h2>
        <p className="text-sm text-neutral-500">您的订阅和购买记录</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-neutral-100">
          <Package className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
          <p className="text-sm text-neutral-400">暂无订单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-neutral-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-900">{order.plan}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  order.status === "active" 
                    ? "text-green-600 bg-green-50" 
                    : "text-neutral-500 bg-neutral-50"
                }`}>
                  {PLAN_LABELS[order.status] || order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">{order.id}</span>
                <span className="text-sm font-semibold text-neutral-900">¥{order.amount}</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                购买日期：{order.created_at}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-100 p-5 text-center">
        <FileText className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
        <p className="text-sm text-neutral-500">如需升级套餐或续费</p>
        {process.env.NEXT_PUBLIC_SHOW_WECHAT === 'true' && <p className="text-xs text-neutral-400 mt-1">请联系客服微信 sweetheart4913</p>}
      </div>
    </div>
  );
}
