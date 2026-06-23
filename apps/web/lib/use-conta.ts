"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham /auth/me e /busca no NestJS)
// ============================================================

export interface ContaUnidade {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
}

export interface MinhaConta {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  ativo: boolean;
  mustChangePassword: boolean;
  ultimoLogin: string | null;
  criadoEm: string;
  perfis: string[];
  unidades: ContaUnidade[];
}

export type TipoResultadoBusca = "ficha" | "usuario";

export interface ResultadoBusca {
  tipo: TipoResultadoBusca;
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

export interface RespostaBusca {
  termo: string;
  total: number;
  resultados: ResultadoBusca[];
}

// ============================================================
// Consultas
// ============================================================

/** Dados completos do próprio usuário logado (tela "Minha conta"). */
export function useMinhaConta() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["conta", "me"],
    queryFn: () => authFetch<MinhaConta>("/auth/me"),
    enabled: status === "authenticated",
  });
}

/**
 * Busca global da topbar. Só dispara com termo >= 2 chars; o backend faz o
 * fan-out por RBAC (devolve só o que o perfil pode ver).
 */
export function useBuscaGlobal(termo: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const limpo = termo.trim();
  return useQuery({
    queryKey: ["busca", limpo],
    queryFn: () =>
      authFetch<RespostaBusca>(`/busca?q=${encodeURIComponent(limpo)}`),
    enabled: status === "authenticated" && limpo.length >= 2,
    placeholderData: (prev) => prev, // mantém a lista enquanto digita
    staleTime: 15_000,
  });
}
