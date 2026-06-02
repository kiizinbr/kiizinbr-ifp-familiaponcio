import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "../_components/ui";
import styles from "../capacitacao.module.css";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

export default async function TurmasPage() {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

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

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação · Turmas"
          title="Turmas"
          desc="Instâncias datadas dos cursos, com vagas e matrículas. Abra uma turma para gerenciar inscrições e a lista de espera."
          action={
            podeCriarTurma(session) ? (
              <Link
                href={"/capacitacao/turmas/nova" as Route}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Nova turma
              </Link>
            ) : null
          }
        />

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.tick} />
            <h2 className={styles.cardTitle}>TODAS AS TURMAS</h2>
            <span className={styles.headNote}>{turmas.length} no total</span>
          </div>
          {turmas.length === 0 ? (
            <div className={styles.empty}>
              Nenhuma turma cadastrada.
              {podeCriarTurma(session) ? (
                <>
                  {" "}
                  <Link href={"/capacitacao/turmas/nova" as Route} className={styles.link}>
                    Abrir a primeira
                  </Link>
                </>
              ) : null}
            </div>
          ) : (
            <div className={styles.list}>
              {turmas.map((t) => {
                const v = STATUS_TURMA_VISUAL[t.status];
                const ocupadas = ativasMap.get(t.id) ?? 0;
                return (
                  <Link
                    key={t.id}
                    href={`/capacitacao/turmas/${t.id}` as Route}
                    className={styles.row}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{t.curso.nome}</div>
                      <div className={styles.rowMeta}>
                        <span className={styles.mono}>{t.codigo}</span>
                        <span>·</span>
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
                      <span className={styles.mono} style={{ fontSize: 12, color: "var(--text-3)" }}>
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
