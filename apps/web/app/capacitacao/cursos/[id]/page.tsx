"use client";

/**
 * Detalhe do curso: identidade (modalidade, carga, presença mínima) + a trilha
 * curricular — módulos ordenados, cada um com sua ementa. A trilha vem do seed
 * por enquanto (não há edição nesta tela); é o conteúdo que sustenta a turma.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, GraduationCap, Layers, ListChecks } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill, SecTitle } from "@/components/casa";
import { MODALIDADE_LABEL, useCursoDetalhe } from "@/lib/use-capacitacao";

export default function PaginaCursoDetalhe() {
  const params = useParams<{ id: string }>();
  const cursoId = params?.id;
  const { data: curso, isLoading, error } = useCursoDetalhe(cursoId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/capacitacao/cursos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Cursos
      </Link>

      {isLoading ? <Spinner label="Carregando curso..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {curso ? (
        <>
          <PageHeader
            titulo={curso.nome}
            descricao={
              <div className="flex flex-wrap gap-1.5">
                <Pill tom="unidade">{MODALIDADE_LABEL[curso.modalidade]}</Pill>
                <Pill>{curso.cargaHorariaTotal}h totais</Pill>
                <Pill>presença mín. {curso.presencaMinimaPct}%</Pill>
                <Pill>
                  {curso._count.turmas} turma{curso._count.turmas === 1 ? "" : "s"}
                </Pill>
                {curso.requerModelos ? <Pill tom="warn">Requer banco de modelos</Pill> : null}
                {!curso.ativo ? <Pill tom="warn">Inativo</Pill> : null}
              </div>
            }
            acoes={
              <Link
                href="/capacitacao/turmas"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <GraduationCap className="h-4 w-4" /> Ver turmas
              </Link>
            }
          />

          <SecTitle icon={<Layers />}>
            Trilha do curso
            {curso.cargaModulos > 0 ? (
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
                · {curso.cargaModulos}h em módulos
              </span>
            ) : null}
          </SecTitle>

          {curso.modulos.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-5 w-5" />
              Este curso ainda não tem módulos cadastrados.
            </Card>
          ) : (
            <ol className="space-y-3">
              {curso.modulos.map((mod) => (
                <li key={mod.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] text-sm font-semibold text-[var(--unidade-escuro)]">
                        {mod.ordem}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground">{mod.nome}</div>
                      </div>
                      {mod.cargaHoraria ? <Pill>{mod.cargaHoraria}h</Pill> : null}
                    </div>
                    {mod.itens.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                        {mod.itens.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {item.descricao}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </main>
  );
}
