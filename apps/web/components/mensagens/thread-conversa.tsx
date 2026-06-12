"use client";

/**
 * Thread da conversa (bolhas + composer) — peça compartilhada equipe/família.
 *
 * A "visão" inverte o alinhamento: as mensagens do MEU lado ficam à direita.
 * Recibo de leitura ("Lida HH:mm") aparece discreto sob as minhas bolhas
 * quando o lado oposto abriu a conversa. Cantos assimétricos sutis (CASA).
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCheck, MessagesSquare, SendHorizonal } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  mensagemDoMeuLado,
  type ConversaDetalhe,
  type LadoConversa,
  type MensagemConversa,
} from "@/lib/use-mensagens";

import { horaCurta, iniciais, rotuloDia } from "./formato";

const CORPO_MAX = 2000;

function Bolha({
  mensagem,
  minha,
  mostrarAutor,
}: {
  mensagem: MensagemConversa;
  minha: boolean;
  mostrarAutor: boolean;
}) {
  return (
    <div className={cn("flex flex-col", minha ? "items-end" : "items-start")}>
      {mostrarAutor ? (
        <p className="mb-0.5 px-1 text-[11px] font-semibold text-muted-foreground">
          {mensagem.autorNome}
          {mensagem.ladoEquipe ? " · IFP" : ""}
        </p>
      ) : null}
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-line break-words rounded-xl px-3.5 py-2 text-sm sm:max-w-[70%]",
          minha
            ? "rounded-br-sm bg-primary text-primary-foreground shadow-casa-sm"
            : "rounded-bl-sm border border-border bg-surface text-foreground shadow-ifp-sm",
        )}
      >
        {mensagem.corpo}
      </div>
      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">
        {horaCurta(mensagem.criadoEm)}
        {minha && mensagem.lidaEm ? (
          <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-primary">
            <CheckCheck className="h-3 w-3" /> Lida {horaCurta(mensagem.lidaEm)}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Composer({
  aoEnviar,
  enviando,
  nomeCrianca,
}: {
  aoEnviar: (corpo: string) => Promise<void>;
  enviando: boolean;
  nomeCrianca: string;
}) {
  const [corpo, setCorpo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const texto = corpo.trim();
    if (!texto) {
      setErro("Escreva uma mensagem antes de enviar.");
      return;
    }
    if (texto.length > CORPO_MAX) {
      setErro(`A mensagem pode ter no máximo ${CORPO_MAX} caracteres.`);
      return;
    }
    setErro(null);
    try {
      await aoEnviar(texto);
      setCorpo("");
    } catch (e) {
      setErro((e as Error).message || "Falha ao enviar a mensagem.");
    }
  }

  return (
    <form
      className="border-t border-border bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {erro ? (
        <p role="alert" className="mb-2 text-xs font-semibold text-danger">
          {erro}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="corpo-mensagem" className="sr-only">
          Mensagem sobre {nomeCrianca}
        </label>
        <textarea
          id="corpo-mensagem"
          rows={1}
          maxLength={CORPO_MAX}
          value={corpo}
          disabled={enviando}
          onChange={(e) => setCorpo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          placeholder="Escreva sua mensagem… (Enter envia)"
          className={cn(
            "max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={enviando || corpo.trim().length === 0}
          aria-label="Enviar mensagem"
          className={cn(
            "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-casa-sm transition",
            "hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
      {corpo.length > CORPO_MAX - 200 ? (
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {corpo.length}/{CORPO_MAX}
        </p>
      ) : null}
    </form>
  );
}

export function ThreadConversa({
  visao,
  conversa,
  carregando,
  erro,
  aoVoltar,
  voltarSempreVisivel,
  aoEnviar,
  enviando,
}: {
  visao: LadoConversa;
  conversa: ConversaDetalhe | undefined;
  carregando: boolean;
  erro: Error | null;
  /** Volta para a lista (tela cheia no mobile). */
  aoVoltar: () => void;
  /** Família: botão voltar visível em todas as larguras; equipe: só mobile. */
  voltarSempreVisivel?: boolean;
  aoEnviar: (corpo: string) => Promise<void>;
  enviando: boolean;
}) {
  const fimRef = useRef<HTMLDivElement>(null);
  const totalAnterior = useRef(0);

  const mensagens = conversa?.mensagens ?? [];

  useEffect(() => {
    if (mensagens.length === 0) return;
    // 1º carregamento pula direto; novas mensagens deslizam suave.
    fimRef.current?.scrollIntoView({
      behavior: totalAnterior.current === 0 ? "auto" : "smooth",
      block: "end",
    });
    totalAnterior.current = mensagens.length;
  }, [mensagens.length]);

  if (erro) {
    return (
      <div className="flex h-full flex-col justify-center p-4">
        <Alerta tipo="erro">{erro.message}</Alerta>
      </div>
    );
  }
  if (carregando || !conversa) {
    return (
      <div className="flex h-full flex-col justify-center">
        <Spinner label="Abrindo a conversa..." />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho da thread */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar para a lista de conversas"
          className={cn(
            "rounded-full border border-border p-1.5 text-muted-foreground transition hover:text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            voltarSempreVisivel ? "" : "md:hidden",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {iniciais(conversa.crianca.nome)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {conversa.crianca.nome}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Canal oficial família ↔ instituto
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <div
        role="log"
        aria-live="polite"
        aria-label={`Mensagens da conversa sobre ${conversa.crianca.nome}`}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-background px-3 py-4 sm:px-4"
      >
        {mensagens.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessagesSquare className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              Comece a conversa sobre {conversa.crianca.nome.split(" ")[0]}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {visao === "equipe"
                ? "A família recebe e responde pelo portal — nada de número pessoal."
                : "A equipe do instituto recebe sua mensagem e responde por aqui."}
            </p>
          </div>
        ) : (
          mensagens.map((m, i) => {
            const anterior = mensagens[i - 1];
            const novoDia =
              !anterior || rotuloDia(anterior.criadoEm) !== rotuloDia(m.criadoEm);
            const minha = mensagemDoMeuLado(visao, m.ladoEquipe);
            const mostrarAutor =
              !minha &&
              (!anterior ||
                anterior.ladoEquipe !== m.ladoEquipe ||
                anterior.autorNome !== m.autorNome ||
                novoDia);
            return (
              <div key={m.id}>
                {novoDia ? (
                  <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {rotuloDia(m.criadoEm)}
                  </p>
                ) : null}
                <Bolha mensagem={m} minha={minha} mostrarAutor={mostrarAutor} />
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <Composer
        aoEnviar={aoEnviar}
        enviando={enviando}
        nomeCrianca={conversa.crianca.nome}
      />
    </div>
  );
}
