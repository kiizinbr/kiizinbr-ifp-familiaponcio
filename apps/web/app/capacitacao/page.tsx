"use client";

import Link from "next/link";
import { Award, GraduationCap, Hourglass, Users } from "lucide-react";

import { useResumoCapacitacao } from "@/lib/use-capacitacao";

function Kpi({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string;
  valor: number | string;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-ifp-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <span className="text-primary">{icone}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{valor}</div>
    </div>
  );
}

export default function CapacitacaoHome() {
  const { data } = useResumoCapacitacao();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Centro de Capacitação</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cursos profissionalizantes, turmas e certificados verificáveis.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Turmas em andamento" valor={data?.turmasEmAndamento ?? "—"} icone={<GraduationCap className="h-5 w-5" />} />
        <Kpi rotulo="Alunos ativos" valor={data?.alunosAtivos ?? "—"} icone={<Users className="h-5 w-5" />} />
        <Kpi rotulo="Certificados emitidos" valor={data?.certificadosEmitidos ?? "—"} icone={<Award className="h-5 w-5" />} />
        <Kpi rotulo="Lista de espera" valor={data?.listaEspera ?? "—"} icone={<Hourglass className="h-5 w-5" />} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/capacitacao/turmas"
          className="group rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:shadow-casa-sm"
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
    </main>
  );
}
