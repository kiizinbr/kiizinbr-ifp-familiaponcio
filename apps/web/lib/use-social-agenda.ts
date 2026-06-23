"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type { AgendaTransversal } from "./api";

/**
 * Agenda transversal do Serviço Social: o dia (YYYY-MM-DD) cruzando as 4
 * unidades. `data` vazia = hoje (o backend resolve em America/Sao_Paulo).
 */
export function useSocialAgenda(data?: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const query = data ? `?data=${data}` : "";
  return useQuery({
    queryKey: ["social-agenda", data ?? "hoje"],
    queryFn: () => authFetch<AgendaTransversal>(`/servico-social/social-agenda${query}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}
