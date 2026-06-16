import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeChamar, hasAnyRole } from "@/lib/rbac";
import { podeMarcarConsulta, podeTransicionarConsulta } from "@/lib/medico/rbac";
import {
  buildJanelaDia,
  getConsultasHoje,
  getSlotsHoje,
  type ConsultaDoDia,
  type SlotDoDia,
} from "@/lib/medico/agenda-dia";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { CONSULTA_VISUAL, corTextoSobre } from "@/lib/medico/ui";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AgendaDiaRefresh } from "./agenda-dia-refresh";
import { AgendaDiaNowMarker } from "./agenda-dia-now";
import { AcaoInline } from "../_components/acao-inline";
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

export default async function AgendaDiaPage({
  searchParams,
}: {
  // Ack lido do redirect das actions (QW1): ?chamado=<1onome>&chamadoHora=HH:MM,
  // ?checkin=ok|desfeito. searchParams e Promise no App Router atual.
  // ?profissionalId — filtro de apresentacao (#11), espelha a agenda semanal.
  searchParams?: Promise<{
    chamado?: string;
    chamadoHora?: string;
    checkin?: string;
    profissionalId?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
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
  const { inicioDia } = buildJanelaDia(agora);
  const [consultas, slots, chamadasHoje] = await Promise.all([
    getConsultasHoje({ agora }),
    getSlotsHoje({ agora }),
    // Chamadas de hoje no painel medico (query leve, filtro unidade+dia usa o
    // indice @@index([unidade, criadoEm])): alimenta Chamar -> Rechamar.
    db.chamada.findMany({
      where: { unidade: "medico", criadoEm: { gte: inicioDia }, consultaId: { not: null } },
      select: { consultaId: true, criadoEm: true },
      orderBy: { criadoEm: "asc" },
    }),
  ]);

  // Mapa consultaId -> hora da ULTIMA chamada (orderBy asc => o ultimo set vence).
  const ultimaChamadaPorConsulta = new Map<string, Date>();
  for (const ch of chamadasHoje) {
    if (ch.consultaId) ultimaChamadaPorConsulta.set(ch.consultaId, ch.criadoEm);
  }

  // Gating de AÇÕES (não de acesso): esconde o botão que o papel não pode disparar.
  const canCheckin = podeMarcarConsulta(session);
  const canChamar = podeChamar(session);
  // FIX 5 — quem NÃO pode marcar consulta (ex.: profissional) não recebe o atalho
  // de slot vazio (?slotId=): o submit falharia "Sem permissão". Reusa a MESMA
  // capability do check-in (recepção/gestão/social). Sem permissão → chip estático.
  const canMarcar = podeMarcarConsulta(session);

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

  // #11 — Filtro por profissional (apenas apresentação): derivamos `colunas`
  // COMPLETA primeiro (alimenta o <select> com todos), e só então filtramos a
  // versão renderizada. Espelha o filtro da Agenda semanal. Sem mutar arrays.
  const profissionalFiltro = sp.profissionalId || "";
  const colunasVisiveis = profissionalFiltro
    ? colunas.filter((c) => c.profissionalId === profissionalFiltro)
    : colunas;

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
  // #11 — acompanha o filtro por profissional do board (só apresentação).
  const fila = consultas
    .filter((c) => c.status === "agendada" || c.status === "confirmada")
    .filter((c) => !profissionalFiltro || c.profissionalId === profissionalFiltro)
    .map((c) => {
      const atrasado = !c.checkinEm && c.slot.dataHoraInicio.getTime() < agora.getTime();
      return { c, atrasado };
    })
    .sort((a, b) => {
      if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
      return a.c.slot.dataHoraInicio.getTime() - b.c.slot.dataHoraInicio.getTime();
    });

  const altura = (HORA_FIM - HORA_INICIO) * 60 * PX_POR_MIN;
  // QW3 — linha do "agora": mesma formula minuto->px dos chips. So renderiza
  // dentro da janela 07:00–20:00 (madrugada/plantao => sem linha, sem auto-scroll).
  const minAgora = (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes();
  const dentroDaJanela = minAgora >= 0 && minAgora <= (HORA_FIM - HORA_INICIO) * 60;
  const topAgora = minAgora * PX_POR_MIN;
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horas = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

  // QW1 — ack curto lido do redirect das actions (reusa o .toast do kit).
  const chamadoNome = typeof sp.chamado === "string" ? sp.chamado : null;
  const ackChamado =
    chamadoNome && sp.chamadoHora ? `Chamada de ${chamadoNome} às ${sp.chamadoHora}` : null;
  const ackCheckin =
    sp.checkin === "ok"
      ? "Check-in registrado."
      : sp.checkin === "desfeito"
        ? "Chegada desfeita."
        : null;

  return (
    <MedicoShell session={session}>
      <AgendaDiaRefresh />
      <MedicoHeader
        eyebrow="Centro Médico"
        titulo="Agenda do dia"
        descricao={`${dataWeekday} · ${dataFull} — mapa de operação por profissional, atualizado sozinho.`}
      />

      {ackChamado || ackCheckin ? (
        <div className="toast ok" role="status" style={{ marginBottom: 16 }}>
          <span className="t-ico" aria-hidden>
            ✓
          </span>
          <span>
            <span className="t-title">{ackChamado ?? ackCheckin}</span>
          </span>
        </div>
      ) : null}

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

      {/* #11 — Filtro por profissional (espelha a Agenda semanal). As opções saem
          das próprias `colunas` (profissionais com agenda hoje) — sem query nova.
          Só aparece quando há ≥2 profissionais a escolher. */}
      {colunas.length > 1 ? (
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          <select
            name="profissionalId"
            defaultValue={profissionalFiltro}
            className="select w-auto"
            aria-label="Filtrar por profissional"
          >
            <option value="">Todos os profissionais</option>
            {colunas.map((col) => (
              <option key={col.profissionalId} value={col.profissionalId}>
                {col.nome}
              </option>
            ))}
          </select>
          <SubmitButton size="sm" pendingLabel="Filtrando…">
            Filtrar
          </SubmitButton>
        </form>
      ) : null}

      <div className="agenda-dia-layout">
        {/* ── Grade: colunas por profissional × horas ───────────────── */}
        <Card
          className="overflow-x-auto !p-0"
          role="region"
          aria-label="Mapa do dia por profissional e horário"
        >
          {colunasVisiveis.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                titulo={
                  profissionalFiltro
                    ? "Sem agenda para este profissional"
                    : "Dia livre por enquanto"
                }
                descricao={
                  profissionalFiltro
                    ? "Esse profissional não tem consulta ou vaga aberta hoje."
                    : "Nenhum profissional com consulta ou vaga aberta para hoje."
                }
              />
            </div>
          ) : (
            <div
              className="agenda-dia-grade"
              style={{ minWidth: 120 + colunasVisiveis.length * 160 }}
            >
              {/* Cabeçalho de colunas */}
              <div
                className="grid border-b"
                style={{
                  gridTemplateColumns: `56px repeat(${colunasVisiveis.length}, 1fr)`,
                  borderColor: "var(--line)",
                }}
              >
                <div />
                {colunasVisiveis.map((col) => (
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
                className="relative grid"
                style={{ gridTemplateColumns: `56px repeat(${colunasVisiveis.length}, 1fr)` }}
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
                {colunasVisiveis.map((col) => (
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
                      const chipStyle = {
                        top: minDia * PX_POR_MIN,
                        height: Math.max(s.duracaoMin * PX_POR_MIN - 2, 14),
                        // FIX 3 — slot curto (chip de 14px) fica abaixo do alvo de toque
                        // mínimo; garante altura clicável quando vira <Link>.
                        minHeight: 24,
                        background: cor + "26",
                        color: "var(--text)",
                        borderLeft: `2px solid ${cor}`,
                      };
                      const chipCls =
                        "ad-chip absolute right-0.5 left-0.5 block overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[10px] leading-tight no-underline";
                      const conteudo = (
                        <span className="block truncate" style={{ color: "var(--text-3)" }}>
                          Livre
                          <span className="sr-only"> · {s.especialidade.nome}</span>
                        </span>
                      );
                      // FIX 5 — só quem pode marcar recebe o atalho clicável; os demais
                      // (ex.: profissional) caem no chip estático (o submit falharia).
                      return canMarcar ? (
                        <Link
                          key={s.id}
                          href={`/medico/consultas/nova?slotId=${s.id}` as Route}
                          className={chipCls}
                          title={`Marcar · Livre · ${horaCurta(s.dataHoraInicio)} · ${s.especialidade.nome}`}
                          aria-label={`Marcar consulta · ${col.nome} · ${horaCurta(s.dataHoraInicio)} · ${s.especialidade.nome}`}
                          style={chipStyle}
                        >
                          {conteudo}
                        </Link>
                      ) : (
                        <span
                          key={s.id}
                          className={chipCls}
                          title={`Livre · ${horaCurta(s.dataHoraInicio)} · ${s.especialidade.nome}`}
                          style={chipStyle}
                        >
                          {conteudo}
                        </span>
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
                          href={`/medico/consultas/${c.id}?voltar=/medico/agenda-dia` as Route}
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

                {/* QW3 — linha do "agora" + auto-scroll (overlay; pointer-events:none) */}
                {dentroDaJanela ? (
                  <AgendaDiaNowMarker top={topAgora} label={horaCurta(agora)} />
                ) : null}
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
            <EmptyState
              titulo="Ninguém aguardando agora"
              descricao="Quando alguém fizer check-in ou estiver atrasado, aparece aqui."
              cta={
                <Link href={"/medico/recepcao" as Route} className="btn btn-secondary">
                  Ir para a recepção
                </Link>
              }
            />
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
              // #14 — "Faltou"/"Reagendar" inline (mesmo gate por papel/consulta da ficha).
              // Esconder quando !pode evita o "Sem permissão" (500), igual aos botões acima.
              const podeFaltar = podeTransicionarConsulta(
                session,
                c.status,
                "faltou",
                c.profissional.userId,
              );
              const podeReagendar = STATUS_REAGENDAVEL.has(c.status) && podeMarcarConsulta(session);
              // QW1 — Chamar -> Rechamar quando ja houve chamada desta consulta hoje
              // (derivado do model Chamada por consultaId; so troca de TEXTO).
              const chamadaEm = ultimaChamadaPorConsulta.get(c.id) ?? null;
              return (
                <Card key={c.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                        {horaCurta(c.slot.dataHoraInicio)}
                      </span>{" "}
                      <Link
                        href={`/medico/consultas/${c.id}?voltar=/medico/agenda-dia` as Route}
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
                      <AcaoInline
                        action={marcarCheckinAction}
                        hiddenFields={{ id: c.id, voltar: "/medico/agenda-dia" }}
                      >
                        <SubmitButton variant="secondary">Chegou</SubmitButton>
                      </AcaoInline>
                    ) : null}
                    {podeConfirmar ? (
                      <AcaoInline
                        action={transitionAction}
                        hiddenFields={{ id: c.id, para: "confirmada" }}
                      >
                        <SubmitButton variant="secondary">Confirmar</SubmitButton>
                      </AcaoInline>
                    ) : null}
                    {podeIniciar ? (
                      <AcaoInline
                        action={transitionAction}
                        hiddenFields={{
                          id: c.id,
                          para: "em_atendimento",
                          // #12 — opt-in: iniciar daqui abre o prontuário direto.
                          // NÃO está no form Confirmar/Chamar/Chegou acima.
                          irParaProntuario: "1",
                          voltar: "/medico/agenda-dia",
                        }}
                      >
                        <SubmitButton>Iniciar</SubmitButton>
                      </AcaoInline>
                    ) : null}
                    {canChamar ? (
                      <AcaoInline
                        action={chamarAction}
                        formStyle={{ display: "flex", alignItems: "center", gap: 6 }}
                        hiddenFields={{
                          unidade: "medico",
                          nomeChamado: nomeExibido,
                          destino: c.profissional.nomeExibicao,
                          cidadaoId: c.cidadao.id,
                          consultaId: c.id,
                          voltar: "/medico/agenda-dia",
                        }}
                      >
                        <SubmitButton variant="secondary">
                          {chamadaEm ? "Rechamar" : "Chamar"}
                        </SubmitButton>
                        {chamadaEm ? (
                          <span className="t-small" style={{ color: "var(--text-3)" }}>
                            chamada às {horaCurta(chamadaEm)}
                          </span>
                        ) : null}
                      </AcaoInline>
                    ) : null}
                    {/* #14 — exceções (Faltou/Reagendar) por último na ordem mental. */}
                    {podeFaltar ? (
                      <ConfirmDialog
                        action={transitionAction}
                        danger
                        triggerVariant="secondary"
                        triggerLabel="Marcar falta"
                        title="Marcar falta?"
                        message="Isso afeta o histórico do paciente."
                        confirmLabel="Marcar falta"
                        hiddenFields={{ id: c.id, para: "faltou" }}
                      />
                    ) : null}
                    {podeReagendar ? (
                      <Link
                        href={`/medico/consultas/${c.id}/reagendar` as Route}
                        className="btn btn-secondary"
                      >
                        Reagendar
                      </Link>
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
