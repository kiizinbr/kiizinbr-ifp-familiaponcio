import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import type { StatusMatricula } from "@prisma/client";
import { auth } from "@/lib/auth";
import { qrDataUrl } from "@/lib/pdf/qr";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { MATRICULA_VISUAL, STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { TRANSICOES_MATRICULA, STATUS_OCUPA_VAGA } from "@/lib/capacitacao/matricula";
import { proximosStatusTurma } from "@/lib/capacitacao/turma";
import { avaliarRiscoEvasao } from "@/lib/capacitacao/evasao";
import { deriveTrilha } from "@/lib/capacitacao/trilha";
import { frequenciaMediaTurma } from "@/lib/capacitacao/presenca";
import {
  podeCriarTurma,
  podeEmitirCertificado,
  podeMatricular,
  podeRegistrarPresencaNaTurma,
  podeTransicionarMatricula,
} from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge, VagasMeter } from "../../_components/ui";
import {
  promoverListaEsperaAction,
  transicionarMatriculaAction,
  transicionarTurmaAction,
} from "../../actions";
import styles from "../../capacitacao.module.css";
import { MatricularCombobox } from "./matricular-combobox";
import { PresencaCard } from "./presenca-card";
import { CertificadoControl } from "./certificado-control";
import { TrilhaFormatura } from "./trilha-formatura";
import { CertificadoCelebracao } from "./certificado-celebracao";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const NEGATIVAS = new Set<StatusMatricula>(["cancelado", "reprovado", "desistente"]);

const ERROS: Record<string, string> = {
  duplicada: "Esse cidadão já tem matrícula ativa nesta turma.",
  transicao: "Não foi possível mudar o status dessa matrícula.",
  promocao: "Não há ninguém na lista de espera ou a turma está lotada.",
  status: "Não foi possível mudar o status da turma.",
  presenca: "Não foi possível registrar a presença (data inválida).",
  cert: "Não foi possível emitir o certificado.",
  cert_inelegivel: "Sem certificado: matrícula não concluída ou frequência abaixo de 80%.",
};

function nome(c: { nomeCompleto: string; nomeSocial: string | null }): string {
  return c.nomeSocial?.trim() ? c.nomeSocial : c.nomeCompleto;
}

