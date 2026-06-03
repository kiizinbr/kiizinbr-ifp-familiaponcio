import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { StatusConsulta } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { podeMarcarConsulta } from "@/lib/medico/rbac";

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

export default async function MedicoHomePage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const agora = new Date();
  const inicioDia = new Date(agora);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(agora);
  fimDia.setHours(23, 59, 59, 999);
  const em7Dias = new Date(inicioDia);
  em7Dias.setDate(em7Dias.getDate() + 7);

  const [consultasHoje, consultas7d, slotsLivresHoje] = await Promise.all([
    db.consulta.findMany({
      where: { slot: { dataHoraInicio: { gte: inicioDia, lte: fimDia } } },
      include: { slot: true, cidadao: true, profissional: true, especialidade: true },
      orderBy: { slot: { dataHoraInicio: "asc" } },
    }),
    db.consulta.count({
      where: {
        slot: { dataHoraInicio: { gte: inicioDia, lte: em7Dias } },
        status: { in: ["agendada", "confirmada"] },
      },
    }),
    db.slot.count({
      where: { status: "disponivel", dataHoraInicio: { gte: agora, lte: fimDia } },
    }),
  ]);

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
              return (
                <Link
                  key={c.id}
                  href={`/medico/consultas/${c.id}` as Route}
                  className={`tl-item${isNow ? " live" : ""}`}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
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
                      <div className="tl-title" style={{ color: "var(--text)" }}>
                        {c.cidadao.nomeCompleto}
                      </div>
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
                </Link>
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
