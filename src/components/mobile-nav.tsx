"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { signOutAction } from "@/app/app/actions";
import {
  SidebarNav,
  SidebarNavGroups,
  type NavItem,
  type NavGroup,
} from "@/components/sidebar-nav";
import { UnitSwitcher } from "@/components/unit-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { RoleAssignment } from "@/lib/rbac-types";

interface MobileNavProps {
  items: NavItem[];
  /** Navegação AGRUPADA (opt-in, espelha o AppShell): presente = drawer usa grupos. */
  groups?: NavGroup[];
  /** Destino do brand clicável (home da unidade / landing). Espelha o AppShell. */
  homeHref?: Route;
  /** Rótulo da seção (grupo) acima da nav, espelha o AppShell. */
  sectionLabel?: string;
  /** Visível só para super_admin (espelha o AppShell). */
  isSuper: boolean;
  roles: RoleAssignment[];
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DRAWER_ID = "mobile-drawer";

/**
 * Navegação mobile do shell — faixa com hambúrguer (`.mobile-topbar`) + drawer
 * lateral (`.drawer`) que reusa a MESMA nav da sidebar (`SidebarNav`), o
 * `UnitSwitcher` (super), `ThemeToggle` e o `signOutAction`. Peça IRMÃ da
 * `<aside class="sidebar">` (não a envolve): a sidebar é `display:none` ≤880px e
 * esta faixa/drawer só aparecem nesse breakpoint (CSS). Acima de 880px tudo aqui
 * é `display:none` — o desktop não muda.
 *
 * A11y (espelha o ConfirmDialog do kit): `role="dialog"` + `aria-modal`, Escape
 * fecha, clique no scrim fecha, foco preso (Tab/Shift-Tab), foco inicial no
 * primeiro foco do drawer e devolvido ao hambúrguer ao fechar, `overflow:hidden`
 * no body enquanto aberto. Fecha sozinho ao trocar de rota.
 */
export function MobileNav({
  items,
  groups,
  homeHref,
  sectionLabel,
  isSuper,
  roles,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Fecha ao navegar (evita drawer aberto após trocar de tela).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Foco inicial no primeiro elemento do drawer; devolve ao hambúrguer ao fechar.
  useEffect(() => {
    if (!open) return;
    const burger = burgerRef.current;
    const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables?.[0]?.focus();
    return () => burger?.focus();
  }, [open]);

  // Escape fecha; Tab fica preso dentro do drawer (focus trap simples).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <div className="mobile-topbar">
        {homeHref ? (
          <Link href={homeHref} className="mobile-topbar-brand" aria-label="Ir para o início">
            <span className="symbol">
              <Image src="/logo/ifp-symbol.png" alt="IFP" width={23} height={23} priority />
            </span>
            <b>IFP Connect</b>
          </Link>
        ) : (
          <span className="mobile-topbar-brand">
            <span className="symbol">
              <Image src="/logo/ifp-symbol.png" alt="IFP" width={23} height={23} priority />
            </span>
            <b>IFP Connect</b>
          </span>
        )}
        <button
          ref={burgerRef}
          type="button"
          className="mobile-topbar-burger tap-area"
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls={DRAWER_ID}
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className={clsx("drawer-scrim", open && "is-open")} onClick={close} aria-hidden="true" />

      <aside
        ref={drawerRef}
        id={DRAWER_ID}
        className={clsx("drawer", open && "is-open")}
        role="dialog"
        aria-modal="true"
        aria-label="Navegação"
      >
        <div className="drawer-head">
          {/* Brand do drawer fica como <span> de propósito: o logo clicável vive
              na faixa do topo (.mobile-topbar). Manter este não-focável preserva
              a ordem do focus-trap (foco inicial = botão Fechar, primeiro focável). */}
          <span className="mobile-topbar-brand">
            <span className="symbol">
              <Image src="/logo/ifp-symbol.png" alt="IFP" width={23} height={23} />
            </span>
            <b>IFP Connect</b>
          </span>
          <button
            type="button"
            className="drawer-close tap-area"
            aria-label="Fechar menu"
            onClick={close}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {groups ? (
          <SidebarNavGroups groups={groups} />
        ) : (
          <>
            {sectionLabel ? <div className="sb-group">{sectionLabel}</div> : null}
            <SidebarNav items={items} />
          </>
        )}

        {isSuper ? (
          <>
            <div className="sb-group">Unidades</div>
            <UnitSwitcher roles={roles} />
          </>
        ) : null}

        <div className="drawer-foot">
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="btn-link-muted tap-area">
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
