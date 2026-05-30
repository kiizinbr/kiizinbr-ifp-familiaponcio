"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";

import { API_BASE_URL, ApiError } from "./api";

/**
 * Hook que devolve uma função `authFetch` já com o accessToken da sessão
 * injetado no header Authorization. Centraliza: base URL, JSON, e a tradução
 * de respostas de erro do NestJS (que vêm como { statusCode, message, error },
 * com `message` podendo ser um array de erros de validação) em ApiError.
 *
 * Uso:
 *   const authFetch = useAuthFetch();
 *   const ficha = await authFetch<FichaDetalhe>(`/fichas-cidadas/${id}`);
 */
export function useAuthFetch() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });

      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // resposta sem corpo JSON — segue com body null
        }
        const raw = (body as { message?: unknown })?.message;
        const message = Array.isArray(raw)
          ? raw.join("; ")
          : typeof raw === "string"
            ? raw
            : res.statusText || "Erro na requisição";
        throw new ApiError(message, res.status, body);
      }

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [token],
  );
}
