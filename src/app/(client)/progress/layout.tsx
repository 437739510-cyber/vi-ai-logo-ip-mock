import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "订单进度查询",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
