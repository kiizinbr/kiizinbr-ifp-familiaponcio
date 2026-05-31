import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";
import { EditorialCanvas, Masthead, Colophon } from "@/components/editorial";
import styles from "@/components/editorial/editorial.module.css";
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
      <EditorialCanvas fullBleed>
        <Masthead
          kicker="Instituto Família Pôncio · Administração"
          title="Usuários"
          dateWeekday={dataWeekday}
          dateFull={dataFull}
          showClock={false}
        />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Nome</th>
                <th className={styles.th}>E-mail</th>
                <th className={styles.th}>Papel principal</th>
                <th className={styles.th}>Unidade(s)</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const primary = user.primaryRoleName as RoleName | null;
                const primaryScope = user.primaryUnitScope as UnitScope | null;
                const isCurrentUser = user.id === session.user.id;

                return (
                  <tr key={user.id} className={isCurrentUser ? styles.trCurrent : styles.tr}>
                    <td className={`${styles.td} ${styles.tdName}`}>
                      {user.name ?? "—"}
                      {isCurrentUser && <span className={styles.youTag}>você</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdMuted}`}>{user.email}</td>
                    <td className={styles.td}>
                      {primary ? (
                        <span className={styles.rolePill}>
                          {ROLE_DESCRIPTIONS[primary] ?? primary}
                        </span>
                      ) : (
                        <span className={styles.tdMuted}>—</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {primaryScope ? UNIT_LABELS[primaryScope] : "Todas / nenhuma"}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.statusDot}>Ativo</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Colophon
          left={`${users.length} pessoa${users.length === 1 ? "" : "s"} com acesso · edição em desenvolvimento`}
          right="Administração"
        />
      </EditorialCanvas>
    </AppShell>
  );
}
