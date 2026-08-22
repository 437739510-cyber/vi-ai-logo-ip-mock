"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LogIn } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { UnifiedLoginPanel } from "@/components/client/UnifiedLoginPanel";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 导航栏 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/brandbrain-icon.png"
              alt=""
              className="h-9 w-9"
              aria-hidden="true"
            />
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold text-neutral-900 tracking-tight">
                Brand Brain
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5">
                品牌顾问
              </span>
            </div>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              首页
            </Link>
            <Link href="/consultation" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              提交需求
            </Link>
            <Link href="/progress" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              进度查询
            </Link>
            <button
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
            <Link
              href="/consultation"
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              立即咨询
            </Link>
          </nav>

          {/* 移动端菜单按钮 */}
          <button
            className="md:hidden p-2 text-neutral-600"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* 移动端菜单 */}
        {menuOpen && (
          <div className="md:hidden border-t border-neutral-100 bg-white px-4 py-4 space-y-3">
            <Link href="/" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              首页
            </Link>
            <Link href="/consultation" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              提交需求
            </Link>
            <Link href="/progress" className="block text-sm text-neutral-600" onClick={() => setMenuOpen(false)}>
              进度查询
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                setLoginOpen(true);
              }}
              className="flex items-center gap-1.5 text-sm text-neutral-600"
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
          </div>
        )}
      </header>

      {/* 主内容 */}
      <main className="flex-1">{children}</main>

      {/* 底部 */}
      <footer className="border-t border-neutral-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-400">
            <Link href="/disclaimer" className="hover:text-neutral-600 transition-colors">免责声明</Link>
            <span className="text-neutral-200">|</span>
            <Link href="/consultation" className="hover:text-neutral-600 transition-colors">联系我们</Link>
          </div>
          <img
            src="/brandbrain-logo.png"
            alt="Brand Brain · 品牌顾问"
            className="h-8 w-auto mx-auto mb-2"
          />
          <p className="text-xs text-neutral-400">&copy; 2026 Brand Brain · 品牌顾问. All rights reserved.</p>
        </div>
      </footer>

      <UnifiedLoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
