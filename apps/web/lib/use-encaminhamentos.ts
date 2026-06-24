"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  Encaminhamento,
  HistoricoEncaminhamentos,
  ListaEncaminhamentos,
  PrioridadeSinal,
  StatusEncaminhamento,
} from "./api";

export interface EncaminhamentosQuery {
  status?: StatusEncaminhamento | "";
  prioridade?: PrioridadeSinal | "";
  page?: number;
  perPage?: number;
}

export interface CriarEncaminhamentoPayload {
  fichaId: string;
  unidadeOrigemSlug: string;
  unidadeDestinoSlug: string;
  prioridade?: PrioridadeSinal;
  motivo: string;
}

function buildQuery(params: EncaminhamentosQuery): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.perPage) sp.set("perPage", String(params.perPage));
  if (params.status) sp.set("status", params.status);
  if (params.prioridade) sp.set("prioridade", params.prioridade);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useEncaminhamentos(params: EncaminhamentosQuery) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["encaminhamentos", params],
    queryFn: () =>
      authFetch<ListaEncaminhamentos>(`/servico-social/encaminhamentos${buildQuery(params)}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

/** Timeline de encaminhamentos de uma ficha (mais recentes primeiro). */
export function useHistoricoEncaminhamentos(fichaId: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["encaminhamentos", "historico", fichaId],
    queryFn: () =>
      authFetch<HistoricoEncaminhamentos>(
        `/servico-social/encaminhamentos/${fichaId}/historico`,
      ),
    enabled: status === "authenticated" && Boolean(fichaId),
  });
}

export function useCriarEncaminhamento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarEncaminhamentoPayload) =>
      authFetch<Encaminhamento>("/servico-social/encaminhamentos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["encaminhamentos"] }),
  });
}

export function useAceitarEncaminhamento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<Encaminhamento>(`/servico-social/encaminhamentos/${id}/aceitar`, {
        method: "PATCH",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["encaminhamentos"] }),
  });
}

export function useRecusarEncaminhamento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, justificativaResposta }: { id: string; justificativaResposta: string }) =>
      authFetch<Encaminhamento>(`/servico-social/encaminhamentos/${id}/recusar`, {
        method: "PATCH",
        body: JSON.stringify({ justificativaResposta }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["encaminhamentos"] }),
  });
}
