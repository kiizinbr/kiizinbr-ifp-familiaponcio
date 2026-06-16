import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import type { StatusTurma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "../_components/ui";
import styles from "../capacitacao.module.css";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

// C9 — chips de filtro por status (estado na URL). Ordem de fluxo da turma.
const STATUS_CHIPS: StatusTurma[] = [
  "planejada",
  "inscricoes_abertas",
  "em_andamento",
  "concluida",
  "cancelada",
];

export default async function TurmasPage({
  searchParams,
}: {
  // C9 — busca por nome/código (?q) e filtro por status (?status), estado na URL.
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const { q, status } = await searchParams;
  const busca = (q ?? "").trim();
  const statusFiltro = STATUS_CHIPS.includes(status as StatusTurma)
    ? (status as StatusTurma)
    : undefined;

  const [turmas, ativasPorTurma] = await Promise.all([
    db.turma.findMany({
      include: { curso: { select: { nome: true } }, instrutor: { select: { nomeExibicao: true } } },
      orderBy: [{ status: "asc" }, { dataInicio: "desc" }],
    }),
    db.matricula.groupBy({
      by: ["turmaId"],
      where: { status: { in: [...ATIVAS] } },
      _count: true,
    }),
  ]);
  const ativasMap = new Map(ativasPorTurma.map((g) => [g.turmaId, g._count]));

  const podeCriar = podeCriarTurma(session);

  // C9 — filtro de exibição (server-side): busca casa nome do curso OU código;
  // chip casa o status. Não toca a query nem a ordenação.
  const buscaLower = busca.toLowerCase();
  const turmasFiltradas = turmas.filter((t) => {
    const casaBusca =
      !buscaLower ||
      t.curso.nome.toLowerCase().includes(buscaLower) ||
      t.codigo.toLowerCase().includes(buscaLower);
    const casaStatus = !statusFiltro || t.status === statusFiltro;
    return casaBusca && casaStatus;
  });
  const temFiltro = busca.length > 0 || statusFiltro !== undefined;

  const chipHref = (s?: StatusTurma): Route => {
    const params = new URLSearchParams();
    if (busca) params.set("q", busca);
    if (s) params.set("status", s);
    const qs = params.toString();
    return (qs ? `/capacitacao/turmas?${qs}` : "/capacitacao/turmas") as Route;
  };

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Turmas"
        eyebrowHref="/capacitacao"
        title="Turmas"
        desc="Instâncias datadas dos cursos, com vagas e matrículas. Abra uma turma para gerenciar inscrições e a lista de espera."
        action={
          podeCriar ? (
            <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary">
              Nova turma
            </Link>
          ) : null
        }
      />

      {turmas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma turma cadastrada"
          descricao="As instâncias datadas dos cursos aparecem aqui. Abra a primeira para começar a matricular."
          cta={
            podeCriar ? (
              <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary btn-sm">
                Abrir a primeira
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <form method="get" className={styles.filterBar} role="search">
            {statusFiltro ? <input type="hidden" name="status" value={statusFiltro} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={busca}
              placeholder="Buscar por curso ou código…"
              aria-label="Buscar turmas"
              className="input"
            />
            <button type="submit" className="btn btn-secondary btn-sm">
              Buscar
            </button>
            {temFiltro ? (
              <Link href={"/capacitacao/turmas" as Route} className="btn btn-secondary btn-sm">
                Limpar
              </Link>
            ) : null}
          </form>

          <div className={styles.chipRow}>
            <Link
              href={chipHref()}
              className={clsx(styles.chip, !statusFiltro && styles.chipAtivo)}
              aria-current={!statusFiltro ? "page" : undefined}
            >
              Todas
            </Link>
            {STATUS_CHIPS.map((s) => (
              <Link
                key={s}
                href={chipHref(s)}
                className={clsx(styles.chip, statusFiltro === s && styles.chipAtivo)}
                aria-current={statusFiltro === s ? "page" : undefined}
              >
                {STATUS_TURMA_VISUAL[s].label}
              </Link>
            ))}
          </div>

          {turmasFiltradas.length === 0 ? (
            <EmptyState
              titulo="Nenhuma turma encontrada"
              descricao="Ajuste a busca ou o filtro de status para ver mais turmas."
            />
          ) : (
            <div className="card">
              <header>
                <span className="tick" />
                <h3>TODAS AS TURMAS</h3>
                <span className="act" style={{ cursor: "default", color: "var(--text-3)" }}>
                  {turmasFiltradas.length}
                  {temFiltro ? ` de ${turmas.length}` : " no total"}
                </span>
              </header>
              <div className="table-wrap" style={{ border: 0, borderRadius: 0, boxShadow: "none" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Período</th>
                      <th>Instrutor</th>
                      <th style={{ textAlign: "right" }}>Vagas</th>
                      <th style={{ textAlign: "right" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turmasFiltradas.map((t) => {
                      const v = STATUS_TURMA_VISUAL[t.status];
                      const ocupadas = ativasMap.get(t.id) ?? 0;
                      const lotada = ocupadas >= t.capacidade && t.capacidade > 0;
                      return (
                        // C9 — destaque de hover na linha (rowLink). A navegação é o
                        // único <Link> do nome (1 só nome acessível pro e2e). NÃO usa
                        // overlay ::after sobre a <tr>: `position:relative` numa <tr>
                        // não estabelece containing block de forma confiável entre
                        // engines, então o overlay poderia capturar cliques fora da
                        // linha. O kit prefere o link direto na célula.
                        <tr key={t.id} className={styles.rowLink}>
                          <td>
                            <Link
                              href={`/capacitacao/turmas/${t.id}` as Route}
                              className={clsx("cell-strong", "text-accent", styles.rowLinkName)}
                              style={{ textDecoration: "none" }}
                            >
                              {t.curso.nome}
                            </Link>
                            <div className="mono text-3" style={{ fontSize: 11, marginTop: 2 }}>
                              {t.codigo}
                            </div>
                          </td>
                          <td className="cell-mono">
                            {fmt.format(t.dataInicio)} – {fmt.format(t.dataFim)}
                          </td>
                          <td style={{ color: "var(--text-3)" }}>
                            {t.instrutor?.nomeExibicao ?? "—"}
                          </td>
                          <td
                            className={clsx("cell-mono", lotada && styles.vagasLotada)}
                            style={{ textAlign: "right" }}
                          >
                            {ocupadas}/{t.capacidade}
                            {lotada ? " · lotada" : ""}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <KitBadge variant={v.variant}>{v.label}</KitBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </CapacitacaoShell>
  );
}
