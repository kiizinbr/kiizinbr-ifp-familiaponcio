import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { ROLE_DESCRIPTIONS, type RoleName, type UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // Proxy ja gateia mas defense-in-depth
  if (!hasAnyRole(session, "super_admin", "gestor_geral")) redirect("/");

  const users = await db.user.findMany({
    include: {
      userRoles: {
        include: { role: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">
          Administração
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">Usuários</h1>
        <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
          {users.length} pessoa{users.length === 1 ? "" : "s"} com acesso ao sistema. Edição ainda
          em desenvolvimento.
        </p>
      </header>

      <section className="ifp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-[rgb(var(--ifp-muted))] uppercase">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Nome</th>
              <th className="px-5 py-3 text-left font-medium">E-mail</th>
              <th className="px-5 py-3 text-left font-medium">Papel principal</th>
              <th className="px-5 py-3 text-left font-medium">Unidade(s)</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const primary = user.primaryRoleName as RoleName | null;
              const primaryScope = user.primaryUnitScope as UnitScope | null;
              const isCurrentUser = user.id === session.user.id;

              const allUnits = Array.from(
                new Set(
                  user.userRoles
                    .map((ur) => ur.unitScope as UnitScope | null)
                    .filter((u): u is UnitScope => Boolean(u)),
                ),
              );
              const isGlobal = user.userRoles.some((ur) =>
                ["super_admin", "presidencia", "gestor_geral", "social"].includes(ur.role.name),
              );

              return (
                <tr key={user.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[rgb(var(--ifp-ink))]">
                      {user.name ?? "—"}
                      {isCurrentUser && (
                        <span className="ml-2 rounded bg-[rgb(var(--ifp-laranja))]/10 px-1.5 py-0.5 text-xs font-medium text-[rgb(var(--ifp-laranja))]">
                          você
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[rgb(var(--ifp-muted))]">{user.email}</td>
                  <td className="px-5 py-3">
                    {primary ? (
                      <div>
                        <div className="font-medium text-slate-700">{primary}</div>
                        <div className="text-xs text-[rgb(var(--ifp-muted))]">
                          {ROLE_DESCRIPTIONS[primary]}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isGlobal && allUnits.length === 0 ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-[rgb(var(--ifp-muted))]">
                        Global
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allUnits.map((unit) => (
                          <span
                            key={unit}
                            className={`rounded px-2 py-0.5 text-xs font-medium text-white`}
                            style={{ background: `rgb(var(--ifp-${unit}))` }}
                          >
                            {UNIT_LABELS[unit]}
                            {primaryScope === unit && " ★"}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                      Ativo
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="mt-6 text-xs text-[rgb(var(--ifp-muted))]">
        ★ indica papel primário (landing após login). Multi-role mostra todos badges.
      </p>
    </AppShell>
  );
}
