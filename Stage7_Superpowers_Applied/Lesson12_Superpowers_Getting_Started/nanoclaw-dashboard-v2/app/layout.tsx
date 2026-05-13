import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NanoClaw Dashboard",
  description: "NanoClaw 控制台 v2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
