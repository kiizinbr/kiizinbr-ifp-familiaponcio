"use client";

/**
 * Prontuários — atendimentos já selados pelo profissional logado (histórico do
 * que ele atendeu). Cada item abre a prancha (somente leitura quando selada).
 */
import Link from "next/link";
import { ClipboardList, FileText } from "lucide-react";

import { useProntuarios } from "@/lib/use-medico";
import { PageHeader } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProntuariosPage() {
  const { data, isLoading, error } = useProntuarios();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader titulo="Prontuários" descricao="Atendimentos selados por você." />

      {isLoading ? <Spinner label="Carregando prontuários..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      <ul className="mt-4 space-y-2">
        {data?.items.map((p) => {
          const corpo = (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">
                    {p.membro?.nomeCompleto ?? p.ficha.nomeCompleto}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.ficha.protocolo} · {dataBR(p.encerradoEm)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.cid10 ? <span className="font-medium text-foreground">{p.cid10}</span> : null}
                  {p.cid10 && (p.avaliacao || p.plano) ? " · " : ""}
                  {p.avaliacao ?? p.plano ?? "Sem avaliação registrada"}
                </div>
              </div>
            </div>
          );
          return (
            <li key={p.id}>
              {p.agendamentoId ? (
                <Link href={`/medico/atendimento/${p.agendamentoId}`} className="block transition hover:opacity-90">
                  {corpo}
                </Link>
              ) : (
                corpo
              )}
            </li>
          );
        })}
        {data && data.items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-6 w-6" />
            Nenhum atendimento selado ainda.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
