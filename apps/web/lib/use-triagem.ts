"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  ListaTriagens,
  PrioridadeTriagem,
  StatusTriagem,
  TriagemItem,
} from "./api";

// ============================================================
// Filtros / payloads (espelham o controller do NestJS)
// ============================================================

export interface TriagensQuery {
  status?: StatusTriagem | "";
  prioridade?: PrioridadeTriagem | "";
  page?: number;
  perPage?: number;
}

export interface CriarTriagemPayload {
  fichaId: string;
  prioridade?: PrioridadeTriagem;
  motivoSolicitacao?: string;
}

/** Monta a query string ignorando filtros vazios/indefinidos. */
function buildQuery(params: TriagensQuery): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.perPage) sp.set("perPage", String(params.perPage));
  if (params.status) sp.set("status", params.status);
  if (params.prioridade) sp.set("prioridade", params.prioridade);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ============================================================
// Query
// ============================================================

export function useTriagens(params: TriagensQuery) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["triagens", params],
    queryFn: () => authFetch<ListaTriagens>(`/servico-social/triagens${buildQuery(params)}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev, // não pisca ao paginar/filtrar
  });
}

// ============================================================
// Mutations — toda transição invalida a fila (refetch dos KPIs)
// ============================================================

export function useCriarTriagem() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarTriagemPayload) =>
      authFetch<TriagemItem>("/servico-social/triagens", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triagens"] }),
  });
}

export function useIniciarTriagem() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<TriagemItem>(`/servico-social/triagens/${id}/iniciar`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triagens"] }),
  });
}

export function useConcluirTriagem() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<TriagemItem>(`/servico-social/triagens/${id}/concluir`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triagens"] }),
  });
}
