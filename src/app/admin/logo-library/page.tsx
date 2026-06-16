"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Palette, Filter, Trash2, HardDrive, RefreshCw,
  ChevronLeft, ChevronRight, Store, Truck,
} from "lucide-react";

interface LogoItem {
  id: string;
  project_id: string;
  company_name: string | null;
  industry: string | null;
  business_type: string;
  logo_index: number;
  image_url: string;
  prompt: string | null;
  style_tags: string[] | null;
  brand_colors: Record<string, string> | null;
  file_size: number;
  created_at: string;
}

interface StorageInfo {
  usedMB: number;
  limitMB: number;
  usedPercent: number;
}

export default function LogoLibraryPage() {
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(40);
  const [storage, setStorage] = useState<StorageInfo>({ usedMB: 0, limitMB: 100, usedPercent: 0 });
  const [industryStats, setIndustryStats] = useState<Record<string, number>>({});
  const [typeStats, setTypeStats] = useState<Record<string, number>>({});
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<LogoItem | null>(null);
  const [collecting, setCollecting] = useState(false);

  const fetchLogos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (filterIndustry) params.set("industry", filterIndustry);
      if (filterType) params.set("business_type", filterType);

      const resp = await fetch(`/api/admin/logo-library?${params}`);
      const data = await resp.json();
      if (data.logos) {
        setLogos(data.logos);
        setTotal(data.total);
        setStorage(data.storage);
        setIndustryStats(data.industryStats || {});
        setTypeStats(data.typeStats || {});
      }
    } catch (err) {
      console.error("获取素材库失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogos();
  }, [page, filterIndustry, filterType]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      // 从所有已完成Logo选择的项目中收集未选中Logo
      const resp = await fetch("/api/admin/logo-library/collect-all", { method: "POST" });
      const data = await resp.json();
      alert(data.message || `收集完成: ${data.collected || 0}个Logo`);
      fetchLogos();
    } catch (err) {
      alert("收集失败");
    } finally {
      setCollecting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("确定清理最旧的Logo释放空间？")) return;
    try {
      const resp = await fetch("/api/admin/logo-library?free_mb=10", { method: "DELETE" });
      const data = await resp.json();
      alert(`已删除${data.deleted}个Logo，释放${data.freedMB}MB`);
      fetchLogos();
    } catch (err) {
      alert("清理失败");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            Logo素材库
          </h1>
          <p className="text-sm text-neutral-500 mt-1">客户未选中的Logo方案，按行业分类归档</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCollect} disabled={collecting}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${collecting ? "animate-spin" : ""}`} />
            {collecting ? "收集中..." : "收集未选中Logo"}
          </button>
        </div>
      </div>

      {/* Storage Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <HardDrive className="w-4 h-4" />
            存储空间
          </div>
          <span className="text-sm text-neutral-500">
            {storage.usedMB} MB / {storage.limitMB} MB
          </span>
        </div>
        <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              storage.usedPercent > 80 ? "bg-red-500" : storage.usedPercent > 50 ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(storage.usedPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-neutral-400">已用 {storage.usedPercent}%</span>
          <span className="text-xs text-neutral-400">剩余 {(storage.limitMB - storage.usedMB).toFixed(1)} MB</span>
        </div>
        {storage.usedPercent > 80 && (
          <button onClick={handleCleanup}
            className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-700">
            <Trash2 className="w-3 h-3" /> 清理最旧素材释放空间
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Industry Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={filterIndustry}
            onChange={(e) => { setFilterIndustry(e.target.value); setPage(1); }}
            className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部行业</option>
            {Object.entries(industryStats).map(([ind, count]) => (
              <option key={ind} value={ind}>{ind} ({count})</option>
            ))}
          </select>
        </div>

        {/* Business Type Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部类型</option>
            {Object.entries(typeStats).map(([bt, count]) => (
              <option key={bt} value={bt}>
                {bt === "店铺" ? "🏪 店铺" : "🛒 路边摊"} ({count})
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-neutral-400 ml-auto">共 {total} 个Logo</span>
      </div>

      {/* Logo Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : logos.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>素材库暂无Logo</p>
          <p className="text-sm mt-1">客户选择Logo后，未选中的方案会自动归档到这里</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {logos.map((logo) => (
              <div
                key={logo.id}
                onClick={() => setSelectedLogo(logo)}
                className="group relative bg-white rounded-xl border border-neutral-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="aspect-square relative bg-neutral-50">
                  <Image
                    src={logo.image_url}
                    alt={`Logo ${logo.logo_index + 1}`}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  />
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-700 truncate">
                      {logo.company_name || "未知品牌"}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {logo.business_type === "路边摊" ? "🛒" : "🏪"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                      {logo.industry || "未分类"}
                    </span>
                    {(logo.style_tags || []).slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-neutral-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLogo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLogo(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="aspect-square relative bg-neutral-50 rounded-xl overflow-hidden mb-4">
                <Image
                  src={selectedLogo.image_url}
                  alt="Logo详情"
                  fill
                  className="object-contain p-4"
                  sizes="512px"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{selectedLogo.company_name || "未知品牌"}</h3>
                  <span className="text-sm px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {selectedLogo.business_type === "路边摊" ? "🛒 路边摊" : "🏪 店铺"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-neutral-400">行业：</span>{selectedLogo.industry || "未分类"}</div>
                  <div><span className="text-neutral-400">方案：</span>第{selectedLogo.logo_index + 1}个</div>
                  <div><span className="text-neutral-400">项目：</span>{selectedLogo.project_id}</div>
                  <div><span className="text-neutral-400">大小：</span>{(selectedLogo.file_size / 1024).toFixed(0)} KB</div>
                </div>
                {selectedLogo.brand_colors && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-400">品牌色：</span>
                    {Object.entries(selectedLogo.brand_colors).map(([key, color]) => (
                      <div key={key} className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full border border-neutral-200" style={{ backgroundColor: color as string }} />
                        <span className="text-xs text-neutral-500">{color as string}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedLogo.style_tags && selectedLogo.style_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedLogo.style_tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                {selectedLogo.prompt && (
                  <div className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg">
                    <span className="text-neutral-400 text-xs">设计提示词</span>
                    <p className="mt-1">{selectedLogo.prompt}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
