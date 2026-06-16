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
import { formatCpf } from "@/lib/cpf";
import { CONSULTA_VISUAL } from "@/lib/medico/ui";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { transitionAction } from "../consultas/[id]/actions";
import { marcarCheckinAction, desfazerCheckinAction } from "../consultas/[id]/checkin-action";
import { chamarAction } from "@/app/painel/chamar-actions";
import { AgendaDiaRefresh } from "../agenda-dia/agenda-dia-refresh";

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
    chamadoNome && sp.chamadoHora ? `${chamadoNome} chamada às ${sp.chamadoHora}` : null;
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
        <form method="get" style={{ display: "flex", gap: 8 }}>
          <input
            name="q"
            defaultValue={q ?? ""}
            aria-label="Buscar paciente"
            placeholder="Buscar paciente por nome, CPF ou telefone"
            className="input"
            style={{ flex: 1 }}
          />
          <SubmitButton variant="secondary" pendingLabel="Buscando…">
            Buscar
          </SubmitButton>
        </form>
        {q && matches.length === 0 ? (
          <EmptyState
            titulo="Ninguém encontrado"
            descricao="Nenhum paciente bate com essa busca. Confira o nome, o CPF ou o telefone — ou cadastre um novo."
            cta={
              <Link href={"/app/cidadaos/novo" as Route} className="btn btn-secondary">
                Cadastrar paciente
              </Link>
            }
          />
        ) : null}
        {matches.length > 0 ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {matches.map((c) => (
              <Link
                key={c.id}
                href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                }}
              >
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{c.nomeCompleto}</span>
                <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
                  {formatCpf(c.cpf)} · {c.telefonePrincipal}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
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
                        <form action={marcarCheckinAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="voltar" value="/medico/recepcao" />
                          <SubmitButton variant="secondary">Chegou</SubmitButton>
                        </form>
                      ) : null}
                      {podeDesfazerChegada ? (
                        <form action={desfazerCheckinAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="voltar" value="/medico/recepcao" />
                          <SubmitButton variant="ghost" pendingLabel="Desfazendo…">
                            Desfazer chegada
                          </SubmitButton>
                        </form>
                      ) : null}
                      {podeConfirmar ? (
                        <form action={transitionAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="para" value="confirmada" />
                          <SubmitButton variant="secondary">Confirmar</SubmitButton>
                        </form>
                      ) : null}
                      {STATUS_REAGENDAVEL.has(c.status) ? (
                        <Link
                          href={`/medico/consultas/${c.id}/reagendar` as Route}
                          className="btn btn-secondary"
                        >
                          Reagendar
                        </Link>
                      ) : null}
                      <form
                        action={chamarAction}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <input type="hidden" name="unidade" value="medico" />
                        <input
                          type="hidden"
                          name="nomeChamado"
                          value={c.cidadao.nomeSocial || c.cidadao.nomeCompleto}
                        />
                        <input type="hidden" name="destino" value="Recepcao" />
                        <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
                        <input type="hidden" name="consultaId" value={c.id} />
                        <input type="hidden" name="voltar" value="/medico/recepcao" />
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
                      </form>
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
