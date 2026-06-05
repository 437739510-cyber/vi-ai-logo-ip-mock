"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-neutral-900">
            官氏VI手册生成
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              首页
            </Link>
            <Link href="/interview" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              品牌访谈
            </Link>
            <Link href="/progress" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              进度查询
            </Link>
            <Link href="/student/register" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              大学生加入
            </Link>
            <Link
              href="/consultation"
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              立即咨询
            </Link>
          </nav>

          <button
            className="md:hidden p-2 text-neutral-600"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-neutral-100 bg-white px-4 py-4 space-y-3">
            <Link href="/" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              首页
            </Link>
            <Link href="/interview" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              品牌访谈
            </Link>
            <Link href="/progress" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              进度查询
            </Link>
            <Link href="/student/register" className="block text-sm text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>
              大学生加入
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-neutral-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-neutral-400">
          <p>&copy; 2026 官氏VI手册生成服务. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
