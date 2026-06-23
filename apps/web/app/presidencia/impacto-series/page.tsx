"use client";

/**
 * Impacto longitudinal — uma série temporal POR MÊS para cada vertical
 * (atendimentos, matrículas, graduações, certificados e presenças), cruzando o
 * que as unidades já registram. Escolhe a janela (6/12/24 meses); os números
 * grandes do topo são a soma das próprias séries. Só leitura agregada, sem IA.
 */
import { useState } from "react";
import { Activity, Award, CalendarCheck, GraduationCap, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { useImpactoSeries, type SerieImpacto } from "@/lib/use-presidencia";
import { SerieMensal } from "../_components";

const JANELAS = [6, 12, 24] as const;

/** Ícone por série (a chave casa com o que a API devolve). */
const ICONE: Record<SerieImpacto["chave"], LucideIcon> = {
  atendimentos: Activity,
  matriculas: CalendarCheck,
  graduacoes: GraduationCap,
  certificados: ScrollText,
  presencas: Award,
};

export default function ImpactoSeriesPage() {
  const [meses, setMeses] = useState<number>(12);
  const { data, isLoading, error } = useImpactoSeries(meses);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Séries de Impacto"
        descricao="A evolução mês a mês de cada frente do Instituto."
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

      {isLoading && !data ? <Spinner label="Carregando séries..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Atendimentos" valor={data.kpis.atendimentos.toLocaleString("pt-BR")} />
            <Kpi label="Matrículas" valor={data.kpis.matriculas.toLocaleString("pt-BR")} />
            <Kpi label="Graduações" valor={data.kpis.graduacoes.toLocaleString("pt-BR")} />
            <Kpi label="Certificados" valor={data.kpis.certificados.toLocaleString("pt-BR")} />
            <Kpi label="Presenças" valor={data.kpis.presencas.toLocaleString("pt-BR")} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Totais somados ao longo dos últimos {data.meses} meses.
          </p>

          <div className="mt-6 space-y-4">
            {data.series.map((serie) => {
              const Icone = ICONE[serie.chave] ?? Activity;
              return (
                <Card key={serie.chave}>
                  <SecTitle icon={<Icone />}>{serie.label} por mês</SecTitle>
                  <SerieMensal dados={serie.pontos} />
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </main>
  );
}
