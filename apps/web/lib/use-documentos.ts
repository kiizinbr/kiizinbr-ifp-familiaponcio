"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import {
  API_BASE_URL,
  ApiError,
  type DocumentoFicha,
  type DownloadDocumento,
  type TipoDocumento,
} from "./api";

/**
 * Documentos da Ficha Cidadã (Onda C2).
 *
 * O upload é multipart (FormData) — por isso NÃO usa o `useAuthFetch` (que força
 * Content-Type: application/json e quebraria o boundary do multipart). Aqui
 * montamos o fetch na mão, só com o Authorization, e deixamos o browser definir
 * o Content-Type do FormData.
 */

/** Lista os documentos de uma ficha. */
export function useDocumentos(fichaId: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["documentos", fichaId],
    queryFn: () => authFetch<DocumentoFicha[]>(`/fichas-cidadas/${fichaId}/documentos`),
    enabled: status === "authenticated" && !!fichaId,
  });
}

/** Sobe um arquivo (PDF/JPG/PNG) classificado por `tipo`. */
export function useUploadDocumento(fichaId: string) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ tipo, arquivo }: { tipo: TipoDocumento; arquivo: File }) => {
      const form = new FormData();
      form.append("tipo", tipo);
      form.append("arquivo", arquivo);

      const res = await fetch(`${API_BASE_URL}/fichas-cidadas/${fichaId}/documentos`, {
        method: "POST",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          /* sem corpo */
        }
        const raw = (body as { message?: unknown })?.message;
        const message = Array.isArray(raw)
          ? raw.join("; ")
          : typeof raw === "string"
            ? raw
            : res.statusText || "Falha no upload";
        throw new ApiError(message, res.status, body);
      }
      return (await res.json()) as DocumentoFicha;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos", fichaId] }),
  });
}

/** Remove um documento (storage + linha). */
export function useRemoverDocumento(fichaId: string) {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      authFetch<{ removido: boolean; id: string }>(
        `/fichas-cidadas/${fichaId}/documentos/${docId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos", fichaId] }),
  });
}

/**
 * Pede a URL pré-assinada e abre o download. A URL é válida por pouco tempo e
 * só é gerada após a API checar ownership/tenant — o front nunca toca na chave
 * interna do storage.
 */
export function useBaixarDocumento(fichaId: string) {
  const authFetch = useAuthFetch();
  return useMutation({
    mutationFn: (docId: string) =>
      authFetch<DownloadDocumento>(`/fichas-cidadas/${fichaId}/documentos/${docId}`),
    onSuccess: (data) => {
      // Abre em nova aba; o browser baixa/exibe conforme o MIME.
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
  });
}
