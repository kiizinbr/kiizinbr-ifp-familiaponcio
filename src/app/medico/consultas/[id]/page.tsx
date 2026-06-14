import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { MedicoShell } from "@/components/medico/medico-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  podeTransicionarConsulta,
  podeMarcarConsulta,
  podeEditarNota,
  podeVerProntuario,
  podeEncaminhar,
  podeEmitirDocumento,
} from "@/lib/medico/rbac";
import { CONSULTA_VISUAL, PROXIMOS_STATUS_CONSULTA } from "@/lib/medico/ui";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { calcularImc } from "@/lib/medico/prontuario";
import { transitionAction, cancelAction } from "./actions";
import {
  adicionarAddendoAction,
  assinarNotaAction,
  salvarRascunhoAction,
} from "./prontuario-actions";
import { emitirReceitaAction, emitirAtestadoAction } from "./documento-actions";
import { marcarCheckinAction, desfazerCheckinAction } from "./checkin-action";
import styles from "./prontuario.module.css";
import { EncaminhamentoPanel } from "./_encaminhamento-panel";
import { Cid10Combobox } from "./cid10-combobox";
import { ReceitaItens } from "./receita-itens";
import { AssinarButton } from "./assinar-button";

const ACAO_LABEL: Record<string, string> = {
  confirmada: "Confirmar",
  em_atendimento: "Iniciar atendimento",
  faltou: "Marcar falta",
};

const VITAIS: { key: string; label: string; unit: string; ph: string }[] = [
  { key: "paSistolica", label: "PA sist", unit: "mmHg", ph: "120" },
  { key: "paDiastolica", label: "PA diast", unit: "mmHg", ph: "80" },
  { key: "fcBpm", label: "FC", unit: "bpm", ph: "72" },
  { key: "frIrpm", label: "FR", unit: "irpm", ph: "16" },
  { key: "tempC", label: "Temp", unit: "°C", ph: "36.5" },
  { key: "spo2", label: "SpO₂", unit: "%", ph: "98" },
  { key: "pesoKg", label: "Peso", unit: "kg", ph: "70" },
  { key: "alturaCm", label: "Altura", unit: "cm", ph: "170" },
];

function idade(d: Date | null): number | null {
  if (!d) return null;
  const hoje = new Date();
  let a = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
  return a;
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}

function chipsDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function ConsultaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; doc?: string; reagendada?: string }>;
}) {
  const { id } = await params;
  const { erro, doc, reagendada } = await searchParams;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const consulta = await db.consulta.findUnique({
    where: { id },
    include: {
      slot: true,
      cidadao: true,
      profissional: { include: { user: true } },
      especialidade: true,
      notaEvolucao: {
        include: { diagnosticos: true, addendos: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!consulta) notFound();

  // A1 IDOR guard (read-side): o gate de rota (canAccessUnidade) NÃO confere a
  // unidade do OBJETO. Esta tela expõe PHI (saúde do cidadão, nota assinada,
  // histórico clínico cross-consulta, receitas/atestados) e dispara
  // medical_data_accessed. Exige acesso à unidade do cidadão antes de qualquer
  // leitura clínica/log — espelha pacientes/[id]/page.tsx (catch → notFound,
  // não vaza existência de consulta de outra unidade).
  try {
    await assertAcessoCidadao(session, consulta.cidadaoId, "view");
  } catch {
    notFound();
  }

  const historico = await db.notaEvolucao.findMany({
    where: { cidadaoId: consulta.cidadaoId, NOT: { consultaId: consulta.id } },
    include: {
      profissional: true,
      consulta: {
        include: { especialidade: true, slot: { select: { dataHoraInicio: true } } },
      },
    },
    // Data CLÍNICA (slot da consulta), nunca NotaEvolucao.createdAt: nas notas
    // migradas da Amplimed o createdAt é a data em que a migração RODOU.
    orderBy: { consulta: { slot: { dataHoraInicio: "desc" } } },
    take: 5,
  });

  const [especialidadesAtivas, encaminhamentos, receitas, atestados] = await Promise.all([
    db.especialidade.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    db.encaminhamento.findMany({
      where: { consultaOrigemId: consulta.id },
      include: { especialidade: { select: { nome: true, corDestaque: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.receita.findMany({
      where: { consultaId: consulta.id },
      select: { id: true, emitidoEm: true },
      orderBy: { emitidoEm: "desc" },
    }),
    db.atestado.findMany({
      where: { consultaId: consulta.id },
      select: { id: true, emitidoEm: true, diasAfastamento: true },
      orderBy: { emitidoEm: "desc" },
    }),
  ]);
  const podeEnc = podeEncaminhar(session);
  const podeEmitir = podeEmitirDocumento(session, consulta.profissional.userId);

  // Registra acesso a dado de saúde (LGPD §0.8) — só quem pode ver conteúdo clínico.
  const podeVer = podeVerProntuario(session);
  if (podeVer) {
    await logEvent({
      userId: session.user.id,
      action: "medical_data_accessed",
      entityType: "prontuario",
      entityId: consulta.id,
      rootEntityType: "cidadao",
      rootEntityId: consulta.cidadaoId,
      meta: { especialidade: consulta.especialidade.nome },
    });
  }

  const nota = consulta.notaEvolucao;
  const assinada = nota?.status === "assinada";
  const emAtendimento = consulta.status === "em_atendimento";
  const podeEditar =
    emAtendimento &&
    !assinada &&
    podeEditarNota(session, consulta.profissional.userId, nota?.status ?? "rascunho");
  const cidadao = consulta.cidadao;
  const pesoNum = nota?.pesoKg != null ? Number(nota.pesoKg) : null;
  const imc = calcularImc(pesoNum, nota?.alturaCm ?? null);
  const visual = CONSULTA_VISUAL[consulta.status];
  const proximos = PROXIMOS_STATUS_CONSULTA[consulta.status].filter((p) => p !== "realizada");
  const naoCancelados = proximos.filter((p) => p !== "cancelada");
  const podeCancelar = proximos.includes("cancelada");
  const podeReagendar = STATUS_REAGENDAVEL.has(consulta.status) && podeMarcarConsulta(session);
  const podeCheckin =
    podeMarcarConsulta(session) &&
    (consulta.status === "agendada" || consulta.status === "confirmada");

  const vitalVal = (key: string): string => {
    const v = nota ? (nota as unknown as Record<string, unknown>)[key] : null;
    return v == null ? "—" : String(v);
  };
  const vitalDefault = (key: string): string | undefined => {
    const v = nota ? (nota as unknown as Record<string, unknown>)[key] : null;
    return v == null ? undefined : String(v);
  };

  return (
    <MedicoShell session={session}>
      <div className={styles.root}>
        {/* faixa do paciente */}
        <div className={styles.patient}>
          <div className={styles.avatar}>{iniciais(cidadao.nomeCompleto)}</div>
          <div>
            <div className={styles.pname}>{cidadao.nomeSocial || cidadao.nomeCompleto}</div>
            <div className={styles.pmeta}>
              <span>
                {idade(cidadao.dataNascimento) ?? "—"} anos
                {cidadao.genero ? ` · ${cidadao.genero}` : ""}
              </span>
              <span className={styles.sep} />
              <span className={styles.mono}>PRONT #{cidadao.id.slice(-6).toUpperCase()}</span>
              {podeVer ? (
                <>
                  <span className={styles.sep} />
                  <Link
                    href={`/medico/pacientes/${cidadao.id}` as Route}
                    style={{ color: "var(--accent)" as string }}
                  >
                    Histórico clínico →
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.slotbox}>
              <span className={styles.micro}>Consulta</span>
              <div className={`${styles.slotT} ${styles.mono}`}>
                {consulta.slot.dataHoraInicio.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {consulta.especialidade.nome}
              </div>
            </div>
            <span
              className={`${styles.badge} ${emAtendimento ? styles.badgeLive : styles.badgeOk}`}
            >
              {emAtendimento ? <span className={styles.pulse} /> : null}
              {visual.label}
            </span>
          </div>
        </div>

        {/* transições da consulta (concluir = assinar, então 'realizada' sai daqui) */}
        {(naoCancelados.length > 0 || podeCancelar) && (
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div
              className={styles.body}
              style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
            >
              {podeCheckin ? (
                consulta.checkinEm ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--text-3)" as string,
                    }}
                  >
                    ✓ Chegou às{" "}
                    {consulta.checkinEm.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <form action={desfazerCheckinAction}>
                      <input type="hidden" name="id" value={consulta.id} />
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        pendingLabel="Desfazendo…"
                        className="tap-area"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 400,
                          color: "var(--text-3)" as string,
                          textDecoration: "underline",
                        }}
                      >
                        desfazer
                      </SubmitButton>
                    </form>
                  </span>
                ) : (
                  <form action={marcarCheckinAction}>
                    <input type="hidden" name="id" value={consulta.id} />
                    <SubmitButton variant="secondary" pendingLabel="Registrando chegada…">
                      Paciente chegou
                    </SubmitButton>
                  </form>
                )
              ) : null}
              {naoCancelados.map((p) => {
                const ok = podeTransicionarConsulta(
                  session,
                  consulta.status,
                  p,
                  consulta.profissional.userId,
                );
                // "Marcar falta" é destrutivo (mexe no histórico do paciente):
                // pede confirmação real via ConfirmDialog do kit. A action é a
                // MESMA (transitionAction) e os campos viajam por hiddenFields —
                // o diálogo só ENVOLVE. Quando `!ok`, cai no SubmitButton
                // desabilitado (sem confirmar nada, comportamento idêntico).
                if (p === "faltou" && ok) {
                  return (
                    <ConfirmDialog
                      key={p}
                      action={transitionAction}
                      danger
                      triggerVariant="secondary"
                      triggerLabel={ACAO_LABEL.faltou ?? "Marcar falta"}
                      title="Marcar falta?"
                      message="Isso afeta o histórico do paciente."
                      confirmLabel="Marcar falta"
                      hiddenFields={{ id: consulta.id, para: "faltou" }}
                    />
                  );
                }
                return (
                  <form key={p} action={transitionAction}>
                    <input type="hidden" name="id" value={consulta.id} />
                    <input type="hidden" name="para" value={p} />
                    <SubmitButton
                      disabled={!ok}
                      pendingLabel="Aplicando…"
                      style={{ opacity: ok ? 1 : 0.4 }}
                    >
                      {ACAO_LABEL[p] ?? p}
                    </SubmitButton>
                  </form>
                );
              })}
              {podeReagendar && (
                <Link
                  href={`/medico/consultas/${consulta.id}/reagendar` as Route}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  Reagendar
                </Link>
              )}
              {podeCancelar && (
                <div style={{ marginLeft: "auto" }}>
                  <ConfirmDialog
                    action={cancelAction}
                    danger
                    triggerVariant="secondary"
                    title="Cancelar consulta"
                    message="A consulta será cancelada e o horário liberado na agenda."
                    confirmLabel="Cancelar consulta"
                    triggerLabel="Cancelar"
                    cancelLabel="Voltar"
                    hiddenFields={{ id: consulta.id }}
                  >
                    <label className="field-group" style={{ marginTop: 12 }}>
                      <span className="label">Motivo do cancelamento</span>
                      <input
                        type="text"
                        name="motivo"
                        required
                        className="input"
                        placeholder="Ex.: paciente solicitou o cancelamento"
                      />
                    </label>
                  </ConfirmDialog>
                </div>
              )}
            </div>
          </div>
        )}

        {reagendada === "ok" ? (
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className={styles.body} style={{ fontSize: 13 }}>
              Consulta reagendada.
            </div>
          </div>
        ) : null}

        {erro && (
          <div
            className={styles.card}
            style={{ marginBottom: 16, borderColor: "var(--danger)" as string }}
          >
            <div className={styles.body} style={{ color: "var(--danger)" as string, fontSize: 13 }}>
              {erro === "nota_assinada" &&
                "Esta nota já está assinada — use addendo para corrigir."}
              {erro === "assinatura" &&
                "Não foi possível assinar (verifique se há nota e se a consulta está em atendimento)."}
              {erro === "nao_assinada" && "Addendo só é permitido após a assinatura."}
              {erro === "diagnosticos" &&
                "Não foi possível ler os diagnósticos do formulário — recarregue a página e tente novamente."}
              {erro === "nao_reagendavel" && "Esta consulta não pode mais ser reagendada."}
              {erro === "slot_indisponivel" &&
                "O horário escolhido acabou de ser reservado. Tente outro."}
            </div>
          </div>
        )}

        {!podeVer ? (
          <div className={styles.card}>
            <div className={styles.body} style={{ color: "var(--text-3)" as string }}>
              Conteúdo clínico restrito ao profissional do atendimento.
            </div>
          </div>
        ) : (
          <div className={styles.pront}>
            {/* COLUNA 1 — CONTEXTO */}
            <div className={styles.col}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} />
                  <h3 className={styles.cardTitle}>Saúde do paciente</h3>
                </div>
                <div className={styles.body}>
                  <div className={styles.field}>
                    <span className={`${styles.micro} ${styles.fieldLabel}`}>Tipo sanguíneo</span>
                    {cidadao.tipoSanguineo ? (
                      <span className={`${styles.chip} ${styles.chipAccent}`}>
                        {cidadao.tipoSanguineo}
                      </span>
                    ) : (
                      <span className={styles.muted}>não informado</span>
                    )}
                  </div>
                  <div className={styles.field}>
                    <span className={`${styles.micro} ${styles.fieldLabel}`}>Alergias</span>
                    <div className={styles.chips}>
                      {chipsDe(cidadao.alergias).length ? (
                        chipsDe(cidadao.alergias).map((a) => (
                          <span key={a} className={`${styles.chip} ${styles.chipDanger}`}>
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className={styles.muted}>nenhuma registrada</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span className={`${styles.micro} ${styles.fieldLabel}`}>
                      Condições crônicas
                    </span>
                    <div className={styles.chips}>
                      {chipsDe(cidadao.condicoesCronicas).length ? (
                        chipsDe(cidadao.condicoesCronicas).map((c) => (
                          <span key={c} className={styles.chip}>
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className={styles.muted}>nenhuma</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span className={`${styles.micro} ${styles.fieldLabel}`}>
                      Medicamentos em uso
                    </span>
                    {chipsDe(cidadao.medicamentosEmUso).length ? (
                      chipsDe(cidadao.medicamentosEmUso).map((m) => (
                        <div key={m} className={styles.med}>
                          <span>{m}</span>
                        </div>
                      ))
                    ) : (
                      <span className={styles.muted}>nenhum</span>
                    )}
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} />
                  <h3 className={styles.cardTitle}>Histórico de atendimentos</h3>
                </div>
                <div className={styles.body}>
                  {historico.length === 0 ? (
                    <span className={styles.muted}>Sem atendimentos anteriores.</span>
                  ) : (
                    <div className={styles.timeline}>
                      {historico.map((h) => (
                        <div key={h.id} className={styles.tlItem}>
                          <div className={styles.tlWhen}>
                            {h.consulta.slot.dataHoraInicio.toLocaleDateString("pt-BR")}
                          </div>
                          <div className={styles.tlTitle}>{h.profissional.nomeExibicao}</div>
                          <div className={styles.tlMeta}>{h.consulta.especialidade.nome}</div>
                          {h.texto ? <div className={styles.tlBody}>{h.texto}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* COLUNA 2 — EVOLUÇÃO */}
            <div className={styles.col}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} />
                  <h3 className={styles.cardTitle}>Evolução do atendimento</h3>
                  <span className={`${styles.headNote} ${styles.mono}`}>
                    {assinada
                      ? `assinada · ${nota?.assinadaEm?.toLocaleDateString("pt-BR") ?? ""}`
                      : podeEditar
                        ? "rascunho · não assinada"
                        : "somente leitura"}
                  </span>
                </div>
                <div className={styles.body}>
                  {podeEditar ? (
                    <>
                      <form action={salvarRascunhoAction} id="formEvolucao">
                        <input type="hidden" name="consultaId" value={consulta.id} />
                        <textarea
                          className={styles.note}
                          name="texto"
                          aria-label="Texto da evolução"
                          defaultValue={nota?.texto ?? ""}
                          placeholder="Anamnese, exame físico, conduta…"
                        />
                        <div className={styles.blockLabel}>
                          <span className={styles.micro}>Sinais vitais</span>
                          <span className={styles.hr} />
                        </div>
                        <div className={styles.vitais}>
                          {VITAIS.map((v) => (
                            <div key={v.key} className={styles.vital}>
                              <div className={styles.vlabel}>{v.label}</div>
                              <input
                                className={styles.vinput}
                                name={v.key}
                                inputMode="decimal"
                                placeholder={v.ph}
                                defaultValue={vitalDefault(v.key)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className={styles.blockLabel}>
                          <span className={styles.micro}>Diagnóstico (CID-10)</span>
                          <span className={styles.hr} />
                        </div>
                        <Cid10Combobox
                          defaultDiagnosticos={(nota?.diagnosticos ?? []).map((d) => ({
                            codigoCid: d.codigoCid,
                            // Clamp a 500 (limite do DiagnosticosSchema): rascunho
                            // legado (form antigo, descrição sem limite) round-tripa
                            // pelo hidden diagnosticosJson; sem o clamp o safeParse
                            // falharia SEMPRE e o save descartaria texto/vitais.
                            descricao: d.descricao.slice(0, 500),
                            principal: d.principal,
                          }))}
                        />
                        <div className={styles.signbar}>
                          <span className={styles.hint}>
                            Salvar mantém em rascunho. Assinar torna a nota imutável e conclui a
                            consulta — correções depois entram como addendo.
                          </span>
                          <SubmitButton variant="secondary" pendingLabel="Salvando rascunho…">
                            Salvar rascunho
                          </SubmitButton>
                        </div>
                      </form>
                      {nota && (
                        <AssinarButton
                          action={assinarNotaAction}
                          consultaId={consulta.id}
                          notaId={nota.id}
                        />
                      )}
                    </>
                  ) : nota ? (
                    <>
                      <div className={styles.noteReadonly}>
                        {nota.texto || "Sem texto de evolução."}
                      </div>
                      <div className={styles.blockLabel}>
                        <span className={styles.micro}>Sinais vitais</span>
                        <span className={styles.hr} />
                      </div>
                      <div className={styles.vitais}>
                        {VITAIS.map((v) => (
                          <div key={v.key} className={styles.vital}>
                            <div className={styles.vlabel}>{v.label}</div>
                            <div className={styles.vval}>
                              {vitalVal(v.key)}
                              <span className={styles.vu}> {v.unit}</span>
                            </div>
                          </div>
                        ))}
                        {imc != null && (
                          <div className={`${styles.vital} ${styles.vitalDerived}`}>
                            <div className={styles.vlabel}>IMC · deriv.</div>
                            <div className={styles.vval}>{imc}</div>
                          </div>
                        )}
                      </div>
                      {nota.diagnosticos.length > 0 && (
                        <>
                          <div className={styles.blockLabel}>
                            <span className={styles.micro}>Diagnóstico (CID-10)</span>
                            <span className={styles.hr} />
                          </div>
                          <div className={styles.cidrow}>
                            {nota.diagnosticos.map((d) => (
                              <span
                                key={d.id}
                                className={`${styles.cid} ${d.principal ? styles.cidPrincipal : ""}`}
                              >
                                {d.codigoCid ? (
                                  <span className={styles.cidCode}>{d.codigoCid}</span>
                                ) : null}{" "}
                                {d.descricao}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                      {assinada && (
                        <>
                          <div className={styles.blockLabel}>
                            <span className={styles.micro}>Addendos</span>
                            <span className={styles.hr} />
                          </div>
                          {nota.addendos.map((ad) => (
                            <div key={ad.id} className={styles.addendo}>
                              <div className={styles.addendoMeta}>
                                {ad.createdAt.toLocaleString("pt-BR")}
                              </div>
                              <div className={styles.noteReadonly}>{ad.texto}</div>
                            </div>
                          ))}
                          <form action={adicionarAddendoAction} style={{ marginTop: 12 }}>
                            <input type="hidden" name="consultaId" value={consulta.id} />
                            <input type="hidden" name="notaId" value={nota.id} />
                            <textarea
                              className={styles.note}
                              name="texto"
                              style={{ minHeight: 70 }}
                              placeholder="Adicionar addendo (append-only)…"
                            />
                            <div style={{ textAlign: "right", marginTop: 8 }}>
                              <SubmitButton
                                variant="secondary"
                                pendingLabel="Adicionando addendo…"
                                style={{ marginTop: 8 }}
                              >
                                Adicionar addendo
                              </SubmitButton>
                            </div>
                          </form>
                        </>
                      )}
                    </>
                  ) : (
                    <span className={styles.muted}>
                      Inicie o atendimento (botão acima) para registrar a evolução.
                    </span>
                  )}
                </div>
              </section>
            </div>

            {/* COLUNA 3 — AÇÕES */}
            <div className={styles.col}>
              <EncaminhamentoPanel
                consultaId={consulta.id}
                cidadaoId={consulta.cidadaoId}
                especialidades={especialidadesAtivas}
                encaminhamentos={encaminhamentos}
                podeEncaminhar={podeEnc}
              />
              {/* Receita (F1.B.3) */}
              <section className={styles.card}>
                <div className={styles.docHead}>
                  <span className={styles.docIco}>℞</span>
                  <h3 className={styles.docTtl}>Prescrição</h3>
                </div>
                <div className={styles.body}>
                  {doc === "ok" && (
                    <div className={styles.docOk}>Documento emitido com sucesso.</div>
                  )}
                  {doc === "erro_receita" && (
                    <div className={styles.docErr}>
                      Informe ao menos medicamento e posologia para emitir a receita.
                    </div>
                  )}
                  {receitas.length > 0 && (
                    <div className={styles.docList}>
                      {receitas.map((r) => (
                        <div key={r.id} className={styles.docItem}>
                          <span className={styles.docWhen}>
                            {r.emitidoEm.toLocaleDateString("pt-BR")}
                          </span>
                          <Link
                            href={`/medico/consultas/${consulta.id}/receita/${r.id}` as Route}
                            className={styles.docLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Baixar PDF →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                  {podeEmitir ? (
                    <form action={emitirReceitaAction} className={styles.docForm}>
                      <input type="hidden" name="consultaId" value={consulta.id} />
                      <ReceitaItens />
                      <input
                        className={styles.docInput}
                        name="observacoes"
                        placeholder="Observações (opcional)"
                      />
                      <div className={styles.docActions}>
                        <SubmitButton pendingLabel="Emitindo receita…">Emitir receita</SubmitButton>
                      </div>
                    </form>
                  ) : (
                    <span className={styles.muted}>
                      Emissão restrita ao profissional do atendimento.
                    </span>
                  )}
                </div>
              </section>

              {/* Atestado (F1.B.3) */}
              <section className={styles.card}>
                <div className={styles.docHead}>
                  <span className={styles.docIco}>✓</span>
                  <h3 className={styles.docTtl}>Atestado</h3>
                </div>
                <div className={styles.body}>
                  {atestados.length > 0 && (
                    <div className={styles.docList}>
                      {atestados.map((at) => (
                        <div key={at.id} className={styles.docItem}>
                          <span className={styles.docWhen}>
                            {at.emitidoEm.toLocaleDateString("pt-BR")}
                            {at.diasAfastamento != null && at.diasAfastamento > 0
                              ? ` · ${at.diasAfastamento}d`
                              : ""}
                          </span>
                          <Link
                            href={`/medico/consultas/${consulta.id}/atestado/${at.id}` as Route}
                            className={styles.docLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Baixar PDF →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                  {podeEmitir ? (
                    <form action={emitirAtestadoAction} className={styles.docForm}>
                      <input type="hidden" name="consultaId" value={consulta.id} />
                      <div className={styles.docRow}>
                        <input
                          className={styles.docInput}
                          name="diasAfastamento"
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="Dias de afastamento"
                        />
                        <input
                          className={styles.docInput}
                          name="cid"
                          placeholder="CID (opcional)"
                        />
                      </div>
                      <input
                        className={styles.docInput}
                        name="observacao"
                        placeholder="Observação (opcional)"
                      />
                      <div className={styles.docActions}>
                        <SubmitButton pendingLabel="Emitindo atestado…">
                          Emitir atestado
                        </SubmitButton>
                      </div>
                    </form>
                  ) : (
                    <span className={styles.muted}>
                      Emissão restrita ao profissional do atendimento.
                    </span>
                  )}
                </div>
              </section>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tick} style={{ background: "var(--text-3)" as string }} />
                  <h3 className={styles.cardTitle}>Privacidade</h3>
                </div>
                <div className={styles.body}>
                  <p className={styles.lgpd}>
                    <span className={`${styles.lk} ${styles.mono}`}>●</span>
                    <span>
                      Dado de saúde (LGPD art. 11). Esta abertura foi registrada na auditoria.
                    </span>
                  </p>
                  <Link
                    href={`/app/cidadaos/${cidadao.id}` as Route}
                    className={styles.mono}
                    style={{ fontSize: 12, color: "var(--accent)" as string }}
                  >
                    Ver ficha completa →
                  </Link>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </MedicoShell>
  );
}
