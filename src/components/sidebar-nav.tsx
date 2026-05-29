"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active =
          pathname === it.href || (it.href !== "/app" && pathname.startsWith(`${it.href}/`));
        return (
          <Link
            key={it.href}
            href={it.href as Route}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-[rgb(var(--ifp-surface-100))] text-[rgb(var(--ifp-ink))]"
                : "text-[rgb(var(--ifp-muted))] hover:bg-[rgb(var(--ifp-surface-100))]"
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full ${
                active ? "bg-[rgb(var(--ifp-orange-500))]" : "bg-[rgb(var(--ifp-surface-200))]"
              }`}
            />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
