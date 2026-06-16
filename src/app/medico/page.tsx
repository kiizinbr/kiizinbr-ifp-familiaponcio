import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { StatusConsulta } from "@prisma/client";
import { clsx } from "clsx";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeChamar, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { AgendaTabs } from "./_components/agenda-tabs";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { podeMarcarConsulta, podeTransicionarConsulta } from "@/lib/medico/rbac";
import { buildJanelaDia, getConsultasHoje } from "@/lib/medico/agenda-dia";
import { transitionAction } from "./consultas/[id]/actions";
import { marcarCheckinAction } from "./consultas/[id]/checkin-action";
import { chamarAction } from "@/app/painel/chamar-actions";

const STATUS_ATIVA = ["agendada", "confirmada"] as const;

const STATUS_EM_FILA = ["agendada", "confirmada", "em_atendimento"] as const;

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

/** status de domínio → badge do kit (variant + label PT-BR). */
const STATUS_BADGE = {
  agendada: { variant: "info", label: "Agendada" },
  confirmada: { variant: "success", label: "Confirmada" },
  em_atendimento: { variant: "info", label: "Agora" },
  realizada: { variant: "default", label: "Realizada" },
  faltou: { variant: "danger", label: "Faltou" },
  cancelada: { variant: "default", label: "Cancelada" },
} as const satisfies Record<StatusConsulta, { variant: BadgeVariant; label: string }>;

