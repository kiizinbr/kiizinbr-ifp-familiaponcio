"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { API_BASE_URL, type TipoUnidade } from "./api";
import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos (espelham as respostas do módulo /users no NestJS)
// ============================================================

export interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  ativo: boolean;
  mustChangePassword: boolean;
  ultimoLogin: string | null;
  criadoEm: string;
  perfis: string[];
  unidades: { slug: string; nome: string }[];
}

export interface CriarUsuarioPayload {
  nome: string;
  email: string;
  cpf?: string;
  perfis: string[];
  unidades?: string[];
}

export interface UsuarioCriado {
  user: { id: string; nome: string; email: string };
  senhaProvisoria: string;
  perfis: string[];
  unidades: { slug: string; nome: string }[];
}

// ============================================================
// Consultas e mutações
// ============================================================

export function useUsuarios() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => authFetch<{ items: UsuarioItem[] }>("/users"),
    enabled: status === "authenticated",
  });
}

export function useCriarUsuario() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarUsuarioPayload) =>
      authFetch<UsuarioCriado>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useResetarSenha() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<{ senhaProvisoria: string }>(`/users/${id}/reset-senha`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useDefinirAtivo() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      authFetch<UsuarioItem>(`/users/${id}/ativo`, {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });
}

export function useTrocarSenha() {
  const authFetch = useAuthFetch();
  return useMutation({
    mutationFn: (payload: { senhaAtual: string; novaSenha: string }) =>
      authFetch<{ ok: boolean }>("/auth/trocar-senha", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

// ============================================================
// Governança LGPD — Auditoria (espelha /admin/auditoria)
// ============================================================

export type AcaoAuditoria =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "LOGIN"
  | "LOGOUT";

export const ACAO_AUDITORIA_LABEL: Record<AcaoAuditoria, string> = {
  CREATE: "Criação",
  READ: "Leitura",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  EXPORT: "Exportação",
  LOGIN: "Login",
  LOGOUT: "Logout",
};

export interface AuditoriaLinha {
  id: string;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId: string | null;
  ator: { id: string; nome: string; email: string } | null;
  ip: string | null;
  metadados: unknown;
  criadoEm: string;
}

export interface AuditoriaFiltros {
  ator?: string;
  acao?: string;
  entidade?: string;
  de?: string;
  ate?: string;
  page?: number;
  perPage?: number;
}

export interface ListaAuditoria {
  items: AuditoriaLinha[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

/** Monta a query string só com os filtros preenchidos. */
function qsAuditoria(f: AuditoriaFiltros): string {
  const p = new URLSearchParams();
  if (f.ator) p.set("ator", f.ator);
  if (f.acao) p.set("acao", f.acao);
  if (f.entidade) p.set("entidade", f.entidade);
  if (f.de) p.set("de", f.de);
  if (f.ate) p.set("ate", f.ate);
  if (f.page) p.set("page", String(f.page));
  if (f.perPage) p.set("perPage", String(f.perPage));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useAuditoria(filtros: AuditoriaFiltros) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "auditoria", filtros],
    queryFn: () => authFetch<ListaAuditoria>(`/admin/auditoria${qsAuditoria(filtros)}`),
    enabled: status === "authenticated",
  });
}

export function useAuditoriaFacetas() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "auditoria", "facetas"],
    queryFn: () => authFetch<{ acoes: AcaoAuditoria[]; entidades: string[] }>(
      "/admin/auditoria/facetas",
    ),
    enabled: status === "authenticated",
  });
}

/** URL absoluta do export CSV (o token vai por download autenticado no clique). */
export function urlExportAuditoria(filtros: AuditoriaFiltros): string {
  return `${API_BASE_URL}/admin/auditoria/export.csv${qsAuditoria(filtros)}`;
}

// ============================================================
// Governança — Unidades (espelha /admin/unidades)
// ============================================================

export interface UnidadeAdmin {
  id: string;
  tipo: TipoUnidade;
  nome: string;
  slug: string;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  _count: { usuarios: number };
}

export interface CriarUnidadePayload {
  tipo: TipoUnidade;
  nome: string;
  slug: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

export interface EditarUnidadePayload {
  nome?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

export function useUnidades() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "unidades"],
    queryFn: () => authFetch<{ items: UnidadeAdmin[] }>("/admin/unidades"),
    enabled: status === "authenticated",
  });
}

export function useCriarUnidade() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarUnidadePayload) =>
      authFetch<UnidadeAdmin>("/admin/unidades", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "unidades"] }),
  });
}

export function useEditarUnidade() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditarUnidadePayload }) =>
      authFetch<UnidadeAdmin>(`/admin/unidades/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "unidades"] }),
  });
}

export function useDefinirUnidadeAtiva() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      authFetch<UnidadeAdmin>(`/admin/unidades/${id}/ativo`, {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "unidades"] }),
  });
}

// ============================================================
// Governança — Entrega de comunicados (/admin/comunicados/entrega)
// ============================================================

export interface ComunicadoEntrega {
  id: string;
  titulo: string;
  critico: boolean;
  criadoEm: string;
  unidade: { slug: string; nome: string };
  turma: { id: string; nome: string } | null;
  publicoAlvo: number;
  lidos: number;
  pendentes: number;
  coberturaPct: number;
}

export interface ListaComunicadosEntrega {
  items: ComunicadoEntrega[];
  kpis: { total: number; criticos: number; coberturaMedia: number };
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export function useComunicadosEntrega(opts: { unidade?: string; criticos?: boolean }) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["admin", "comunicados-entrega", opts],
    queryFn: () => {
      const p = new URLSearchParams();
      if (opts.unidade) p.set("unidade", opts.unidade);
      if (opts.criticos) p.set("criticos", "true");
      const s = p.toString();
      return authFetch<ListaComunicadosEntrega>(`/admin/comunicados/entrega${s ? `?${s}` : ""}`);
    },
    enabled: status === "authenticated",
  });
}
