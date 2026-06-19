"use client";

/**
 * Indicadores da unidade de Capacitação: cursos ativos, certificados, taxa de
 * conclusão e distribuição de turmas e alunos por status.
 */
import { useIndicadoresCapacitacao } from "@/lib/use-capacitacao";
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

export default function IndicadoresCapacitacaoPage() {
  const { data, isLoading, error } = useIndicadoresCapacitacao();

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
    </main>
  );
}
