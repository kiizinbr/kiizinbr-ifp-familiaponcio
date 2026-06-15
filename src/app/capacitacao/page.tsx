import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { avaliarRiscoEvasao } from "@/lib/capacitacao/evasao";
import { PageHead } from "./_components/ui";
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
      <PageHead
        eyebrow="Capacitação"
        title="Painel da unidade"
        desc="Cursos, turmas e matrículas da capacitação profissional. Acompanhe a ocupação das próximas turmas e abra novas inscrições."
        action={
          podeCriarTurma(session) ? (
            <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary">
              Nova turma
            </Link>
          ) : null
        }
      />

      <div className={styles.statRow}>
        <KpiCard label="cursos no catálogo" value={cursosAtivos} />
        <KpiCard label="turmas ativas" value={turmasAbertas} />
        <KpiCard label="matrículas ativas" value={matriculasAtivas} />
      </div>

      {podeGerir ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <header>
            <span className="tick" />
            <h3>ALUNOS EM RISCO DE EVASÃO</h3>
            {emRisco.length > 0 ? (
              <span className="act" style={{ pointerEvents: "none" }}>
                <Badge variant="danger">{emRisco.length}</Badge>
              </span>
            ) : null}
          </header>
          {emRisco.length === 0 ? (
            <div className="body">
              <p className="t-body text-3" style={{ margin: 0 }}>
                Nenhum aluno em risco no momento. 👏
              </p>
            </div>
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
                      <span className="mono">· {a.codigo}</span>
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <Badge variant="danger">⚠ {a.motivos.join(" · ")}</Badge>
                  </div>
                </Link>
              ))}
              {emRisco.length > 10 ? (
                <div className="body">
                  <p className="t-small text-3" style={{ margin: 0 }}>
                    e mais {emRisco.length - 10}…
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="card">
        <header>
          <span className="tick" />
          <h3>PRÓXIMAS TURMAS</h3>
          <Link href={"/capacitacao/turmas" as Route} className="act">
            ver todas →
          </Link>
        </header>
        {proximas.length === 0 ? (
          <EmptyState
            titulo="Nenhuma turma ativa"
            descricao="Ainda não há turmas em planejamento ou andamento. Abra a primeira para começar a receber inscrições."
            cta={
              podeCriarTurma(session) ? (
                <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary">
                  Abrir a primeira turma
                </Link>
              ) : undefined
            }
          />
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
                      <span className="mono">{t.codigo}</span>
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
