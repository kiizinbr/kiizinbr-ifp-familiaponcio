import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { MedicoShell } from "@/components/medico/medico-shell";
import { podeTransicionarConsulta, podeEditarNota, podeVerProntuario } from "@/lib/medico/rbac";
import { CONSULTA_VISUAL, PROXIMOS_STATUS_CONSULTA } from "@/lib/medico/ui";
import { calcularImc } from "@/lib/medico/prontuario";
import { transitionAction, cancelAction } from "./actions";
import {
  adicionarAddendoAction,
  assinarNotaAction,
  salvarRascunhoAction,
} from "./prontuario-actions";
import styles from "./prontuario.module.css";

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

function idade(d: Date): number {
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
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
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

  const historico = await db.notaEvolucao.findMany({
    where: { cidadaoId: consulta.cidadaoId, NOT: { consultaId: consulta.id } },
    include: { profissional: true, consulta: { include: { especialidade: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

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
  const principal = nota?.diagnosticos.find((d) => d.principal) ?? nota?.diagnosticos[0];
  const pesoNum = nota?.pesoKg != null ? Number(nota.pesoKg) : null;
  const imc = calcularImc(pesoNum, nota?.alturaCm ?? null);
  const visual = CONSULTA_VISUAL[consulta.status];
  const proximos = PROXIMOS_STATUS_CONSULTA[consulta.status].filter((p) => p !== "realizada");
  const naoCancelados = proximos.filter((p) => p !== "cancelada");
  const podeCancelar = proximos.includes("cancelada");

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
                {idade(cidadao.dataNascimento)} anos
                {cidadao.genero ? ` · ${cidadao.genero}` : ""}
              </span>
              <span className={styles.sep} />
              <span className={styles.mono}>PRONT #{cidadao.id.slice(-6).toUpperCase()}</span>
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
            <div className={styles.body} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {naoCancelados.map((p) => {
                const ok = podeTransicionarConsulta(
                  session,
                  consulta.status,
                  p,
                  consulta.profissional.userId,
                );
                return (
                  <form key={p} action={transitionAction}>
                    <input type="hidden" name="id" value={consulta.id} />
                    <input type="hidden" name="para" value={p} />
                    <button
                      type="submit"
                      disabled={!ok}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      style={{ opacity: ok ? 1 : 0.4 }}
                    >
                      {ACAO_LABEL[p] ?? p}
                    </button>
                  </form>
                );
              })}
              {podeCancelar && (
                <form action={cancelAction} style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <input type="hidden" name="id" value={consulta.id} />
                  <input
                    type="text"
                    name="motivo"
                    placeholder="motivo"
                    required
                    className={styles.cidInput}
                  />
                  <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`}>
                    Cancelar
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

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
                            {h.createdAt.toLocaleDateString("pt-BR")}
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
                        <div className={styles.cidrow}>
                          <input
                            className={`${styles.cidInput} ${styles.cidCodeInput}`}
                            name="cidCodigo"
                            placeholder="J06.9"
                            defaultValue={principal?.codigoCid ?? ""}
                          />
                          <input
                            className={styles.cidInput}
                            name="cidDescricao"
                            placeholder="Descrição do diagnóstico"
                            defaultValue={principal?.descricao ?? ""}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div className={styles.signbar}>
                          <span className={styles.hint}>
                            Salvar mantém em rascunho. Assinar torna a nota imutável e conclui a
                            consulta — correções depois entram como addendo.
                          </span>
                          <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`}>
                            Salvar rascunho
                          </button>
                        </div>
                      </form>
                      {nota && (
                        <form
                          action={assinarNotaAction}
                          style={{ marginTop: 10, textAlign: "right" }}
                        >
                          <input type="hidden" name="consultaId" value={consulta.id} />
                          <input type="hidden" name="notaId" value={nota.id} />
                          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                            Assinar e concluir →
                          </button>
                        </form>
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
                              <button
                                type="submit"
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                style={{ marginTop: 8 }}
                              >
                                Adicionar addendo
                              </button>
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

            {/* COLUNA 3 — AÇÕES (F1.B.3) */}
            <div className={styles.col}>
              {[
                { ico: "℞", t: "Prescrição" },
                { ico: "⇄", t: "Encaminhamento" },
                { ico: "✓", t: "Atestado" },
              ].map((a) => (
                <section key={a.t} className={`${styles.card} ${styles.soon}`}>
                  <div className={styles.soonBody}>
                    <span className={styles.ico}>{a.ico}</span>
                    <div>
                      <div className={styles.soonTtl}>{a.t}</div>
                      <span className={styles.pill}>Chega no F1.B.3</span>
                    </div>
                  </div>
                </section>
              ))}
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
