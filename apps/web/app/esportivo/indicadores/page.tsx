"use client";

/**
 * Indicadores do Centro Esportivo: graduações concedidas por mês, frequência
 * por modalidade e evasão por modalidade.
 * Molde: indicadores do Médico (mesmas barras horizontais + KPIs).
 */
import { useIndicadoresEsportivo } from "@/lib/use-esportivo";
import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";

function mesLabel(ym: string) {
  const [ano = "", mes = ""] = ym.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}

/** Barra horizontal genérica (rótulo · trilho · valor) na cor da unidade. */
function Barra({ label, valor, max, sufixo }: { label: string; valor: number; max: number; sufixo?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(valor / max) * 100}%` }} />
      </div>
      <span className="w-12 text-right font-semibold tabular-nums text-foreground">
        {valor}
        {sufixo ?? ""}
      </span>
    </div>
  );
}

export default function IndicadoresEsportivoPage() {
  const { data, isLoading, error } = useIndicadoresEsportivo();
  const maxMes = Math.max(1, ...(data?.graduacoesPorMes ?? []).map((m) => m.total));

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader titulo="Indicadores" descricao="Graduações, frequência e evasão do Centro Esportivo." />

      {isLoading ? <Spinner label="Carregando indicadores..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi
              label="Frequência geral"
              valor={data.taxaFrequenciaGeral != null ? `${data.taxaFrequenciaGeral}%` : "—"}
            />
            <Kpi
              label="Evasão geral"
              valor={data.taxaEvasaoGeral != null ? `${data.taxaEvasaoGeral}%` : "—"}
              alerta={data.taxaEvasaoGeral != null && data.taxaEvasaoGeral >= 20}
            />
          </div>

          <Card className="mt-6">
            <SecTitle>Graduações concedidas por mês (6 meses)</SecTitle>
            {data.graduacoesPorMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma graduação no período.</p>
            ) : (
              <div className="space-y-2">
                {data.graduacoesPorMes.map((m) => (
                  <Barra key={m.mes} label={mesLabel(m.mes)} valor={m.total} max={maxMes} />
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <SecTitle>Frequência por modalidade</SecTitle>
            <p className="mb-2 text-xs text-muted-foreground">
              % de comparecimento (presentes + atrasos) sobre as chamadas seladas.
            </p>
            {data.frequenciaPorModalidade.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem chamadas seladas ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.frequenciaPorModalidade.map((f) => (
                  <div key={f.modalidade}>
                    <Barra label={f.modalidade} valor={f.pct ?? 0} max={100} sufixo="%" />
                    <div className="ml-[7.75rem] mt-0.5 flex gap-3 text-[11px] text-muted-foreground">
                      <span className="text-success">{f.presencas} compareceram</span>
                      <span className="text-ifp-orange">{f.atrasos} atraso(s)</span>
                      <span className="text-danger">{f.faltas} falta(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <SecTitle>Evasão por modalidade</SecTitle>
            {data.evasaoPorModalidade.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem matrículas para medir evasão.</p>
            ) : (
              <div className="space-y-3">
                {data.evasaoPorModalidade.map((e) => (
                  <div key={e.modalidade} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{e.modalidade}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-warning"
                        style={{ width: `${e.pct ?? 0}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-semibold tabular-nums text-foreground">
                      {e.evadidas}/{e.base}
                      {e.pct != null ? ` (${e.pct}%)` : ""}
                    </span>
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
