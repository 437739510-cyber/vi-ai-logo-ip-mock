"use client";

import { useEffect, useState } from "react";
import { FavoriteFilters } from "@/components/admin/FavoriteFilters";
import { FavoriteList } from "@/components/admin/FavoriteList";
import { getFavorites } from "@/lib/mock";
import type { Favorite } from "@/types";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState("");

  useEffect(() => {
    getFavorites().then((list) => {
      setFavorites(list);
      setLoading(false);
    });
  }, []);

  const filtered = industry
    ? favorites.filter((f) => f.clientIndustry === industry)
    : favorites;

  const handleRemove = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">收藏方案</h2>
        <p className="text-sm text-neutral-400">共 {filtered.length} 个收藏</p>
      </div>

      <FavoriteFilters industry={industry} onIndustryChange={setIndustry} />

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <FavoriteList favorites={filtered} onRemove={handleRemove} />
      )}
    </div>
  );
}
