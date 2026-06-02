import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import type { StatusMatricula } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { MATRICULA_VISUAL, STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { TRANSICOES_MATRICULA, STATUS_OCUPA_VAGA } from "@/lib/capacitacao/matricula";
import { podeCriarTurma, podeMatricular } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge, VagasMeter } from "../../_components/ui";
import {
  matricularAction,
  promoverListaEsperaAction,
  transicionarMatriculaAction,
} from "../../actions";
import styles from "../../capacitacao.module.css";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const NEGATIVAS = new Set<StatusMatricula>(["cancelado", "reprovado", "desistente"]);

const ERROS: Record<string, string> = {
  duplicada: "Esse cidadão já tem matrícula ativa nesta turma.",
  transicao: "Não foi possível mudar o status dessa matrícula.",
  promocao: "Não há ninguém na lista de espera ou a turma está lotada.",
};

function nome(c: { nomeCompleto: string; nomeSocial: string | null }): string {
  return c.nomeSocial?.trim() ? c.nomeSocial : c.nomeCompleto;
}

export default async function TurmaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const { id } = await params;
  const { erro } = await searchParams;

  const turma = await db.turma.findUnique({
    where: { id },
    include: {
      curso: { select: { id: true, nome: true, area: true } },
      instrutor: { select: { nomeExibicao: true } },
      matriculas: {
        include: { cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!turma) notFound();

  const podeMat = podeMatricular(session);
  const podeGerir = podeCriarTurma(session);

  const ocupadas = turma.matriculas.filter((m) => STATUS_OCUPA_VAGA.has(m.status)).length;
  const matriculados = turma.matriculas.filter(
    (m) => m.status !== "lista_espera" && m.status !== "cancelado",
  );
  const espera = turma.matriculas.filter((m) => m.status === "lista_espera");
  const jaNaTurma = turma.matriculas
    .filter((m) => m.status !== "cancelado")
    .map((m) => m.cidadaoId);

  const candidatos = podeMat
    ? await db.cidadao.findMany({
        where: { id: { notIn: jaNaTurma } },
        orderBy: { nomeCompleto: "asc" },
        take: 300,
        select: { id: true, nomeCompleto: true, nomeSocial: true },
      })
    : [];

  const vt = STATUS_TURMA_VISUAL[turma.status];

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow={`Capacitação · ${turma.curso.area}`}
          title={turma.curso.nome}
          desc={`Turma ${turma.codigo} · ${fmt.format(turma.dataInicio)} a ${fmt.format(turma.dataFim)}${
            turma.local ? ` · ${turma.local}` : ""
          }${turma.instrutor ? ` · ${turma.instrutor.nomeExibicao}` : ""}`}
          action={
            <Link href={"/capacitacao/turmas" as Route} className={`${styles.btn} ${styles.btnGhost}`}>
              ← Turmas
            </Link>
          }
        />

        {erro && ERROS[erro] ? (
          <div className={`${styles.alert} ${styles.alertError}`}>{ERROS[erro]}</div>
        ) : null}

        <div className={styles.grid2}>
          {/* coluna esquerda: vagas + matricular */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.tick} />
                <h2 className={styles.cardTitle}>OCUPAÇÃO</h2>
                <span className={styles.headNote}>
                  <KitBadge variant={vt.variant}>{vt.label}</KitBadge>
                </span>
              </div>
              <div className={styles.body}>
                <VagasMeter ocupadas={ocupadas} capacidade={turma.capacidade} />
                {espera.length > 0 ? (
                  <p className={styles.meterText} style={{ marginTop: 12 }}>
                    <b>{espera.length}</b> na lista de espera
                  </p>
                ) : null}
              </div>
            </div>

            {podeMat ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} />
                  <h2 className={styles.cardTitle}>MATRICULAR CIDADÃO</h2>
                </div>
                <div className={styles.body}>
                  {ocupadas >= turma.capacidade ? (
                    <p className={styles.desc} style={{ margin: "0 0 12px" }}>
                      Turma lotada — novas matrículas entram automaticamente na lista de espera.
                    </p>
                  ) : null}
                  <form action={matricularAction} className={styles.form}>
                    <input type="hidden" name="turmaId" value={turma.id} />
                    <label className={styles.label}>
                      <span className={styles.labelText}>Cidadão</span>
                      <select name="cidadaoId" required className={styles.select} defaultValue="">
                        <option value="" disabled>
                          Selecione…
                        </option>
                        {candidatos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {nome(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={candidatos.length === 0}
                    >
                      Matricular
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>

          {/* coluna direita: matriculados + lista de espera */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.tick} />
                <h2 className={styles.cardTitle}>MATRICULADOS</h2>
                <span className={styles.headNote}>{matriculados.length}</span>
              </div>
              {matriculados.length === 0 ? (
                <div className={styles.empty}>Ninguém matriculado ainda.</div>
              ) : (
                <div className={styles.list}>
                  {matriculados.map((m) => {
                    const vm = MATRICULA_VISUAL[m.status];
                    const alvos = [...TRANSICOES_MATRICULA[m.status]].filter(
                      (a) => a !== "lista_espera",
                    );
                    return (
                      <div key={m.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowTitle}>{nome(m.cidadao)}</div>
                          <div className={styles.rowMeta}>
                            <KitBadge variant={vm.variant}>{vm.label}</KitBadge>
                            {m.motivoSaida ? <span>· {m.motivoSaida}</span> : null}
                          </div>
                        </div>
                        {alvos.length > 0 ? (
                          <div className={styles.rowRight}>
                            <div className={styles.btnRow}>
                              {alvos.map((a) => (
                                <form key={a} action={transicionarMatriculaAction}>
                                  <input type="hidden" name="matriculaId" value={m.id} />
                                  <input type="hidden" name="turmaId" value={turma.id} />
                                  <input type="hidden" name="para" value={a} />
                                  <button
                                    type="submit"
                                    className={`${styles.btn} ${styles.btnSm} ${
                                      NEGATIVAS.has(a) ? styles.btnDanger : styles.btnGhost
                                    }`}
                                  >
                                    {MATRICULA_VISUAL[a].label}
                                  </button>
                                </form>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {espera.length > 0 ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} />
                  <h2 className={styles.cardTitle}>LISTA DE ESPERA</h2>
                  <span className={styles.headNote}>{espera.length}</span>
                </div>
                <div className={styles.list}>
                  {espera.map((m, i) => (
                    <div key={m.id} className={styles.row}>
                      <span className={`${styles.mono} ${styles.micro}`} style={{ width: 22 }}>
                        {i + 1}º
                      </span>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>{nome(m.cidadao)}</div>
                      </div>
                      <div className={styles.rowRight}>
                        <form action={transicionarMatriculaAction}>
                          <input type="hidden" name="matriculaId" value={m.id} />
                          <input type="hidden" name="turmaId" value={turma.id} />
                          <input type="hidden" name="para" value="cancelado" />
                          <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                          >
                            Remover
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
                {podeGerir ? (
                  <div className={styles.body} style={{ borderTop: "1px solid var(--line)" }}>
                    <form action={promoverListaEsperaAction}>
                      <input type="hidden" name="turmaId" value={turma.id} />
                      <button
                        type="submit"
                        className={`${styles.btn} ${styles.btnGhost}`}
                        disabled={ocupadas >= turma.capacidade}
                      >
                        Promover próximo da fila
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </CapacitacaoShell>
  );
}
