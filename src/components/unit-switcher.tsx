"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RoleAssignment } from "@/lib/rbac-types";
import { UNIDADE_SLUGS, UNIDADES } from "@/lib/unidades";

export function UnitSwitcher({ roles }: { roles: RoleAssignment[] }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isSuperAdmin = roles.some((r) => r.name === "super_admin");

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape fecha o menu e devolve o foco ao gatilho (padrão WAI-ARIA de menu).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!isSuperAdmin) return null;

  const activeSlug = UNIDADE_SLUGS.find((slug) => pathname.startsWith(`/${slug}`));
  const activeLabel = activeSlug ? UNIDADES[activeSlug].nome : "Início";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="unit-switcher"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
      >
        <span className="flex items-center gap-3">
          <span className="h-[7px] w-[7px] rounded-full bg-[rgb(var(--ifp-orange-500))]" />
          {activeLabel}
        </span>
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
        >
          {UNIDADE_SLUGS.map((slug) => {
            const isActive = activeSlug === slug;
            return (
              <Link
                key={slug}
                href={`/${slug}` as Route}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-[rgb(var(--ifp-orange-500))]/10 font-medium text-[rgb(var(--ifp-orange-500))]"
                    : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {UNIDADES[slug].nome}
              </Link>
            );
          })}
          <Link
            href={"/" as Route}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-sm transition ${
              !activeSlug
                ? "bg-[rgb(var(--ifp-orange-500))]/10 font-medium text-[rgb(var(--ifp-orange-500))]"
                : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            }`}
          >
            Início
          </Link>
        </div>
      )}
    </div>
  );
}
