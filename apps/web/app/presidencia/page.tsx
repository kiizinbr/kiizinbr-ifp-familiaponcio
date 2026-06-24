"use client";

/**
 * Sala de Comando — painel inicial da Presidência. KPIs de volume cruzando
 * todas as unidades + atalhos para as visões aprofundadas. Tudo com dado real.
 */
import Link from "next/link";
import { ArrowRight, BarChart3, LayoutGrid, MapPin, Network, Users } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { useResumoPresidencia } from "@/lib/use-presidencia";

const ATALHOS = [
  {
    href: "/presidencia/familias",
    titulo: "Famílias",
    desc: "Bairros, perfil socioeconômico e faixa etária.",
    icone: Users,
  },
  {
    href: "/presidencia/unidades",
    titulo: "Unidades",
    desc: "Ocupação, fila e volume de cada salão.",
    icone: LayoutGrid,
  },
  {
    href: "/presidencia/impacto",
    titulo: "Impacto",
    desc: "Tendência de 12 meses e crescimento.",
    icone: BarChart3,
  },
  {
    href: "/presidencia/territorio",
    titulo: "Território",
    desc: "Distribuição das famílias por bairro e cidade.",
    icone: MapPin,
  },
  {
    href: "/presidencia/jornada",
    titulo: "Jornada da Família",
    desc: "Famílias que cruzam 2+ unidades.",
    icone: Network,
  },
];

export default function PresidenciaHome() {
  const { data, isLoading, error } = useResumoPresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Sala de Comando"
        descricao="Visão integrada do Instituto Família Poncio — números agregados e anônimos."
      />

      {isLoading ? <Spinner label="Carregando o painel..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Famílias atendidas" valor={data.familiasAtendidas.toLocaleString("pt-BR")} />
            <Kpi label="Pessoas impactadas" valor={data.pessoasImpactadas.toLocaleString("pt-BR")} />
            <Kpi label="Novas fichas no mês" valor={data.novasFichasMes} />
            <Kpi label="Atendimentos no mês" valor={data.atendimentosMes} />
          </div>

          <Card className="mt-6">
            <SecTitle icon={<BarChart3 />}>Operação em números</SecTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              <Numero rotulo="Famílias ativas" valor={data.familiasAtivas} />
              <Numero rotulo="Matrículas ativas" valor={data.matriculasAtivas} />
              <Numero rotulo="Certificados" valor={data.certificados} />
              <Numero rotulo="Graduações" valor={data.graduacoes} />
              <Numero rotulo="Profissionais" valor={data.profissionaisAtivos} />
              <Numero rotulo="Unidades" valor={data.unidadesAtivas} />
            </div>
          </Card>

          <h3 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Aprofundar
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ATALHOS.map((a) => {
              const Icone = a.icone;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)] transition hover:border-primary/50 hover:shadow-casa-sm"
                >
                  <span className="text-primary">
                    <Icone className="h-6 w-6" />
                  </span>
                  <h4 className="mt-3 flex items-center gap-1 font-semibold text-foreground group-hover:text-primary">
                    {a.titulo}
                    <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </main>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums text-foreground">
        {valor.toLocaleString("pt-BR")}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </div>
    </div>
  );
}
