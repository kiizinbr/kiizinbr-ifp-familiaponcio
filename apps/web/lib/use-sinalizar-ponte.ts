"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthFetch } from "./use-auth-fetch";
import type { PrioridadeSinal, SinalizacaoPonte, TipoSinalizacao } from "./api";

/**
 * Corpo do POST /servico-social/ponte (lado do PROFISSIONAL que sinaliza).
 *
 * Só `fichaId` e `descricao` são obrigatórios. `tipo` e `prioridade` caem no
 * default do banco quando omitidos. NÃO mandamos `unidadeOrigemSlug`: o servidor
 * é autoritativo e usa sempre a unidade do profissional logado (evita origem
 * forjada na auditoria).
 */
export interface NovaSinalizacao {
  fichaId: string;
  membroId?: string;
  tipo?: TipoSinalizacao;
  prioridade?: PrioridadeSinal;
  descricao: string;
}

/**
 * Mutation que cria a sinalização "Sinalizar ao Social". É a ponta que faltava:
 * o lado social só consome/atende (use-ponte.ts); aqui o profissional ENVIA.
 *
 * Invalida a fila ["ponte"] para que, se o usuário também for do Social, a lista
 * recém-criada já apareça atualizada.
 */
export function useSinalizarPonte() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: NovaSinalizacao) =>
      authFetch<SinalizacaoPonte>("/servico-social/ponte", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ponte"] }),
  });
}
