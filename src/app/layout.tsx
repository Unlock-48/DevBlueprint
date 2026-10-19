import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevBlueprint — Project Readiness",
  description: "วางแผนและตรวจความพร้อมของโปรเจกต์ให้เริ่มพัฒนาได้อย่างมั่นใจ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script dangerouslySetInnerHTML={{ __html: `try { var t = localStorage.getItem("devblueprint-theme"); if (t) document.documentElement.dataset.theme = t.toLowerCase(); } catch (_) {}` }} />{children}</body>
    </html>
  );
}
