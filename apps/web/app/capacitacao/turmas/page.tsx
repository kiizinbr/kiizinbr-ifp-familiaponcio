"use client";

import Link from "next/link";
import { ChevronRight, GraduationCap, Users } from "lucide-react";

import { STATUS_TURMA_LABEL, type StatusTurma } from "@/lib/api";
import { useTurmas } from "@/lib/use-capacitacao";
import { Alerta, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

const statusEstilo: Record<StatusTurma, string> = {
  INSCRICOES_ABERTAS: "border-info/50 text-info",
  EM_ANDAMENTO: "border-primary/60 bg-primary/10 text-primary",
  ENCERRADA: "border-success/50 text-success",
};

export default function TurmasPage() {
  const { data, isLoading, isError, error } = useTurmas();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground">Minhas turmas</h1>

      {isLoading ? <Spinner label="Carregando turmas..." /> : null}
      {isError ? (
        <div className="mt-6">
          <Alerta>Não foi possível carregar: {(error as Error)?.message}</Alerta>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhuma turma na sua unidade ainda.
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {data?.items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/capacitacao/turmas/${t.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-ifp-sm transition hover:shadow-casa-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground group-hover:text-primary">
                  {t.curso.nome}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t.codigo}
                  </span>
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {t.diasHorario}
                  {t.sala ? ` · ${t.sala}` : ""} · {t.curso.cargaHorariaTotal}h
                </div>
              </div>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <Users className="h-3.5 w-3.5" />
                {t._count.matriculas}/{t.vagasTotais}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusEstilo[t.status],
                )}
              >
                {STATUS_TURMA_LABEL[t.status]}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
