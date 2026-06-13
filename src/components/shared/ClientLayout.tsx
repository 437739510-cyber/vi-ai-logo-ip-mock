"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-neutral-900">
            Brand Brain
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              首页
            </Link>
            <Link href="/interview" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              VI设计服务
            </Link>
            <Link href="/member/login" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              品牌管家
            </Link>
            <Link href="/progress" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              进度查询
            </Link>
            <Link
              href="/interview"
              className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              免费获取VI方案
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
              VI设计服务
            </Link>
            <Link href="/member/login" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              品牌管家
            </Link>
            <Link href="/progress" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              进度查询
            </Link>
            <Link
              href="/interview"
              className="block text-sm font-medium text-primary"
              onClick={() => setMenuOpen(false)}
            >
              免费获取VI方案 →
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* 底部悬浮CTA - 仅移动端 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-100 px-4 py-3">
        <Link
          href="/interview"
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white font-medium rounded-xl shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          免费获取VI方案
        </Link>
      </div>

      <footer className="border-t border-neutral-100 py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-neutral-400">
          <div className="space-y-1">
            <p>电话：400-666-1806 ｜ 工作时间：周一至周六 9:00-18:00{process.env.NEXT_PUBLIC_SHOW_WECHAT === 'true' && ' ｜ 客服微信：sweetheart4913'}</p>
            <p>&copy; 2026 Brand Brain 品牌脑 ｜ <Link href="/privacy" className="hover:text-neutral-600">隐私政策</Link> ｜ <Link href="/terms" className="hover:text-neutral-600">服务协议</Link></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
