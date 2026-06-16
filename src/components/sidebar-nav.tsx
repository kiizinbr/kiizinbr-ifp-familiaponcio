"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export interface NavItem {
  label: string;
  href: string;
}

/** Seção de navegação agrupada — rótulo (`.sb-group`) + itens (`.nav-item`). */
export interface NavGroup {
  /** Rótulo do grupo (vira `.sb-group`). Omitido = sem rótulo (itens soltos). */
  label?: string;
  items: NavItem[];
}

/** Decide se o item está ativo pela rota atual (mesma regra usada nos dois renders). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
}

/** Link de item de navegação — `.nav-item`/`.on`, ativo = acento da unidade. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href as Route}
      className={clsx("nav-item", active && "on")}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}

/** Navegação lateral — itens do kit (`.nav-item`/`.on`), ativo = acento da unidade. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navegação principal"
      style={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {items.map((it) => (
        <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
      ))}
    </nav>
  );
}

/**
 * Navegação lateral AGRUPADA — reusa o `.sb-group` do kit como rótulo de cada
 * seção e o mesmo `.nav-item` do `SidebarNav`. Grupos sem itens (ex.: após o
 * gating por papel esvaziar a seção) são omitidos junto com o rótulo, pra não
 * deixar um `.sb-group` órfão. Para o app não-agrupado continue usando
 * `SidebarNav(items)`.
 */
export function SidebarNavGroups({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname() ?? "";
  const visible = groups.filter((g) => g.items.length > 0);

  return (
    <nav
      aria-label="Navegação principal"
      style={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {visible.map((group, idx) => (
        <div
          key={group.label ?? `grupo-${idx}`}
          style={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {group.label ? <div className="sb-group">{group.label}</div> : null}
          {group.items.map((it) => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
          ))}
        </div>
      ))}
    </nav>
  );
}
