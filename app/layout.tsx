import type { Metadata } from "next";
import TopNav from "@/components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "电子元器件智能管理系统",
  description: "本地化电子元器件与采购记录管理工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <div className="mac-bg" />
          <div className="container">
            <TopNav />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
