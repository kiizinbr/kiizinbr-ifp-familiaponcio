"use client";

/**
 * Hooks do Centro Médico Fase 2 (clínico): documentos (atestado/receita/
 * declaração com verificação pública) e odontograma (FDI + plano).
 * Mantido separado de use-medico.ts (já grande). useAuthFetch injeta o token.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Documentos médicos
// ============================================================

export type TipoDocumentoMedico = "ATESTADO" | "RECEITA" | "DECLARACAO";

export const TIPO_DOC_LABEL: Record<TipoDocumentoMedico, string> = {
  ATESTADO: "Atestado",
  RECEITA: "Receita",
  DECLARACAO: "Declaração",
};

export interface DocumentoMedico {
  id: string;
  tipo: TipoDocumentoMedico;
  codigoVerificacao: string;
  conteudo: string;
  cid10: string | null;
  diasAfastamento: number | null;
  revogadoEm: string | null;
  revogadoMotivo: string | null;
  emitidoEm: string;
}

export interface EmitirDocumentoPayload {
  atendimentoId: string;
  tipo: TipoDocumentoMedico;
  conteudo: string;
  cid10?: string;
  diasAfastamento?: number;
}

export function useDocumentosDoAtendimento(atendimentoId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "documentos", atendimentoId],
    queryFn: () =>
      authFetch<{ items: DocumentoMedico[] }>(
        `/medico/atendimentos/${atendimentoId}/documentos`,
      ),
    enabled: status === "authenticated" && !!atendimentoId,
  });
}

export function useEmitirDocumento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atendimentoId, ...body }: EmitirDocumentoPayload) =>
      authFetch<DocumentoMedico>(`/medico/atendimentos/${atendimentoId}/documentos`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "documentos"] }),
  });
}

export function useRevogarDocumento() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      authFetch<DocumentoMedico>(`/medico/documentos/${id}/revogar`, {
        method: "PATCH",
        body: JSON.stringify({ motivo }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "documentos"] }),
  });
}

// ============================================================
// Odontograma (FDI 32 dentes + plano de tratamento)
// ============================================================

export type EstadoDente =
  | "HIGIDO"
  | "CARIE"
  | "RESTAURADO"
  | "AUSENTE"
  | "EXTRACAO_INDICADA"
  | "TRATAMENTO_CANAL"
  | "IMPLANTE"
  | "PROTESE"
  | "FRATURADO";

export const ESTADO_DENTE_LABEL: Record<EstadoDente, string> = {
  HIGIDO: "Hígido",
  CARIE: "Cárie",
  RESTAURADO: "Restaurado",
  AUSENTE: "Ausente",
  EXTRACAO_INDICADA: "Extração indicada",
  TRATAMENTO_CANAL: "Tratamento de canal",
  IMPLANTE: "Implante",
  PROTESE: "Prótese",
  FRATURADO: "Fraturado",
};

/** Cor de cada estado (classes de fundo/borda CASA), p/ o grid de dentes. */
export const ESTADO_DENTE_COR: Record<EstadoDente, string> = {
  HIGIDO: "bg-surface border-border text-muted-foreground",
  CARIE: "bg-danger/15 border-danger/50 text-danger",
  RESTAURADO: "bg-primary/15 border-primary/50 text-primary",
  AUSENTE: "bg-muted border-border text-muted-foreground line-through",
  EXTRACAO_INDICADA: "bg-warning/20 border-warning/60 text-warning",
  TRATAMENTO_CANAL: "bg-info/15 border-info/50 text-info",
  IMPLANTE: "bg-success/15 border-success/50 text-success",
  PROTESE: "bg-success/10 border-success/40 text-success",
  FRATURADO: "bg-danger/10 border-danger/40 text-danger",
};

export interface DenteEstado {
  id: string;
  numeroFdi: number;
  estado: EstadoDente;
  procedimento: string | null;
  observacoes: string | null;
}

export interface Odontograma {
  id: string;
  observacoes: string | null;
  dentes: DenteEstado[];
}

export interface DenteInput {
  numeroFdi: number;
  estado: EstadoDente;
  procedimento?: string;
  observacoes?: string;
}

export interface UpsertOdontogramaPayload {
  atendimentoId: string;
  observacoes?: string;
  dentes: DenteInput[];
}

/** Numeração FDI organizada por arcada (para desenhar o grid). */
export const FDI_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const FDI_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function useOdontograma(atendimentoId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["medico", "odontograma", atendimentoId],
    queryFn: () =>
      authFetch<Odontograma>(`/medico/atendimentos/${atendimentoId}/odontograma`),
    enabled: status === "authenticated" && !!atendimentoId,
    // 404 (sem odontograma ainda) é estado normal — não fica re-tentando.
    retry: false,
  });
}

export function useSalvarOdontograma() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atendimentoId, ...body }: UpsertOdontogramaPayload) =>
      authFetch<Odontograma>(`/medico/atendimentos/${atendimentoId}/odontograma`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medico", "odontograma"] }),
  });
}
