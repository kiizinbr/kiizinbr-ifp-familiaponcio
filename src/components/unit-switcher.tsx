"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RoleAssignment, UnitScope } from "@/lib/rbac-types";

interface SwitcherOption {
  label: string;
  href: string;
  isActive: boolean;
}

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
};

function buildOptions(roles: RoleAssignment[], currentPath: string): SwitcherOption[] {
  const hasGlobal = roles.some((r) =>
    ["super_admin", "presidencia", "gestor_geral"].includes(r.name),
  );
  const hasSocial = roles.some((r) => r.name === "social");

  const options: SwitcherOption[] = [];

  if (hasGlobal) {
    options.push({
      label: "Visão geral",
      href: "/app",
      isActive: currentPath === "/app",
    });
  }

  if (hasGlobal || hasSocial) {
    options.push({
      label: "Serviço Social",
      href: "/app/social",
      isActive: currentPath.startsWith("/app/social"),
    });
  }

  // Unidades acessíveis
  const units: UnitScope[] = hasGlobal
    ? ["medico", "capacitacao", "esportivo", "recreativo"]
    : Array.from(new Set(roles.map((r) => r.unitScope).filter((u): u is UnitScope => Boolean(u))));

  for (const unit of units) {
    options.push({
      label: UNIT_LABELS[unit],
      href: `/app/${unit}`,
      isActive: currentPath.startsWith(`/app/${unit}`),
    });
  }

  return options;
}

export function UnitSwitcher({ roles }: { roles: RoleAssignment[] }) {
  const pathname = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = buildOptions(roles, pathname);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Se só uma opção, não mostra switcher (sem necessidade)
  if (options.length <= 1) {
    return options[0] ? <span className="text-sm text-slate-700">{options[0].label}</span> : null;
  }

  const activeLabel = options.find((o) => o.isActive)?.label ?? options[0]?.label ?? "Selecionar";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="unit-switcher"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <span>{activeLabel}</span>
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
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href as never}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm transition ${
                option.isActive
                  ? "bg-[rgb(var(--ifp-laranja))]/10 font-medium text-[rgb(var(--ifp-laranja))]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
