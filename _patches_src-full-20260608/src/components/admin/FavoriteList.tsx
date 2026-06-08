"use client";

import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Favorite } from "@/types";

interface FavoriteListProps {
  favorites: Favorite[];
  onRemove: (id: string) => void;
}

export function FavoriteList({ favorites, onRemove }: FavoriteListProps) {
  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={<Star className="w-12 h-12 text-neutral-300" />}
        title="还没有收藏的方案"
        description="在 AI 生成方案时点击星标即可收藏"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow group"
        >
          {/* 方案缩略图 */}
          <div className="aspect-[4/3] bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
            <span className="text-sm text-neutral-400">{fav.styleLabel}</span>
          </div>

          {/* 信息 */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-900">{fav.styleLabel}</span>
              <button
                onClick={() => onRemove(fav.id)}
                className="p-1 rounded text-neutral-300 hover:text-danger hover:bg-danger/5 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                {fav.clientIndustry}
              </span>
              <span className="text-[10px] text-neutral-400">
                {new Date(fav.collectedAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            {fav.notes && (
              <p className="text-xs text-neutral-500 line-clamp-2">{fav.notes}</p>
            )}
            <div className="pt-1">
              <Link
                href={`/admin/projects/${fav.projectId}`}
                className="text-xs text-primary hover:underline"
              >
                查看项目
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
