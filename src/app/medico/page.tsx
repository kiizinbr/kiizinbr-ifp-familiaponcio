import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { StatusConsulta } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell } from "@/components/medico/medico-shell";
import {
  EditorialCanvas,
  Masthead,
  KpiLedger,
  Agenda,
  TimelineRow,
  EditorialEmpty,
  Colophon,
} from "@/components/editorial";
import { podeMarcarConsulta } from "@/lib/medico/rbac";

const STATUS_EM_FILA = ["agendada", "confirmada", "em_atendimento"] as const;

/** status de domínio → badge editorial (kind + label PT-BR). */
const STATUS_BADGE = {
  agendada: { kind: "scheduled", label: "Agendada" },
  confirmada: { kind: "confirmed", label: "Confirmada" },
  em_atendimento: { kind: "now", label: "Agora" },
  realizada: { kind: "done", label: "Realizada" },
  faltou: { kind: "danger", label: "Faltou" },
  cancelada: { kind: "muted", label: "Cancelada" },
} as const satisfies Record<StatusConsulta, { kind: string; label: string }>;

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
      <EditorialCanvas fullBleed>
        <Masthead
          kicker="Instituto Família Pôncio · Centro Médico"
          title="Fila"
          titleEm="do dia"
          dateWeekday={dataWeekday}
          dateFull={dataFull}
          action={
            podeMarcarConsulta(session) ? (
              <Link
                href={"/medico/consultas/nova" as Route}
                style={{
                  display: "inline-block",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: "rgb(var(--ifp-orange-500))",
                  padding: "12px 18px",
                  borderRadius: "2px",
                  textDecoration: "none",
                }}
              >
                + Marcar consulta
              </Link>
            ) : undefined
          }
        />

        <KpiLedger
          items={[
            { label: "Na fila", value: emAndamento, suffix: "aguardando", tone: "orange" },
            { label: "Realizadas hoje", value: realizadas, suffix: "concluídas", tone: "teal" },
            {
              label: "Slots livres",
              value: slotsLivresHoje,
              suffix: "vagos",
              tone: "ink",
              hint: `${consultas7d} agendadas em 7 dias`,
            },
          ]}
        />

        <Agenda title="A pauta de hoje" legend={legend}>
          {consultasHoje.length === 0 ? (
            <EditorialEmpty
              title="Dia livre por enquanto"
              text="Nenhuma consulta agendada para hoje. Marque a primeira pelo botão acima."
            />
          ) : (
            consultasHoje.map((c, i) => {
              const badge = STATUS_BADGE[c.status];
              const isNow = c.status === "em_atendimento";
              const hora = c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const elapsedMin = isNow
                ? Math.max(
                    0,
                    Math.floor((agora.getTime() - c.slot.dataHoraInicio.getTime()) / 60000),
                  )
                : undefined;
              return (
                <TimelineRow
                  key={c.id}
                  href={`/medico/consultas/${c.id}`}
                  time={hora}
                  durationMin={c.slot.duracaoMin}
                  specColor={c.especialidade.corDestaque}
                  specName={c.especialidade.nome}
                  patientName={c.cidadao.nomeCompleto}
                  proName={c.profissional.nomeExibicao}
                  variant={isNow ? "now" : "default"}
                  statusKind={badge.kind}
                  statusLabel={badge.label}
                  elapsedMin={elapsedMin}
                  delaySec={i * 0.07}
                />
              );
            })
          )}
        </Agenda>

        <Colophon left="Centro Médico · Duque de Caxias / RJ" right="Atualizado em tempo real" />
      </EditorialCanvas>
    </MedicoShell>
  );
}
