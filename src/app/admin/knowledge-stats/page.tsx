"use client";

/**
 * Admin: Knowledge Base Statistics Dashboard (KM-009)
 * Shows industry config coverage, error hit rates, and font references.
 */
import { useState, useEffect } from "react";

interface StatsData {
  industryConfigs: number;
  totalCases: number;
  casesByIndustry: Record<string, number>;
  topErrors: Array<{ errorId: string; errorFeature: string; occurrenceCount: number }>;
  fontStats: Array<{ name: string; nameZh: string; bestFor: string; weights: number }>;
}

export default function KnowledgeStatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/knowledge/stats")
      .then(r => r.json())
      .then(json => { setStats(json.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!stats) return <div style={{ padding: 24 }}>Failed to load stats.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>知识库统计看板</h1>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, color: "#666" }}>行业配置数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.industryConfigs}</div>
        </div>
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, color: "#666" }}>案例总数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.totalCases}</div>
        </div>
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, color: "#666" }}>Top错误类型</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.topErrors.length}</div>
        </div>
      </div>

      {/* Cases by industry */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>案例行业分布</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "8px 0" }}>行业</th>
              <th style={{ padding: "8px 0" }}>案例数</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.casesByIndustry)
              .sort(([, a], [, b]) => b - a)
              .map(([industry, count]) => (
                <tr key={industry} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "6px 0" }}>{industry}</td>
                  <td style={{ padding: "6px 0" }}>{count}</td>
                </tr>
              ))}
            {Object.keys(stats.casesByIndustry).length === 0 && (
              <tr><td colSpan={2} style={{ padding: 12, color: "#999" }}>暂无案例数据</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top errors */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>反面案例命中率 Top 5</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "8px 0" }}>错误ID</th>
              <th style={{ padding: "8px 0" }}>特征</th>
              <th style={{ padding: "8px 0" }}>命中次数</th>
            </tr>
          </thead>
          <tbody>
            {stats.topErrors.map(e => (
              <tr key={e.errorId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 0", fontFamily: "monospace", fontSize: 12 }}>{e.errorId}</td>
                <td style={{ padding: "6px 0", fontSize: 13 }}>{e.errorFeature}</td>
                <td style={{ padding: "6px 0" }}>{e.occurrenceCount}</td>
              </tr>
            ))}
            {stats.topErrors.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 12, color: "#999" }}>暂无错误记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Font references */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>字体库 ({stats.fontStats.length} 款)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "8px 0" }}>字体</th>
              <th style={{ padding: "8px 0" }}>中文名</th>
              <th style={{ padding: "8px 0" }}>适用场景</th>
              <th style={{ padding: "8px 0" }}>字重数</th>
            </tr>
          </thead>
          <tbody>
            {stats.fontStats.map(f => (
              <tr key={f.name} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 0", fontFamily: "monospace", fontSize: 12 }}>{f.name}</td>
                <td style={{ padding: "6px 0" }}>{f.nameZh}</td>
                <td style={{ padding: "6px 0", fontSize: 13 }}>{f.bestFor}</td>
                <td style={{ padding: "6px 0" }}>{f.weights}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}