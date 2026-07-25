import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "会员登录",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
