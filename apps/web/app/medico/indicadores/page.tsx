"use client";

/**
 * Indicadores do consultório do profissional: totais, taxa de comparecimento,
 * distribuição dos agendamentos por status e atendimentos por mês.
 */
import { useIndicadoresMedico } from "@/lib/use-medico";
import { STATUS_AGENDAMENTO_LABEL } from "@/lib/api";
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
          <span className="w-32 shrink-0 text-muted-foreground">{labels[k] ?? k}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-semibold tabular-nums text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

function mesLabel(ym: string) {
  const [ano = "", mes = ""] = ym.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}

export default function IndicadoresMedicoPage() {
  const { data, isLoading, error } = useIndicadoresMedico();
  const maxMes = Math.max(1, ...(data?.porMes ?? []).map((m) => m.total));

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader titulo="Indicadores" descricao="Visão do seu consultório." />

      {isLoading ? <Spinner label="Carregando indicadores..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Atendimentos selados" valor={data.atendimentosSelados} />
            <Kpi label="Beneficiários" valor={data.beneficiarios} />
            <Kpi
              label="Comparecimento"
              valor={data.taxaComparecimento != null ? `${data.taxaComparecimento}%` : "—"}
            />
          </div>

          <Card className="mt-6">
            <SecTitle>Agendamentos por status</SecTitle>
            <BarrasStatus dados={data.porStatus} labels={STATUS_AGENDAMENTO_LABEL} />
          </Card>

          <Card className="mt-4">
            <SecTitle>Atendimentos por mês (6 meses)</SecTitle>
            {data.porMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem atendimentos no período.</p>
            ) : (
              <div className="space-y-2">
                {data.porMes.map((m) => (
                  <div key={m.mes} className="flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 text-muted-foreground">{mesLabel(m.mes)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(m.total / maxMes) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-semibold tabular-nums text-foreground">{m.total}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </main>
  );
}
