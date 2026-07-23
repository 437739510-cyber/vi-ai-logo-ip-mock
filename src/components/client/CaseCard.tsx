"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CaseCardProps {
  company: string;
  industryLabel: string;
  deliverables: string[];
  pageCount: number;
  coverImage: string;
  onClick: () => void;
}

export function CaseCard({
  company,
  industryLabel,
  deliverables,
  pageCount,
  coverImage,
  onClick,
}: CaseCardProps) {
  return (
    <motion.div
      layout
      className="group relative bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-sm cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-50">
        <Image
          src={coverImage}
          alt={"美容养生" + company}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5">
            查看详情 <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            {industryLabel}
          </span>
          <span className="text-xs text-neutral-400">{pageCount}页</span>
        </div>
        <h3 className="text-sm font-semibold text-neutral-900">{company}</h3>
        <div className="flex flex-wrap gap-1">
          {deliverables.map((d) => (
            <span
              key={d}
              className="text-[11px] text-neutral-500 bg-neutral-50 px-1.5 py-0.5 rounded"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
