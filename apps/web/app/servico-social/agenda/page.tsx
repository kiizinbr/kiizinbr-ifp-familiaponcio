"use client";

import { useState } from "react";
import { CalendarDays, Clock, Inbox } from "lucide-react";

import {
  STATUS_AGENDAMENTO_LABEL,
  TIPO_ITEM_AGENDA_LABEL,
  type ColunaAgendaUnidade,
  type ItemAgendaTransversal,
  type TipoUnidade,
} from "@/lib/api";
import { useSocialAgenda } from "@/lib/use-social-agenda";
import { cn } from "@/lib/cn";
import { Alerta, Spinner } from "@/components/ui";
import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";

/** Cor de acento de cada unidade (espelha os temas data-theme dos tokens CASA). */
const COR_UNIDADE: Record<TipoUnidade, string> = {
  MEDICO: "#10C2BB",
  CAPACITACAO: "#FF772E",
  ESPORTIVO: "#9A3D0B",
  EDUCACIONAL: "#007571",
};

/** Dia civil de hoje em São Paulo (YYYY-MM-DD) — valor inicial do seletor. */
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ItemLinha({ item }: { item: ItemAgendaTransversal }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {horaDe(item.inicioEm)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{item.titulo}</span>
          {item.status ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {STATUS_AGENDAMENTO_LABEL[item.status]}
            </span>
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {TIPO_ITEM_AGENDA_LABEL[item.tipo]}
            </span>
          )}
        </div>
        {item.detalhe ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detalhe}</p> : null}
        {item.profissional ? (
          <p className="mt-0.5 text-xs text-muted-foreground">com {item.profissional}</p>
        ) : null}
      </div>
    </li>
  );
}

function ColunaUnidade({ coluna }: { coluna: ColunaAgendaUnidade }) {
  const cor = COR_UNIDADE[coluna.tipo];
  return (
    <Card className="overflow-hidden !p-0">
      <div className="border-l-4" style={{ borderColor: cor }}>
        <div className="flex items-center justify-between px-4 pt-4">
          <SecTitle>{coluna.nome}</SecTitle>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
            style={{ background: `${cor}1A`, color: cor }}
          >
            {coluna.total}
          </span>
        </div>
        <div className="px-4 pb-4">
          {coluna.itens.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Sem atividades neste dia.</p>
          ) : (
            <ul className="space-y-2">
              {coluna.itens.map((item) => (
                <ItemLinha key={`${coluna.tipo}-${item.id}`} item={item} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AgendaTransversalPage() {
  const [data, setData] = useState<string>(hojeSP());
  const { data: agenda, isLoading, isError, error, isFetching } = useSocialAgenda(data);

  const pulso = agenda?.pulso;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Agenda transversal"
        descricao="O dia das 4 unidades em uma só tela — agendamentos, aulas, treinos e eventos já marcados."
        acoes={
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="sr-only">Escolher dia</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value || hojeSP())}
              className="bg-transparent text-sm text-foreground outline-none"
            />
          </label>
        }
      />

      {/* Pulso do dia */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total no dia" valor={pulso?.totalDoDia ?? "—"} />
        <Kpi label="Consultas" valor={pulso?.agendamentos ?? "—"} />
        <Kpi label="Aulas" valor={pulso?.aulas ?? "—"} />
        <Kpi label="Treinos" valor={pulso?.treinos ?? "—"} />
        <Kpi label="Eventos" valor={pulso?.eventos ?? "—"} />
      </section>

      {isLoading ? (
        <Spinner label="Carregando a agenda do dia..." />
      ) : isError ? (
        <Alerta>Não foi possível carregar: {(error as Error)?.message ?? "erro desconhecido"}</Alerta>
      ) : !agenda ? null : (
        <>
          <p role="status" aria-live="polite" className="mb-4 text-xs text-muted-foreground">
            {pulso?.unidadesComAtividade ?? 0} de {agenda.unidades.length} unidades com atividade
            {isFetching ? " · atualizando..." : ""}
          </p>
          {pulso && pulso.totalDoDia === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma atividade marcada neste dia em nenhuma das unidades.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {agenda.unidades.map((coluna) => (
                <ColunaUnidade key={coluna.tipo} coluna={coluna} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
