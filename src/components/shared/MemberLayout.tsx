"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Image,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/member/dashboard", label: "我的内容", icon: Image },
  { href: "/member/upload", label: "拍照上传", icon: Camera },
  { href: "/member/orders", label: "订单记录", icon: FileText },
];

export function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [memberName, setMemberName] = useState("老板");
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaTotal, setQuotaTotal] = useState(2);
  const [plan, setPlan] = useState("free");

  const isLoginPage = pathname === "/member/login";
  const isActive = (href: string) => pathname.startsWith(href);

  // 检查登录状态
  useEffect(() => {
    if (isLoginPage) return;
    fetch("/api/member/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          window.location.href = "/member/login";
        } else {
          setMemberName(data.member?.name || data.member?.phone || "老板");
          setQuotaUsed(data.member?.quota_used || 0);
          setQuotaTotal(data.member?.quota_total || 2);
          setPlan(data.member?.plan || "free");
        }
      })
      .catch(() => {
        window.location.href = "/member/login";
      });
  }, [isLoginPage]);

  const handleLogout = async () => {
    await fetch("/api/member/logout", { method: "POST" });
    window.location.href = "/member/login";
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-bold text-neutral-900">品牌管家</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">{quotaUsed}/{quotaTotal}条</span>
            {plan === "free" && <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400">免费</span>}
            <span className="text-sm text-neutral-700">{memberName}</span>
            <button onClick={handleLogout} className="text-neutral-400 hover:text-neutral-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 移动端下拉菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-neutral-200 px-4 py-2 space-y-1">
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
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
            >
              <Home className="w-4 h-4" />
              返回首页
            </Link>
          </div>
        )}
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* 底部Tab导航 */}
      <nav className="sticky bottom-0 bg-white border-t border-neutral-200 flex z-50">
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
