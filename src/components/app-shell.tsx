import Image from "next/image";
import type { Session } from "next-auth";
import { signOutAction } from "@/app/app/actions";
import { UnitSwitcher } from "@/components/unit-switcher";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { StagingBanner } from "@/components/staging-banner";
import { hasAnyRole } from "@/lib/rbac";
import { podeAgendar } from "@/lib/funil";
import type { UnidadeSlug } from "@/lib/unidades";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
  /** Override opcional da navegação (ex.: contexto da unidade). */
  items?: NavItem[];
  /** Rótulo da seção (grupo) acima da nav. */
  sectionLabel?: string;
  /** Slug da unidade — seta data-unit + data-unit-accent (acento por unidade). */
  unit?: UnidadeSlug;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Navegação padrão do app (visão cross-unidade). */
function defaultItems(session: Session): NavItem[] {
  const items: NavItem[] = [
    { label: "Visão geral", href: "/app" },
    { label: "Cidadãos", href: "/app/cidadaos" },
  ];
  if (podeAgendar(session)) {
    items.push({ label: "Vagas", href: "/app/vagas" });
  }
  if (hasAnyRole(session, "super_admin", "social")) {
    items.push({ label: "Serviço Social", href: "/social" });
  }
  if (hasAnyRole(session, "super_admin")) {
    items.push({ label: "Admin", href: "/admin/users" });
  }
  return items;
}

/**
 * Shell base de toda tela autenticada — Design Kit (`.shell` + `.sidebar` +
 * `.content`). `unit` seta o contrato `data-unit`/`data-unit-accent` (acento da
 * unidade nos itens ativos, faixa da sidebar, botões). `.ifp-kit` aplica o
 * canvas + tipografia do kit.
 */
export function AppShell({
  session,
  children,
  items: itemsOverride,
  sectionLabel,
  unit,
}: AppShellProps) {
  const displayName = session.user.name ?? session.user.email ?? "Usuário";
  const items: NavItem[] = itemsOverride ?? defaultItems(session);
  const isSuper = session.user.roles.some((r) => r.name === "super_admin");

  return (
    <>
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <StagingBanner />
      <div className="shell ifp-kit" data-unit={unit} {...(unit ? { "data-unit-accent": "" } : {})}>
        <aside className="sidebar">
          <div className="sb-brand">
            <span className="symbol">
              <Image src="/logo/ifp-symbol.png" alt="IFP" width={23} height={23} priority />
            </span>
            <b>IFP Connect</b>
          </div>

          {sectionLabel ? <div className="sb-group">{sectionLabel}</div> : null}
          <SidebarNav items={items} />

          {isSuper ? (
            <>
              <div className="sb-group">Unidades</div>
              <UnitSwitcher roles={session.user.roles} />
            </>
          ) : null}

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <ThemeToggle />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="avatar sm">{initials(displayName)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName}
                </p>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--text-3)",
                      fontFamily: "inherit",
                    }}
                  >
                    Sair
                  </button>
                </form>
              </div>
            </div>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1}>
          <div className="content">{children}</div>
        </main>
      </div>
    </>
  );
}
