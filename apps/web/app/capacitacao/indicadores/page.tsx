"use client";

/**
 * Indicadores da unidade de Capacitação: cursos ativos, certificados, taxa de
 * conclusão e distribuição de turmas e alunos por status. Inclui também os
 * INDICADORES LONGITUDINAIS (A2): séries temporais por mês de matrículas,
 * conclusões, certificados e evasão — janela escolhível (6/12/24 meses).
 */
import { useState } from "react";

import {
  useIndicadoresCapacitacao,
  useIndicadoresSeriesCapacitacao,
  type ChaveSerieCapacitacao,
} from "@/lib/use-capacitacao";
import { STATUS_MATRICULA_LABEL, STATUS_TURMA_LABEL } from "@/lib/api";
import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";

function BarrasStatus({
  dados,
  labels,
}: {
  dados: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(dados).filter(([, v]) => v > 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 text-muted-foreground">{labels[k] ?? k}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-semibold tabular-nums text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-06" → "jun/26". */
function mesLabel(ym: string) {
  const [ano = "", mes = ""] = ym.split("-");
  return `${MESES_CURTO[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}

/** Série temporal em barras verticais finas (mesmo estilo CASA da Presidência). */
function SerieMensal({ dados }: { dados: { mes: string; total: number }[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {dados.map((d) => (
        <div key={d.mes} className="flex min-w-[34px] flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums text-foreground">{d.total}</span>
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-md bg-[var(--unidade)]"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{mesLabel(d.mes)}</span>
        </div>
      ))}
    </div>
  );
}

const JANELAS = [6, 12, 24] as const;

/** Rótulo curto por chave de série (casa com o que a API devolve). */
const SERIE_TITULO: Record<ChaveSerieCapacitacao, string> = {
  matriculas: "Matrículas por mês",
  conclusoes: "Conclusões por mês",
  certificados: "Certificados por mês",
  evasoes: "Evasões por mês",
};

export default function IndicadoresCapacitacaoPage() {
  const { data, isLoading, error } = useIndicadoresCapacitacao();
  const [meses, setMeses] = useState<number>(12);
  const series = useIndicadoresSeriesCapacitacao(meses);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader titulo="Indicadores" descricao="Visão da unidade de Capacitação." />

      {isLoading ? <Spinner label="Carregando indicadores..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Cursos ativos" valor={data.cursosAtivos} />
            <Kpi label="Certificados emitidos" valor={data.certificados} />
            <Kpi
              label="Taxa de conclusão"
              valor={data.taxaConclusao != null ? `${data.taxaConclusao}%` : "—"}
            />
          </div>

          <Card className="mt-6">
            <SecTitle>Turmas por status</SecTitle>
            <BarrasStatus dados={data.turmas} labels={STATUS_TURMA_LABEL} />
          </Card>

          <Card className="mt-4">
            <SecTitle>Alunos por status</SecTitle>
            <BarrasStatus dados={data.matriculas} labels={STATUS_MATRICULA_LABEL} />
          </Card>
        </>
      ) : null}

      {/* ---- Indicadores longitudinais (A2) ---- */}
      <div className="mt-10">
        <PageHeader
          titulo="Evolução no tempo"
          descricao="Matrículas, conclusões, certificados e evasão mês a mês."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {JANELAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMeses(n)}
              className={
                meses === n
                  ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-primary/50"
              }
            >
              {n} meses
            </button>
          ))}
        </div>

        {series.isLoading && !series.data ? <Spinner label="Carregando séries..." /> : null}
        {series.error ? <Alerta>{(series.error as Error).message}</Alerta> : null}

        {series.data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Matrículas" valor={series.data.kpis.matriculas.toLocaleString("pt-BR")} />
              <Kpi label="Conclusões" valor={series.data.kpis.conclusoes.toLocaleString("pt-BR")} />
              <Kpi
                label="Certificados"
                valor={series.data.kpis.certificados.toLocaleString("pt-BR")}
              />
              <Kpi label="Evasões" valor={series.data.kpis.evasoes.toLocaleString("pt-BR")} />
              <Kpi
                label="Taxa de conclusão"
                valor={
                  series.data.kpis.taxaConclusao != null
                    ? `${series.data.kpis.taxaConclusao}%`
                    : "—"
                }
              />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Totais somados ao longo dos últimos {series.data.meses} meses.
            </p>

            <div className="mt-6 space-y-4">
              {series.data.series.map((serie) => (
                <Card key={serie.chave}>
                  <SecTitle>{SERIE_TITULO[serie.chave] ?? `${serie.label} por mês`}</SecTitle>
                  <SerieMensal dados={serie.pontos} />
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
