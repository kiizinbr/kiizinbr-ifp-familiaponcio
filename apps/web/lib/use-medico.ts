"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  AgendaDia,
  AgendamentoResumo,
  Atendimento,
  FichaBuscaItem,
  Prancha,
  StatusAgendamento,
} from "./api";

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

export interface FilaItem extends AgendamentoResumo {
  profissional: { user: { nome: string } };
}

/** Fila do dia da UNIDADE (todos os profissionais) — usada pelo balcão/recepção. */
export function useFilaUnidade(data?: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "fila", data ?? "hoje"],
    queryFn: () =>
      authFetch<{ items: FilaItem[]; dia: string }>(
        `/medico/fila${data ? `?data=${data}` : ""}`,
      ),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
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

// ============================================================
// Prescrição (com bloqueio de alergia server-side)
// ============================================================

export interface PrescricaoItemInput {
  medicamento: string;
  posologia: string;
}

/** Conflito devolvido no corpo do 409 (ApiError.body.conflitos). */
export interface ConflitoAlergia {
  medicamento: string;
  alergiaId: string;
  alergiaDescricao: string;
  gravidade: GravidadeAlergia | null;
}

export interface PrescricaoEmitida {
  id: string;
  observacoes: string | null;
  alergiaOverride: boolean;
  alergiaOverrideMotivo: string | null;
  emitidaEm: string;
  itens: {
    id: string;
    medicamento: string;
    posologia: string;
    conflitoAlergia: boolean;
  }[];
}

export interface EmitirPrescricaoPayload {
  atendimentoId: string;
  itens: PrescricaoItemInput[];
  observacoes?: string;
  /** Só presente quando o médico justifica prescrever apesar do conflito. */
  override?: { motivo: string };
}

