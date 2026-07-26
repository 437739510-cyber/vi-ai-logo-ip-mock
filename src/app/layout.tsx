import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/shared/ToastProvider";

export const metadata: Metadata = {
  title: {
    template: "Brand Brain · %s",
    default: "Brand Brain · AI品牌VI手册自动生成",
  },
  description: "上传您的品牌素材，AI 为您生成专业 VI 手册",
  openGraph: {
    title: "Brand Brain · AI品牌VI手册自动生成",
    description: "AI 为您生成专业 VI 手册，从 Logo 到名片一套搞定",
    images: [{ url: "/brandbrain-logo.png" }],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/brandbrain-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
