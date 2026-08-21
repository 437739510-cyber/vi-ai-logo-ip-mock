"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Filter, RefreshCw } from "lucide-react";

interface BlockView {
  blockedAt: string;
  ticketCode: string;
  industryFamily: string;
  sceneRole: string;
  ruleId: string;
  promptPreview: string;
  result: string;
  status: string;
  costCny: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  finishReason: string | null;
  geoInferredFalse: boolean;
  hasAfterPrompt: boolean;
}

interface Summary {
  total: number;
  byRuleId: Record<string, number>;
  byIndustry: Record<string, number>;
  byStatus: Record<string, number>;
  byResult: Record<string, number>;
}

export default function PromptGatePage() {
  const [blocks, setBlocks] = useState<BlockView[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (ruleId) params.set("ruleId", ruleId);
    if (industry) params.set("industryFamily", industry);
    if (status) params.set("status", status);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    try {
      const resp = await fetch(`/api/admin/prompt-gate-blocks?${params.toString()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "加载失败");
      setBlocks(data.blocks || []);
      setSummary(data.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ruleId, industry, status, from, to]);

  useEffect(() => { load(); }, [load]);

  const fmtTime = (t: string) => (t ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "—");
  const ruleIds = Array.from(new Set(blocks.map((b) => b.ruleId).filter(Boolean)));
  const industries = Array.from(new Set(blocks.map((b) => b.industryFamily).filter(Boolean)));
  const statuses = Array.from(new Set(blocks.map((b) => b.status).filter(Boolean)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-600" />
        <h1 className="text-xl font-bold">提示词门拦截记录</h1>
        <button onClick={load} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border rounded p-3"><div className="text-2xl font-bold">{summary.total}</div><div className="text-xs text-gray-500">总拦截</div></div>
          <div className="border rounded p-3"><div className="text-2xl font-bold">{Object.keys(summary.byRuleId).length}</div><div className="text-xs text-gray-500">规则数</div></div>
          <div className="border rounded p-3"><div className="text-2xl font-bold">{Object.keys(summary.byIndustry).length}</div><div className="text-xs text-gray-500">行业数</div></div>
          <div className="border rounded p-3"><div className="text-2xl font-bold">{summary.byStatus["待核验"] || 0}</div><div className="text-xs text-gray-500">待核验</div></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end border rounded p-3 bg-gray-50">
        <Filter className="w-4 h-4 self-center text-gray-500" />
        <label className="text-xs text-gray-600">ruleId
          <select value={ruleId} onChange={(e) => setRuleId(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm">
            <option value="">全部</option>
            {ruleIds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">行业
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm">
            <option value="">全部</option>
            {industries.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">状态
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm">
            <option value="">全部</option>
            {statuses.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">从
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">到
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm" />
        </label>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">加载中…</div>
      ) : (
        <div className="border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2">时间</th>
                <th className="p-2">项目代号</th>
                <th className="p-2">行业族</th>
                <th className="p-2">ruleId</th>
                <th className="p-2">提示词预览</th>
                <th className="p-2">结果</th>
                <th className="p-2">费用</th>
                <th className="p-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {blocks.length === 0 && <tr><td colSpan={8} className="p-3 text-gray-500">暂无拦截记录</td></tr>}
              {blocks.map((b, i) => (
                <tr key={`${b.blockedAt}-${i}`} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fmtTime(b.blockedAt)}</td>
                  <td className="p-2">{b.ticketCode || "—"}</td>
                  <td className="p-2">{b.industryFamily || "—"}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">{b.ruleId || "—"}</span></td>
                  <td className="p-2 max-w-xs truncate" title={b.promptPreview}>{b.promptPreview || "—"}</td>
                  <td className="p-2">{b.result || "—"}{b.hasAfterPrompt ? "（已修正）" : ""}</td>
                  <td className="p-2 whitespace-nowrap">¥{b.costCny.toFixed(4)}<br /><span className="text-xs text-gray-500">{b.promptTokens}+{b.completionTokens} tok · {b.model || "—"} · {b.finishReason || "—"}</span></td>
                  <td className="p-2">{b.status || "待核验"}{b.geoInferredFalse ? <span className="text-xs text-orange-500">（geo异常）</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded p-3">
            <div className="text-sm font-semibold mb-2">按规则统计</div>
            {Object.entries(summary.byRuleId).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-bold">{v}</span></div>)}
          </div>
          <div className="border rounded p-3">
            <div className="text-sm font-semibold mb-2">按行业统计</div>
            {Object.entries(summary.byIndustry).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-bold">{v}</span></div>)}
          </div>
          <div className="border rounded p-3">
            <div className="text-sm font-semibold mb-2">按处理状态</div>
            {Object.entries(summary.byStatus).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-bold">{v}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
