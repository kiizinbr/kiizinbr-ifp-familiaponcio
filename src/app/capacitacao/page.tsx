import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { avaliarRiscoEvasao } from "@/lib/capacitacao/evasao";
import { PageHead, KitBadge } from "./_components/ui";
import styles from "./capacitacao.module.css";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function nome(c: { nomeCompleto: string; nomeSocial: string | null }): string {
  return c.nomeSocial?.trim() ? c.nomeSocial : c.nomeCompleto;
}

export default async function CapacitacaoHome() {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
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

  const podeGerir = podeCriarTurma(session);
  let emRisco: {
    id: string;
    nome: string;
    turmaId: string;
    curso: string;
    codigo: string;
    motivos: string[];
  }[] = [];
  if (podeGerir) {
    const ms = await db.matricula.findMany({
      where: { status: { in: [...ATIVAS] }, turma: { status: "em_andamento" } },
      // Salvaguarda contra query ilimitada (era sem take). orderBy dá um cap
      // determinístico; cobertura total do risco em escala maior pede
      // materialização/job periódico (follow-up documentado no relatório de QA).
      orderBy: { id: "asc" },
      take: 500,
      select: {
        id: true,
        turmaId: true,
        cidadao: { select: { nomeCompleto: true, nomeSocial: true } },
        turma: { select: { codigo: true, curso: { select: { nome: true } } } },
        presencas: { select: { presente: true }, orderBy: { data: "asc" } },
      },
    });
    emRisco = ms
      .map((m) => ({ m, r: avaliarRiscoEvasao(m.presencas) }))
      .filter((x) => x.r.emRisco)
      .map((x) => ({
        id: x.m.id,
        nome: nome(x.m.cidadao),
        turmaId: x.m.turmaId,
        curso: x.m.turma.curso.nome,
        codigo: x.m.turma.codigo,
        motivos: x.r.motivos,
      }));
  }

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação"
          title="Painel da unidade"
          desc="Cursos, turmas e matrículas da capacitação profissional. Acompanhe a ocupação das próximas turmas e abra novas inscrições."
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

        {podeGerir ? (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.tick} />
              <h2 className={styles.cardTitle}>ALUNOS EM RISCO DE EVASÃO</h2>
              {emRisco.length > 0 ? (
                <span className={styles.headNote}>
                  <KitBadge variant="danger">{emRisco.length}</KitBadge>
                </span>
              ) : null}
            </div>
            {emRisco.length === 0 ? (
              <div className={styles.empty}>Nenhum aluno em risco no momento. 👏</div>
            ) : (
              <div className={styles.list}>
                {emRisco.slice(0, 10).map((a) => (
                  <Link
                    key={a.id}
                    href={`/capacitacao/turmas/${a.turmaId}` as Route}
                    className={styles.row}
                  >
                    <span className={styles.dot} />
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{a.nome}</div>
                      <div className={styles.rowMeta}>
                        <span>{a.curso}</span>
                        <span className={styles.mono}>· {a.codigo}</span>
                      </div>
                    </div>
                    <div className={styles.rowRight}>
                      <KitBadge variant="danger">⚠ {a.motivos.join(" · ")}</KitBadge>
                    </div>
                  </Link>
                ))}
                {emRisco.length > 10 ? (
                  <div className={styles.empty}>e mais {emRisco.length - 10}…</div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

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
                  <Link
                    key={t.id}
                    href={`/capacitacao/turmas/${t.id}` as Route}
                    className={styles.row}
                  >
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
