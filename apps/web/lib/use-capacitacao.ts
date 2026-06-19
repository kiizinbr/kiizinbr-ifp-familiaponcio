"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  AulaInfo,
  Curso,
  FichaBuscaItem,
  MatriculaTurma,
  ResumoCapacitacao,
  ResumoEncerramentoTurma,
  StatusPresenca,
  TurmaDetalhe,
  TurmaResumo,
} from "./api";

/** Aula com presenças (hidrata a chamada). */
export interface AulaComPresencas extends AulaInfo {
  turmaId: string;
  presencas: { matriculaId: string; status: StatusPresenca }[];
}

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

export function useCursos() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "cursos"],
    queryFn: () => authFetch<{ items: Curso[] }>("/capacitacao/cursos"),
    enabled: status === "authenticated",
  });
}

export function useResumoCapacitacao() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "resumo"],
    queryFn: () => authFetch<ResumoCapacitacao>("/capacitacao/resumo"),
    enabled: status === "authenticated",
  });
}

export function useFichasElegiveis(q: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "elegiveis", q],
    queryFn: () =>
      authFetch<{ items: FichaBuscaItem[] }>(
        `/capacitacao/fichas-elegiveis?q=${encodeURIComponent(q)}`,
      ),
    enabled: status === "authenticated" && q.trim().length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useAula(aulaId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "aula", aulaId],
    queryFn: () => authFetch<AulaComPresencas>(`/capacitacao/aulas/${aulaId}`),
    enabled: status === "authenticated" && !!aulaId,
  });
}

// ============================================================
// Mutations
// ============================================================

export interface CriarTurmaPayload {
  cursoId: string;
  codigo: string;
  diasHorario: string;
  sala?: string;
  inicioEm: string;
  vagasTotais: number;
}

export function useCriarTurma() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarTurmaPayload) =>
      authFetch<TurmaResumo>("/capacitacao/turmas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}

export function useMatricular() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      turmaId,
      fichaId,
      membroId,
    }: {
      turmaId: string;
      fichaId: string;
      membroId?: string;
    }) =>
      authFetch<MatriculaTurma>(`/capacitacao/turmas/${turmaId}/matriculas`, {
        method: "POST",
        body: JSON.stringify({ fichaId, membroId }),
      }),
    onSuccess: (_d, { turmaId }) =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "turma", turmaId] }),
  });
}

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

// ============================================================
// Cursos (gestão) — CRUD que alimenta o select de nova turma
// ============================================================

export type ModalidadeCurso = "PRATICO" | "TEORICO";

export const MODALIDADE_LABEL: Record<ModalidadeCurso, string> = {
  PRATICO: "Prático",
  TEORICO: "Teórico",
};

export interface CursoGestao {
  id: string;
  nome: string;
  modalidade: ModalidadeCurso;
  cargaHorariaTotal: number;
  presencaMinimaPct: number;
  requerModelos: boolean;
  ativo: boolean;
  _count: { turmas: number };
}

export interface CriarCursoPayload {
  nome: string;
  modalidade: ModalidadeCurso;
  cargaHorariaTotal: number;
  presencaMinimaPct?: number;
  requerModelos?: boolean;
}

export function useCursosGestao() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "cursos-gestao"],
    queryFn: () => authFetch<{ items: CursoGestao[] }>("/capacitacao/cursos/todos"),
    enabled: status === "authenticated",
  });
}

export function useCriarCurso() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarCursoPayload) =>
      authFetch<CursoGestao>("/capacitacao/cursos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}

export function useAtualizarCurso() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: Partial<CriarCursoPayload> & { ativo?: boolean };
    }) =>
      authFetch<CursoGestao>(`/capacitacao/cursos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}
