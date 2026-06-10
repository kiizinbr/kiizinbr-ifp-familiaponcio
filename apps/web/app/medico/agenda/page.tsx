"use client";

import Link from "next/link";
import { ChevronRight, Stethoscope } from "lucide-react";

import { STATUS_AGENDAMENTO_LABEL, type StatusAgendamento } from "@/lib/api";
import { useAgendaDoDia } from "@/lib/use-medico";
import { Alerta, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

const statusEstilo: Record<StatusAgendamento, string> = {
  AGENDADO: "border-border text-muted-foreground",
  CONFIRMADO: "border-info/50 text-info",
  EM_ATENDIMENTO: "border-primary/60 bg-primary/10 text-primary",
  CONCLUIDO: "border-success/50 text-success",
  FALTOU: "border-warning/50 text-warning",
  CANCELADO: "border-border text-muted-foreground line-through",
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function idade(dataNascimento: string) {
  const nasc = new Date(dataNascimento);
  const diff = Date.now() - nasc.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function AgendaPage() {
  const { data, isLoading, isError, error } = useAgendaDoDia();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-foreground">Agenda do dia</h1>
        {data?.dia ? (
          <span className="text-sm text-muted-foreground">
            {new Date(`${data.dia}T12:00:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
        ) : null}
      </div>

      {isLoading ? <Spinner label="Carregando agenda..." /> : null}
      {isError ? (
        <div className="mt-6">
          <Alerta>Não foi possível carregar a agenda: {(error as Error)?.message}</Alerta>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhum paciente agendado para hoje.
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {data?.items.map((ag) => (
          <li key={ag.id}>
            <Link
              href={`/medico/atendimento/${ag.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-ifp-sm transition hover:shadow-casa-sm"
            >
              <div className="w-14 shrink-0 text-center">
                <div className="text-lg font-bold text-primary">{hora(ag.inicioEm)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {hora(ag.fimEm)}
                </div>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground group-hover:text-primary">
                  {ag.membro?.nomeCompleto ?? ag.ficha.nomeCompleto}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {idade(ag.membro?.dataNascimento ?? ag.ficha.dataNascimento)} anos
                  </span>
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {ag.motivo ?? "Sem motivo informado"} · {ag.ficha.protocolo}
                </div>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusEstilo[ag.status],
                )}
              >
                {STATUS_AGENDAMENTO_LABEL[ag.status]}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
