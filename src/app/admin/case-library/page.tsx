"use client";

/**
 * Admin: Case Library Browser
 * Displays reference VI manual cases from case_library table.
 */
import { useState, useEffect } from "react";

interface CaseItem {
  case_id: string;
  project_id: string;
  industry: string;
  quality_score: number;
  highlight_tags: string[];
  is_reference: boolean;
  created_at: string;
}

export default function CaseLibraryPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState("");
  const [search, setSearch] = useState("");

  const fetchCases = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (industry) params.set("industry", industry);
    if (search) params.set("q", search);
    const res = await fetch(`/api/case-library?${params}`);
    const json = await res.json();
    setCases(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>案例库</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="搜索品牌名/行业"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
        >
          <option value="">全部行业</option>
          <option value="餐饮">餐饮</option>
          <option value="美业">美业</option>
          <option value="零售">零售</option>
          <option value="教育">教育</option>
        </select>
        <button onClick={fetchCases} style={{ padding: "6px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          搜索
        </button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>品牌/项目</th>
              <th style={{ padding: "8px 12px" }}>行业</th>
              <th style={{ padding: "8px 12px" }}>质量分</th>
              <th style={{ padding: "8px 12px" }}>标签</th>
              <th style={{ padding: "8px 12px" }}>参考</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.case_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px" }}>{c.project_id}</td>
                <td style={{ padding: "8px 12px" }}>{c.industry}</td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 12, fontSize: 12,
                    background: c.quality_score >= 80 ? "#dcfce7" : c.quality_score >= 60 ? "#fef9c3" : "#fee2e2",
                    color: c.quality_score >= 80 ? "#166534" : c.quality_score >= 60 ? "#854d0e" : "#991b1b",
                  }}>
                    {c.quality_score}
                  </span>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {(c.highlight_tags || []).slice(0, 3).map((t: string) => (
                    <span key={t} style={{ marginRight: 4, padding: "1px 6px", background: "#f3f4f6", borderRadius: 4, fontSize: 11 }}>{t}</span>
                  ))}
                </td>
                <td style={{ padding: "8px 12px" }}>{c.is_reference ? "⭐" : ""}</td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>暂无案例数据</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
