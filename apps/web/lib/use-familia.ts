"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { API_BASE_URL, ApiError } from "./api";
import { useAuthFetch } from "./use-auth-fetch";

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
