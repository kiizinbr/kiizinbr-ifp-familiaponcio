"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham as respostas do módulo esportivo no NestJS)
// ============================================================

export interface ResumoEsportivo {
  turmasEmAndamento: number;
  atletasAtivos: number;
  graduacoesConcedidas: number;
  listaEspera: number;
}

export interface ModalidadeItem {
  id: string;
  nome: string;
  trilhaGraduacoes: string[];
  ativo: boolean;
  _count: { turmas: number };
}

export interface TurmaEsportivaResumo {
  id: string;
  codigo: string;
  diasHorario: string;
  local: string | null;
  faixaEtariaMin: number | null;
  faixaEtariaMax: number | null;
  vagasTotais: number;
  status: "INSCRICOES_ABERTAS" | "EM_ANDAMENTO" | "ENCERRADA";
  modalidade: { id: string; nome: string; trilhaGraduacoes: string[] };
  _count: { matriculas: number };
}

export interface GraduacaoItem {
  id: string;
  nivel: string;
  codigoVerificacao: string;
  observacao: string | null;
  concedidaEm: string;
}

export interface MatriculaEsportivaItem {
  id: string;
  status: string;
  posicaoEspera: number | null;
  ficha: { id: string; protocolo: string; nomeCompleto: string };
  membro: { id: string; nomeCompleto: string; dataNascimento: string } | null;
  graduacoes: GraduacaoItem[];
}

export interface TreinoItem {
  id: string;
  data: string;
  conteudo: string | null;
  encerradoEm: string | null;
}

export interface PresencaTreinoItem {
  matriculaId: string;
  status: "PRESENTE" | "FALTA" | "JUSTIFICADA";
}

export interface TurmaEsportivaDetalhe extends Omit<TurmaEsportivaResumo, "_count"> {
  instrutor: { user: { nome: string } };
  matriculas: MatriculaEsportivaItem[];
  treinos: TreinoItem[];
}

export interface FichaElegivelEsportivo {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  membros: { id: string; nomeCompleto: string; parentesco: string }[];
}

export interface IndicadoresEsportivo {
  graduacoesPorMes: { mes: string; total: number }[];
  frequenciaPorModalidade: {
    modalidade: string;
    presencas: number;
    total: number;
    pct: number | null;
  }[];
  evasaoPorModalidade: {
    modalidade: string;
    evadidas: number;
    base: number;
    pct: number | null;
  }[];
  taxaFrequenciaGeral: number | null;
  taxaEvasaoGeral: number | null;
}

export interface PainelEsportivo {
  ocupacao: { atletasAtivos: number; vagasTotais: number; pct: number | null };
  emQuadraHoje: {
    treinoId: string;
    turmaId: string;
    codigo: string;
    modalidade: string;
    local: string | null;
    diasHorario: string;
    data: string;
    selado: boolean;
  }[];
  proximosExames: {
    turmaId: string;
    codigo: string;
    modalidade: string;
    proximoNivel: string;
    atletas: number;
  }[];
}

export interface TurmaCatalogoItem {
  id: string;
  codigo: string;
  diasHorario: string;
  local: string | null;
  faixaEtariaMin: number | null;
  faixaEtariaMax: number | null;
  vagasTotais: number;
  status: "INSCRICOES_ABERTAS" | "EM_ANDAMENTO" | "ENCERRADA";
  modalidade: { id: string; nome: string };
  atletasAtivos: number;
}

export interface CatalogoEsportivo {
  items: TurmaCatalogoItem[];
  grade: { diasHorario: string; turmas: TurmaCatalogoItem[] }[];
  total: number;
}

// ============================================================
// Consultas
// ============================================================

export function useResumoEsportivo() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "resumo"],
    queryFn: () => authFetch<ResumoEsportivo>("/esportivo/resumo"),
    enabled: status === "authenticated",
  });
}

export function useModalidades() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "modalidades"],
    queryFn: () => authFetch<{ items: ModalidadeItem[] }>("/esportivo/modalidades"),
    enabled: status === "authenticated",
  });
}

export function useIndicadoresEsportivo() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "indicadores"],
    queryFn: () => authFetch<IndicadoresEsportivo>("/esportivo/indicadores"),
    enabled: status === "authenticated",
  });
}

