"use client";

/**
 * Modal "Nova conversa" do console da equipe: escolhe a turma e depois a
 * criança (reusa os endpoints existentes de turmas do educacional). O POST é
 * get-or-create — se já existe conversa da criança, só abre a thread.
 */
import { useState } from "react";
import { ArrowLeft, Baby, X } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { iniciais } from "@/components/mensagens/formato";
import { useTurmaInfantil, useTurmasInfantis } from "@/lib/use-educacional";
import { useCriarConversa } from "@/lib/use-mensagens";

export function ModalNovaConversa({
  aoFechar,
  aoAbrir,
}: {
  aoFechar: () => void;
  aoAbrir: (conversaId: string) => void;
}) {
  const { data: turmas, isLoading: carregandoTurmas } = useTurmasInfantis();
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const { data: turma, isLoading: carregandoTurma } = useTurmaInfantil(
    turmaId ?? undefined,
  );
  const criar = useCriarConversa("equipe");
  const [erro, setErro] = useState<string | null>(null);

  async function iniciar(membroId: string) {
    setErro(null);
    try {
      const conversa = await criar.mutateAsync({ membroId });
      aoAbrir(conversa.id);
      aoFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao iniciar a conversa.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            {turmaId ? (
              <button
                type="button"
                onClick={() => setTurmaId(null)}
                aria-label="Voltar para as turmas"
                className="rounded-full border border-border p-1 text-muted-foreground transition hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            Nova conversa
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {turmaId
            ? "Com qual família você quer falar?"
            : "Escolha a turma da criança."}
        </p>

        {erro ? (
          <div className="mt-3">
            <Alerta tipo="erro">{erro}</Alerta>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {!turmaId ? (
            <>
              {carregandoTurmas && <Spinner label="Carregando turmas..." />}
              {turmas?.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTurmaId(t.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Baby className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {t.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t._count.matriculas}{" "}
                      {t._count.matriculas === 1 ? "criança" : "crianças"}
                    </span>
                  </span>
                </button>
              ))}
              {turmas?.items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma turma cadastrada na unidade.
                </p>
              )}
            </>
          ) : (
            <>
              {carregandoTurma && <Spinner label="Carregando crianças..." />}
              {turma?.matriculas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={criar.isPending}
                  onClick={() => void iniciar(m.membroId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition",
                    "hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {iniciais(m.crianca.nomeCompleto)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {m.crianca.nomeCompleto}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Responsável: {m.ficha.nomeCompleto}
                    </span>
                  </span>
                </button>
              ))}
              {turma && turma.matriculas.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma criança com matrícula ativa nesta turma.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
