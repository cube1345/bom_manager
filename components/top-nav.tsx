"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tr, useUiLang } from "@/lib/ui-language";

const navItems = [
  { href: "/pcbs", label: { zh: "PCB管理", en: "PCB" } },
  { href: "/stores", label: { zh: "店铺评价", en: "Stores" } },
  { href: "/types", label: { zh: "类型管理", en: "Types" } },
  { href: "/components/manage", label: { zh: "元器件管理", en: "Manage" } },
  { href: "/settings", label: { zh: "设置", en: "Settings" } },
];

export default function TopNav() {
  const pathname = usePathname();
  const lang = useUiLang();

  return (
    <header className="top-nav panel">
      <div className="brand">BOM Manager</div>
      <nav>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
              {item.label[lang]}
            </Link>
          );
        })}
        <Link href="/" className={pathname === "/" ? "nav-link active nav-link-home" : "nav-link nav-link-home"}>
          {tr(lang, "返回首页", "Home")}
        </Link>
      </nav>
    </header>
  );
}