export function usePainelEsportivo() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "painel"],
    queryFn: () => authFetch<PainelEsportivo>("/esportivo/painel"),
    enabled: status === "authenticated",
  });
}

export function useCatalogoEsportivo(filtros: { modalidadeId?: string; status?: string }) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const params = new URLSearchParams();
  if (filtros.modalidadeId) params.set("modalidadeId", filtros.modalidadeId);
  if (filtros.status) params.set("status", filtros.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["esportivo", "catalogo", filtros.modalidadeId ?? "", filtros.status ?? ""],
    queryFn: () => authFetch<CatalogoEsportivo>(`/esportivo/catalogo${qs ? `?${qs}` : ""}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function useTurmasEsportivas() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "turmas"],
    queryFn: () => authFetch<{ items: TurmaEsportivaResumo[] }>("/esportivo/turmas"),
    enabled: status === "authenticated",
  });
}

export function useTurmaEsportiva(id: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "turma", id],
    queryFn: () => authFetch<TurmaEsportivaDetalhe>(`/esportivo/turmas/${id}`),
    enabled: status === "authenticated" && !!id,
    placeholderData: (prev) => prev,
  });
}

export function useFichasElegiveisEsportivo(q: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const termo = q.trim();
  return useQuery({
    queryKey: ["esportivo", "fichas-elegiveis", termo],
    queryFn: () =>
      authFetch<{ items: FichaElegivelEsportivo[] }>(
        `/esportivo/fichas-elegiveis?q=${encodeURIComponent(termo)}`,
      ),
    enabled: status === "authenticated" && termo.length >= 2,
  });
}

// ============================================================
// Mutações
// ============================================================

export interface CriarTurmaEsportivaPayload {
  modalidadeId: string;
  codigo: string;
  diasHorario: string;
  local?: string;
  faixaEtariaMin?: number;
  faixaEtariaMax?: number;
  inicioEm: string;
  vagasTotais: number;
}

export function useCriarTurmaEsportiva() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarTurmaEsportivaPayload) =>
      authFetch<TurmaEsportivaResumo>("/esportivo/turmas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}

export function useMatricularEsportivo() {
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
      authFetch<MatriculaEsportivaItem>(`/esportivo/turmas/${turmaId}/matriculas`, {
        method: "POST",
        body: JSON.stringify({ fichaId, ...(membroId ? { membroId } : {}) }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}

export function useGraduar() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matriculaId,
      nivel,
      observacao,
    }: {
      matriculaId: string;
      nivel: string;
      observacao?: string;
    }) =>
      authFetch<GraduacaoItem>(`/esportivo/matriculas/${matriculaId}/graduacoes`, {
        method: "POST",
        body: JSON.stringify({ nivel, ...(observacao ? { observacao } : {}) }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}

export function useTreino(id: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["esportivo", "treino", id],
    queryFn: () =>
      authFetch<TreinoItem & { presencas: PresencaTreinoItem[] }>(
        `/esportivo/treinos/${id}`,
      ),
    enabled: status === "authenticated" && !!id,
  });
}

export function useCriarTreino() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      turmaId,
      data,
      conteudo,
    }: {
      turmaId: string;
      data: string;
      conteudo?: string;
    }) =>
      authFetch<TreinoItem>(`/esportivo/turmas/${turmaId}/treinos`, {
        method: "POST",
        body: JSON.stringify({ data, ...(conteudo ? { conteudo } : {}) }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}

export function useLancarChamadaTreino() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treinoId, itens }: { treinoId: string; itens: PresencaTreinoItem[] }) =>
      authFetch(`/esportivo/treinos/${treinoId}/chamada`, {
        method: "PUT",
        body: JSON.stringify({ itens }),
      }),
    onSuccess: (_d, { treinoId }) => {
      qc.invalidateQueries({ queryKey: ["esportivo", "treino", treinoId] });
    },
  });
}

export function useEncerrarTreino() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treinoId: string) =>
      authFetch<TreinoItem>(`/esportivo/treinos/${treinoId}/encerrar`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}

export function useEncerrarTurmaEsportiva() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (turmaId: string) =>
      authFetch<{ concluidas: number; esperaCanceladas: number }>(
        `/esportivo/turmas/${turmaId}/encerrar`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esportivo"] }),
  });
}
