"use client";

/**
 * Matrículas do semestre — visão consolidada que cruza TODAS as turmas da
 * unidade. Antes desta tela, a lista de alunos só existia dentro de uma turma;
 * aqui o instrutor acompanha quem está matriculado no período inteiro, com
 * filtro por situação. Leitura agregada (a alteração de matrícula segue na turma).
 */
import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";

import { Alerta, Select, Spinner } from "@/components/ui";
import { Card, Kpi, PageHeader, Pill, SecTitle } from "@/components/casa";
import { STATUS_MATRICULA_LABEL, STATUS_TURMA_LABEL, type StatusMatricula } from "@/lib/api";
import { useMatriculasSemestre } from "@/lib/use-capacitacao";

/** Tom da pílula por situação da matrícula (espelha a UI da turma). */
function tomStatus(status: StatusMatricula): "ok" | "warn" | "neutro" | "unidade" {
  if (status === "ATIVA") return "ok";
  if (status === "CONCLUIDA") return "unidade";
  if (status === "LISTA_ESPERA" || status === "TRANCADA" || status === "EVADIDA") return "warn";
  return "neutro";
}

const OPCOES_FILTRO: { valor: StatusMatricula | "TODOS"; label: string }[] = [
  { valor: "TODOS", label: "Todas as situações" },
  { valor: "ATIVA", label: "Ativas" },
  { valor: "LISTA_ESPERA", label: "Lista de espera" },
  { valor: "CONCLUIDA", label: "Concluídas" },
  { valor: "TRANCADA", label: "Trancadas" },
  { valor: "EVADIDA", label: "Evadidas" },
];

export default function PaginaMatriculas() {
  const [filtro, setFiltro] = useState<StatusMatricula | "TODOS">("TODOS");
  const { data, isLoading, isFetching, error } = useMatriculasSemestre(filtro);

  const ativas = data?.totaisPorStatus.ATIVA ?? 0;
  const espera = data?.totaisPorStatus.LISTA_ESPERA ?? 0;
  const concluidas = data?.totaisPorStatus.CONCLUIDA ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Matrículas do semestre"
        descricao="Todos os alunos matriculados na unidade, agrupados por turma."
        acoes={
          <Select
            aria-label="Filtrar por situação"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as StatusMatricula | "TODOS")}
          >
            {OPCOES_FILTRO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </Select>
        }
      />

      {/* KPIs do período (não mudam com o filtro: vêm do conjunto carregado). */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" valor={data?.total ?? 0} />
        <Kpi label="Ativas" valor={ativas} />
        <Kpi label="Lista de espera" valor={espera} />
        <Kpi label="Concluídas" valor={concluidas} />
      </div>

      {isLoading ? <Spinner label="Carregando matrículas..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        data.turmas.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-5 w-5" />
            Nenhuma matrícula{filtro !== "TODOS" ? " nesta situação" : ""} no momento.
          </Card>
        ) : (
          <div className={isFetching ? "space-y-6 opacity-70" : "space-y-6"}>
            {data.turmas.map((turma) => (
              <section key={turma.turmaId}>
                <SecTitle icon={<GraduationCap />}>
                  <Link
                    href={`/capacitacao/turmas/${turma.turmaId}`}
                    className="normal-case tracking-normal hover:text-primary hover:underline"
                  >
                    {turma.codigo} · {turma.curso}
                  </Link>
                  <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                    {STATUS_TURMA_LABEL[turma.statusTurma]} · {turma.alunos.length} aluno
                    {turma.alunos.length === 1 ? "" : "s"}
                  </span>
                </SecTitle>
                <div className="space-y-2">
                  {turma.alunos.map((a) => (
                    <Card key={a.id}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] text-sm font-semibold text-[var(--unidade-escuro)]">
                          {a.aluno.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground">{a.aluno}</div>
                          <div className="text-xs text-muted-foreground">
                            Protocolo {a.protocolo}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tom={tomStatus(a.status)}>
                            {STATUS_MATRICULA_LABEL[a.status]}
                            {a.status === "LISTA_ESPERA" && a.posicaoEspera
                              ? ` (${a.posicaoEspera}º)`
                              : ""}
                          </Pill>
                          {a.certificado ? <Pill tom="ok">Certificado</Pill> : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}
    </main>
  );
}
