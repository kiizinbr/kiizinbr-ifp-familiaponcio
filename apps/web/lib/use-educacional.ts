"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham as respostas do módulo educacional no NestJS)
// ============================================================

export type EstadoDia = "SEM_CHECKIN" | "PRESENTE" | "SAIU";
export type SentidoCheck = "ENTRADA" | "SAIDA";
export type StatusDiario = "ABERTO" | "FECHADO";
export type TipoRegistroRotina =
  | "ALIMENTACAO"
  | "SONO"
  | "HIGIENE"
  | "ATIVIDADE"
  | "OCORRENCIA";
export type EscopoImagem = "USO_INTERNO" | "REDES_IFP" | "IMPRENSA";

export const TIPO_ROTINA_LABEL: Record<TipoRegistroRotina, string> = {
  ALIMENTACAO: "Alimentação",
  SONO: "Sono",
  HIGIENE: "Higiene",
  ATIVIDADE: "Atividade",
  OCORRENCIA: "Ocorrência",
};

/** Tags de 1 toque por tipo — preenchem a descrição (meta 5–10s da pesquisa). */
export const TAGS_ROTINA: Record<TipoRegistroRotina, string[]> = {
  ALIMENTACAO: ["Aceitou bem", "Comeu pouco", "Recusou a refeição"],
  SONO: ["Dormiu 1h30", "Sono tranquilo", "Não quis dormir"],
  HIGIENE: ["Troca feita", "Banho dado"],
  ATIVIDADE: ["Participou animada(o)", "Pintura e desenho", "Brincadeira no pátio"],
  OCORRENCIA: ["Choro persistente", "Febre baixa — responsável avisado", "Arranhão leve — cuidado feito"],
};

export const ESCOPO_IMAGEM_LABEL: Record<EscopoImagem, string> = {
  USO_INTERNO: "Uso interno (ficha e chamada)",
  REDES_IFP: "Redes sociais do IFP",
  IMPRENSA: "Imprensa e parceiros",
};

export interface AlergiaItem {
  id: string;
  descricao: string;
  gravidade: "LEVE" | "MODERADA" | "GRAVE";
}

export interface AutorizadoItem {
  id: string;
  nome: string;
  documento?: string;
  parentesco: string;
  fotoUrl: string | null;
  restricaoJudicial: boolean;
  vigenteAte: string | null;
  revogadoEm?: string | null;
}

export interface CheckItem {
  id: string;
  sentido: SentidoCheck;
  ocorridoEm: string;
  autorizado: { id?: string; nome: string; parentesco: string };
}

export interface RegistroRotinaItem {
  id: string;
  tipo: TipoRegistroRotina;
  descricao: string;
  ocorridoEm: string;
}

export interface DiarioItem {
  id: string;
  status: StatusDiario;
  fechadoEm: string | null;
  registros: RegistroRotinaItem[];
  fechadoPor?: { user: { nome: string } } | null;
}

export interface ResumoEducacional {
  matriculados: number;
  presentesAgora: number;
  diariosFechados: number;
  diariosAbertos: number;
  criticosSemLeitura: number;
}

export interface TurmaInfantilResumo {
  id: string;
  nome: string;
  faixaEtariaMin: number;
  faixaEtariaMax: number;
  capacidade: number;
  educador: { user: { nome: string } };
  _count: { matriculas: number };
}

export interface MatriculaTurmaDia {
  id: string;
  membroId: string;
  crianca: {
    id: string;
    nomeCompleto: string;
    dataNascimento: string;
    alergias: AlergiaItem[];
  };
  ficha: { id: string; protocolo: string; nomeCompleto: string };
  estadoDia: EstadoDia;
  checksDoDia: CheckItem[];
  diarioDoDia: { id: string; status: StatusDiario } | null;
}

export interface TurmaInfantilDia extends TurmaInfantilResumo {
  matriculas: MatriculaTurmaDia[];
  dia: string;
}

export interface PerfilCrianca {
  crianca: {
    id: string;
    nomeCompleto: string;
    dataNascimento: string;
    alergias: AlergiaItem[];
    condicoesCronicas: { id: string; descricao: string; cid10?: string | null }[];
    ficha: { id: string; protocolo: string; nomeCompleto: string; telefone: string };
  };
  matricula: { turma: { id: string; nome: string } };
  autorizados: AutorizadoItem[];
  autorizacoesImagem: {
    escopo: EscopoImagem;
    concedido: boolean;
    revogadoEm: string | null;
  }[];
  ultimosChecks: CheckItem[];
}

export interface MinhaCrianca {
  id: string; // matrícula
  crianca: { id: string; nomeCompleto: string; dataNascimento: string };
  turma: { id: string; nome: string };
}

export interface DiarioFamilia {
  dia: string;
  crianca: { id: string; nomeCompleto: string };
  diario: DiarioItem | null;
  checks: CheckItem[];
}

