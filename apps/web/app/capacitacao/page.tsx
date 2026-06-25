"use client";

/**
 * Painel da Capacitação — visão de entrada da unidade. Junta os KPIs do
 * resumo (turmas em andamento, alunos ativos, certificados, lista de espera)
 * com widgets de desempenho (taxa de conclusão, cursos ativos) vindos dos
 * indicadores, e atalhos para as telas com filtro/busca (A3).
 */
import Link from "next/link";
import {
  Award,
  BarChart3,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  useIndicadoresCapacitacao,
  useResumoCapacitacao,
} from "@/lib/use-capacitacao";
import { Card, Kpi, PageHeader, Pill, SecTitle } from "@/components/casa";

const ATALHOS = [
  {
    href: "/capacitacao/turmas",
    icon: GraduationCap,
    titulo: "Minhas turmas",
    descricao: "Criar turma, matricular alunos, chamada e certificados.",
  },
  {
    href: "/capacitacao/matriculas",
    icon: Users,
    titulo: "Matrículas do semestre",
    descricao: "Buscar aluno, filtrar por situação e por curso.",
  },
  {
    href: "/capacitacao/certificados",
    icon: Award,
    titulo: "Certificados",
    descricao: "Consultar e baixar 2ª via — busca por aluno, curso e período.",
  },
  {
    href: "/capacitacao/indicadores",
    icon: BarChart3,
    titulo: "Indicadores",
    descricao: "Séries temporais e distribuição por status.",
  },
];

export default function CapacitacaoHome() {
  const { data: resumo } = useResumoCapacitacao();
  const { data: indicadores } = useIndicadoresCapacitacao();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Centro de Capacitação"
        descricao="Cursos profissionalizantes, turmas e certificados verificáveis."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Turmas em andamento" valor={resumo?.turmasEmAndamento ?? "—"} />
        <Kpi label="Alunos ativos" valor={resumo?.alunosAtivos ?? "—"} />
        <Kpi label="Certificados emitidos" valor={resumo?.certificadosEmitidos ?? "—"} />
        <Kpi label="Lista de espera" valor={resumo?.listaEspera ?? "—"} />
      </div>

      {/* Widgets de desempenho — leitura agregada dos indicadores da unidade. */}
      <Card className="mt-6">
        <SecTitle icon={<TrendingUp />}>Resumo de desempenho</SecTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tom="unidade">
            {indicadores?.cursosAtivos ?? "—"} curso
            {indicadores?.cursosAtivos === 1 ? "" : "s"} ativo
            {indicadores?.cursosAtivos === 1 ? "" : "s"}
          </Pill>
          <Pill tom={indicadores?.taxaConclusao != null ? "ok" : "neutro"}>
            Taxa de conclusão{" "}
            {indicadores?.taxaConclusao != null ? `${indicadores.taxaConclusao}%` : "—"}
          </Pill>
          <Pill>
            {indicadores?.matriculas?.CONCLUIDA ?? 0} concluída
            {(indicadores?.matriculas?.CONCLUIDA ?? 0) === 1 ? "" : "s"}
          </Pill>
          <Pill tom="warn">
            {indicadores?.matriculas?.EVADIDA ?? 0} evadida
            {(indicadores?.matriculas?.EVADIDA ?? 0) === 1 ? "" : "s"}
          </Pill>
        </div>
      </Card>

      <Card className="mt-6">
        <SecTitle icon={<GraduationCap />}>Atalhos</SecTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ATALHOS.map((a) => {
            const Icone = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)] transition hover:shadow-casa-sm"
              >
                <Icone className="h-6 w-6 text-primary" />
                <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                  {a.titulo}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
              </Link>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
