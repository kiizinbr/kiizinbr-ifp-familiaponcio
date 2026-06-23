"use client";

/**
 * Indicadores do Centro Educacional (creche): presença dos últimos 7 dias,
 * fechamento dos diários do dia e ocupação por turma.
 * Molde: indicadores do Esportivo (mesmas barras horizontais + KPIs).
 */
import { useIndicadoresEducacional } from "@/lib/use-educacional";
import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Rótulo curto do dia (ex.: "qua 18/06") a partir de AAAA-MM-DD. */
function diaLabel(iso: string) {
  const [ano = "", mes = "", dia = ""] = iso.split("-");
  // Constrói no fuso de SP (meia-noite -03:00) para o nome do dia não virar.
  const d = new Date(`${iso}T12:00:00-03:00`);
  const nome = Number.isNaN(d.getTime()) ? "" : DIAS_SEMANA[d.getDay()];
  return `${nome} ${dia}/${mes}`;
}

/** Barra horizontal (rótulo · trilho · valor) na cor da unidade. */
function Barra({
  label,
  valor,
  max,
  sufixo,
}: {
  label: string;
  valor: number;
  max: number;
  sufixo?: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max > 0 ? (valor / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-12 text-right font-semibold tabular-nums text-foreground">
        {valor}
        {sufixo ?? ""}
      </span>
    </div>
  );
}

export default function IndicadoresEducacionalPage() {
  const { data, isLoading, error } = useIndicadoresEducacional();
  const maxPresenca = Math.max(1, ...(data?.presencaPorDia ?? []).map((d) => d.presentes));

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Indicadores"
        descricao="Presença, diários e ocupação do Centro Educacional."
      />

      {isLoading ? <Spinner label="Carregando indicadores..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi
              label="Ocupação geral"
              valor={data.ocupacao.pct != null ? `${data.ocupacao.pct}%` : "—"}
            />
            <Kpi
              label="Diários fechados hoje"
              valor={`${data.diarios.fechados}/${data.diarios.fechados + data.diarios.abertos}`}
            />
            <Kpi
              label="Taxa de fechamento"
              valor={data.diarios.taxaFechamento != null ? `${data.diarios.taxaFechamento}%` : "—"}
              alerta={data.diarios.taxaFechamento != null && data.diarios.taxaFechamento < 100}
            />
          </div>

          <Card className="mt-6">
            <SecTitle>Presença por dia (últimos 7 dias)</SecTitle>
            {data.presencaPorDia.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem check-ins no período.</p>
            ) : (
              <div className="space-y-2">
                {data.presencaPorDia.map((d) => (
                  <Barra
                    key={d.dia}
                    label={diaLabel(d.dia)}
                    valor={d.presentes}
                    max={maxPresenca}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <SecTitle>Ocupação por turma</SecTitle>
            {data.ocupacaoPorTurma.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.ocupacaoPorTurma.map((t) => (
                  <div key={t.turmaId} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{t.nome}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${t.pct ?? 0}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-semibold tabular-nums text-foreground">
                      {t.matriculados}/{t.capacidade}
                      {t.pct != null ? ` (${t.pct}%)` : ""}
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