export default async function MedicoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ chamado?: string; chamadoHora?: string; checkin?: string }>;
}) {
  const { chamado, chamadoHora, checkin } = await searchParams;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  // QW1 — banner de sucesso reusando o MESMO mecanismo já em produção (server
  // action faz redirect com query param; a página lê de searchParams). Aqui a
  // home é read-only (cards são Links), então só ECOA o ack da ação que acabou
  // de rodar em outra tela/redirect. Mesma família ?chamado / ?checkin das
  // telas de fila. Sem PII completa: ?chamado já chega só com o primeiro nome.
  const horaValida = chamadoHora && /^\d{1,2}:\d{2}$/.test(chamadoHora) ? chamadoHora : null;
  const sucessoMsg =
    chamado && /^[\p{L}\p{M}'-]{1,40}$/u.test(chamado)
      ? `Chamada de ${chamado}${horaValida ? ` às ${horaValida}` : ""}`
      : checkin === "ok"
        ? "Check-in registrado"
        : checkin === "desfeito"
          ? "Chegada desfeita"
          : null;

  const agora = new Date();
  const { inicioDia, fimDia } = buildJanelaDia(agora);
  const em7Dias = new Date(inicioDia);
  em7Dias.setDate(em7Dias.getDate() + 7);

  const [consultasHoje, consultas7d, slotsLivresHoje, chamadasHoje] = await Promise.all([
    getConsultasHoje({ agora }),
    db.consulta.count({
      where: {
        slot: { dataHoraInicio: { gte: inicioDia, lte: em7Dias } },
        status: { in: ["agendada", "confirmada"] },
      },
    }),
    db.slot.count({
      where: { status: "disponivel", dataHoraInicio: { gte: agora, lte: fimDia } },
    }),
    // #6 — chamadas de hoje no painel médico (mesma query leve do board/recepção,
    // filtro unidade+dia usa o @@index([unidade, criadoEm])): alimenta Chamar → Rechamar.
    db.chamada.findMany({
      where: { unidade: "medico", criadoEm: { gte: inicioDia }, consultaId: { not: null } },
      select: { consultaId: true, criadoEm: true },
      orderBy: { criadoEm: "asc" },
    }),
  ]);

  // #6 — mapa consultaId → hora da ÚLTIMA chamada (orderBy asc => o último set vence).
  const ultimaChamadaPorConsulta = new Map<string, Date>();
  for (const ch of chamadasHoje) {
    if (ch.consultaId) ultimaChamadaPorConsulta.set(ch.consultaId, ch.criadoEm);
  }

  // #6 — gating de AÇÕES (não de acesso): esconde o botão que o papel não pode
  // disparar. Igual ao board agenda-dia. As actions re-checam no servidor.
  const canCheckin = podeMarcarConsulta(session);
  const canChamar = podeChamar(session);

  // #17 — atalho "Só os meus" da barra de abas: aponta a Agenda do dia já filtrada
  // pelo profissional logado (?profissionalId=, filtro JÁ existente do board). Só
  // pra quem é profissional; lookup read-only por userId (igual minha-agenda),
  // sem efeito em RBAC/anti-overbooking.
  const profissionalLogado = hasAnyRole(session, "profissional")
    ? await db.profissional.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;
  const meusHref = profissionalLogado
    ? (`/medico/agenda-dia?profissionalId=${profissionalLogado.id}` as Route)
    : undefined;

  const emAndamento = consultasHoje.filter((c) =>
    STATUS_EM_FILA.includes(c.status as (typeof STATUS_EM_FILA)[number]),
  ).length;
  const realizadas = consultasHoje.filter((c) => c.status === "realizada").length;

  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // legenda: especialidades distintas presentes hoje (cor + nome)
  const legendMap = new Map<string, { color: string; label: string }>();
  for (const c of consultasHoje) {
    if (!legendMap.has(c.especialidade.id)) {
      legendMap.set(c.especialidade.id, {
        color: c.especialidade.corDestaque,
        label: c.especialidade.nome,
      });
    }
  }
  const legend = [...legendMap.values()];

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Instituto Família Pôncio · Centro Médico"
        titulo="Fila do dia"
        descricao={`${dataWeekday} · ${dataFull}`}
        acao={
          podeMarcarConsulta(session) ? (
            <Link href={"/medico/consultas/nova" as Route}>
              <Button variant="primary" size="sm">
                + Marcar consulta
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* #17 — abas das três visões de agenda (Fila do dia / Agenda do dia /
          Agenda semanal). Entram ENTRE o header e os KPIs; o H1 "Fila do dia"
          e o KPI "Na fila" permanecem intactos. */}
      <AgendaTabs active="fila" meusHref={meusHref} />

      {/* QW1 — ack curto da última ação (chamar / check-in), reusando a classe
          .toast.ok do kit (tokens var(--ok), sem cor inventada). Inline (não
          flutuante) logo abaixo do cabeçalho. */}
      {sucessoMsg ? (
        <div className="toast ok" role="status" style={{ marginBottom: 24 }}>
          <div>
            <div className="t-title">{sucessoMsg}</div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard label="Na fila" value={`${emAndamento} aguardando`} />
        <KpiCard label="Realizadas hoje" value={`${realizadas} concluídas`} />
        <KpiCard
          label="Slots livres"
          value={`${slotsLivresHoje} vagos`}
          hint={`${consultas7d} agendadas em 7 dias`}
        />
      </div>

      <section>
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <h2 className="t-h2" style={{ color: "var(--text)" }}>
            A pauta de hoje
          </h2>
          {legend.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {legend.map((l) => (
                <span
                  key={l.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
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
        </header>

        {consultasHoje.length === 0 ? (
          <EmptyState
            titulo="Dia livre por enquanto"
            descricao="Nenhuma consulta agendada para hoje. Marque a primeira pelo botão acima."
          />
        ) : (
          <div className="timeline">
            {consultasHoje.map((c) => {
              const badge = STATUS_BADGE[c.status];
              const isNow = c.status === "em_atendimento";
              const hora = c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const durationMin = c.slot.duracaoMin;
              const elapsedMin = isNow
                ? Math.max(
                    0,
                    Math.floor((agora.getTime() - c.slot.dataHoraInicio.getTime()) / 60000),
                  )
                : undefined;
              const prog =
                isNow && durationMin && elapsedMin != null
                  ? Math.max(4, Math.min(100, Math.round((elapsedMin / durationMin) * 100)))
                  : undefined;
              // #6 — gating por papel POR consulta (igual ao board): a home mostra
              // TODOS os profissionais, então um profissional não transiciona a
              // consulta de um colega — esconder evita o "Sem permissão" (500).
              const nomeExibido = c.cidadao.nomeSocial || c.cidadao.nomeCompleto;
              const ativa = STATUS_ATIVA.includes(c.status as (typeof STATUS_ATIVA)[number]);
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
              const chamadaEm = ultimaChamadaPorConsulta.get(c.id) ?? null;
              // FIX 1 — a home itera TODOS os status, mas o board agenda-dia só
              // mostra a linha de ações sobre consultas EM FILA (não-terminais).
              // Espelhar esse recorte aqui: em consulta realizada/faltou/cancelada
              // a linha (e principalmente o Chamar, que anuncia na TV pública) some.
              const emFila = STATUS_EM_FILA.includes(c.status as (typeof STATUS_EM_FILA)[number]);
              const podeChamarConsulta = canChamar && emFila;
              const temAcao =
                (canCheckin && ativa && !c.checkinEm) ||
                podeConfirmar ||
                podeIniciar ||
                podeChamarConsulta;
              return (
                // #6 — o item deixa de ser um <a> externo (não se pode aninhar
                // <form>/<button> dentro de <a>). Vira <div>; a navegação pro
                // detalhe migra pro <Link> no nome; as ações são irmãs do nome.
                <div
                  key={c.id}
                  className={clsx("tl-item", isNow && "live")}
                  style={{ display: "block" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span className="tl-when">
                        {hora}
                        {durationMin != null && ` · ${durationMin} min`}
                      </span>
                      <Link
                        href={`/medico/consultas/${c.id}?voltar=/medico` as Route}
                        className="tl-title"
                        style={{ color: "var(--text)", textDecoration: "none", display: "block" }}
                      >
                        {nomeExibido}
                      </Link>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "var(--text-3)",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: c.especialidade.corDestaque,
                            flex: "none",
                          }}
                        />
                        {c.especialidade.nome}
                      </span>
                      <div className="tl-meta">{c.profissional.nomeExibicao}</div>
                      {c.checkinEm && (c.status === "agendada" || c.status === "confirmada") ? (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--accent)",
                            fontWeight: 600,
                          }}
                        >
                          ✓ Chegou · esperando{" "}
                          {Math.max(
                            0,
                            Math.floor((agora.getTime() - c.checkinEm.getTime()) / 60000),
                          )}{" "}
                          min
                        </div>
                      ) : null}
                    </div>
                    <div style={{ flex: "none" }}>
                      {isNow ? (
                        <span className="badge badge-live">
                          <span className="pulse" />
                          EM ATENDIMENTO
                        </span>
                      ) : (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      )}
                    </div>
                  </div>
                  {isNow && elapsedMin != null && prog != null && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--live)", fontWeight: 600 }}>
                        em curso · ~{elapsedMin} min
                      </span>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 999,
                          background: "var(--live-soft)",
                          marginTop: 3,
                        }}
                      >
                        <div
                          style={{
                            width: `${prog}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: "var(--live)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* #6 — ações inline (mesmos forms + actions do board agenda-dia,
                      gated por papel por-consulta). Todos com voltar="/medico". */}
                  {temAcao ? (
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
                          <input type="hidden" name="voltar" value="/medico" />
                          <SubmitButton
                            variant="secondary"
                            aria-label={`Registrar chegada de ${nomeExibido} às ${hora}`}
                          >
                            Chegou
                          </SubmitButton>
                        </form>
                      ) : null}
                      {podeConfirmar ? (
                        <form action={transitionAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="para" value="confirmada" />
                          <SubmitButton
                            variant="secondary"
                            aria-label={`Confirmar consulta de ${nomeExibido} às ${hora}`}
                          >
                            Confirmar
                          </SubmitButton>
                        </form>
                      ) : null}
                      {podeIniciar ? (
                        <form action={transitionAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="para" value="em_atendimento" />
                          <input type="hidden" name="irParaProntuario" value="1" />
                          <input type="hidden" name="voltar" value="/medico" />
                          <SubmitButton
                            aria-label={`Iniciar atendimento de ${nomeExibido} às ${hora}`}
                          >
                            Iniciar
                          </SubmitButton>
                        </form>
                      ) : null}
                      {podeChamarConsulta ? (
                        <form
                          action={chamarAction}
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <input type="hidden" name="unidade" value="medico" />
                          <input type="hidden" name="nomeChamado" value={nomeExibido} />
                          <input type="hidden" name="destino" value={c.profissional.nomeExibicao} />
                          <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
                          <input type="hidden" name="consultaId" value={c.id} />
                          <input type="hidden" name="voltar" value="/medico" />
                          <SubmitButton
                            variant="secondary"
                            aria-label={`${chamadaEm ? "Rechamar" : "Chamar"} ${nomeExibido}`}
                          >
                            {chamadaEm ? "Rechamar" : "Chamar"}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="micro" style={{ marginTop: 32, color: "var(--text-3)" }}>
        Centro Médico · Duque de Caxias / RJ · Atualizado em tempo real
      </p>
    </MedicoShell>
  );
}
