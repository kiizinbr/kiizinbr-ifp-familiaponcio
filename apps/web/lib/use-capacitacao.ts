"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  AulaInfo,
  Curso,
  CursoDetalhe,
  FichaBuscaItem,
  MatriculasSemestre,
  MatriculaTurma,
  ResumoCapacitacao,
  ResumoEncerramentoTurma,
  StatusMatricula,
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

export function useTurmas(filtros: { status?: string; cursoId?: string } = {}) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const params = new URLSearchParams();
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.cursoId) params.set("cursoId", filtros.cursoId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["capacitacao", "turmas", filtros.status ?? "", filtros.cursoId ?? ""],
    queryFn: () =>
      authFetch<{ items: TurmaResumo[]; total: number }>(
        `/capacitacao/turmas${qs ? `?${qs}` : ""}`,
      ),
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
      consentimentoTitular,
    }: {
      turmaId: string;
      fichaId: string;
      membroId?: string;
      /** Consentimento do responsável — exigido pelo servidor p/ matricular menor. */
      consentimentoTitular?: boolean;
    }) =>
      authFetch<MatriculaTurma>(`/capacitacao/turmas/${turmaId}/matriculas`, {
        method: "POST",
        body: JSON.stringify({ fichaId, membroId, consentimentoTitular }),
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

export interface EditarTurmaPayload {
  diasHorario?: string;
  sala?: string;
  vagasTotais?: number;
}

export function useEditarTurma() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: EditarTurmaPayload }) =>
      authFetch<TurmaResumo>(`/capacitacao/turmas/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
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
  /** Alunos ATIVOS somados nas turmas do curso. */
  alunosAtivos?: number;
  /** Vagas somadas das turmas do curso. */
  vagasTotais?: number;
  /** % de ocupação do curso (alunosAtivos / vagasTotais). */
  ocupacaoPct?: number | null;
}

export interface CriarCursoPayload {
  nome: string;
  modalidade: ModalidadeCurso;
  cargaHorariaTotal: number;
  presencaMinimaPct?: number;
  requerModelos?: boolean;
}

export function useCursosGestao(filtro?: "ativos" | "inativos") {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const qs = filtro ? `?filtro=${filtro}` : "";
  return useQuery({
    queryKey: ["capacitacao", "cursos-gestao", filtro ?? ""],
    queryFn: () => authFetch<{ items: CursoGestao[] }>(`/capacitacao/cursos/todos${qs}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

/** Detalhe de um curso com a trilha (módulos + ementa). */
export function useCursoDetalhe(cursoId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "curso", cursoId],
    queryFn: () => authFetch<CursoDetalhe>(`/capacitacao/cursos/${cursoId}`),
    enabled: status === "authenticated" && !!cursoId,
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

// ============================================================
// Matrícula (trancar/cancelar/reativar) e certificados emitidos
// ============================================================

export type AcaoMatricula = "ATIVA" | "TRANCADA" | "CANCELADA";

export function useAlterarMatricula() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matriculaId, status }: { matriculaId: string; status: AcaoMatricula }) =>
      authFetch<{ id: string; status: string }>(`/capacitacao/matriculas/${matriculaId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacitacao"] }),
  });
}

export interface CertificadoEmitido {
  id: string;
  codigoVerificacao: string;
  cargaHorariaCumprida: number;
  presencaPct: number;
  emitidoEm: string;
  aluno: string;
  curso: string;
  turma: string;
}

export function useCertificados() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "certificados"],
    queryFn: () => authFetch<{ items: CertificadoEmitido[] }>("/capacitacao/certificados"),
    enabled: status === "authenticated",
  });
}

export interface IndicadoresCapacitacao {
  turmas: Record<string, number>;
  matriculas: Record<string, number>;
  certificados: number;
  cursosAtivos: number;
  taxaConclusao: number | null;
}

export function useIndicadoresCapacitacao() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "indicadores"],
    queryFn: () => authFetch<IndicadoresCapacitacao>("/capacitacao/indicadores"),
    enabled: status === "authenticated",
  });
}

// ============================================================
// Indicadores longitudinais — séries temporais por mês (A2)
// ============================================================

export type ChaveSerieCapacitacao =
  | "matriculas"
  | "conclusoes"
  | "certificados"
  | "evasoes";

export interface SerieCapacitacao {
  chave: ChaveSerieCapacitacao;
  label: string;
  pontos: { mes: string; total: number }[];
}

export interface IndicadoresSeriesCapacitacao {
  meses: number;
  kpis: {
    matriculas: number;
    conclusoes: number;
    certificados: number;
    evasoes: number;
    taxaConclusao: number | null;
  };
  series: SerieCapacitacao[];
}

/** Séries temporais por mês (janela 3 a 24 meses; default 12) da unidade. */
export function useIndicadoresSeriesCapacitacao(meses: number) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "indicadores-series", meses],
    queryFn: () =>
      authFetch<IndicadoresSeriesCapacitacao>(
        `/capacitacao/indicadores/series?meses=${meses}`,
      ),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

// ============================================================
// Matrículas consolidadas do semestre (cruza todas as turmas)
// ============================================================

/**
 * Matrículas da unidade agrupadas por turma. `status` opcional filtra por
 * situação (ATIVA, LISTA_ESPERA, CONCLUIDA...). Sem filtro = todas.
 */
export function useMatriculasSemestre(status?: StatusMatricula | "TODOS") {
  const authFetch = useAuthFetch();
  const { status: sessao } = useSession();
  const filtro = status && status !== "TODOS" ? status : undefined;
  return useQuery({
    queryKey: ["capacitacao", "matriculas-semestre", filtro ?? "todos"],
    queryFn: () =>
      authFetch<MatriculasSemestre>(
        `/capacitacao/matriculas/semestre${filtro ? `?status=${filtro}` : ""}`,
      ),
    enabled: sessao === "authenticated",
    placeholderData: (prev) => prev,
  });
}

// ============================================================
// Banco de Modelos (C4) — sessões práticas + matching aluno <-> modelo
// ============================================================

export type StatusSessaoPratica = "AGENDADA" | "REALIZADA" | "CANCELADA";
export type StatusInscricaoModelo = "INSCRITO" | "VINCULADO" | "CONCLUIDO" | "CANCELADO";

export const STATUS_SESSAO_LABEL: Record<StatusSessaoPratica, string> = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const STATUS_INSCRICAO_LABEL: Record<StatusInscricaoModelo, string> = {
  INSCRITO: "Inscrito",
  VINCULADO: "Vinculado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export interface ModeloVoluntario {
  id: string;
  nomeCompleto: string;
  telefone: string | null;
  observacao: string | null;
  ativo: boolean;
}

export interface InscricaoModelo {
  id: string;
  status: StatusInscricaoModelo;
  modelo: { id: string; nome: string };
  aluno: { matriculaId: string; nome: string } | null;
}

export interface SessaoPratica {
  id: string;
  titulo: string;
  data: string;
  vagasModelos: number;
  status: StatusSessaoPratica;
  observacao: string | null;
  turma: { id: string; codigo: string; curso: string };
  inscricoes: InscricaoModelo[];
  vagasOcupadas: number;
}

export function useModelosVoluntarios() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["capacitacao", "modelos"],
    queryFn: () =>
      authFetch<{ items: ModeloVoluntario[]; total: number }>(
        "/capacitacao/banco-modelos/modelos",
      ),
    enabled: status === "authenticated",
  });
}

export function useSessoesPraticas(filtros: { turmaId?: string; status?: string } = {}) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const params = new URLSearchParams();
  if (filtros.turmaId) params.set("turmaId", filtros.turmaId);
  if (filtros.status) params.set("status", filtros.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["capacitacao", "sessoes", filtros.turmaId ?? "", filtros.status ?? ""],
    queryFn: () =>
      authFetch<{ items: SessaoPratica[]; total: number }>(
        `/capacitacao/banco-modelos/sessoes${qs ? `?${qs}` : ""}`,
      ),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function useCriarModelo() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nomeCompleto: string; telefone?: string; observacao?: string }) =>
      authFetch<ModeloVoluntario>("/capacitacao/banco-modelos/modelos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "modelos"] }),
  });
}

export function useCriarSessaoPratica() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      turmaId: string;
      titulo: string;
      data: string;
      vagasModelos?: number;
      observacao?: string;
    }) =>
      authFetch<SessaoPratica>("/capacitacao/banco-modelos/sessoes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "sessoes"] }),
  });
}

export function useInscreverModelo() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessaoId,
      modeloId,
      matriculaId,
    }: {
      sessaoId: string;
      modeloId: string;
      matriculaId?: string;
    }) =>
      authFetch<InscricaoModelo>(
        `/capacitacao/banco-modelos/sessoes/${sessaoId}/inscricoes`,
        { method: "POST", body: JSON.stringify({ modeloId, matriculaId }) },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "sessoes"] }),
  });
}

export function useVincularAlunoModelo() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inscricaoId, matriculaId }: { inscricaoId: string; matriculaId: string }) =>
      authFetch<InscricaoModelo>(
        `/capacitacao/banco-modelos/inscricoes/${inscricaoId}/aluno`,
        { method: "PATCH", body: JSON.stringify({ matriculaId }) },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["capacitacao", "sessoes"] }),
  });
}
