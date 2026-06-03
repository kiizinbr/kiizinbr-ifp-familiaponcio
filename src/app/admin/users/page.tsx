import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
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
  if (!hasAnyRole(session, "super_admin")) redirect("/");

  const users = await db.user.findMany({
    include: { userRoles: { include: { role: true } } },
    orderBy: { name: "asc" },
  });

  const agora = new Date();
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell session={session}>
      <div className="page-head">
        <div>
          <p className="micro" style={{ color: "var(--accent)" }}>
            Instituto Família Pôncio · Administração
          </p>
          <h1 className="t-h1" style={{ color: "var(--text)" }}>
            Usuários
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>
            {dataWeekday} · {dataFull}
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel principal</th>
              <th>Unidade(s)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const primary = user.primaryRoleName as RoleName | null;
              const primaryScope = user.primaryUnitScope as UnitScope | null;
              const isCurrentUser = user.id === session.user.id;

              return (
                <tr
                  key={user.id}
                  style={isCurrentUser ? { background: "var(--accent-soft)" } : undefined}
                >
                  <td>
                    <span className="cell-strong">{user.name ?? "—"}</span>
                    {isCurrentUser && (
                      <Badge variant="info" style={{ marginLeft: 8 }}>
                        você
                      </Badge>
                    )}
                  </td>
                  <td style={{ color: "var(--text-3)" }}>{user.email}</td>
                  <td>
                    {primary ? (
                      <Badge variant="default">{ROLE_DESCRIPTIONS[primary] ?? primary}</Badge>
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-3)" }}>
                    {primaryScope ? UNIT_LABELS[primaryScope] : "Todas / nenhuma"}
                  </td>
                  <td>
                    <Badge variant="success">
                      <span className="dot" />
                      Ativo
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p
        className="micro"
        style={{
          marginTop: "var(--sp-4)",
          color: "var(--text-3)",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          {users.length} pessoa{users.length === 1 ? "" : "s"} com acesso · edição em
          desenvolvimento
        </span>
        <span>Administração</span>
      </p>
    </AppShell>
  );
}