export interface FichaCriancaFamilia {
  crianca: {
    id: string;
    nomeCompleto: string;
    dataNascimento: string;
    alergias: AlergiaItem[];
    condicoesCronicas: { id: string; descricao: string }[];
  };
  autorizados: AutorizadoItem[];
  autorizacoesImagem: {
    escopo: EscopoImagem;
    concedido: boolean;
    revogadoEm: string | null;
  }[];
}

export interface ComunicadoFamilia {
  id: string;
  titulo: string;
  corpo: string;
  critico: boolean;
  criadoEm: string;
  lidoEm: string | null;
}

// ============================================================
// Console do educador
// ============================================================

export function useResumoEducacional() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "resumo"],
    queryFn: () => authFetch<ResumoEducacional>("/educacional/resumo"),
    enabled: status === "authenticated",
  });
}

export function useTurmasInfantis() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "turmas"],
    queryFn: () => authFetch<{ items: TurmaInfantilResumo[] }>("/educacional/turmas"),
    enabled: status === "authenticated",
  });
}

export function useTurmaInfantil(id: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "turma", id],
    queryFn: () => authFetch<TurmaInfantilDia>(`/educacional/turmas/${id}`),
    enabled: status === "authenticated" && !!id,
    placeholderData: (prev) => prev,
  });
}

export function usePerfilCrianca(membroId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "crianca", membroId],
    queryFn: () => authFetch<PerfilCrianca>(`/educacional/criancas/${membroId}`),
    enabled: status === "authenticated" && !!membroId,
  });
}

/** Lista de autorizados da criança (modal de check-in/out — inclui revogados p/ exibir bloqueio). */
export function useAutorizados(membroId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "autorizados", membroId],
    queryFn: () =>
      authFetch<{ items: AutorizadoItem[] }>(
        `/educacional/criancas/${membroId}/autorizados`,
      ),
    enabled: status === "authenticated" && !!membroId,
  });
}

export interface CheckPayload {
  membroId: string;
  autorizadoId: string;
}

export function useCheckin() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckPayload) =>
      authFetch<CheckItem>("/educacional/checkins", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["educacional"] }),
  });
}

export function useCheckout() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckPayload) =>
      authFetch<CheckItem>("/educacional/checkouts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["educacional"] }),
  });
}

export function useRegistrarRotina() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      membroId,
      tipo,
      descricao,
    }: {
      membroId: string;
      tipo: TipoRegistroRotina;
      descricao: string;
    }) =>
      authFetch<RegistroRotinaItem>(`/educacional/diarios/${membroId}/registros`, {
        method: "POST",
        body: JSON.stringify({ tipo, descricao }),
      }),
    onSuccess: (_d, { membroId }) => {
      qc.invalidateQueries({ queryKey: ["educacional", "diario", membroId] });
      qc.invalidateQueries({ queryKey: ["educacional", "resumo"] });
    },
  });
}

export function useDiarioDoDia(membroId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["educacional", "diario", membroId],
    queryFn: () =>
      authFetch<{ dia: string; diario: DiarioItem | null }>(
        `/educacional/diarios/${membroId}`,
      ),
    enabled: status === "authenticated" && !!membroId,
  });
}

export function useFecharDiario() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (diarioId: string) =>
      authFetch<DiarioItem>(`/educacional/diarios/${diarioId}/fechar`, {
        method: "PATCH",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["educacional"] }),
  });
}

// ============================================================
// Portal da família
// ============================================================

export function useMinhasCriancas() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "criancas"],
    queryFn: () => authFetch<{ items: MinhaCrianca[] }>("/familia/educacional/criancas"),
    enabled: status === "authenticated",
  });
}

export function useDiarioFamilia(membroId: string | undefined, data?: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "diario", membroId, data ?? "hoje"],
    queryFn: () =>
      authFetch<DiarioFamilia>(
        `/familia/educacional/diario/${membroId}${data ? `?data=${data}` : ""}`,
      ),
    enabled: status === "authenticated" && !!membroId,
    placeholderData: (prev) => prev,
  });
}

export function useFichaCrianca(membroId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "ficha", membroId],
    queryFn: () =>
      authFetch<FichaCriancaFamilia>(`/familia/educacional/ficha/${membroId}`),
    enabled: status === "authenticated" && !!membroId,
  });
}

export function useComunicadosFamilia() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "comunicados"],
    queryFn: () =>
      authFetch<{ items: ComunicadoFamilia[] }>("/familia/educacional/comunicados"),
    enabled: status === "authenticated",
  });
}

export function useConfirmarLeitura() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comunicadoId: string) =>
      authFetch(`/familia/educacional/comunicados/${comunicadoId}/leitura`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["familia", "comunicados"] }),
  });
}
