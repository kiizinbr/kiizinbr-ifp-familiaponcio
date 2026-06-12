"use client";

/**
 * Lista de conversas (painel esquerdo do chat / tela cheia no mobile).
 * Mesma peça nos dois consoles — muda só a "visão" (qual lado é o meu).
 */
import { MessagesSquare } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  mensagemDoMeuLado,
  type ConversaResumo,
  type LadoConversa,
} from "@/lib/use-mensagens";

import { iniciais, quandoCompacto } from "./formato";

export function ListaConversas({
  visao,
  conversas,
  ativaId,
  aoSelecionar,
  vazioAcao,
}: {
  visao: LadoConversa;
  conversas: ConversaResumo[];
  ativaId: string | null;
  aoSelecionar: (id: string) => void;
  /** CTA opcional exibido no estado vazio (ex.: botão "Nova conversa"). */
  vazioAcao?: React.ReactNode;
}) {
  if (conversas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <MessagesSquare className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Nenhuma conversa ainda</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {visao === "equipe"
            ? "Inicie uma conversa com a família de uma criança da unidade — tudo fica registrado aqui, sem usar o número pessoal de ninguém."
            : "Fale com a equipe do instituto sobre a sua criança — a conversa fica guardada aqui, no canal oficial."}
        </p>
        {vazioAcao}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label="Conversas">
      {conversas.map((c) => {
        const ativa = c.id === ativaId;
        const minha = c.ultimaMensagem
          ? mensagemDoMeuLado(visao, c.ultimaMensagem.ladoEquipe)
          : false;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => aoSelecionar(c.id)}
              aria-current={ativa ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                ativa
                  ? "border-primary/40 bg-unidade-suave"
                  : "border-border bg-surface hover:border-primary/40",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {iniciais(c.crianca.nome)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {c.crianca.nome}
                  </span>
                  {c.ultimaMensagem ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {quandoCompacto(c.ultimaMensagem.criadoEm)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-xs",
                    c.naoLidas > 0
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {c.ultimaMensagem
                    ? `${minha ? "Você: " : ""}${c.ultimaMensagem.corpo}`
                    : "Conversa iniciada — envie a primeira mensagem."}
                </span>
              </span>

              {c.naoLidas > 0 ? (
                <span
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
                  aria-label={`${c.naoLidas} ${c.naoLidas === 1 ? "mensagem não lida" : "mensagens não lidas"}`}
                >
                  {c.naoLidas > 99 ? "99+" : c.naoLidas}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
