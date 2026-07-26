import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理后台",
};

import { AdminLayout } from "@/components/shared/AdminLayout";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
