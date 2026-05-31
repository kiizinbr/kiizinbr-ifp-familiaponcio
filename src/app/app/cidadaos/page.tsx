import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { EditorialCanvas, Masthead } from "@/components/editorial";
import styles from "@/components/editorial/editorial.module.css";
import { listCidadaos, calcularIdade, type CidadaoStatus } from "@/lib/cidadao";
import { statusDisplay, type StatusTone } from "@/lib/cidadao-status";
import { formatCpf } from "@/lib/cpf";
import { UNIT_SCOPES, type UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

const TONE_CLASS: Record<StatusTone, string> = {
  red: styles.toneRed ?? "",
  amber: styles.toneAmber ?? "",
  emerald: styles.toneEmerald ?? "",
  slate: styles.toneSlate ?? "",
};

type CicloFilter = "rascunho" | "ativo" | "inativo";

interface SearchParams {
  q?: string;
  unidade?: string;
  status?: CidadaoStatus;
  ciclo?: string;
  cursor?: string;
}

const CICLO_VALUES: CicloFilter[] = ["rascunho", "ativo", "inativo"];

export default async function CidadaosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const selectedUnits = params.unidade
    ? (params.unidade.split(",").filter((u) => UNIT_SCOPES.includes(u as UnitScope)) as UnitScope[])
    : undefined;

  const ciclo = CICLO_VALUES.includes(params.ciclo as CicloFilter)
    ? (params.ciclo as CicloFilter)
    : undefined;

  const { items, nextCursor } = await listCidadaos(
    {
      search: params.q,
      unitScopes: selectedUnits,
      status: params.status,
      statusCadastro: ciclo,
      cursor: params.cursor,
      limit: 50,
    },
    session,
  );

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
          kicker="Instituto Família Pôncio · Pessoas atendidas"
          title="Cidadãos"
          dateWeekday={dataWeekday}
          dateFull={dataFull}
          showClock={false}
          action={
            <Link href={"/app/cidadaos/novo" as Route} className={styles.btnPrimary}>
              + Novo cidadão
            </Link>
          }
        />

        <form method="get" className={styles.toolbar}>
          <div className={`${styles.field} ${styles.fieldGrow}`}>
            <label className={styles.fieldLabel}>Buscar (nome, CPF, telefone)</label>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Ex: Maria Silva ou 123.456.789-09"
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Unidade</label>
            <select name="unidade" defaultValue={params.unidade ?? ""} className={styles.select}>
              <option value="">Todas</option>
              {UNIT_SCOPES.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <select name="status" defaultValue={params.status ?? "ativo"} className={styles.select}>
              <option value="ativo">Ativos</option>
              <option value="deletado">Excluídos</option>
              <option value="anonimizado">Anonimizados (LGPD)</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Ciclo</label>
            <select name="ciclo" defaultValue={params.ciclo ?? ""} className={styles.select}>
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <button type="submit" className={styles.btnGhost}>
            Filtrar
          </button>
        </form>

        <p className={styles.fieldLabel} style={{ marginTop: "20px" }}>
          {items.length} {items.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}
        </p>

        <div className={styles.tableWrap}>
          {items.length === 0 ? (
            <p className={styles.tableEmpty}>Nenhum cidadão encontrado com esses filtros.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nome</th>
                  <th className={styles.th}>CPF</th>
                  <th className={styles.th}>Idade</th>
                  <th className={styles.th}>Telefone</th>
                  <th className={styles.th}>Unidade</th>
                  <th className={styles.th}>Família</th>
                  <th className={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const unit = c.unitIdOrigem as UnitScope;
                  const status = statusDisplay(c);
                  return (
                    <tr key={c.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdName}`}>
                        <Link href={`/app/cidadaos/${c.id}` as Route} className={styles.panelLink}>
                          {c.nomeCompleto}
                        </Link>
                        {c.nomeSocial && (
                          <div className={styles.tdMuted}>Social: {c.nomeSocial}</div>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{formatCpf(c.cpf)}</td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>
                        {calcularIdade(c.dataNascimento)} anos
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{c.telefonePrincipal}</td>
                      <td className={styles.td}>
                        <span
                          className={styles.unitPill}
                          style={{ background: `rgb(var(--ifp-filter-${unit}))` }}
                        >
                          {UNIT_LABELS[unit]}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>
                        {c.familia?.nomeReferencia ?? "—"}
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.tonePill} ${TONE_CLASS[status.tone]}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {nextCursor && (
          <div className={styles.loadMore}>
            <Link href={`/app/cidadaos?cursor=${nextCursor}` as Route} className={styles.btnGhost}>
              Carregar mais
            </Link>
          </div>
        )}
      </EditorialCanvas>
    </AppShell>
  );
}
