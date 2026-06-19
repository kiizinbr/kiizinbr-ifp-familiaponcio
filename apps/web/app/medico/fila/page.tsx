"use client";

/**
 * Fila do dia — visão operacional do atendimento, agrupada por etapa
 * (aguardando → em atendimento → concluídos → faltas/cancelados). Reusa a
 * agenda de hoje e as ações de gestão (confirmar/falta/cancelar/reagendar).
 */
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";

import { useFilaUnidade, type FilaItem } from "@/lib/use-medico";
import { AcoesAgendamento } from "@/components/medico/acoes-agendamento";
import { PageHeader } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { STATUS_AGENDAMENTO_LABEL, type StatusAgendamento } from "@/lib/api";
import { idade } from "@/lib/idade";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const GRUPOS: { titulo: string; statuses: StatusAgendamento[]; tom: string }[] = [
  { titulo: "Aguardando", statuses: ["AGENDADO", "CONFIRMADO"], tom: "text-info" },
  { titulo: "Em atendimento", statuses: ["EM_ATENDIMENTO"], tom: "text-primary" },
  { titulo: "Concluídos", statuses: ["CONCLUIDO"], tom: "text-success" },
  { titulo: "Faltas e cancelados", statuses: ["FALTOU", "CANCELADO"], tom: "text-muted-foreground" },
];

function Paciente({ ag }: { ag: FilaItem }) {
  return (
    <li className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-center text-sm font-bold text-primary">
          {hora(ag.inicioEm)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">
            {ag.membro?.nomeCompleto ?? ag.ficha.nomeCompleto}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {idade(ag.membro?.dataNascimento ?? ag.ficha.dataNascimento)} anos
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {ag.profissional.user.nome} · {ag.motivo ?? "Sem motivo"} · {ag.ficha.protocolo}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {STATUS_AGENDAMENTO_LABEL[ag.status]}
        </span>
        <Link
          href={`/medico/atendimento/${ag.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <AcoesAgendamento id={ag.id} status={ag.status} inicioEm={ag.inicioEm} />
    </li>
  );
}

export default function FilaPage() {
  const { data, isLoading, isError, error } = useFilaUnidade();
  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        titulo="Fila do dia"
        descricao={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
      />

      {isLoading ? <Spinner label="Carregando fila..." /> : null}
      {isError ? <Alerta>{(error as Error)?.message}</Alerta> : null}

      {data && items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-6 w-6" />
          Nenhum paciente na fila de hoje.
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        {GRUPOS.map((g) => {
          const doGrupo = items.filter((a) => g.statuses.includes(a.status));
          if (doGrupo.length === 0) return null;
          return (
            <section key={g.titulo}>
              <h2 className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${g.tom}`}>
                {g.titulo}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {doGrupo.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {doGrupo.map((ag) => (
                  <Paciente key={ag.id} ag={ag} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
