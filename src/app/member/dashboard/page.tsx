"use client";

import { useState, useEffect } from "react";
import { Image as ImageIcon, Clock, CheckCircle, Send, Loader2, Plus } from "lucide-react";
import Link from "next/link";

interface ContentItem {
  id: string;
  status: "pending" | "processing" | "ready" | "published";
  images: string[];
  caption: string;
  created_at: string;
  platform?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待处理", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "制作中", color: "text-blue-600 bg-blue-50", icon: Loader2 },
  ready: { label: "待发布", color: "text-green-600 bg-green-50", icon: CheckCircle },
  published: { label: "已发布", color: "text-neutral-600 bg-neutral-50", icon: Send },
};

export default function MemberDashboard() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const quotaTotal = 12;

  useEffect(() => {
    fetch("/api/member/contents")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setContents(data.contents || []);
          setQuotaUsed(data.quotaUsed || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* 配额卡片 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-neutral-900">本月内容配额</h2>
          <span className="text-2xl font-bold text-primary">{quotaUsed}<span className="text-sm text-neutral-400 font-normal">/{quotaTotal}条</span></span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${Math.min((quotaUsed / quotaTotal) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          超出配额 ¥30/条 · 续费请咨询客服
        </p>
      </div>

      {/* 快捷操作 */}
      <Link
        href="/member/upload"
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white font-medium rounded-2xl hover:bg-primary-dark transition-all shadow-sm"
      >
        <Plus className="w-5 h-5" />
        拍照上传
      </Link>

      {/* 内容列表 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">我的内容</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-100">
            <ImageIcon className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
            <p className="text-sm text-neutral-400">还没有内容</p>
            <p className="text-xs text-neutral-300 mt-1">点击上方「拍照上传」开始</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contents.map((item) => {
              const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
              const StatusIcon = status.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-neutral-100 p-4 flex gap-3"
                >
                  {/* 缩略图 */}
                  <div className="w-16 h-16 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
                    {item.images[0] ? (
                      <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-neutral-300" />
                      </div>
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-700 truncate">
                      {item.caption || "待生成文案"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
                        {item.status === "processing" ? (
                          <StatusIcon className="w-3 h-3 animate-spin" />
                        ) : (
                          <StatusIcon className="w-3 h-3" />
                        )}
                        {status.label}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(item.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400 self-start">{item.images.length}张</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
