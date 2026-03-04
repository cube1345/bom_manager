import type { Metadata } from "next";
import TopNav from "@/components/top-nav";
import UiPreferenceBootstrap from "@/components/ui-preference-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOM Manager",
  description: "Local component, PCB, and purchase record management tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <UiPreferenceBootstrap />
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
