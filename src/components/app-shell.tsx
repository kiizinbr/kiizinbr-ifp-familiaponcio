import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Session } from "next-auth";
import { signOutAction } from "@/app/app/actions";
import { UnitSwitcher } from "@/components/unit-switcher";
import { hasAnyRole } from "@/lib/rbac";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

export function AppShell({ session, children }: AppShellProps) {
  const displayName = session.user.name ?? session.user.email ?? "Usuário";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo/ifp-symbol.png" alt="IFP" width={36} height={36} priority />
            <span className="text-lg font-semibold text-[rgb(var(--ifp-esportivo))]">
              IFP Connect
            </span>
            <div className="flex h-1 w-12 overflow-hidden rounded">
              <span className="flex-1 bg-[rgb(var(--ifp-medico))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-capacitacao))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-esportivo))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-recreativo))]" />
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <UnitSwitcher roles={session.user.roles} />
            <Link
              href={"/app/cidadaos" as Route}
              className="text-slate-600 transition hover:text-[rgb(var(--ifp-laranja))]"
            >
              Cidadãos
            </Link>
            {hasAnyRole(session, "super_admin", "gestor_geral") && (
              <Link
                href={"/admin/users" as Route}
                className="text-slate-600 transition hover:text-[rgb(var(--ifp-laranja))]"
              >
                Admin
              </Link>
            )}
            <span className="text-slate-600">{displayName}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded border border-slate-300 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">
        Instituto Família Pôncio · Uso interno
      </footer>
    </div>
  );
}
