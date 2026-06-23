"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, ListChecks } from "lucide-react";

import { PRIORIDADE_TRIAGEM_LABEL, type PrioridadeTriagem } from "@/lib/api";
import { useTriagens } from "@/lib/use-triagem";
import { iniciaisDe } from "@/lib/iniciais";
import { cn } from "@/lib/cn";
import { Kpi, ListRow } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";

const PRIORIDADE_ESTILO: Record<PrioridadeTriagem, string> = {
  BAIXA: "border-border text-muted-foreground",
  MEDIA: "border-border text-foreground",
  ALTA: "border-warning/40 bg-warning/10 text-warning",
  URGENTE: "border-danger/40 bg-danger/10 text-danger",
};

/**
 * Painel de entrada do Serviço Social: KPIs reais + prévia das próximas famílias
 * da fila de triagem. `naFila`/`prioritarias` são contagens globais no backend;
 * a lista mostra o topo da fila (URGENTE primeiro). Dados via useTriagens.
 */
export function PainelInicioSocial() {
  const { data, isLoading, isError } = useTriagens({ perPage: 5 });
  const kpis = data?.kpis;
  const pendentes = (data?.items ?? []).filter((t) => t.status !== "CONCLUIDA");

  return (
    <section className="mb-10">
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="Famílias na fila" valor={kpis?.naFila ?? "—"} />
        <Kpi
          label="Prioritárias"
          valor={kpis?.prioritarias ?? "—"}
          tendencia={kpis && kpis.prioritarias > 0 ? "Atenção" : undefined}
          alerta={!!kpis && kpis.prioritarias > 0}
        />
        <Kpi
          label="Maior espera"
          valor={kpis ? (kpis.maiorEsperaDias === 0 ? "hoje" : `${kpis.maiorEsperaDias}d`) : "—"}
          tendencia={kpis && kpis.maiorEsperaDias >= 7 ? "Acompanhar" : undefined}
          alerta={!!kpis && kpis.maiorEsperaDias >= 7}
        />
      </div>

      <div className="rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
            Próximas da fila
          </h3>
          <Link
            href="/servico-social/triagem"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-primary"
          >
            Ver fila completa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <Spinner label="Carregando fila..." />
        ) : isError ? (
          <Alerta>Não foi possível carregar a fila de triagem agora.</Alerta>
        ) : pendentes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <ListChecks className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma família aguardando triagem.
            </p>
          </div>
        ) : (
          pendentes.map((t) => (
            <ListRow
              key={t.id}
              avatar={iniciaisDe(t.ficha.nomeCompleto)}
              titulo={
                <span className="flex flex-wrap items-center gap-2">
                  {t.ficha.nomeCompleto}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      PRIORIDADE_ESTILO[t.prioridade],
                    )}
                  >
                    {t.prioridade === "URGENTE" || t.prioridade === "ALTA" ? (
                      <AlertTriangle className="mr-1 h-3 w-3" />
                    ) : null}
                    {PRIORIDADE_TRIAGEM_LABEL[t.prioridade]}
                  </span>
                </span>
              }
              subtitulo={
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.diasEspera === 0 ? "entrou hoje" : `${t.diasEspera}d na fila`}
                </span>
              }
              trailing={
                <Link
                  href={`/servico-social/fichas/${t.fichaId}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
                >
                  Ficha
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
