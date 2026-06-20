"use client";

/**
 * Impacto — tendência dos últimos 12 meses: famílias acolhidas e atendimentos
 * por mês, e crescimento (novas famílias atendidas) por unidade no período.
 */
import { Activity, BarChart3, TrendingUp } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { UNIDADE_COR, UNIDADE_LABEL, useImpactoPresidencia } from "@/lib/use-presidencia";
import { Barras, SerieMensal } from "../_components";

export default function ImpactoPresidenciaPage() {
  const { data, isLoading, error } = useImpactoPresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Impacto"
        descricao="Como o acolhimento cresceu nos últimos 12 meses."
      />

      {isLoading ? <Spinner label="Carregando impacto..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi
              label="Famílias atendidas"
              valor={data.kpis.familiasAtendidas.toLocaleString("pt-BR")}
            />
            <Kpi label="Atendimentos no mês" valor={data.kpis.atendimentosMes} />
          </div>

          <Card className="mt-6">
            <SecTitle icon={<TrendingUp />}>Novas famílias por mês</SecTitle>
            <SerieMensal dados={data.serieFamilias} />
          </Card>

          <Card className="mt-4">
            <SecTitle icon={<Activity />}>Atendimentos por mês</SecTitle>
            <SerieMensal dados={data.serieAtendimentos} />
          </Card>

          <Card className="mt-4">
            <SecTitle icon={<BarChart3 />}>Crescimento por unidade (12 meses)</SecTitle>
            <p className="mb-3 text-xs text-muted-foreground">
              Novas famílias aprovadas em cada unidade no período.
            </p>
            <Barras
              itens={data.crescimentoPorUnidade.map((u) => ({
                label: UNIDADE_LABEL[u.tipo] ?? u.nome,
                valor: u.total,
                cor: UNIDADE_COR[u.tipo],
              }))}
            />
          </Card>
        </>
      ) : null}
    </main>
  );
}
