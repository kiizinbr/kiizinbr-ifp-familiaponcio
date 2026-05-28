import Image from "next/image";
import type { Session } from "next-auth";
import { signOutAction } from "@/app/app/actions";
import { UnitSwitcher } from "@/components/unit-switcher";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { hasAnyRole } from "@/lib/rbac";
import { podeAgendar } from "@/lib/funil";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function AppShell({ session, children }: AppShellProps) {
  const displayName = session.user.name ?? session.user.email ?? "Usuário";

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

  return (
    <div className="flex min-h-screen bg-[rgb(var(--ifp-canvas))] text-[rgb(var(--ifp-ink))]">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-black/[0.07] bg-white/70 px-4 py-7 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-3 pb-7">
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={32} height={32} priority />
          <span className="text-[17px] font-extrabold tracking-tight">IFP Connect</span>
        </div>

        <SidebarNav items={items} />

        {session.user.roles.some((r) => r.name === "super_admin") && (
          <>
            <p className="mt-6 mb-2 px-3 text-[11px] font-bold text-[#b0a99c]">Unidades</p>
            <UnitSwitcher roles={session.user.roles} />
          </>
        )}

        <div className="mt-auto flex items-center gap-3 border-t border-black/[0.06] px-2 pt-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--ifp-ink))] text-xs font-bold text-white">
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-xs text-[rgb(var(--ifp-muted))] transition hover:text-[rgb(var(--ifp-laranja))]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1180px] px-10 py-12 lg:px-14">{children}</div>
      </main>
    </div>
  );
}
