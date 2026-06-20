"use client";

/**
 * Famílias — retrato agregado e anônimo da base de fichas: bairros, perfil
 * socioeconômico, situação das fichas e faixa etária. A presidência vê
 * contagens, nunca a ficha individual.
 */
import { Home, MapPin, PieChart, Users } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { useFamiliasPresidencia } from "@/lib/use-presidencia";
import { Barras } from "../_components";

const MORADIA_LABEL: Record<string, string> = {
  PROPRIA: "Própria",
  ALUGADA: "Alugada",
  CEDIDA: "Cedida",
  FINANCIADA: "Financiada",
  OCUPACAO: "Ocupação",
  OUTRA: "Outra",
};

function pct(parte: number, total: number) {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

export default function FamiliasPresidenciaPage() {
  const { data, isLoading, error } = useFamiliasPresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Famílias"
        descricao="Quem o Instituto acolhe — contagem agregada e anonimizada."
      />

      {isLoading ? <Spinner label="Carregando famílias..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Famílias ativas" valor={data.total.toLocaleString("pt-BR")} />
            <Kpi label="Pessoas impactadas" valor={data.pessoasImpactadas.toLocaleString("pt-BR")} />
            <Kpi label="Novas no mês" valor={data.novasMes} />
            <Kpi label="Em triagem" valor={data.situacao.emTriagem} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <SecTitle icon={<MapPin />}>Distribuição por bairro</SecTitle>
              <Barras
                itens={data.porBairro.map((b) => ({ label: b.bairro, valor: b.total }))}
              />
            </Card>

            <Card>
              <SecTitle icon={<Users />}>Faixa etária</SecTitle>
              <Barras
                itens={data.faixaEtaria.map((f) => ({ label: `${f.faixa} anos`, valor: f.total }))}
              />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <SecTitle icon={<PieChart />}>Perfil socioeconômico</SecTitle>
              {data.perfilSocio.comDados === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ficha tem dados socioeconômicos preenchidos ainda.
                </p>
              ) : (
                <div className="space-y-3 text-sm">
                  <Linha
                    rotulo="Fichas com dados socioeconômicos"
                    valor={data.perfilSocio.comDados.toLocaleString("pt-BR")}
                  />
                  <Linha
                    rotulo="Renda per capita média"
                    valor={
                      data.perfilSocio.rendaPerCapitaMedia != null
                        ? data.perfilSocio.rendaPerCapitaMedia.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"
                    }
                  />
                  <Linha
                    rotulo="Recebe Bolsa Família"
                    valor={`${data.perfilSocio.recebeBolsaFamilia} (${pct(data.perfilSocio.recebeBolsaFamilia, data.perfilSocio.comDados)})`}
                  />
                  <Linha
                    rotulo="Recebe BPC"
                    valor={`${data.perfilSocio.recebeBPC} (${pct(data.perfilSocio.recebeBPC, data.perfilSocio.comDados)})`}
                  />
                  {data.perfilSocio.moradia.length > 0 ? (
                    <div className="pt-2">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Situação de moradia
                      </div>
                      <Barras
                        itens={data.perfilSocio.moradia.map((m) => ({
                          label: MORADIA_LABEL[m.situacao] ?? m.situacao,
                          valor: m.total,
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </Card>

            <Card>
              <SecTitle icon={<Home />}>Situação das fichas</SecTitle>
              <div className="grid grid-cols-3 gap-4 text-center">
                <Stat rotulo="Aprovadas" valor={data.situacao.aprovadas} />
                <Stat rotulo="Em triagem" valor={data.situacao.emTriagem} />
                <Stat rotulo="Inativas" valor={data.situacao.inativas} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                &quot;Aprovadas&quot; = famílias com ao menos uma elegibilidade aprovada em alguma
                unidade. &quot;Em triagem&quot; = fichas ativas ainda sem aprovação.
              </p>
            </Card>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-semibold tabular-nums text-foreground">{valor}</span>
    </div>
  );
}

function Stat({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-4">
      <div className="text-2xl font-semibold tabular-nums text-foreground">
        {valor.toLocaleString("pt-BR")}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </div>
    </div>
  );
}
