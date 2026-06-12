"use client";

/**
 * Mensagens do portal da família — canal oficial com a equipe do instituto.
 *
 * Tela 4 do portal (mobile-first, max-w-2xl): lista das conversas das crianças
 * da ficha + thread em tela cheia (bolhas — família à direita nesta visão,
 * equipe à esquerda, recibo "Lida HH:mm"). Iniciar conversa é por criança da
 * própria ficha (POST get-or-create idempotente).
 *
 * Reusa as MESMAS peças do console da equipe (ListaConversas/ThreadConversa)
 * mudando só a visão — o contrato HTTP é espelhado em /familia/educacional.
 */
import { useMemo, useState } from "react";
import { MessagesSquare, SendHorizonal } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { iniciais, primeiroNome } from "@/components/mensagens/formato";
import { ListaConversas } from "@/components/mensagens/lista-conversas";
import { ThreadConversa } from "@/components/mensagens/thread-conversa";
import { useMinhasCriancas, type MinhaCrianca } from "@/lib/use-educacional";
import {
  useConversa,
  useConversas,
  useCriarConversa,
  useEnviarMensagem,
} from "@/lib/use-mensagens";

/** Botões "Falar sobre {criança}" — inicia (ou reabre) a conversa única. */
function IniciarConversa({
  criancas,
  desabilitado,
  aoIniciar,
}: {
  criancas: MinhaCrianca[];
  desabilitado: boolean;
  aoIniciar: (membroId: string) => void;
}) {
  if (criancas.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Iniciar conversa sobre uma criança">
      {criancas.map((m) => (
        <li key={m.crianca.id}>
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => aoIniciar(m.crianca.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition",
              "hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {iniciais(m.crianca.nomeCompleto)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                Falar sobre {primeiroNome(m.crianca.nomeCompleto)}
              </span>
              <span className="text-xs text-muted-foreground">
                Turma {m.turma.nome} · canal oficial do instituto
              </span>
            </span>
            <SendHorizonal className="h-4 w-4 shrink-0 text-primary" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function MensagensFamiliaPage() {
  const { data: conversas, isLoading, error } = useConversas("familia");
  const { data: criancas, isLoading: carregandoCriancas } = useMinhasCriancas();
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [erroIniciar, setErroIniciar] = useState<string | null>(null);

  const thread = useConversa("familia", ativaId);
  const enviar = useEnviarMensagem("familia");
  const criar = useCriarConversa("familia");

  // Crianças da ficha que ainda não têm conversa (crianca.id === membroId).
  const semConversa = useMemo(() => {
    const comConversa = new Set((conversas ?? []).map((c) => c.crianca.id));
    return (criancas?.items ?? []).filter((m) => !comConversa.has(m.crianca.id));
  }, [conversas, criancas]);

  async function iniciar(membroId: string) {
    setErroIniciar(null);
    try {
      const conversa = await criar.mutateAsync({ membroId });
      setAtivaId(conversa.id);
    } catch (e) {
      setErroIniciar((e as Error).message || "Não foi possível iniciar a conversa.");
    }
  }

  if (isLoading || carregandoCriancas) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando mensagens..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  const itensCriancas = criancas?.items ?? [];
  if (itensCriancas.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="info">
          Nenhuma criança matriculada encontrada para a sua família — as mensagens
          ficam disponíveis após a matrícula.
        </Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <MessagesSquare className="h-5 w-5 text-primary" /> Mensagens
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Fale com a equipe do instituto sobre a sua criança — tudo fica guardado
        aqui, no canal oficial.
      </p>

      {erroIniciar ? (
        <div className="mt-3">
          <Alerta tipo="erro">{erroIniciar}</Alerta>
        </div>
      ) : null}

      <div className="mt-4">
        <ListaConversas
          visao="familia"
          conversas={conversas ?? []}
          ativaId={ativaId}
          aoSelecionar={setAtivaId}
          vazioAcao={
            <div className="w-full max-w-sm">
              <IniciarConversa
                criancas={semConversa}
                desabilitado={criar.isPending}
                aoIniciar={(id) => void iniciar(id)}
              />
            </div>
          }
        />
      </div>

      {/* Crianças sem conversa quando já existe alguma na lista */}
      {(conversas?.length ?? 0) > 0 && semConversa.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Iniciar nova conversa
          </h2>
          <div className="mt-2">
            <IniciarConversa
              criancas={semConversa}
              desabilitado={criar.isPending}
              aoIniciar={(id) => void iniciar(id)}
            />
          </div>
        </div>
      ) : null}

      {/* Thread em tela cheia (cobre a navegação fixa do portal) */}
      {ativaId ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <ThreadConversa
            visao="familia"
            conversa={thread.data}
            carregando={thread.isLoading}
            erro={thread.error as Error | null}
            aoVoltar={() => setAtivaId(null)}
            voltarSempreVisivel
            aoEnviar={async (corpo) => {
              await enviar.mutateAsync({ conversaId: ativaId, corpo });
            }}
            enviando={enviar.isPending}
          />
        </div>
      ) : null}
    </main>
  );
}
