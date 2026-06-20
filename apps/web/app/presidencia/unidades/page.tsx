"use client";

/**
 * Unidades — pulso de ocupação dos salões por capacidade (creche, cursos,
 * esporte) e volume do Centro Médico (que não tem vaga fixa). Tabela comparativa.
 */
import { Card, Kpi, PageHeader, Pill, Pulso, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import {
  UNIDADE_COR,
  useUnidadesPresidencia,
  type UnidadePulso,
} from "@/lib/use-presidencia";

function statusOcupacao(pct: number) {
  if (pct >= 90) return <Pill tom="warn">Sob pressão</Pill>;
  if (pct >= 80) return <Pill tom="unidade">Saudável</Pill>;
  return <Pill tom="ok">Com folga</Pill>;
}

export default function UnidadesPresidenciaPage() {
  const { data, isLoading, error } = useUnidadesPresidencia();

  const capacidade = data?.unidades.filter((u) => u.modo === "capacidade") ?? [];
  const volume = data?.unidades.filter((u) => u.modo === "volume") ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader titulo="Unidades" descricao="Ocupação, fila e volume de cada salão da Corte." />

      {isLoading ? <Spinner label="Carregando unidades..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ocupação média"
              valor={data.kpis.ocupacaoMedia != null ? `${data.kpis.ocupacaoMedia}%` : "—"}
            />
            <Kpi label="Vagas preenchidas" valor={data.kpis.vagasPreenchidas.toLocaleString("pt-BR")} />
            <Kpi label="Em lista de espera" valor={data.kpis.listaEspera} />
            <Kpi
              label="Sob pressão"
              valor={`${data.kpis.sobPressao} de ${capacidade.length}`}
              alerta={data.kpis.sobPressao > 0}
            />
          </div>

          {capacidade.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {capacidade.map((u) => (
                <Pulso
                  key={u.tipo}
                  nome={u.nome}
                  meta={`${u.ativos ?? 0}/${u.vagas ?? 0} vagas · fila ${u.listaEspera ?? 0}`}
                  pct={u.ocupacaoPct ?? 0}
                  cor={UNIDADE_COR[u.tipo] ?? "var(--unidade)"}
                  status={statusOcupacao(u.ocupacaoPct ?? 0)}
                />
              ))}
            </div>
          ) : null}

          {volume.map((u) => (
            <Card key={u.tipo} className="mt-4">
              <SecTitle>{u.nome} · volume</SecTitle>
              <p className="mb-3 text-xs text-muted-foreground">
                O Centro Médico não trabalha com vaga fixa — acompanhamos por volume de atendimento.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <Mini rotulo="Beneficiários" valor={u.beneficiarios ?? 0} />
                <Mini rotulo="Agenda ativa" valor={u.agendamentosAtivos ?? 0} />
                <Mini rotulo="Atend. no mês" valor={u.atendimentosMes ?? 0} />
              </div>
            </Card>
          ))}

          <Card className="mt-4 overflow-x-auto">
            <SecTitle>Comparativo das unidades</SecTitle>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Unidade</th>
                  <th className="py-2 pr-3 font-semibold">Beneficiários</th>
                  <th className="py-2 pr-3 font-semibold">Ativos / Vagas</th>
                  <th className="py-2 pr-3 font-semibold">Fila</th>
                  <th className="py-2 pr-3 font-semibold">Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {data.unidades.map((u) => (
                  <Linha key={u.tipo} u={u} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </main>
  );
}

function Linha({ u }: { u: UnidadePulso }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-3 font-semibold text-foreground">{u.nome}</td>
      <td className="py-2.5 pr-3 tabular-nums text-foreground">{u.beneficiarios ?? "—"}</td>
      <td className="py-2.5 pr-3 tabular-nums text-foreground">
        {u.modo === "capacidade" ? `${u.ativos ?? 0} / ${u.vagas ?? 0}` : "—"}
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-foreground">
        {u.listaEspera != null ? u.listaEspera : "—"}
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-foreground">
        {u.ocupacaoPct != null ? `${u.ocupacaoPct}%` : "—"}
      </td>
    </tr>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: number }) {
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
