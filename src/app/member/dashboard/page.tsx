"use client";

import { useState, useEffect, useCallback } from "react";
import { Image as ImageIcon, Clock, CheckCircle, Send, Loader2, Plus, Sparkles, Copy, Check, Wand2, Download } from "lucide-react";
import Link from "next/link";

interface ComposedImage {
  template: string;
  url: string;
}

interface ContentItem {
  id: string;
  status: "pending" | "processing" | "ready" | "published";
  images: string[];
  caption: string;
  note: string;
  created_at: string;
  platform?: string;
  composed_images?: ComposedImage[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待生成", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "生成中", color: "text-blue-600 bg-blue-50", icon: Loader2 },
  ready: { label: "已完成", color: "text-green-600 bg-green-50", icon: CheckCircle },
  published: { label: "已发布", color: "text-neutral-600 bg-neutral-50", icon: Send },
};

const PLATFORM_OPTIONS = [
  { value: "xiaohongshu", label: "小红书" },
  { value: "wechat", label: "朋友圈" },
  { value: "douyin", label: "抖音" },
];

const TEMPLATE_OPTIONS = [
  { value: "product_showcase", label: "产品展示", icon: "📦" },
  { value: "promo", label: "促销活动", icon: "🎉" },
  { value: "daily", label: "日常种草", icon: "🌿" },
];

export default function MemberDashboard() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaTotal, setQuotaTotal] = useState(2);
  const [plan, setPlan] = useState("free");
  const [generating, setGenerating] = useState<string | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const isFree = plan === "free";
  const isQuotaFull = quotaUsed >= quotaTotal;

  const loadData = useCallback(() => {
    fetch("/api/member/contents")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setContents(data.contents || []);
          setQuotaUsed(data.quotaUsed || 0);
          setQuotaTotal(data.quotaTotal || 2);
          setPlan(data.plan || "free");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async (contentId: string, platform: string) => {
    setGenerating(contentId);
    try {
      const res = await fetch("/api/member/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, platform }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "生成失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setGenerating(null);
    }
  };

  const handleCompose = async (contentId: string, template: string) => {
    setComposing(contentId);
    try {
      const res = await fetch("/api/member/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, template }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "合成失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setComposing(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 配额卡片 */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-neutral-900">本月内容配额</h2>
          <div className="flex items-center gap-2">
            {isFree && <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">免费体验</span>}
            {!isFree && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">会员</span>}
            <span className="text-2xl font-bold text-primary">{quotaUsed}<span className="text-sm text-neutral-400 font-normal">/{quotaTotal}条</span></span>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2">
          <div className={`rounded-full h-2 transition-all ${isQuotaFull ? "bg-red-400" : "bg-primary"}`}
            style={{ width: `${Math.min((quotaUsed / quotaTotal) * 100, 100)}%` }} />
        </div>
        {isFree && !isQuotaFull && <p className="text-xs text-neutral-400 mt-2">免费体验{quotaTotal}条内容，用完后开通会员继续使用</p>}
        {isFree && isQuotaFull && (
          <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
            <p className="text-sm font-medium text-primary">免费体验已用完</p>
            <p className="text-xs text-neutral-500 mt-1">开通会员¥299/月，每月12条品牌内容，AI自动生成文案+品牌化图片</p>
            <a href="https://brandbrain.zeabur.app" className="inline-block mt-2 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg">立即开通</a>
          </div>
        )}
        {!isFree && <p className="text-xs text-neutral-400 mt-2">超出配额 ¥30/条 · 续费请咨询客服</p>}
      </div>

      {/* 快捷操作 */}
      <Link href="/member/upload"
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white font-medium rounded-2xl hover:bg-primary-dark transition-all shadow-sm">
        <Plus className="w-5 h-5" />
        拍照上传
      </Link>

      {/* 内容列表 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">我的内容</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />加载中...
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
              const isGenerating = generating === item.id;
              const isComposing = composing === item.id;
              return (
                <div key={item.id} className="bg-white rounded-xl border border-neutral-100 p-4">
                  <div className="flex gap-3">
                    {/* 缩略图 */}
                    <div className="w-16 h-16 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
                      {item.images[0] && !item.images[0].startsWith("pending_") ? (
                        <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-neutral-300" />
                        </div>
                      )}
                    </div>
                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700 line-clamp-2">
                        {item.caption || item.note || "待生成文案"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
                          {item.status === "processing" || isGenerating || isComposing ? (
                            <StatusIcon className="w-3 h-3 animate-spin" />
                          ) : (
                            <StatusIcon className="w-3 h-3" />
                          )}
                          {isComposing ? "合成中" : isGenerating ? "生成中" : status.label}
                        </span>
                        <span className="text-xs text-neutral-400">{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400 self-start">{item.images.length}张</span>
                  </div>

                  {/* AI文案生成按钮 */}
                  {item.status === "pending" && !isGenerating && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-400 mb-2">生成文案</p>
                      <div className="flex gap-2">
                        {PLATFORM_OPTIONS.map((p) => (
                          <button key={p.value} onClick={() => handleGenerate(item.id, p.value)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-all">
                            <Sparkles className="w-3.5 h-3.5" />{p.label}文案
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI模板合成按钮 */}
                  {(item.status === "pending" || item.status === "ready") && !isComposing && item.images.some((u: string) => !u.startsWith("pending_")) && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-400 mb-2">生成品牌图</p>
                      <div className="flex gap-2">
                        {TEMPLATE_OPTIONS.map((t) => (
                          <button key={t.value} onClick={() => handleCompose(item.id, t.value)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-white bg-primary/80 rounded-lg hover:bg-primary transition-all">
                            <Wand2 className="w-3.5 h-3.5" />{t.icon}{t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 合成图片展示 */}
                  {item.composed_images && item.composed_images.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-400 mb-2">品牌化图片</p>
                      <div className="grid grid-cols-3 gap-2">
                        {item.composed_images.map((ci, i) => (
                          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100 cursor-pointer group"
                            onClick={() => setPreviewImg(ci.url)}>
                            <img src={ci.url} alt={ci.template} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <Download className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 文案展示+复制 */}
                  {item.caption && (
                    <div className="mt-3 p-3 bg-neutral-50 rounded-lg relative group">
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap pr-8">{item.caption}</p>
                      <button onClick={() => handleCopy(item.caption, item.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-neutral-200 transition-colors text-neutral-400 hover:text-neutral-600">
                        {copied === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 图片预览弹窗 */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-lg w-full">
            <img src={previewImg} alt="预览" className="w-full rounded-xl" />
            <div className="mt-3 flex gap-3 justify-center">
              <a href={previewImg} download="brand-image.jpg"
                className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-100">
                <Download className="w-4 h-4" />保存图片
              </a>
              <button onClick={() => setPreviewImg(null)}
                className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm hover:bg-white/30">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
