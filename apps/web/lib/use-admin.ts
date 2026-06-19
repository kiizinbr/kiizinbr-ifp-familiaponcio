"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham as respostas do módulo /users no NestJS)
// ============================================================

export interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  ativo: boolean;
  mustChangePassword: boolean;
  ultimoLogin: string | null;
  criadoEm: string;
  perfis: string[];
  unidades: { slug: string; nome: string }[];
}

export interface CriarUsuarioPayload {
  nome: string;
  email: string;
  cpf?: string;
  perfis: string[];
  unidades?: string[];
}

export interface UsuarioCriado {
  user: { id: string; nome: string; email: string };
  senhaProvisoria: string;
  perfis: string[];
  unidades: { slug: string; nome: string }[];
}

// ============================================================
// Consultas e mutações
// ============================================================

export function useUsuarios() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => authFetch<{ items: UsuarioItem[] }>("/users"),
    enabled: status === "authenticated",
  });
}

export function useCriarUsuario() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarUsuarioPayload) =>
      authFetch<UsuarioCriado>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useResetarSenha() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<{ senhaProvisoria: string }>(`/users/${id}/reset-senha`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useDefinirAtivo() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      authFetch<UsuarioItem>(`/users/${id}/ativo`, {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useTrocarSenha() {
  const authFetch = useAuthFetch();
  return useMutation({
    mutationFn: (payload: { senhaAtual: string; novaSenha: string }) =>
      authFetch<{ ok: boolean }>("/auth/trocar-senha", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}
