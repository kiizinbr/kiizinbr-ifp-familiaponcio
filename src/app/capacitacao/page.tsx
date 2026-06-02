import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "./_components/ui";
import styles from "./capacitacao.module.css";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default async function CapacitacaoHome() {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const [cursosAtivos, turmasAbertas, matriculasAtivas, proximas, ativasPorTurma] =
    await Promise.all([
      db.curso.count({ where: { ativo: true } }),
      db.turma.count({
        where: { status: { in: ["planejada", "inscricoes_abertas", "em_andamento"] } },
      }),
      db.matricula.count({ where: { status: { in: [...ATIVAS] } } }),
      db.turma.findMany({
        where: { status: { in: ["planejada", "inscricoes_abertas", "em_andamento"] } },
        include: { curso: { select: { nome: true } } },
        orderBy: { dataInicio: "asc" },
        take: 6,
      }),
      db.matricula.groupBy({
        by: ["turmaId"],
        where: { status: { in: [...ATIVAS] } },
        _count: true,
      }),
    ]);

  const ativasMap = new Map(ativasPorTurma.map((g) => [g.turmaId, g._count]));

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação"
          title="Painel da unidade"
          desc="Cursos, turmas e matrículas da capacitação profissional. Acompanhe a ocupação das próximas turmas e abra novas inscrições."
          action={
            podeCriarTurma(session) ? (
              <Link href={"/capacitacao/turmas/nova" as Route} className={`${styles.btn} ${styles.btnPrimary}`}>
                Nova turma
              </Link>
            ) : null
          }
        />

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statNum}>{cursosAtivos}</div>
            <div className={styles.statLabel}>cursos no catálogo</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{turmasAbertas}</div>
            <div className={styles.statLabel}>turmas ativas</div>
          </div>
          <div className={styles.stat}>
            <div className={`${styles.statNum} ${styles.statAccent}`}>{matriculasAtivas}</div>
            <div className={styles.statLabel}>matrículas ativas</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.tick} />
            <h2 className={styles.cardTitle}>PRÓXIMAS TURMAS</h2>
            <Link href={"/capacitacao/turmas" as Route} className={styles.headNote}>
              ver todas →
            </Link>
          </div>
          {proximas.length === 0 ? (
            <div className={styles.empty}>
              Nenhuma turma ativa.{" "}
              {podeCriarTurma(session) ? (
                <Link href={"/capacitacao/turmas/nova" as Route} className={styles.link}>
                  Abrir a primeira turma
                </Link>
              ) : null}
            </div>
          ) : (
            <div className={styles.list}>
              {proximas.map((t) => {
                const v = STATUS_TURMA_VISUAL[t.status];
                const ocupadas = ativasMap.get(t.id) ?? 0;
                return (
                  <Link key={t.id} href={`/capacitacao/turmas/${t.id}` as Route} className={styles.row}>
                    <span className={styles.dot} />
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{t.curso.nome}</div>
                      <div className={styles.rowMeta}>
                        <span className={styles.mono}>{t.codigo}</span>
                        <span>·</span>
                        <span>
                          {fmt.format(t.dataInicio)} – {fmt.format(t.dataFim)}
                        </span>
                        {t.local ? (
                          <>
                            <span>·</span>
                            <span>{t.local}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.rowRight}>
                      <span className={`${styles.mono} ${styles.meterText}`} style={{ margin: 0 }}>
                        {ocupadas}/{t.capacidade}
                      </span>
                      <KitBadge variant={v.variant}>{v.label}</KitBadge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CapacitacaoShell>
  );
}
