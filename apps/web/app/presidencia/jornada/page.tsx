"use client";

/**
 * Jornada da Família — o diferencial do IFP: a mesma família atravessando
 * várias unidades (médico + curso + creche + judô). Mede profundidade do
 * acolhimento, não só volume. Constelações anonimizadas (código, nunca nome).
 */
import { Network, Users, Waypoints } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { UNIDADE_COR, UNIDADE_LABEL, useJornadaPresidencia } from "@/lib/use-presidencia";
import { Barras } from "../_components";

export default function JornadaPresidenciaPage() {
  const { data, isLoading, error } = useJornadaPresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Jornada da Família"
        descricao="O impacto profundo: a mesma família transformada por várias unidades."
      />

      {isLoading ? <Spinner label="Carregando a jornada..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Famílias únicas" valor={data.familiasUnicas.toLocaleString("pt-BR")} />
            <Kpi
              label="Em 2+ unidades"
              valor={data.cross2mais}
              delta={
                data.familiasUnicas > 0
                  ? `${Math.round((data.cross2mais / data.familiasUnicas) * 100)}% do total`
                  : undefined
              }
            />
            <Kpi label="Em 3+ unidades" valor={data.cross3mais} />
            <Kpi label="Nas 4 unidades" valor={data.quatroUnidades} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <SecTitle icon={<Users />}>Profundidade do acolhimento</SecTitle>
              <Barras
                itens={data.distribuicao.map((d) => ({
                  label: `${d.unidades} ${d.unidades === 1 ? "unidade" : "unidades"}`,
                  valor: d.total,
                }))}
              />
            </Card>

            <Card>
              <SecTitle icon={<Waypoints />}>Pontes mais comuns</SecTitle>
              {data.pontes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há famílias cruzando duas unidades.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.pontes.map((p) => (
                    <div
                      key={`${p.tipo_a}-${p.tipo_b}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Ponto cor={UNIDADE_COR[p.tipo_a]} />
                        {UNIDADE_LABEL[p.tipo_a] ?? p.tipo_a}
                        <span className="text-muted-foreground">↔</span>
                        <Ponto cor={UNIDADE_COR[p.tipo_b]} />
                        {UNIDADE_LABEL[p.tipo_b] ?? p.tipo_b}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{p.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <SecTitle icon={<Network />}>Constelações de famílias</SecTitle>
            {data.constelacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma família cruza 2+ unidades por enquanto.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.constelacoes.map((c) => (
                  <div key={c.codigo} className="rounded-[18px] border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{c.codigo}</span>
                      <span className="text-xs text-muted-foreground">{c.pessoas} pessoas</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.unidades.map((u) => (
                        <span
                          key={u}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-foreground"
                        >
                          <Ponto cor={UNIDADE_COR[u]} />
                          {UNIDADE_LABEL[u] ?? u}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Identificação anonimizada — a Presidência vê o impacto, nunca o nome da família.
            </p>
          </Card>
        </>
      ) : null}
    </main>
  );
}

function Ponto({ cor }: { cor?: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: cor ?? "var(--unidade)" }}
    />
  );
}
