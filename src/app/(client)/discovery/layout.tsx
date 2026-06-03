/**
 * Brand Discovery 页面布局
 * 
 * 使用 ClientLayout 提供全局客户端状态（主题、侧边栏等）
 */
import ClientLayout from "@/components/shared/ClientLayout";

export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
