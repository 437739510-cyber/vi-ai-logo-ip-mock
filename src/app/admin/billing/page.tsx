"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, RefreshCw, CheckCircle2, KeyRound, AlertCircle, TrendingUp, Image, Eye, FileText, Cpu } from "lucide-react";

interface ApiBalance {
  provider: string;
  balance: number | null;
  currency: string;
  status?: string;
  error?: string;
  detail?: string;
  source?: string;
}

interface UsageSummary {
  totalImageCost: number;
  totalVisionCost: number;
  totalImages: number;
  totalVisionCalls: number;
  byModel: Record<string, { count: number; cost: number }>;
  byProject: Array<{ id: string; images: number; visionCalls: number; cost: number }>;
  byType: Record<string, { count: number; cost: number }>;
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
  const [liblibaiBalance, setLiblibaiBalance] = useState<ApiBalance | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [arkUsage, setArkUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dsRes, dqRes, libRes, usageRes, arkRes] = await Promise.allSettled([
        fetch("/api/billing/deepseek-balance").then(r => r.json()),
        fetch("/api/billing/dashscope-balance").then(r => r.json()),
        fetch("/api/billing/liblibai-balance").then(r => r.json()),
        fetch("/api/billing/usage-detail").then(r => r.json()),
        fetch("/api/ai/ark-balance").then(r => r.json()),
      ]);
      if (dsRes.status === "fulfilled") setDeepseekBalance(dsRes.value);
      if (dqRes.status === "fulfilled") setDashscopeBalance(dqRes.value);
      if (libRes.status === "fulfilled") setLiblibaiBalance(libRes.value);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value);
      if (arkRes.status === "fulfilled") setArkUsage(arkRes.value);
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

  const providers = [deepseekBalance, dashscopeBalance, liblibaiBalance].filter(Boolean) as ApiBalance[];

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

      {/* ARK Seedream */}
      {arkUsage && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">火山 Seedream 4.0</span>
            <span className="text-xs text-neutral-400">（手动维护，火山引擎控制台核对）</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-600">{arkUsage.balance !== null ? "\u00a5" + arkUsage.balance.toFixed(2) : "\u2014"}</div>
              <div className="text-[10px] text-neutral-400">可用余额</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-orange-500">{arkUsage.trackedCost != null ? "\u00a5" + arkUsage.trackedCost.toFixed(2) : "\u2014"}</div>
              <div className="text-[10px] text-neutral-400">平台已追踪消耗</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-neutral-900">{arkUsage.status || "\u2014"}</div>
              <div className="text-[10px] text-neutral-400">状态</div>
            </div>
          </div>
          {arkUsage.note && (
            <p className="text-xs text-neutral-400 mt-2">{arkUsage.note}</p>
          )}
        </div>
      )}

{/* 用量追踪 */}
      {usage && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">用量追踪</span>
            <span className="text-xs text-neutral-400">（基于已记录的调用，V87+新增追踪）</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-neutral-900">{usage.totalImages}</div>
              <div className="text-[10px] text-neutral-400">图片生成</div>
              <div className="text-xs text-orange-500">¥{usage.totalImageCost.toFixed(2)}</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-neutral-900">{usage.totalVisionCalls}</div>
              <div className="text-[10px] text-neutral-400">视觉识别</div>
              <div className="text-xs text-orange-500">¥{usage.totalVisionCost.toFixed(2)}</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-neutral-900">¥{(usage.totalImageCost + usage.totalVisionCost).toFixed(2)}</div>
              <div className="text-[10px] text-neutral-400">追踪总成本</div>
              <div className="text-xs text-red-500">已记录</div>
            </div>
          </div>

          {/* By Model */}
          {Object.keys(usage.byModel).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-neutral-500 mb-2">按模型</p>
              <div className="space-y-1">
                {Object.entries(usage.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([model, data]) => (
                  <div key={model} className="flex items-center justify-between text-xs py-1 px-2 bg-neutral-50 rounded">
                    <span className="text-neutral-700">{model}</span>
                    <span className="text-neutral-500">{data.count}次</span>
                    <span className="font-medium text-orange-600">¥{data.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Project */}
          {usage.byProject.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">按项目</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {usage.byProject.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 bg-neutral-50 rounded">
                    <span className="text-neutral-700 font-mono">{p.id}</span>
                    <span className="text-neutral-500">
                      {p.images > 0 && <span className="inline-flex items-center gap-0.5"><Image className="w-3 h-3" />{p.images}</span>}
                      {p.visionCalls > 0 && <span className="inline-flex items-center gap-0.5 ml-1"><Eye className="w-3 h-3" />{p.visionCalls}</span>}
                    </span>
                    <span className="font-medium text-orange-600">¥{p.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usage.totalImages === 0 && usage.totalVisionCalls === 0 && (
            <p className="text-xs text-neutral-400 text-center py-4">暂无用量记录（V87之前的调用未被追踪）</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-neutral-700">费用说明</span>
        </div>
        <div className="text-xs text-neutral-400 space-y-1 pl-12">
          <p>• DeepSeek V4-Flash：品牌分析、文案生成、排版决策</p>
          <p>• 通义万相 wan2.6-t2i：Logo+场景图生成（¥0.20/张）</p>
          <p>• qwen-vl-max：Logo视觉描述（约¥0.01/次）</p>
          <p>• 首次生成单项目成本约 ¥2.00（4Logo+5场景+1视觉识别）</p>
          <p className="text-orange-500">• 注意：重复生成/重新生成每次都会产生图片费用</p>
        </div>
      </div>
    </div>
  );
}
