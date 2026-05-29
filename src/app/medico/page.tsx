import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { CONSULTA_VISUAL } from "@/lib/medico/ui";

const STATUS_EM_FILA = ["agendada", "confirmada", "em_atendimento"] as const;

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

  const dataExtenso = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  // marcador "agora": índice da primeira consulta cujo horário ainda não passou
  const idxAgora = consultasHoje.findIndex(
    (c) => c.slot.dataHoraInicio.getTime() >= agora.getTime(),
  );

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow={dataExtenso}
        titulo="Fila do dia"
        acao={
          podeMarcarConsulta(session) ? (
            <Link
              href={"/medico/consultas/nova" as Route}
              className="inline-flex items-center gap-2 rounded-[var(--ifp-radius-md)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
            >
              + Marcar consulta
            </Link>
          ) : undefined
        }
      />

      {/* KPIs — faixa de 3 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <MiniKpi label="Em fila hoje" value={emAndamento} tone="teal" />
        <MiniKpi label="Realizadas hoje" value={realizadas} tone="ink" />
        <MiniKpi
          label="Slots livres hoje"
          value={slotsLivresHoje}
          tone="muted"
          hint={`${consultas7d} agendadas em 7 dias`}
        />
      </div>

      {/* Timeline viva */}
      <Card className="!p-0">
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
        >
          <h2 className="text-sm font-bold tracking-wide" style={{ color: "rgb(var(--ifp-ink))" }}>
            Agenda de hoje
          </h2>
          <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
            {consultasHoje.length} {consultasHoje.length === 1 ? "consulta" : "consultas"}
          </span>
        </div>

        {consultasHoje.length === 0 ? (
          <EmptyState
            titulo="Dia livre por enquanto"
            descricao="Nenhuma consulta agendada para hoje. Marque a primeira pelo botão acima."
          />
        ) : (
          <ol className="relative px-6 py-5">
            {/* linha vertical da timeline */}
            <span
              className="absolute top-5 bottom-5 left-[calc(1.5rem+58px)] w-px"
              style={{ background: "rgb(var(--ifp-surface-200))" }}
              aria-hidden
            />
            {consultasHoje.map((c, i) => {
              const visual = CONSULTA_VISUAL[c.status];
              const hora = c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const passou = c.slot.dataHoraInicio.getTime() < agora.getTime();
              const ehAgora = i === idxAgora;
              return (
                <li key={c.id} className="relative flex gap-4 py-2.5">
                  <span
                    className="w-[58px] shrink-0 pt-0.5 text-right font-mono text-sm font-semibold tabular-nums"
                    style={{ color: passou ? "rgb(var(--ifp-muted))" : "rgb(var(--ifp-ink))" }}
                  >
                    {hora}
                  </span>
                  {/* nó da timeline */}
                  <span className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
                    <span
                      className="h-3 w-3 rounded-full ring-4 ring-white"
                      style={{ background: c.especialidade.corDestaque }}
                    />
                    {ehAgora && (
                      <span
                        className="absolute h-3 w-3 animate-ping rounded-full"
                        style={{ background: c.especialidade.corDestaque, opacity: 0.5 }}
                      />
                    )}
                  </span>
                  <Link
                    href={`/medico/consultas/${c.id}` as Route}
                    className="group flex flex-1 items-center justify-between gap-3 rounded-[var(--ifp-radius-md)] px-3 py-2 transition hover:bg-[rgb(var(--ifp-surface-50))]"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate font-semibold"
                        style={{ color: "rgb(var(--ifp-ink))" }}
                      >
                        {c.cidadao.nomeCompleto}
                      </p>
                      <p className="truncate text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                        <span
                          className="mr-1.5 inline-block rounded px-1.5 py-0.5 font-medium"
                          style={{
                            background: c.especialidade.corDestaque + "1f",
                            color: c.especialidade.corDestaque,
                          }}
                        >
                          {c.especialidade.nome}
                        </span>
                        {c.profissional.nomeExibicao}
                      </p>
                    </div>
                    <Badge variant={visual.variant}>{visual.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </MedicoShell>
  );
}

function MiniKpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "teal" | "ink" | "muted";
  hint?: string;
}) {
  const color =
    tone === "teal"
      ? "rgb(var(--ifp-teal-700))"
      : tone === "ink"
        ? "rgb(var(--ifp-ink))"
        : "rgb(var(--ifp-muted))";
  return (
    <div
      className="rounded-[var(--ifp-radius-lg)] border bg-white p-5"
      style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
    >
      <p className="text-xs font-medium" style={{ color: "rgb(var(--ifp-muted))" }}>
        {label}
      </p>
      <p
        className="mt-2 text-[2.4rem] leading-none font-extrabold tracking-tight"
        style={{ color }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-[11px]" style={{ color: "rgb(var(--ifp-muted))" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
