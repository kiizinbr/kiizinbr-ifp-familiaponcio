import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { getConsultasHoje, buildJanelaDia } from "@/lib/medico/agenda-dia";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { CONSULTA_VISUAL } from "@/lib/medico/ui";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { transitionAction } from "../consultas/[id]/actions";
import { marcarCheckinAction, desfazerCheckinAction } from "../consultas/[id]/checkin-action";
import { chamarAction } from "@/app/painel/chamar-actions";
import { AgendaDiaRefresh } from "../agenda-dia/agenda-dia-refresh";
import { AcaoInline } from "../_components/acao-inline";
import { BuscaPaciente } from "./busca-paciente";

/** Balcão único da recepção: busca o paciente + agenda do dia com ações inline. */
export default async function RecepcaoPage({
  searchParams,
}: {
  // Ack lido do redirect das actions (QW1), mesmo idioma do board agenda-dia:
  // ?chamado=<1onome>&chamadoHora=HH:MM (do chamarAction) e ?checkin=ok|desfeito
  // (do marcar/desfazerCheckinAction).
  searchParams: Promise<{
    q?: string;
    chamado?: string;
    chamadoHora?: string;
    checkin?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const sp = await searchParams;
  const { q } = sp;
  const agora = new Date();

  // #16 — busca server-side da 1ª carga (no-JS / deep-link com ?q=). A QUERY é a
  // mesma de sempre; a interação ao vivo (digitar sem clicar) é assumida pelo
  // island <BuscaPaciente>, que chama buscarPacientesAction (mesma query + RBAC).
  const digits = q?.replace(/\D/g, "") ?? "";
  const matches = q
    ? await db.cidadao.findMany({
        where: {
          deletedAt: null,
          OR: [
            { nomeCompleto: { contains: q, mode: "insensitive" } },
            { telefonePrincipal: { contains: q } },
            ...(digits ? [{ cpf: { contains: digits } }] : []),
          ],
        },
        select: { id: true, nomeCompleto: true, cpf: true, telefonePrincipal: true },
        take: 6,
        orderBy: { nomeCompleto: "asc" },
      })
    : [];

  const consultas = await getConsultasHoje({
    agora,
    include: {
      slot: { select: { dataHoraInicio: true } },
      cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
      especialidade: { select: { nome: true } },
      profissional: { select: { nomeExibicao: true } },
    },
  });

  // QW1 — chamadas de hoje no painel médico (mesma query leve do board, filtro
  // unidade+dia usa o @@index([unidade, criadoEm])): alimenta Chamar -> Rechamar.
  const { inicioDia } = buildJanelaDia(agora);
  const chamadasHoje = await db.chamada.findMany({
    where: { unidade: "medico", criadoEm: { gte: inicioDia }, consultaId: { not: null } },
    select: { consultaId: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });
  // Mapa consultaId -> hora da ÚLTIMA chamada (orderBy asc => o último set vence).
  const ultimaChamadaPorConsulta = new Map<string, Date>();
  for (const ch of chamadasHoje) {
    if (ch.consultaId) ultimaChamadaPorConsulta.set(ch.consultaId, ch.criadoEm);
  }

  // QW1 — ack curto lido do redirect das actions (reusa o .toast do kit, igual ao board).
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
      {/* QW4 — recepção se atualiza sozinha (mesmo island do board, default 30s). */}
      <AgendaDiaRefresh />
      <MedicoHeader
        eyebrow="Centro Médico"
        titulo="Recepção"
        descricao="Busque o paciente, faça check-in, confirme ou reagende — tudo do balcão."
        acao={
          <Link href={"/medico/consultas/nova" as Route} className="btn btn-primary">
            + Marcar consulta
          </Link>
        }
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

      <Card>
        {/* #16 — busca incremental (digita sem clicar, debounce) + foco automático.
            O island reusa o <form method="get"> + botão "Buscar" como fallback no-JS
            e semeia com os resultados server-side (matches) da carga com ?q=. */}
        <BuscaPaciente qInicial={q ?? ""} iniciais={matches} />
      </Card>

      <h2 className="t-h2" style={{ color: "var(--text)", margin: "20px 0 12px" }}>
        Agenda de hoje ({consultas.length})
      </h2>
      {consultas.length === 0 ? (
        <EmptyState
          titulo="Sem consultas hoje"
          descricao="Nenhuma consulta na agenda de hoje. Marque a primeira pelo botão acima."
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {/* #11 — prioriza quem CHEGOU/está esperando no topo, depois por horário.
              Lógica portada do sort do board (agenda-dia). NÃO muta `consultas`
              (copia com [...]); `getConsultasHoje` já vem asc por horário, então o
              desempate por horário se mantém — só elevamos quem está esperando. */}
          {[...consultas]
            .sort((a, b) => {
              const chegouA = !!a.checkinEm && a.status !== "em_atendimento";
              const chegouB = !!b.checkinEm && b.status !== "em_atendimento";
              if (chegouA !== chegouB) return chegouA ? -1 : 1;
              return a.slot.dataHoraInicio.getTime() - b.slot.dataHoraInicio.getTime();
            })
            .map((c) => {
              const hora = c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const visual = CONSULTA_VISUAL[c.status];
              const espera =
                c.checkinEm && c.status !== "em_atendimento"
                  ? Math.max(0, Math.floor((agora.getTime() - c.checkinEm.getTime()) / 60000))
                  : null;
              const ativa = c.status === "agendada" || c.status === "confirmada";
              const podeConfirmar = c.status === "agendada";
              // QW5 — só oferece desfazer enquanto o paciente está marcado como "chegou"
              // e o atendimento ainda NÃO começou (espelha o guard de `espera`).
              const podeDesfazerChegada = !!c.checkinEm && c.status !== "em_atendimento";
              // QW1 — Chamar -> Rechamar quando já houve chamada desta consulta hoje
              // (derivado do model Chamada por consultaId; só troca de TEXTO).
              const chamadaEm = ultimaChamadaPorConsulta.get(c.id) ?? null;
              return (
                <Card key={c.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                        {hora}
                      </span>{" "}
                      <Link
                        href={`/medico/consultas/${c.id}?voltar=/medico/recepcao` as Route}
                        style={{ color: "var(--text)", fontWeight: 600 }}
                      >
                        {c.cidadao.nomeSocial || c.cidadao.nomeCompleto}
                      </Link>
                      <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                        {" "}
                        · {c.especialidade.nome} · {c.profissional.nomeExibicao}
                      </span>
                      {espera != null ? (
                        <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
                          {" "}
                          · ✓ esperando {espera} min
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Badge variant={visual.variant}>{visual.label}</Badge>
                      {ativa && !c.checkinEm ? (
                        <AcaoInline
                          action={marcarCheckinAction}
                          hiddenFields={{ id: c.id, voltar: "/medico/recepcao" }}
                        >
                          <SubmitButton variant="secondary">Chegou</SubmitButton>
                        </AcaoInline>
                      ) : null}
                      {podeDesfazerChegada ? (
                        <AcaoInline
                          action={desfazerCheckinAction}
                          hiddenFields={{ id: c.id, voltar: "/medico/recepcao" }}
                        >
                          <SubmitButton variant="ghost" pendingLabel="Desfazendo…">
                            Desfazer chegada
                          </SubmitButton>
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
                      {STATUS_REAGENDAVEL.has(c.status) ? (
                        <Link
                          href={`/medico/consultas/${c.id}/reagendar` as Route}
                          className="btn btn-secondary"
                        >
                          Reagendar
                        </Link>
                      ) : null}
                      <AcaoInline
                        action={chamarAction}
                        formStyle={{ display: "flex", alignItems: "center", gap: 6 }}
                        hiddenFields={{
                          unidade: "medico",
                          nomeChamado: c.cidadao.nomeSocial || c.cidadao.nomeCompleto,
                          destino: "Recepcao",
                          cidadaoId: c.cidadao.id,
                          consultaId: c.id,
                          voltar: "/medico/recepcao",
                        }}
                      >
                        <SubmitButton variant="secondary">
                          {chamadaEm ? "Rechamar" : "Chamar"}
                        </SubmitButton>
                        {chamadaEm ? (
                          <span className="t-small" style={{ color: "var(--text-3)" }}>
                            chamada às{" "}
                            {chamadaEm.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                      </AcaoInline>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </MedicoShell>
  );
}
