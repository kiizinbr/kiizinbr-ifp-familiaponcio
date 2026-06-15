import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma, podeGerenciarCurso } from "@/lib/capacitacao/rbac";
import { PageHead } from "../../_components/ui";
import { toggleCursoAtivoAction } from "../../actions";
import styles from "../../capacitacao.module.css";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

export default async function CursoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const { id } = await params;
  const curso = await db.curso.findUnique({
    where: { id },
    include: {
      turmas: {
        include: { instrutor: { select: { nomeExibicao: true } } },
        orderBy: { dataInicio: "desc" },
      },
    },
  });
  if (!curso) notFound();

  const ativasPorTurma = await db.matricula.groupBy({
    by: ["turmaId"],
    where: { turmaId: { in: curso.turmas.map((t) => t.id) }, status: { in: [...ATIVAS] } },
    _count: true,
  });
  const ativasMap = new Map(ativasPorTurma.map((g) => [g.turmaId, g._count]));

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow={`Capacitação · ${curso.area}`}
        title={curso.nome}
        desc={curso.descricao ?? undefined}
        action={
          <>
            {podeGerenciarCurso(session) ? (
              <form action={toggleCursoAtivoAction}>
                <input type="hidden" name="cursoId" value={curso.id} />
                <SubmitButton
                  variant={curso.ativo ? "ghost" : "primary"}
                  pendingLabel="Alterando status do curso…"
                >
                  {curso.ativo ? "Desativar curso" : "Reativar curso"}
                </SubmitButton>
              </form>
            ) : null}
            <Link href={"/capacitacao/cursos" as Route} className="btn btn-secondary">
              ← Catálogo
            </Link>
          </>
        }
      />

      <div className={styles.statRow}>
        <KpiCard label="carga horária" value={`${curso.cargaHorariaTotal}h`} />
        <div className="kpi">
          <div className="kpi-top">
            <span className="micro">modalidade</span>
          </div>
          <div className="t-h3" style={{ textTransform: "capitalize" }}>
            {curso.modalidade}
          </div>
        </div>
        <KpiCard label="turmas" value={curso.turmas.length} />
      </div>

      <div className="card">
        <header>
          <span className="tick" />
          <h3>TURMAS DESTE CURSO</h3>
          {podeCriarTurma(session) ? (
            <Link href={"/capacitacao/turmas/nova" as Route} className="act">
              + nova turma
            </Link>
          ) : null}
        </header>
        {curso.turmas.length === 0 ? (
          <EmptyState
            titulo="Nenhuma turma aberta"
            descricao="Este curso ainda não tem turmas. Abra uma turma para começar as matrículas."
          />
        ) : (
          <div className={styles.list}>
            {curso.turmas.map((t) => {
              const v = STATUS_TURMA_VISUAL[t.status];
              const ocupadas = ativasMap.get(t.id) ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/capacitacao/turmas/${t.id}` as Route}
                  className={styles.row}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{t.codigo}</div>
                    <div className={styles.rowMeta}>
                      <span>
                        {fmt.format(t.dataInicio)} – {fmt.format(t.dataFim)}
                      </span>
                      {t.instrutor ? (
                        <>
                          <span>·</span>
                          <span>{t.instrutor.nomeExibicao}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <span className="mono text-3" style={{ fontSize: 12 }}>
                      {ocupadas}/{t.capacidade}
                    </span>
                    <Badge variant={v.variant}>{v.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </CapacitacaoShell>
  );
}
