import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/shared/ToastProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

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
    <html lang="zh-CN" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}