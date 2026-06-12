"use client";

/**
 * Mensagens 1:1 com as famílias (console da equipe, estilo ClassApp).
 *
 * Chat em 2 painéis: lista de conversas (badge de não lidas, prévia da última
 * mensagem) + thread com bolhas — equipe à direita, família à esquerda.
 * No mobile a lista é a tela e a thread abre por cima (tela cheia).
 * Tudo pelo canal oficial: protege o número pessoal da equipe.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessagesSquare, Plus } from "lucide-react";

import { Alerta, Botao, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ListaConversas } from "@/components/mensagens/lista-conversas";
import { ThreadConversa } from "@/components/mensagens/thread-conversa";
import { useConversa, useConversas, useEnviarMensagem } from "@/lib/use-mensagens";

import { ModalNovaConversa } from "./nova-conversa";

export default function MensagensEquipePage() {
  const { data: conversas, isLoading, error } = useConversas("equipe");
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const thread = useConversa("equipe", ativaId);
  const enviar = useEnviarMensagem("equipe");

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Spinner label="Carregando conversas..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-57px)] max-w-6xl flex-col px-4 py-4 sm:px-6">
      <Link
        href="/educacional"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Painel do dia
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <MessagesSquare className="h-5 w-5 text-primary" /> Mensagens
        </h1>
        <Botao onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" /> Nova conversa
        </Botao>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-3 md:grid-cols-[330px_1fr]">
        {/* Lista (tela cheia no mobile) */}
        <aside
          className={cn(
            "min-h-0 overflow-y-auto",
            ativaId ? "hidden md:block" : "block",
          )}
        >
          <ListaConversas
            visao="equipe"
            conversas={conversas ?? []}
            ativaId={ativaId}
            aoSelecionar={setAtivaId}
            vazioAcao={
              <Botao variante="outline" onClick={() => setCriando(true)}>
                <Plus className="h-4 w-4" /> Iniciar a primeira conversa
              </Botao>
            }
          />
        </aside>

        {/* Thread (abre por cima no mobile) */}
        <section
          className={cn(
            "min-h-0 overflow-hidden",
            ativaId
              ? "fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto md:rounded-xl md:border md:border-border md:shadow-ifp-sm"
              : "hidden md:flex md:flex-col md:rounded-xl md:border md:border-border md:shadow-ifp-sm",
          )}
        >
          {ativaId ? (
            <ThreadConversa
              visao="equipe"
              conversa={thread.data}
              carregando={thread.isLoading}
              erro={thread.error as Error | null}
              aoVoltar={() => setAtivaId(null)}
              aoEnviar={async (corpo) => {
                await enviar.mutateAsync({ conversaId: ativaId, corpo });
              }}
              enviando={enviar.isPending}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface p-6 text-center">
              <MessagesSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                Selecione uma conversa
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Ou clique em “Nova conversa” para falar com a família de uma
                criança da unidade.
              </p>
            </div>
          )}
        </section>
      </div>

      {criando ? (
        <ModalNovaConversa
          aoFechar={() => setCriando(false)}
          aoAbrir={setAtivaId}
        />
      ) : null}
    </main>
  );
}
