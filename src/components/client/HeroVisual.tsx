"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function HeroVisual() {
  return (
    <div className="relative w-[420px] h-[420px]">

      {/* Background circle */}
      <div className="absolute inset-0 rounded-full bg-brand-50/60" />

      {/* Floating VI manual mockup card */}
      <motion.div
        className="absolute top-10 right-0 w-56 h-72 bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden"
        initial={{ rotate: 3 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="h-3 bg-brand-500" />
        <div className="p-4 space-y-2">
          <div className="w-12 h-12 rounded-lg bg-brand-100 flex items-center justify-center mx-auto">
            <span className="text-brand-600 font-bold text-lg">B</span>
          </div>
          <div className="h-2 w-3/4 mx-auto bg-neutral-100 rounded" />
          <div className="h-2 w-1/2 mx-auto bg-neutral-100 rounded" />
          <div className="mt-3 space-y-1">
            <div className="h-1.5 w-full bg-brand-50 rounded" />
            <div className="h-1.5 w-5/6 bg-brand-50 rounded" />
            <div className="h-1.5 w-4/6 bg-brand-50 rounded" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="aspect-square rounded bg-accent-100" />
            <div className="aspect-square rounded bg-brand-100" />
            <div className="aspect-square rounded bg-success-light" />
          </div>
        </div>
      </motion.div>

      {/* Floating brand logo badge */}
      <motion.div
        className="absolute bottom-16 left-0 w-32 h-32 bg-white rounded-2xl shadow-md border border-neutral-100 p-3 flex items-center justify-center"
        initial={{ rotate: -5, y: 10 }}
        animate={{ rotate: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
      >
        <Image
          src="/brandbrain-logo.png"
          alt="Brand Brain Logo"
          width={96}
          height={96}
          className="object-contain"
        />
      </motion.div>

      {/* Small stats badge */}
      <motion.div
        className="absolute bottom-6 right-8 bg-white rounded-xl shadow-md border border-neutral-100 px-4 py-2.5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
            <span className="text-accent-600 font-bold text-sm">22+</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-800">页专业 VI 手册</p>
            <p className="text-[10px] text-neutral-400">含 LOGO · 色板 · 字体 · 物料</p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
