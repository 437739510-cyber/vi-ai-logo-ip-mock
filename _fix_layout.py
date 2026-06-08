import os
base = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock'

# Use unicode escapes for Chinese text
title = 'VI ' + '\u89c6\u89c9\u8bc6\u522b\u624b\u518c' + ' - AI ' + '\u52a0\u901f\u6d77\u62a5\u8bbe\u8ba1'
desc = '\u4e0a\u4f20\u60a8\u7684\u54c1\u724c\u7d20\u6750' + '\uff0cAI ' + '\u4e3a\u60a8\u751f\u6210\u4e13\u4e1a VI \u624b\u518c'

content = '''import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

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
  title: "''' + title + '''",
  description: "''' + desc + '''",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
'''

path = os.path.join(base, 'src', 'app', 'layout.tsx')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Written layout.tsx')
