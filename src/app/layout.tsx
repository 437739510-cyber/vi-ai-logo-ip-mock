import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "线上代客生成企业VI手册",
  description: "上传您的品牌素材，AI 为您生成专业 VI 手册",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
