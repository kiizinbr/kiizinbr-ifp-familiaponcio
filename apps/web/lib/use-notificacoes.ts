"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type { Notificacoes } from "./api";

/**
 * Central de Avisos do sino: busca os avisos reais do usuário logado (a API
 * decide o que cada perfil vê). Revalida ao focar a janela e a cada 60s para
 * o contador não ficar "preso" sem precisar de WebSocket.
 */
export function useNotificacoes() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => authFetch<Notificacoes>("/notificacoes"),
    enabled: status === "authenticated",
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
