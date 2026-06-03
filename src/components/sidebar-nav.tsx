"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
}

/** Navegação lateral — itens do kit (`.nav-item`/`.on`), ativo = acento da unidade. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((it) => {
        const active =
          pathname === it.href || (it.href !== "/app" && pathname.startsWith(`${it.href}/`));
        return (
          <Link
            key={it.href}
            href={it.href as Route}
            className={`nav-item ${active ? "on" : ""}`.trim()}
            aria-current={active ? "page" : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
