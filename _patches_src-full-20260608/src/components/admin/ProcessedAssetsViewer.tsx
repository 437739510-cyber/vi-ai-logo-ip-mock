"use client";

import { useEffect, useState } from "react";
import { CheckCircle, RefreshCw, AlertCircle, ImageIcon } from "lucide-react";

interface ProcessedAsset {
  originalPath: string;
  processedPath: string;
  assetType: "logo" | "mascot-single" | "mascot-threeview";
  splitViews?: string[];
  method: string;
  detectedBgColor?: string;
  processedAt: string;

  // Semantic analysis fields
  analysisStatus?: "pending" | "completed" | "failed";
  logoElements?: string[];
  logoSyleTags?: string[];
  logoMeaning?: string;
  extractedColors?: { hex: string; name?: string; usage?: string }[];
  mascotName?: string;
  mascotStyle?: string;
  mascotPersonality?: string;
  mascotDescription?: string;
  mascotLabels?: string[];
}
interface Props {
  logoUrl?: string;
  mascotFiles?: { url: string }[];
}

export function ProcessedAssetsViewer({ logoUrl, mascotFiles }: Props) {
  const [entries, setEntries] = useState<ProcessedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/processed-assets");
        if (res.ok) {
          const data = await res.json();
          const all: ProcessedAsset[] = data.entries || [];

          // Filter: only show entries that match current project's assets
          const relevantPaths = new Set<string>();
          if (logoUrl) relevantPaths.add(logoUrl);
          if (mascotFiles) mascotFiles.forEach((f) => relevantPaths.add(f.url));

          const filtered = all.filter((e) => relevantPaths.has(e.originalPath));
          setEntries(filtered);
        }
      } catch {}
      setLoading(false);
    })();
  }, [logoUrl, mascotFiles]);

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-neutral-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-700">已处理素材</h3>
        <p className="text-xs text-neutral-400 animate-pulse">加载中...</p>
      </section>
    );
  }

  if (entries.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-emerald-100 p-5 space-y-4 bg-gradient-to-br from-emerald-50/40 to-transparent">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-neutral-700">
          已处理素材
          <span className="ml-2 text-xs font-normal text-neutral-400">
            （背景已移除，缓存可用）
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map((entry) => {
          const isLogo = entry.assetType === "logo";
          const isThreeView = entry.assetType === "mascot-threeview";
          const views = entry.splitViews || [entry.processedPath];

          return (
            <div key={entry.originalPath}>
              {/* Label */}
              <p className="text-[11px] font-medium text-neutral-600 mb-1.5 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {isLogo ? "LOGO（已抠图）" : isThreeView ? "IP 公仔（三视图）" : "IP 公仔（已抠图）"}
                <span className="text-[10px] text-neutral-400 ml-auto">
                  {entry.method === "sharp" ? "Sharp" : "AI"}
                </span>
              </p>

              {isThreeView && views.length === 3 ? (
                <div className="space-y-1.5">
                  {["正面", "侧面", "背面"].map((label, vi) => (
                    <div key={vi} className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={views[vi]}
                          alt={`${label}视图`}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500">{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full aspect-square rounded-lg bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-1">
                  <img
                    src={entry.processedPath}
                    alt={isLogo ? "LOGO" : "IP 公仔"}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.innerHTML =
                        '<div class="flex flex-col items-center gap-1 text-neutral-300"><AlertCircle class="w-5 h-5"/><span class="text-[10px]">尚未处理</span></div>';
                    }}
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="mt-1 flex items-center gap-2 text-[9px] text-neutral-400">
                <span>耗时：{new Date(entry.processedAt).toLocaleString("zh-CN")}</span>
                {entry.detectedBgColor && (
                  <span className="flex items-center gap-0.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full border border-neutral-200"
                      style={{ backgroundColor: entry.detectedBgColor }}
                    />
                    {entry.detectedBgColor}
                  </span>
                )}
              </div>

              {/* AI Analysis results */}
              {entry.analysisStatus === "completed" && (
                <div className="mt-2 space-y-0.5">
                  {isLogo ? (
                    <>
                      {entry.logoElements && entry.logoElements.length > 0 && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">元素：</span>
                          {entry.logoElements.join("、")}
                        </p>
                      )}
                      {entry.logoSyleTags && entry.logoSyleTags.length > 0 && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">风格：</span>
                          {entry.logoSyleTags.join("、")}
                        </p>
                      )}
                      {entry.logoMeaning && (
                        <p className="text-[9px] text-neutral-500 line-clamp-2">
                          <span className="font-medium">含义：</span>
                          {entry.logoMeaning}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {entry.mascotName && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">名字：</span>
                          {entry.mascotName}
                        </p>
                      )}
                      {entry.mascotStyle && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">风格：</span>
                          {entry.mascotStyle}
                        </p>
                      )}
                      {entry.mascotPersonality && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">性格：</span>
                          {entry.mascotPersonality}
                        </p>
                      )}
                      {entry.mascotLabels && entry.mascotLabels.length > 0 && (
                        <p className="text-[9px] text-neutral-500">
                          <span className="font-medium">标注：</span>
                          {entry.mascotLabels.join("、")}
                        </p>
                      )}
                    </>
                  )}
                  {entry.extractedColors && entry.extractedColors.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-neutral-400">色：</span>
                      {entry.extractedColors.map((c, ci) => (
                        <span
                          key={ci}
                          className="inline-block w-3 h-3 rounded-full border border-neutral-200"
                          style={{ backgroundColor: c.hex }}
                          title={c.name + (c.usage ? " (" + c.usage + ")" : "")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {entry.analysisStatus === "pending" && (
                <p className="text-[9px] text-neutral-300 mt-1 animate-pulse">AI分析中...</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
