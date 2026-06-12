"use client";

/**
 * Mensagens 1:1 família ↔ instituto (estilo ClassApp).
 *
 * Hooks react-query contra o contrato HTTP de conversas — o MESMO shape nos
 * dois lados, mudando só a rota base:
 *   equipe  → /educacional/conversas
 *   família → /familia/educacional/conversas
 *
 * Abrir a thread (GET :id) marca as mensagens do lado oposto como lidas no
 * servidor; por isso, todo fetch bem-sucedido da thread invalida a lista
 * (zera o badge de não lidas).
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham o contrato de conversas no NestJS)
// ============================================================

/** Qual console está olhando a conversa — define rota base e lado "meu". */
export type LadoConversa = "equipe" | "familia";

export interface ConversaResumo {
  id: string;
  crianca: { id: string; nome: string };
  ultimaMensagem: { corpo: string; criadoEm: string; ladoEquipe: boolean } | null;
  naoLidas: number;
}

export interface MensagemConversa {
  id: string;
  corpo: string;
  ladoEquipe: boolean;
  autorNome: string;
  lidaEm: string | null;
  criadoEm: string;
}

export interface ConversaDetalhe {
  id: string;
  crianca: { id: string; nome: string };
  mensagens: MensagemConversa[];
}

const ROTA_BASE: Record<LadoConversa, string> = {
  equipe: "/educacional/conversas",
  familia: "/familia/educacional/conversas",
};

/** A mensagem é "minha" (alinha à direita) na visão informada? */
export function mensagemDoMeuLado(visao: LadoConversa, ladoEquipe: boolean) {
  return visao === "equipe" ? ladoEquipe : !ladoEquipe;
}

// Polling discreto: lista atualiza badges; thread aberta busca novas mensagens.
const INTERVALO_LISTA_MS = 15_000;
const INTERVALO_THREAD_MS = 10_000;

/** Aceita tanto `{ items: [...] }` (convenção do projeto) quanto array puro. */
function normalizarLista(res: unknown): ConversaResumo[] {
  if (Array.isArray(res)) return res as ConversaResumo[];
  const items = (res as { items?: ConversaResumo[] } | null)?.items;
  return Array.isArray(items) ? items : [];
}

// ============================================================
// Leitura
// ============================================================

export function useConversas(lado: LadoConversa) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["mensagens", lado, "lista"],
    queryFn: async () => normalizarLista(await authFetch<unknown>(ROTA_BASE[lado])),
    enabled: status === "authenticated",
    refetchInterval: INTERVALO_LISTA_MS,
  });
}

export function useConversa(lado: LadoConversa, conversaId: string | null) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["mensagens", lado, "conversa", conversaId],
    queryFn: () => authFetch<ConversaDetalhe>(`${ROTA_BASE[lado]}/${conversaId}`),
    enabled: status === "authenticated" && !!conversaId,
    refetchInterval: INTERVALO_THREAD_MS,
  });

  // O GET da thread marca como lida no servidor → refletir no badge da lista.
  const { dataUpdatedAt, isSuccess } = query;
  useEffect(() => {
    if (isSuccess && dataUpdatedAt > 0) {
      qc.invalidateQueries({ queryKey: ["mensagens", lado, "lista"] });
    }
  }, [isSuccess, dataUpdatedAt, qc, lado]);

  return query;
}

// ============================================================
// Mutations
// ============================================================

/** POST get-or-create: abre (ou reaproveita) a conversa única da criança. */
export function useCriarConversa(lado: LadoConversa) {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membroId }: { membroId: string }) =>
      authFetch<{ id: string }>(ROTA_BASE[lado], {
        method: "POST",
        body: JSON.stringify({ membroId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mensagens", lado, "lista"] });
    },
  });
}

export function useEnviarMensagem(lado: LadoConversa) {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversaId, corpo }: { conversaId: string; corpo: string }) =>
      authFetch<MensagemConversa>(`${ROTA_BASE[lado]}/${conversaId}/mensagens`, {
        method: "POST",
        body: JSON.stringify({ corpo }),
      }),
    onSuccess: (_d, { conversaId }) => {
      qc.invalidateQueries({ queryKey: ["mensagens", lado, "conversa", conversaId] });
      qc.invalidateQueries({ queryKey: ["mensagens", lado, "lista"] });
    },
  });
}
