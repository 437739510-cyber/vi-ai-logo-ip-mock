"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Star,
  Users,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "工作台", icon: LayoutDashboard },
  { href: "/admin/projects", label: "项目列表", icon: FolderKanban },
  { href: "/admin/favorites", label: "收藏", icon: Star },
  { href: "/admin/clients", label: "客户管理", icon: Users },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex w-60 bg-white border-r border-neutral-200 flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-neutral-100">
          <Link href="/admin/dashboard" className="font-bold text-neutral-900">
            VI 管理后台
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-neutral-100">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            返回客户端
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏（桌面 + 移动） */}
        <header className="h-14 md:h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base md:text-lg font-semibold text-neutral-900">管理后台</h1>
          </div>
          {/* 移动端底部导航显示当前页面标识 */}
          <span className="md:hidden text-xs text-neutral-400">
            {NAV_ITEMS.find((item) => isActive(item.href))?.label || ""}
          </span>
        </header>

        {/* 移动端下拉菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-neutral-200 px-3 py-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              返回客户端
            </Link>
          </div>
        )}

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* 移动端底部导航栏 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex z-50">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors",
                isActive(item.href)
                  ? "text-primary"
                  : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