export default async function TurmaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    erro?: string;
    presenca?: string;
    cert?: string;
    vaga_liberada?: string;
    turma_concluida?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const { id } = await params;
  const { erro, presenca, cert, vaga_liberada, turma_concluida } = await searchParams;

  const turma = await db.turma.findUnique({
    where: { id },
    include: {
      curso: { select: { id: true, nome: true, area: true } },
      instrutor: { select: { nomeExibicao: true, userId: true } },
      matriculas: {
        include: {
          cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
          presencas: { select: { presente: true, data: true }, orderBy: { data: "asc" } },
          certificado: { select: { codigo: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!turma) notFound();

  const podeMat = podeMatricular(session);
  const podeGerir = podeCriarTurma(session);
  // M6 — userId do instrutor dono da turma, para gatear os botões de transição
  // (instrutor só transiciona as PRÓPRIAS turmas). instrutor é opcional no schema.
  const instrutorUserId = turma.instrutor?.userId ?? undefined;

  const ocupadas = turma.matriculas.filter((m) => STATUS_OCUPA_VAGA.has(m.status)).length;
  const matriculados = turma.matriculas.filter(
    (m) => m.status !== "lista_espera" && m.status !== "cancelado",
  );
  const espera = turma.matriculas.filter((m) => m.status === "lista_espera");
  const emRiscoCount = matriculados.filter((m) => avaliarRiscoEvasao(m.presencas).emRisco).length;

  const vt = STATUS_TURMA_VISUAL[turma.status];
  const proximosStatus = podeGerir ? proximosStatusTurma(turma.status) : [];
  const podeReg = podeRegistrarPresencaNaTurma(session, turma.instrutor?.userId ?? null);
  const podeEmitirCert = podeEmitirCertificado(session);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const presencaRoster = matriculados.map((m) => ({
    id: m.id,
    nome: nome(m.cidadao),
    presencas: m.presencas,
  }));

  // Trilha derivada (F2, read-only): aulas = datas distintas de chamada;
  // formatura = dataFim. deriveTrilha precisa do conjunto achatado de datas (correto).
  const presencasTurma = matriculados.flatMap((m) => m.presencas);
  const trilha = deriveTrilha({
    datasPresenca: presencasTurma.map((p) => p.data),
    dataFim: turma.dataFim,
  });
  // B8 — frequência da turma = média das %/aluno (não soma de linhas, que achatava
  // matrículas tardias). Só exibição agregada; não toca a regra de 80% do certificado.
  const frequenciaTurma = frequenciaMediaTurma(matriculados);

  // Momento WOW pós-emissão: ?cert=CODIGO (do redirect da emissão) abre a tela de
  // celebração (confetti + parabéns + compartilhar/baixar). Lê só o snapshot já
  // gravado — não toca a emissão nem a regra de elegibilidade. URLs absolutas
  // (QR/WhatsApp) derivam do origin do request.
  const certEmitido = cert
    ? await db.certificado.findUnique({
        where: { codigo: cert },
        select: {
          codigo: true,
          nomeAluno: true,
          nomeCurso: true,
          cargaHoraria: true,
          percentualFrequencia: true,
          emitidoEm: true,
        },
      })
    : null;

  if (certEmitido) {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const base = host ? `${proto}://${host}` : "";
    const verificacaoUrl = `${base}/verificar/${certEmitido.codigo}`;
    const qr = await qrDataUrl(verificacaoUrl);
    const primeiroNome = certEmitido.nomeAluno.trim().split(/\s+/)[0] ?? certEmitido.nomeAluno;

    return (
      <CapacitacaoShell session={session}>
        <CertificadoCelebracao
          cert={certEmitido}
          qr={qr}
          verificacaoUrl={verificacaoUrl}
          pdfUrl={`${base}/verificar/${certEmitido.codigo}/pdf`}
          primeiroNome={primeiroNome}
        />
      </CapacitacaoShell>
    );
  }

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
            <Link href={"/capacitacao/turmas" as Route} className="btn btn-secondary">
              ← Turmas
            </Link>
          }
        />

        {erro && ERROS[erro] ? (
          <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {ERROS[erro]}
          </div>
        ) : null}
        {presenca === "ok" ? (
          <div role="status" className={styles.alert}>
            Presença do dia registrada.
          </div>
        ) : null}
        {turma_concluida ? (
          <div role="status" className={styles.alert}>
            Turma concluída. {turma_concluida}{" "}
            {Number(turma_concluida) === 1 ? "aluno ainda estava" : "alunos ainda estavam"}{" "}
            &quot;cursando&quot; — finalize as matrículas para emitir certificados.
          </div>
        ) : null}
        {vaga_liberada ? (
          <div role="status" className={styles.alert}>
            Vaga liberada · {vaga_liberada} na lista de espera. Use &quot;Promover próximo da
            fila&quot; para chamar o próximo.
          </div>
        ) : null}

        <div className={styles.grid2}>
          {/* coluna esquerda: vagas + matricular */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="card">
              <header>
                <span className="tick" />
                <h3>OCUPAÇÃO</h3>
                <span className="act" style={{ cursor: "default" }}>
                  <KitBadge variant={vt.variant}>{vt.label}</KitBadge>
                </span>
              </header>
              <div className="body">
                <VagasMeter ocupadas={ocupadas} capacidade={turma.capacidade} />
                {espera.length > 0 ? (
                  <p className={styles.meterText} style={{ marginTop: 12 }}>
                    <b>{espera.length}</b> na lista de espera
                  </p>
                ) : null}
                {proximosStatus.length > 0 ? (
                  <div className={styles.btnRow} style={{ marginTop: 14, flexWrap: "wrap" }}>
                    {proximosStatus.map((st) => (
                      <form key={st} action={transicionarTurmaAction}>
                        <input type="hidden" name="turmaId" value={turma.id} />
                        <input type="hidden" name="para" value={st} />
                        <SubmitButton
                          variant={st === "cancelada" ? "danger" : "ghost"}
                          size="sm"
                          pendingLabel="Mudando status da turma…"
                        >
                          {STATUS_TURMA_VISUAL[st].label}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {podeMat ? (
              <div className="card">
                <header>
                  <span className="tick" />
                  <h3>MATRICULAR CIDADÃO</h3>
                </header>
                <div className="body">
                  {ocupadas >= turma.capacidade ? (
                    <p className={styles.desc} style={{ margin: "0 0 12px" }}>
                      Turma lotada — novas matrículas entram automaticamente na lista de espera.
                    </p>
                  ) : null}
                  <MatricularCombobox turmaId={turma.id} />
                </div>
              </div>
            ) : null}
          </div>

          {/* coluna direita: trilha + matriculados + lista de espera */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {matriculados.length > 0 ? (
              <TrilhaFormatura
                aulasRegistradas={trilha.aulasRegistradas}
                formatura={trilha.formatura}
                percentualTurma={frequenciaTurma}
              />
            ) : null}

            <div className="card">
              <header>
                <span className="tick" />
                <h3>MATRICULADOS</h3>
                <span className="act mono text-3" style={{ cursor: "default" }}>
                  {matriculados.length}
                </span>
                {emRiscoCount > 0 ? (
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <KitBadge variant="danger">⚠ {emRiscoCount} em risco</KitBadge>
                  </span>
                ) : null}
              </header>
              {matriculados.length === 0 ? (
                <div className="empty">
                  <p className="e-msg">Ninguém matriculado ainda.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {matriculados.map((m) => {
                    const vm = MATRICULA_VISUAL[m.status];
                    // M6 — gate por permissão (instrutor só as próprias turmas; recepção
                    // só confirmado/cancelado): não renderiza botão que a action negaria.
                    const alvos = [...TRANSICOES_MATRICULA[m.status]]
                      .filter((a) => a !== "lista_espera")
                      .filter((a) =>
                        podeTransicionarMatricula(session, m.status, a, instrutorUserId),
                      );
                    const risco = avaliarRiscoEvasao(m.presencas);
                    return (
                      <div key={m.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowTitle}>{nome(m.cidadao)}</div>
                          <div className={styles.rowMeta}>
                            <KitBadge variant={vm.variant}>{vm.label}</KitBadge>
                            {m.motivoSaida ? <span>· {m.motivoSaida}</span> : null}
                            <CertificadoControl
                              matriculaId={m.id}
                              turmaId={turma.id}
                              status={m.status}
                              presencas={m.presencas}
                              certificadoCodigo={m.certificado?.codigo ?? null}
                              podeEmitir={podeEmitirCert}
                            />
                            {risco.emRisco ? (
                              <KitBadge variant="danger">⚠ {risco.motivos.join(" · ")}</KitBadge>
                            ) : null}
                          </div>
                        </div>
                        {alvos.length > 0 ? (
                          <div className={styles.rowRight}>
                            <div className={styles.btnRow}>
                              {alvos.map((a) =>
                                NEGATIVAS.has(a) ? (
                                  <ConfirmDialog
                                    key={a}
                                    action={transicionarMatriculaAction}
                                    danger
                                    triggerSize="sm"
                                    title={`${MATRICULA_VISUAL[a].label}: ${nome(m.cidadao)}`}
                                    message={`Confirmar mudança da matrícula para "${MATRICULA_VISUAL[a].label}"? Isso afeta o histórico do aluno.`}
                                    confirmLabel={MATRICULA_VISUAL[a].label}
                                    triggerLabel={MATRICULA_VISUAL[a].label}
                                    hiddenFields={{
                                      matriculaId: m.id,
                                      turmaId: turma.id,
                                      para: a,
                                    }}
                                  />
                                ) : (
                                  <form key={a} action={transicionarMatriculaAction}>
                                    <input type="hidden" name="matriculaId" value={m.id} />
                                    <input type="hidden" name="turmaId" value={turma.id} />
                                    <input type="hidden" name="para" value={a} />
                                    <SubmitButton
                                      variant="ghost"
                                      size="sm"
                                      pendingLabel="Mudando status da matrícula…"
                                    >
                                      {MATRICULA_VISUAL[a].label}
                                    </SubmitButton>
                                  </form>
                                ),
                              )}
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
              <div className="card">
                <header>
                  <span className="tick" />
                  <h3>LISTA DE ESPERA</h3>
                  <span className="act mono text-3" style={{ cursor: "default" }}>
                    {espera.length}
                  </span>
                </header>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {espera.map((m, i) => (
                    <div key={m.id} className={styles.row}>
                      <span className="micro" style={{ width: 22 }}>
                        {i + 1}º
                      </span>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>{nome(m.cidadao)}</div>
                      </div>
                      <div className={styles.rowRight}>
                        {podeTransicionarMatricula(
                          session,
                          "lista_espera",
                          "cancelado",
                          instrutorUserId,
                        ) ? (
                          <ConfirmDialog
                            action={transicionarMatriculaAction}
                            danger
                            triggerSize="sm"
                            title={`Remover ${nome(m.cidadao)} da lista de espera`}
                            message="O aluno será removido da lista de espera desta turma."
                            confirmLabel="Remover"
                            triggerLabel="Remover"
                            hiddenFields={{
                              matriculaId: m.id,
                              turmaId: turma.id,
                              para: "cancelado",
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {podeGerir ? (
                  <div className="body" style={{ borderTop: "1px solid var(--line)" }}>
                    <form action={promoverListaEsperaAction}>
                      <input type="hidden" name="turmaId" value={turma.id} />
                      <SubmitButton
                        variant={vaga_liberada ? "primary" : "ghost"}
                        disabled={ocupadas >= turma.capacidade}
                        pendingLabel="Promovendo próximo da fila…"
                      >
                        Promover próximo da fila
                      </SubmitButton>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {podeReg && presencaRoster.length > 0 ? (
          <PresencaCard turmaId={turma.id} matriculados={presencaRoster} hoje={hojeISO} />
        ) : null}
      </div>
    </CapacitacaoShell>
  );
}
