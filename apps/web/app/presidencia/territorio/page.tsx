"use client";

/**
 * Panorama Territorial — distribuição das famílias ativas POR BAIRRO (e cidade),
 * com o cruzamento bairro × unidade. Honesto por construção: NÃO é mapa
 * geográfico (o banco não guarda lat/long), e NÃO há "demanda reprimida"
 * (não existe dado para isso). Só o endereço já cadastrado nas fichas.
 */
import { Building2, MapPin, Network } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import {
  UNIDADE_COR,
  UNIDADE_LABEL,
  useTerritorioPresidencia,
} from "@/lib/use-presidencia";
import { Barras } from "../_components";

function pct(parte: number, total: number) {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

export default function TerritorioPresidenciaPage() {
  const { data, isLoading, error } = useTerritorioPresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Panorama territorial por bairro"
        descricao="Onde as famílias moram — distribuição por bairro e cidade do endereço cadastrado. Não é um mapa geográfico."
      />

      {isLoading ? <Spinner label="Carregando o território..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Famílias ativas" valor={data.totalFamilias.toLocaleString("pt-BR")} />
            <Kpi
              label="Com bairro informado"
              valor={data.familiasComBairro.toLocaleString("pt-BR")}
              delta={`${pct(data.familiasComBairro, data.totalFamilias)} do total`}
            />
            <Kpi label="Bairros distintos" valor={data.bairrosDistintos} />
            <Kpi label="Cidades" valor={data.porCidade.length} />
          </div>

          {data.totalFamilias === 0 ? (
            <Card className="mt-6">
              <p className="text-sm text-muted-foreground">
                Ainda não há famílias ativas para montar o panorama territorial.
              </p>
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Card>
                  <SecTitle icon={<MapPin />}>Distribuição por bairro</SecTitle>
                  <Barras
                    itens={data.porBairro.map((b) => ({ label: b.bairro, valor: b.total }))}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Contagem de famílias ativas por bairro. A soma das barras é o total de
                    famílias ({data.totalFamilias.toLocaleString("pt-BR")}).
                  </p>
                </Card>

                <Card>
                  <SecTitle icon={<Building2 />}>Distribuição por cidade</SecTitle>
                  <Barras
                    itens={data.porCidade.map((c) => ({ label: c.cidade, valor: c.total }))}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Cidade do endereço cadastrado em cada ficha.
                  </p>
                </Card>
              </div>

              <Card className="mt-4">
                <SecTitle icon={<Network />}>Bairros por unidade</SecTitle>
                {data.porBairroUnidade.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ainda não há famílias com elegibilidade aprovada em alguma unidade.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {data.porBairroUnidade.map((linha) => {
                      const totalLinha = linha.unidades.reduce((s, u) => s + u.total, 0);
                      return (
                        <div key={linha.bairro}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">{linha.bairro}</span>
                            <span className="text-xs text-muted-foreground">
                              {totalLinha.toLocaleString("pt-BR")} elegibilidades aprovadas
                            </span>
                          </div>
                          <Barras
                            itens={linha.unidades.map((u) => ({
                              label: UNIDADE_LABEL[u.tipo] ?? u.tipo,
                              valor: u.total,
                              cor: UNIDADE_COR[u.tipo],
                            }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Cruzamento real bairro × unidade pelas elegibilidades aprovadas. Uma família
                  atendida em mais de uma unidade conta em cada uma — por isso este total é maior
                  que o de famílias e é medido em elegibilidades, não em famílias.
                </p>
              </Card>
            </>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Panorama baseado no endereço cadastrado nas fichas. Não há geolocalização (latitude /
            longitude), mapa de calor nem estimativa de demanda — só o dado real de bairro e cidade.
          </p>
        </>
      ) : null}
    </main>
  );
}
