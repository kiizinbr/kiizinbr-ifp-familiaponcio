"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type { AgendaDia, AgendamentoResumo, Atendimento, FichaBuscaItem, Prancha } from "./api";

// ============================================================
// Payloads de entrada (espelham os DTOs do módulo medico no NestJS)
// ============================================================

export interface SoapPayload {
  subjetivo?: string;
  objetivo?: string;
  avaliacao?: string;
  plano?: string;
  cid10?: string;
}

export interface VitaisPayload {
  pressaoSistolica?: number;
  pressaoDiastolica?: number;
  frequenciaCardiaca?: number;
  frequenciaRespiratoria?: number;
  temperaturaC?: number;
  saturacaoO2?: number;
  pesoKg?: number;
  alturaCm?: number;
  glicemia?: number;
  queixaPrincipal?: string;
}

// ============================================================
// Queries
// ============================================================

export function useAgendaDoDia(data?: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "agenda", data ?? "hoje"],
    queryFn: () =>
      authFetch<AgendaDia>(`/medico/agenda${data ? `?data=${data}` : ""}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function usePrancha(agendamentoId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "prancha", agendamentoId],
    queryFn: () => authFetch<Prancha>(`/medico/agenda/${agendamentoId}`),
    enabled: status === "authenticated" && !!agendamentoId,
  });
}

/** Busca enxuta de pacientes (autocomplete do novo agendamento). */
export function useBuscarFichas(q: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "fichas", q],
    queryFn: () =>
      authFetch<{ items: FichaBuscaItem[] }>(
        `/medico/fichas?q=${encodeURIComponent(q)}`,
      ),
    enabled: status === "authenticated" && q.trim().length >= 2,
    placeholderData: (prev) => prev,
  });
}

// ============================================================
// Mutations
// ============================================================

export interface CriarAgendamentoPayload {
  fichaId: string;
  membroId?: string;
  inicioEm: string;
  fimEm?: string;
  motivo?: string;
}

export function useCriarAgendamento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarAgendamentoPayload) =>
      authFetch<AgendamentoResumo>("/medico/agendamentos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "agenda"] }),
  });
}

export function useIniciarAtendimento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agendamentoId: string) =>
      authFetch<Atendimento>(`/medico/agendamentos/${agendamentoId}/iniciar`, {
        method: "POST",
      }),
    onSuccess: (_data, agendamentoId) => {
      qc.invalidateQueries({ queryKey: ["medico", "prancha", agendamentoId] });
      qc.invalidateQueries({ queryKey: ["medico", "agenda"] });
    },
  });
}

export function useSalvarSoap() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atendimentoId, dados }: { atendimentoId: string; dados: SoapPayload }) =>
      authFetch<Atendimento>(`/medico/atendimentos/${atendimentoId}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export function useSalvarVitais() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atendimentoId, dados }: { atendimentoId: string; dados: VitaisPayload }) =>
      authFetch<Atendimento>(`/medico/atendimentos/${atendimentoId}/vitais`, {
        method: "PUT",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export function useEncerrarAtendimento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (atendimentoId: string) =>
      authFetch<Atendimento>(`/medico/atendimentos/${atendimentoId}/encerrar`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}
