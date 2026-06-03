/**
 * Brand Discovery 页面布局
 * 
 * 简单的布局，不使用 admin 侧边栏
 */

import { ClientLayout } from "@/components/shared/ClientLayout";

export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
