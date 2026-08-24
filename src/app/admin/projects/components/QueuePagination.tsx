"use client";

import { cn } from "@/lib/core/utils";

interface QueuePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZES = [20, 50, 100];

export function QueuePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: QueuePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pages: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="text-sm text-neutral-500">共 {total} 条 · 第 {safePage}/{pageCount} 页</div>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1.5 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
        >
          上一页
        </button>
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
              n === safePage ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
