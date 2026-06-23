"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { API_BASE_URL, ApiError } from "./api";
import { useAuthFetch } from "./use-auth-fetch";

export type RespostaPresenca = "SIM" | "NAO";

// ============================================================
// Portal da família — "O que recebi" + galeria de certificados.
// Espelha o módulo educacional (FamiliaRecebidoController), prefixo /familia.
// ============================================================

export type StatusMatriculaFamilia =
  | "ATIVA"
  | "LISTA_ESPERA"
  | "TRANCADA"
  | "EVADIDA"
  | "CONCLUIDA"
  | "CANCELADA";

export interface RecebidoResumo {
  creche: number;
  capacitacao: number;
  esporte: number;
  certificados: number;
  graduacoes: number;
  atendimentos: number;
}

export interface RecebidoCreche {
  id: string;
  crianca: { id: string; nomeCompleto: string };
  turma: { id: string; nome: string };
  unidade: { id: string; nome: string };
}

export interface RecebidoCapacitacao {
  id: string;
  status: StatusMatriculaFamilia;
  beneficiario: string;
  curso: string;
  turma: string;
  unidade: string;
  temCertificado: boolean;
}

export interface RecebidoEsporte {
  id: string;
  status: StatusMatriculaFamilia;
  beneficiario: string;
  modalidade: string;
  turma: string;
  unidade: string;
  graduacoes: number;
}

export interface FamiliaRecebido {
  resumo: RecebidoResumo;
  creche: RecebidoCreche[];
  capacitacao: RecebidoCapacitacao[];
  esporte: RecebidoEsporte[];
}

export interface CertificadoFamilia {
  id: string;
  codigoVerificacao: string;
  beneficiario: string;
  curso: string;
  turma: string;
  cargaHorariaCumprida: number;
  presencaPct: number;
  emitidoEm: string;
}

export interface GraduacaoFamilia {
  id: string;
  codigoVerificacao: string;
  beneficiario: string;
  modalidade: string;
  turma: string;
  nivel: string;
  observacao: string | null;
  concedidaEm: string;
}

export interface FamiliaCertificados {
  certificados: CertificadoFamilia[];
  graduacoes: GraduacaoFamilia[];
}

/** Resumo agregado de tudo o que a família recebeu nas verticais. */
export function useRecebido() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "recebido"],
    queryFn: () => authFetch<FamiliaRecebido>("/familia/recebido"),
    enabled: status === "authenticated",
  });
}

/** Galeria de certificados (capacitação) + graduações (esporte) da família. */
export function useCertificadosFamilia() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "certificados"],
    queryFn: () => authFetch<FamiliaCertificados>("/familia/certificados"),
    enabled: status === "authenticated",
  });
}

/**
 * Baixa o PDF do certificado da PRÓPRIA família e abre numa nova aba.
 * O PDF é binário, então não usa o authFetch (que faz JSON): busca o blob
 * com o token no header e abre uma object URL. IDOR fica no backend (404).
 */
export function useBaixarCertificadoPdf() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  return useMutation({
    mutationFn: async (codigo: string) => {
      const res = await fetch(
        `${API_BASE_URL}/familia/certificados/${codigo}/pdf`,
        {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        throw new ApiError(
          res.status === 404
            ? "Certificado não encontrado."
            : "Não foi possível abrir o certificado.",
          res.status,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Libera a object URL depois de o navegador abrir a aba.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return true;
    },
  });
}

// ============================================================
// Agenda de eventos + confirmação de presença (U6).
// Espelha o FamiliaAgendaController (prefixo /familia/agenda, /familia/presenca).
// ============================================================

export interface ConfirmacaoEventoFamilia {
  membroId: string;
  resposta: RespostaPresenca;
  observacao: string | null;
  respondidoEm: string;
}

export interface EventoFamilia {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicioEm: string;
  fimEm: string | null;
  pedeConfirmacao: boolean;
  unidade: { id: string; nome: string };
  turma: { id: string; nome: string } | null;
  confirmacoes: ConfirmacaoEventoFamilia[];
  pendentes: number;
}

export interface AgendaFamilia {
  items: EventoFamilia[];
}

export interface PresencaItem {
  crianca: { id: string; nomeCompleto: string };
  turma: { id: string; nome: string };
  unidade: { id: string; nome: string };
  resposta: RespostaPresenca | null;
  observacao: string | null;
  respondidaEm: string | null;
}

export interface PresencaDoDia {
  dia: string;
  items: PresencaItem[];
}

/** Calendário de eventos das unidades das minhas crianças + meu RSVP. */
export function useAgenda() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["familia", "agenda"],
    queryFn: () => authFetch<AgendaFamilia>("/familia/agenda"),
    enabled: status === "authenticated",
  });
}

/** Confirma (SIM/NAO) a presença de uma criança num evento; invalida a agenda. */
export function useConfirmarEvento() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      eventoId: string;
      membroId: string;
      resposta: RespostaPresenca;
      observacao?: string;
    }) =>
      authFetch(`/familia/agenda/${vars.eventoId}/confirmar`, {
        method: "POST",
        body: JSON.stringify({
          membroId: vars.membroId,
          resposta: vars.resposta,
          observacao: vars.observacao,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["familia", "agenda"] });
    },
  });
}

/** "Vem amanhã?" da creche — confirmação por criança no dia (default: amanhã). */
export function usePresenca(data?: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  const qs = data ? `?data=${encodeURIComponent(data)}` : "";
  return useQuery({
    queryKey: ["familia", "presenca", data ?? "amanha"],
    queryFn: () => authFetch<PresencaDoDia>(`/familia/presenca${qs}`),
    enabled: status === "authenticated",
  });
}

/** Responde o "vem amanhã?" de uma criança (SIM/NAO); invalida a lista do dia. */
export function useResponderPresenca() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      membroId: string;
      resposta: RespostaPresenca;
      data?: string;
      observacao?: string;
    }) =>
      authFetch("/familia/presenca", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["familia", "presenca"] });
    },
  });
}
