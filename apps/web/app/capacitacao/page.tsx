"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { useResumoCapacitacao } from "@/lib/use-capacitacao";
import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";

export default function CapacitacaoHome() {
  const { data } = useResumoCapacitacao();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Centro de Capacitação"
        descricao="Cursos profissionalizantes, turmas e certificados verificáveis."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Turmas em andamento" valor={data?.turmasEmAndamento ?? "—"} />
        <Kpi label="Alunos ativos" valor={data?.alunosAtivos ?? "—"} />
        <Kpi label="Certificados emitidos" valor={data?.certificadosEmitidos ?? "—"} />
        <Kpi label="Lista de espera" valor={data?.listaEspera ?? "—"} />
      </div>

      <Card className="mt-8">
        <SecTitle icon={<GraduationCap />}>Atalhos</SecTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/capacitacao/turmas"
            className="group rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)] transition hover:shadow-casa-sm"
          >
            <GraduationCap className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
              Minhas turmas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Criar turma, matricular alunos, chamada e certificados.
            </p>
          </Link>
        </div>
      </Card>
    </main>
  );
}
