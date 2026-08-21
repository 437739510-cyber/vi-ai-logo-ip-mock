"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Star, Users, Grid3X3,
  Wallet, Tag, GraduationCap, ChevronLeft, Menu, X, Palette,
  Briefcase, Coins, LogOut, Settings, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { AdminRole } from "@/lib/core/admin-roles";
import { getNavForRole } from "@/lib/core/admin-roles";

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, FolderKanban, Star, Users, Grid3X3,
  Wallet, Tag, GraduationCap, Briefcase, Coins, Palette, Settings, ShieldAlert,
};

const ROLE_LABEL: Record<AdminRole, string> = {
  admin: "VI 管理后台",
  student: "合伙人工作台",
};

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [role, setRole] = useState<AdminRole>("admin");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.role) {
          setRole(d.role);
          setUserName(d.name || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const navItems = getNavForRole(role);
  const isLoginPage = pathname === "/admin/login";
  const isActive = (href: string) => pathname.startsWith(href);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/admin/login", { method: "DELETE" });
      if (response.ok || response.status === 401) window.location.href = "/admin/login";
    } catch {
      // 保持当前页面，避免网络失败时假装服务端 HttpOnly 会话已清除。
    }
  };

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="hidden md:flex w-60 bg-white border-r border-neutral-200 flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-neutral-100">
          <Link href="/admin/dashboard" className="font-bold text-neutral-900">
            {ROLE_LABEL[role]}
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href) ? "bg-primary/10 text-primary" : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-neutral-100 space-y-1">
          {userName && (
            <div className="px-3 py-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{userName}</span>
              <span className="ml-1">({role === "admin" ? "管理员" : "合伙人"})</span>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-3 h-3" />
            退出登录
          </button>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors">
            <ChevronLeft className="w-3 h-3" />
            返回客户端
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base md:text-lg font-semibold text-neutral-900">
              {role === "student" ? "合伙人工作台" : "管理后台"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {userName && <span className="text-xs text-neutral-400 hidden md:inline">{userName}</span>}
            <button onClick={handleLogout} className="md:hidden p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-neutral-200 px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon];
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href) ? "bg-primary/10 text-primary" : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
            <Link href="/" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              返回客户端
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex z-50">
        {navItems.slice(0, 5).map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors",
                isActive(item.href) ? "text-primary" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              {Icon && <Icon className="w-5 h-5 mb-0.5" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
