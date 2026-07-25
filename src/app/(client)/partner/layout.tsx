import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "合伙人计划",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
