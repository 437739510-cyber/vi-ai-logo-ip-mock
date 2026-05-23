"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Star,
  Users,
  ChevronLeft,
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

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* 侧边栏 */}
      <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col shrink-0">
        {/* 品牌标识 */}
        <div className="h-16 flex items-center px-5 border-b border-neutral-100">
          <Link href="/admin/dashboard" className="font-bold text-neutral-900">
            VI 管理后台
          </Link>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
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

        {/* 返回客户端 */}
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
        {/* 顶栏 */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center px-6 shrink-0">
          <h1 className="text-lg font-semibold text-neutral-900">管理后台</h1>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
