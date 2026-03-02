"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/types", label: "类型管理" },
  { href: "/components", label: "元器件列表" },
  { href: "/components/manage", label: "元器件管理" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="top-nav panel">
      <div className="brand">BOM Manager</div>
      <nav>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
