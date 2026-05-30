"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";
import type {
  Elegibilidade,
  Escolaridade,
  EstadoCivil,
  FichaDetalhe,
  ListaFichas,
  Parentesco,
  SituacaoMoradia,
  StatusElegibilidade,
} from "./api";

// ============================================================
// Payloads de entrada (espelham os DTOs do NestJS)
// ============================================================

export interface CriarFichaPayload {
  nomeCompleto: string;
  cpf: string;
  rg?: string;
  dataNascimento: string; // YYYY-MM-DD
  estadoCivil?: EstadoCivil;
  escolaridade?: Escolaridade;
  telefone: string;
  telefoneAlt?: string;
  email?: string;
  whatsappOptIn?: boolean;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  observacoes?: string;
}

export interface MembroPayload {
  nomeCompleto: string;
  cpf?: string;
  dataNascimento: string;
  parentesco: Parentesco;
  ocupacao?: string;
  escolaridade?: Escolaridade;
  rendaMensal?: number;
  observacoes?: string;
}

export interface DadosSocioPayload {
  rendaFamiliarTotal: number;
  rendaPerCapita: number;
  recebeBolsaFamilia?: boolean;
  recebeBPC?: boolean;
  recebeAuxilioGas?: boolean;
  outrosBeneficios?: string;
  situacaoMoradia: SituacaoMoradia;
  numeroPessoasMoradia: number;
  numeroComodos?: number;
  temAguaEncanada?: boolean;
  temEsgoto?: boolean;
  temEnergiaEletrica?: boolean;
  vulnerabilidades?: string;
}

export interface ElegibilidadePayload {
  status: StatusElegibilidade;
  motivo?: string;
  reavaliarEm?: string;
}

export interface FichasQuery {
  page?: number;
  perPage?: number;
  q?: string;
  unidade?: string;
  status?: StatusElegibilidade | "";
  ativa?: boolean;
}

/** Monta a query string ignorando campos vazios/indefinidos. */
function buildQuery(params: FichasQuery): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.perPage) sp.set("perPage", String(params.perPage));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.unidade) sp.set("unidade", params.unidade);
  if (params.status) sp.set("status", params.status);
  if (params.ativa !== undefined) sp.set("ativa", String(params.ativa));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ============================================================
// Queries
// ============================================================

export function useFichas(params: FichasQuery) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["fichas", params],
    queryFn: () => authFetch<ListaFichas>(`/fichas-cidadas${buildQuery(params)}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev, // não pisca ao paginar/filtrar
  });
}

export function useFicha(id: string | undefined) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["ficha", id],
    queryFn: () => authFetch<FichaDetalhe>(`/fichas-cidadas/${id}`),
    enabled: status === "authenticated" && !!id,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useCriarFicha() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarFichaPayload) =>
      authFetch<FichaDetalhe>("/fichas-cidadas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fichas"] }),
  });
}

export function useReplaceMembros() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, membros }: { id: string; membros: MembroPayload[] }) =>
      authFetch<FichaDetalhe>(`/fichas-cidadas/${id}/membros`, {
        method: "PUT",
        body: JSON.stringify({ membros }),
      }),
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: ["ficha", id] }),
  });
}

export function useUpsertDadosSocio() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: DadosSocioPayload }) =>
      authFetch<FichaDetalhe>(`/fichas-cidadas/${id}/dados-socio`, {
        method: "PUT",
        body: JSON.stringify(dados),
      }),
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: ["ficha", id] }),
  });
}

export function useUpdateElegibilidade() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      unidadeSlug,
      dados,
    }: {
      id: string;
      unidadeSlug: string;
      dados: ElegibilidadePayload;
    }) =>
      authFetch<Elegibilidade>(`/fichas-cidadas/${id}/elegibilidade/${unidadeSlug}`, {
        method: "PUT",
        body: JSON.stringify(dados),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["ficha", id] });
      qc.invalidateQueries({ queryKey: ["fichas"] });
    },
  });
}
