"use client";

/**
 * Índice das turmas do Centro Educacional: lista as turmas infantis com
 * ocupação e educador(a) responsável, cada uma abrindo a tela do dia
 * (check-in/out + diário). Reaproveita o mesmo dado do painel
 * (`useTurmasInfantis`) — read-only, sem PII de criança.
 */
import Link from "next/link";
import { Baby, BookOpenCheck, ChevronRight } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { ListRow, PageHeader } from "@/components/casa";
import { useTurmasInfantis } from "@/lib/use-educacional";

export default function TurmasEducacionalPage() {
  const { data, isLoading, error } = useTurmasInfantis();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        titulo="Turmas"
        descricao="Abra a turma para registrar check-in/out, rotina e diário do dia."
      />

      {isLoading ? (
        <div className="mt-6">
          <Spinner label="Carregando turmas..." />
        </div>
      ) : null}
      {error ? (
        <div className="mt-6">
          <Alerta tipo="erro">{(error as Error).message}</Alerta>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6">
          {data.items.map((t) => (
            <Link key={t.id} href={`/educacional/turmas/${t.id}`} className="group block">
              <ListRow
                className="transition group-hover:shadow-casa-sm"
                avatar={<Baby className="h-4 w-4" />}
                titulo={<span className="group-hover:text-primary">{t.nome}</span>}
                subtitulo={`${Math.floor(t.faixaEtariaMin / 12)}–${Math.floor(t.faixaEtariaMax / 12)} anos · ${t._count.matriculas}/${t.capacidade} crianças · ${t.educador.user.nome}`}
                trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
              />
            </Link>
          ))}
          {data.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              <BookOpenCheck className="mx-auto mb-2 h-5 w-5" />
              Nenhuma turma cadastrada ainda.
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