export function useEmitirPrescricao() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atendimentoId, ...body }: EmitirPrescricaoPayload) =>
      authFetch<PrescricaoEmitida>(`/medico/atendimentos/${atendimentoId}/prescricoes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

// ============================================================
// Gestão do agendamento (confirmar / falta / cancelar / reagendar)
// ============================================================

export interface AtualizarAgendamentoPayload {
  status?: StatusAgendamento;
  inicioEm?: string;
  fimEm?: string;
  motivo?: string;
}

export function useAtualizarAgendamento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AtualizarAgendamentoPayload }) =>
      authFetch<AgendamentoResumo>(`/medico/agendamentos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

// ============================================================
// Beneficiários, ficha clínica (alergias/condições) e prontuários
// ============================================================

export type GravidadeAlergia = "LEVE" | "MODERADA" | "GRAVE";

export const GRAVIDADE_LABEL: Record<GravidadeAlergia, string> = {
  LEVE: "Leve",
  MODERADA: "Moderada",
  GRAVE: "Grave",
};

export interface BeneficiarioItem {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  dataNascimento: string;
  alergiasAtivas: number;
}

export interface AlergiaItem {
  id: string;
  descricao: string;
  gravidade: GravidadeAlergia | null;
  ativa: boolean;
  membroId: string | null;
}

export interface CondicaoItem {
  id: string;
  descricao: string;
  cid10: string | null;
  observacoes: string | null;
  ativa: boolean;
  membroId: string | null;
}

export interface AtendimentoHistorico {
  id: string;
  encerradoEm: string;
  subjetivo: string | null;
  avaliacao: string | null;
  plano: string | null;
  cid10: string | null;
  agendamentoId: string | null;
  membro: { id: string; nomeCompleto: string } | null;
  profissional: { user: { nome: string } };
}

export interface MembroFicha {
  id: string;
  nomeCompleto: string;
  dataNascimento: string;
  parentesco: string;
}

export interface FichaClinica {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  dataNascimento: string;
  telefone: string | null;
  membros: MembroFicha[];
  alergias: AlergiaItem[];
  condicoesCronicas: CondicaoItem[];
  atendimentos: AtendimentoHistorico[];
}

export interface ProntuarioItem {
  id: string;
  encerradoEm: string;
  avaliacao: string | null;
  plano: string | null;
  cid10: string | null;
  agendamentoId: string | null;
  ficha: { id: string; protocolo: string; nomeCompleto: string };
  membro: { nomeCompleto: string } | null;
}

export function useBeneficiarios(q: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "beneficiarios", q],
    queryFn: () =>
      authFetch<{ items: BeneficiarioItem[] }>(
        `/medico/beneficiarios${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      ),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export function useFichaClinica(fichaId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "ficha-clinica", fichaId],
    queryFn: () => authFetch<FichaClinica>(`/medico/beneficiarios/${fichaId}`),
    enabled: status === "authenticated" && !!fichaId,
  });
}

export function useProntuarios() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "prontuarios"],
    queryFn: () => authFetch<{ items: ProntuarioItem[] }>("/medico/prontuarios"),
    enabled: status === "authenticated",
  });
}

export interface RegistrarAlergiaPayload {
  descricao: string;
  gravidade?: GravidadeAlergia;
  membroId?: string;
}

export function useAdicionarAlergia() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, dados }: { fichaId: string; dados: RegistrarAlergiaPayload }) =>
      authFetch<AlergiaItem>(`/medico/beneficiarios/${fichaId}/alergias`, {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export function useAtualizarAlergia() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: { descricao?: string; gravidade?: GravidadeAlergia; ativa?: boolean };
    }) =>
      authFetch<AlergiaItem>(`/medico/alergias/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export interface RegistrarCondicaoPayload {
  descricao: string;
  cid10?: string;
  observacoes?: string;
  membroId?: string;
}

export function useAdicionarCondicao() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, dados }: { fichaId: string; dados: RegistrarCondicaoPayload }) =>
      authFetch<CondicaoItem>(`/medico/beneficiarios/${fichaId}/condicoes`, {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export function useAtualizarCondicao() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: { descricao?: string; cid10?: string; observacoes?: string; ativa?: boolean };
    }) =>
      authFetch<CondicaoItem>(`/medico/condicoes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico"] }),
  });
}

export interface IndicadoresMedico {
  atendimentosSelados: number;
  beneficiarios: number;
  porStatus: Record<string, number>;
  taxaComparecimento: number | null;
  porMes: { mes: string; total: number }[];
}

export function useIndicadoresMedico() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "indicadores"],
    queryFn: () => authFetch<IndicadoresMedico>("/medico/indicadores"),
    enabled: status === "authenticated",
  });
}

// ============================================================
// Equipe — cadastro de profissionais do Centro Médico
// ============================================================

export interface ProfissionalEquipe {
  id: string;
  especialidade: string | null;
  registroConselho: string | null;
  ufConselho: string;
  ativo: boolean;
  user: { id: string; nome: string; email: string };
}

export interface CandidatoEquipe {
  id: string;
  nome: string;
  email: string;
}

export function useEquipe() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "equipe"],
    queryFn: () => authFetch<{ items: ProfissionalEquipe[] }>("/medico/equipe"),
    enabled: status === "authenticated",
  });
}

export function useCandidatosEquipe() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "equipe", "candidatos"],
    queryFn: () => authFetch<{ items: CandidatoEquipe[] }>("/medico/equipe/candidatos"),
    enabled: status === "authenticated",
  });
}

export interface VincularProfissionalPayload {
  userId: string;
  especialidade?: string;
  registroConselho?: string;
  ufConselho?: string;
}

export function useVincularProfissional() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VincularProfissionalPayload) =>
      authFetch<ProfissionalEquipe>("/medico/equipe", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "equipe"] }),
  });
}

export function useEditarProfissional() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: { especialidade?: string; registroConselho?: string; ufConselho?: string; ativo?: boolean };
    }) =>
      authFetch<ProfissionalEquipe>(`/medico/equipe/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "equipe"] }),
  });
}
