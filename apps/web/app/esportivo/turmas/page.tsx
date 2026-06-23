"use client";

/**
 * Catálogo de turmas do Centro Esportivo: filtros por modalidade/status e
 * grade de horários (turmas agrupadas pelo slot "dias/horário").
 * Read-only — só metadados de turma (sem PII de atleta).
 */
import { useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronRight, Filter, Medal } from "lucide-react";

import { Card, ListRow, PageHeader, Pill, SecTitle } from "@/components/casa";
import { Alerta, Campo, Select, Spinner } from "@/components/ui";
import { STATUS_TURMA_LABEL } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useCatalogoEsportivo, useModalidades, type TurmaCatalogoItem } from "@/lib/use-esportivo";

function pillTom(status: TurmaCatalogoItem["status"]) {
  if (status === "EM_ANDAMENTO") return "unidade" as const;
  if (status === "INSCRICOES_ABERTAS") return "ok" as const;
  return "neutro" as const;
}

function LinhaTurma({ t }: { t: TurmaCatalogoItem }) {
  return (
    <Link href={`/esportivo/turmas/${t.id}`} className="group block">
      <ListRow
        className="transition group-hover:shadow-casa-sm"
        avatar={<Medal className="h-4 w-4" />}
        titulo={
          <span className="group-hover:text-primary">
            {t.modalidade.nome} · {t.codigo}
          </span>
        }
        subtitulo={`${t.diasHorario}${t.local ? ` · ${t.local}` : ""} · ${t.atletasAtivos}/${t.vagasTotais} atletas${
          t.faixaEtariaMin != null && t.faixaEtariaMax != null
            ? ` · ${t.faixaEtariaMin}–${t.faixaEtariaMax} anos`
            : ""
        }`}
        trailing={
          <div className="flex items-center gap-2">
            <Pill tom={pillTom(t.status)}>{STATUS_TURMA_LABEL[t.status]}</Pill>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        }
      />
    </Link>
  );
}

export default function CatalogoTurmasPage() {
  const [modalidadeId, setModalidadeId] = useState("");
  const [status, setStatus] = useState("");
  const { data: modalidades } = useModalidades();
  const { data, isLoading, error } = useCatalogoEsportivo({ modalidadeId, status });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Turmas"
        descricao="Catálogo completo com filtros e grade de horários."
      />

      <Card>
        <SecTitle icon={<Filter />}>Filtros</SecTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Modalidade" htmlFor="f-modalidade">
            <Select
              id="f-modalidade"
              value={modalidadeId}
              onChange={(e) => setModalidadeId(e.target.value)}
            >
              <option value="">Todas</option>
              {modalidades?.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Situação" htmlFor="f-status">
            <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="INSCRICOES_ABERTAS">Inscrições abertas</option>
              <option value="ENCERRADA">Encerrada</option>
            </Select>
          </Campo>
        </div>
      </Card>

      {isLoading ? (
        <div className="mt-6">
          <Spinner label="Carregando turmas..." />
        </div>
      ) : null}
      {error ? (
        <div className="mt-6">
          <Alerta>{(error as Error).message}</Alerta>
        </div>
      ) : null}

      {data ? (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {data.total} turma(s)
          </p>

          {data.total === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              <Medal className="mx-auto mb-2 h-5 w-5" />
              Nenhuma turma com esses filtros.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <SecTitle icon={<CalendarRange />}>Grade de horários</SecTitle>
              {data.grade.map((slot) => (
                <section key={slot.diasHorario}>
                  <div className={cn("mb-2 text-sm font-semibold text-foreground")}>
                    {slot.diasHorario}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {slot.turmas.length} turma(s)
                    </span>
                  </div>
                  {slot.turmas.map((t) => (
                    <LinhaTurma key={t.id} t={t} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
