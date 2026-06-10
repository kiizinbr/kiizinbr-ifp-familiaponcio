"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  AulaInfo,
  ResumoEncerramentoTurma,
  StatusPresenca,
  TurmaDetalhe,
  TurmaResumo,
} from "./api";

// ============================================================
// Payloads (espelham os DTOs do módulo capacitacao no NestJS)
// ============================================================

export interface CriarAulaPayload {
  data: string; // ISO
  conteudo?: string;
}

export interface ItemChamada {
  matriculaId: string;
  status: StatusPresenca;
}

// ============================================================
// Queries
// ============================================================

export function useTurmas() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "turmas"],
    queryFn: () => authFetch<{ items: TurmaResumo[] }>("/capacitacao/turmas"),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function useTurma(turmaId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "turma", turmaId],
    queryFn: () => authFetch<TurmaDetalhe>(`/capacitacao/turmas/${turmaId}`),
    enabled: status === "authenticated" && !!turmaId,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useCriarAula() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ turmaId, dados }: { turmaId: string; dados: CriarAulaPayload }) =>
      authFetch<AulaInfo>(`/capacitacao/turmas/${turmaId}/aulas`, {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: (_d, { turmaId }) =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "turma", turmaId] }),
  });
}

export function useLancarChamada() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aulaId, itens }: { aulaId: string; itens: ItemChamada[] }) =>
      authFetch<AulaInfo>(`/capacitacao/aulas/${aulaId}/chamada`, {
        method: "PUT",
        body: JSON.stringify({ itens }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}

export function useEncerrarAula() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aulaId: string) =>
      authFetch<AulaInfo>(`/capacitacao/aulas/${aulaId}/encerrar`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}

export function useEncerrarTurma() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (turmaId: string) =>
      authFetch<ResumoEncerramentoTurma>(`/capacitacao/turmas/${turmaId}/encerrar`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}
