"use client";

import { Eye, Download } from "lucide-react";

interface AssetPreviewProps {
  label: string;
  files: { fileName: string; url: string; size: number }[];
  emptyText?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetPreview({ label, files, emptyText = "暂无素材" }: AssetPreviewProps) {
  if (files.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">{label}</h4>
        <p className="text-sm text-neutral-400">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-medium text-neutral-700 mb-2">
        {label}（{files.length} 个）
      </h4>
      <div className="space-y-2">
        {files.map((file, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-lg text-sm"
          >
            <div className="w-10 h-10 bg-neutral-200 rounded flex items-center justify-center text-xs text-neutral-500 shrink-0">
              {file.fileName.split(".").pop()?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-neutral-700 truncate">{file.fileName}</p>
              <p className="text-xs text-neutral-400">{formatSize(file.size)}</p>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 transition-colors">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 transition-colors">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
