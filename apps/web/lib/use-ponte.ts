"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  ListaSinalizacoes,
  PrioridadeSinal,
  SinalizacaoPonte,
  StatusSinalizacao,
} from "./api";

export interface PonteQuery {
  status?: StatusSinalizacao | "";
  prioridade?: PrioridadeSinal | "";
  page?: number;
  perPage?: number;
}

function buildQuery(params: PonteQuery): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.perPage) sp.set("perPage", String(params.perPage));
  if (params.status) sp.set("status", params.status);
  if (params.prioridade) sp.set("prioridade", params.prioridade);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function usePonte(params: PonteQuery) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["ponte", params],
    queryFn: () => authFetch<ListaSinalizacoes>(`/servico-social/ponte${buildQuery(params)}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function useMarcarAtendida() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<SinalizacaoPonte>(`/servico-social/ponte/${id}/marcar-atendida`, {
        method: "PATCH",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ponte"] }),
  });
}
