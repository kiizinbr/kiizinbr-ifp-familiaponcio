import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeChamar, hasAnyRole } from "@/lib/rbac";
import { podeMarcarConsulta, podeTransicionarConsulta } from "@/lib/medico/rbac";
import {
  getConsultasHoje,
  getSlotsHoje,
  type ConsultaDoDia,
  type SlotDoDia,
} from "@/lib/medico/agenda-dia";
import { CONSULTA_VISUAL, corTextoSobre } from "@/lib/medico/ui";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { AgendaDiaRefresh } from "./agenda-dia-refresh";
import { transitionAction } from "../consultas/[id]/actions";
import { marcarCheckinAction } from "../consultas/[id]/checkin-action";
import { chamarAction } from "@/app/painel/chamar-actions";

// Idioma da grade espelha agenda/page.tsx (eixo: profissionais × horas; dia = hoje).
const HORA_INICIO = 7;
const HORA_FIM = 20;
const PX_POR_MIN = 1.4;
const STATUS_ATIVA = ["agendada", "confirmada"] as const;

type Coluna = {
  profissionalId: string;
  nome: string;
  consultas: ConsultaDoDia[];
  slotsLivres: SlotDoDia[];
};

function horaCurta(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function iniciais(nome: string): string {
  return nome
    .replace(/^(Dr|Dra|Dr\.|Dra\.)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AgendaDiaPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  // Board operacional: exige um papel que opere/supervisione a agenda. Bloqueia o
  // quiosque "painel" (TV, sem acesso a dados) que passaria só pelo gate de unidade
  // — espelha recepcao (podeMarcarConsulta) e minha-fila (profissional).
  const podeOperarAgenda =
    podeMarcarConsulta(session) || hasAnyRole(session, "profissional", "presidencia");
  if (!podeOperarAgenda) redirect("/medico" as Route);

  const agora = new Date();
  const [consultas, slots] = await Promise.all([
    getConsultasHoje({ agora }),
    getSlotsHoje({ agora }),
  ]);

  // Gating de AÇÕES (não de acesso): esconde o botão que o papel não pode disparar.
  const canCheckin = podeMarcarConsulta(session);
  const canChamar = podeChamar(session);

  // ── Derivações em memória (na página, não na lib) ─────────────────────
  // Colunas = profissionais que têm consulta OU slot hoje.
  const colMap = new Map<string, Coluna>();
  for (const c of consultas) {
    const col = colMap.get(c.profissionalId) ?? {
      profissionalId: c.profissionalId,
      nome: c.profissional.nomeExibicao,
      consultas: [],
      slotsLivres: [],
    };
    col.consultas.push(c);
    colMap.set(c.profissionalId, col);
  }
  for (const s of slots) {
    const col = colMap.get(s.profissionalId) ?? {
      profissionalId: s.profissionalId,
      nome: s.profissional.nomeExibicao,
      consultas: [],
      slotsLivres: [],
    };
    if (s.status === "disponivel") col.slotsLivres.push(s);
    colMap.set(s.profissionalId, col);
  }
  const colunas = [...colMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // KPIs do dia.
  const aguardando = consultas.filter(
    (c) => c.status === "agendada" || c.status === "confirmada",
  ).length;
  const emAtendimento = consultas.filter((c) => c.status === "em_atendimento").length;
  const realizadas = consultas.filter((c) => c.status === "realizada").length;
  const livresAgora = slots.filter(
    (s) => s.status === "disponivel" && s.dataHoraInicio.getTime() >= agora.getTime(),
  ).length;

  // Legenda: especialidades distintas presentes hoje (cor + nome).
  const legendMap = new Map<string, { color: string; label: string }>();
  for (const c of consultas) {
    if (!legendMap.has(c.especialidade.id)) {
      legendMap.set(c.especialidade.id, {
        color: c.especialidade.corDestaque,
        label: c.especialidade.nome,
      });
    }
  }
  const legend = [...legendMap.values()];

  // Fila de ação: atrasados sem check-in no topo, depois por horário.
  const fila = consultas
    .filter((c) => c.status === "agendada" || c.status === "confirmada")
    .map((c) => {
      const atrasado = !c.checkinEm && c.slot.dataHoraInicio.getTime() < agora.getTime();
      return { c, atrasado };
    })
    .sort((a, b) => {
      if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
      return a.c.slot.dataHoraInicio.getTime() - b.c.slot.dataHoraInicio.getTime();
    });

  const altura = (HORA_FIM - HORA_INICIO) * 60 * PX_POR_MIN;
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horas = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

  return (
    <MedicoShell session={session}>
      <AgendaDiaRefresh />
      <MedicoHeader
        eyebrow="Centro Médico"
        titulo="Agenda do dia"
        descricao={`${dataWeekday} · ${dataFull} — mapa de operação por profissional, atualizado sozinho.`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Aguardando" value={`${aguardando} na fila`} />
        <KpiCard label="Em atendimento" value={`${emAtendimento} agora`} />
        <KpiCard label="Realizadas" value={`${realizadas} concluídas`} />
        <KpiCard label="Livres agora" value={`${livresAgora} vagos`} />
      </div>

      {legend.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {legend.map((l) => (
            <span
              key={l.label}
              className="micro"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-3)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: l.color,
                  flex: "none",
                }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}

      <div className="agenda-dia-layout">
        {/* ── Grade: colunas por profissional × horas ───────────────── */}
        <Card
          className="overflow-x-auto !p-0"
          role="region"
          aria-label="Mapa do dia por profissional e horário"
        >
          {colunas.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                titulo="Dia livre por enquanto"
                descricao="Nenhum profissional com consulta ou vaga aberta para hoje."
              />
            </div>
          ) : (
            <div className="agenda-dia-grade" style={{ minWidth: 120 + colunas.length * 160 }}>
              {/* Cabeçalho de colunas */}
              <div
                className="grid border-b"
                style={{
                  gridTemplateColumns: `56px repeat(${colunas.length}, 1fr)`,
                  borderColor: "var(--line)",
                }}
              >
                <div />
                {colunas.map((col) => (
                  <div
                    key={col.profissionalId}
                    style={{
                      borderLeft: "1px solid var(--line)",
                      padding: "10px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span className="avatar sm" aria-hidden>
                      {iniciais(col.nome)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        className="micro"
                        style={{
                          display: "block",
                          color: "var(--text)",
                          textTransform: "uppercase",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.nome}
                      </span>
                      <span className="t-small" style={{ color: "var(--text-3)" }}>
                        {col.consultas.length} consulta
                        {col.consultas.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Corpo da grade */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `56px repeat(${colunas.length}, 1fr)` }}
              >
                {/* coluna de horas */}
                <div className="relative" style={{ height: altura }}>
                  {horas.map((h) => (
                    <div
                      key={h}
                      className="ad-hour absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums"
                      style={{ top: (h - HORA_INICIO) * 60 * PX_POR_MIN, color: "var(--text-3)" }}
                    >
                      {String(h).padStart(2, "0")}h
                    </div>
                  ))}
                </div>

                {/* colunas de profissional */}
                {colunas.map((col) => (
                  <div
                    key={col.profissionalId}
                    className="relative"
                    style={{ height: altura, borderLeft: "1px solid var(--line)" }}
                  >
                    {/* linhas de hora */}
                    {horas.slice(1).map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t"
                        style={{
                          top: (h - HORA_INICIO) * 60 * PX_POR_MIN,
                          borderColor: "var(--surface-2)",
                        }}
                      />
                    ))}

                    {/* slots livres (fundo translúcido) */}
                    {col.slotsLivres.map((s) => {
                      const minDia =
                        (s.dataHoraInicio.getHours() - HORA_INICIO) * 60 +
                        s.dataHoraInicio.getMinutes();
                      const cor = s.especialidade.corDestaque;
                      return (
                        <div
                          key={s.id}
                          className="ad-chip absolute right-0.5 left-0.5 overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[10px] leading-tight"
                          title={`Livre · ${horaCurta(s.dataHoraInicio)} · ${s.especialidade.nome}`}
                          style={{
                            top: minDia * PX_POR_MIN,
                            height: Math.max(s.duracaoMin * PX_POR_MIN - 2, 14),
                            background: cor + "26",
                            color: "var(--text)",
                            borderLeft: `2px solid ${cor}`,
                          }}
                        >
                          <span className="block truncate" style={{ color: "var(--text-3)" }}>
                            Livre
                            <span className="sr-only"> · {s.especialidade.nome}</span>
                          </span>
                        </div>
                      );
                    })}

                    {/* consultas (fundo cheio) */}
                    {col.consultas.map((c) => {
                      const minDia =
                        (c.slot.dataHoraInicio.getHours() - HORA_INICIO) * 60 +
                        c.slot.dataHoraInicio.getMinutes();
                      const cor = c.especialidade.corDestaque;
                      const isNow = c.status === "em_atendimento";
                      const nomeExibido = c.cidadao.nomeSocial || c.cidadao.nomeCompleto;
                      return (
                        <Link
                          key={c.id}
                          href={`/medico/consultas/${c.id}` as Route}
                          title={`${nomeExibido} · ${horaCurta(c.slot.dataHoraInicio)} · ${c.especialidade.nome}`}
                          className="ad-chip absolute right-0.5 left-0.5 block overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[10px] leading-tight no-underline"
                          style={{
                            top: minDia * PX_POR_MIN,
                            height: Math.max(c.slot.duracaoMin * PX_POR_MIN - 2, 14),
                            background: cor,
                            color: corTextoSobre(cor),
                            borderLeft: `2px solid ${cor}`,
                          }}
                        >
                          <span className="block truncate" style={{ fontWeight: 600 }}>
                            {nomeExibido}
                          </span>
                          <span className="block truncate" style={{ opacity: 0.85 }}>
                            {horaCurta(c.slot.dataHoraInicio)}
                            {isNow ? " · agora" : ""}
                          </span>
                          {/* Status + especialidade em texto: o chip distingue ambos só por
                              cor (WCAG 1.4.1). sr-only mantém o visual e dá o sinal textual. */}
                          <span className="sr-only">
                            {" · "}
                            {CONSULTA_VISUAL[c.status].label} · {c.especialidade.nome}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── Fila de ação (lateral) ────────────────────────────────── */}
        <section style={{ display: "grid", gap: 8 }}>
          <h2 className="t-h2" style={{ color: "var(--text)" }}>
            Fila de ação
          </h2>
          {fila.length === 0 ? (
            <Card>
              <p style={{ color: "var(--text-3)" }}>Ninguém aguardando agora.</p>
            </Card>
          ) : (
            fila.map(({ c, atrasado }) => {
              const visual = CONSULTA_VISUAL[c.status];
              const nomeExibido = c.cidadao.nomeSocial || c.cidadao.nomeCompleto;
              const espera =
                c.checkinEm && c.status !== "em_atendimento"
                  ? Math.max(0, Math.floor((agora.getTime() - c.checkinEm.getTime()) / 60000))
                  : null;
              const ativa = STATUS_ATIVA.includes(c.status as (typeof STATUS_ATIVA)[number]);
              // Gate por papel POR consulta (igual à tela de detalhe): o board mostra
              // TODOS os profissionais, então um profissional não pode transicionar a
              // consulta de um colega — esconder evita o "Sem permissão" (500) ao clicar.
              const podeConfirmar =
                c.status === "agendada" &&
                podeTransicionarConsulta(session, c.status, "confirmada", c.profissional.userId);
              const podeIniciar =
                ativa &&
                podeTransicionarConsulta(
                  session,
                  c.status,
                  "em_atendimento",
                  c.profissional.userId,
                );
              return (
                <Card key={c.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                        {horaCurta(c.slot.dataHoraInicio)}
                      </span>{" "}
                      <Link
                        href={`/medico/consultas/${c.id}` as Route}
                        style={{ color: "var(--text)", fontWeight: 600 }}
                      >
                        {nomeExibido}
                      </Link>
                      <div className="t-small" style={{ color: "var(--text-3)" }}>
                        {c.especialidade.nome} · {c.profissional.nomeExibicao}
                      </div>
                      {atrasado ? (
                        <div
                          className="t-small"
                          style={{ color: "var(--danger)", fontWeight: 600 }}
                        >
                          Atrasado · sem check-in
                        </div>
                      ) : null}
                      {espera != null ? (
                        <div
                          className="t-small"
                          style={{ color: "var(--accent)", fontWeight: 600 }}
                        >
                          ✓ esperando {espera} min
                        </div>
                      ) : null}
                    </div>
                    <div style={{ flex: "none" }}>
                      {c.status === "em_atendimento" ? (
                        <span className="badge badge-live">
                          <span className="pulse" />
                          EM ATENDIMENTO
                        </span>
                      ) : (
                        <Badge variant={visual.variant}>{visual.label}</Badge>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: 8,
                      alignItems: "center",
                    }}
                  >
                    {canCheckin && ativa && !c.checkinEm ? (
                      <form action={marcarCheckinAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="voltar" value="/medico/agenda-dia" />
                        <SubmitButton variant="secondary">Chegou</SubmitButton>
                      </form>
                    ) : null}
                    {podeConfirmar ? (
                      <form action={transitionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="para" value="confirmada" />
                        <SubmitButton variant="secondary">Confirmar</SubmitButton>
                      </form>
                    ) : null}
                    {podeIniciar ? (
                      <form action={transitionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="para" value="em_atendimento" />
                        <SubmitButton>Iniciar</SubmitButton>
                      </form>
                    ) : null}
                    {canChamar ? (
                      <form action={chamarAction}>
                        <input type="hidden" name="unidade" value="medico" />
                        <input type="hidden" name="nomeChamado" value={nomeExibido} />
                        <input type="hidden" name="destino" value={c.profissional.nomeExibicao} />
                        <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
                        <input type="hidden" name="consultaId" value={c.id} />
                        <SubmitButton variant="secondary">Chamar</SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </MedicoShell>
  );
}
