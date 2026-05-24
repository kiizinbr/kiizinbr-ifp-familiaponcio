/**
 * CRUD da Ficha Cidadã com RBAC integrado.
 *
 * Decisões §0.5 (RLS), §0.6 (busca trigram), §0.9 (soft delete + LGPD)
 * fechadas no Plano 2 e Plano 3.
 */

import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { normalizeCpf } from "@/lib/cpf";
import { normalizeCep } from "@/lib/cep";
import { can, getUserUnits } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

export type CidadaoStatus = "ativo" | "anonimizado" | "deletado";

export interface CidadaoListFilters {
  search?: string;
  unitScopes?: UnitScope[];
  status?: CidadaoStatus;
  /** Idade mínima inclusiva. */
  idadeMin?: number;
  /** Idade máxima inclusiva. */
  idadeMax?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Lista cidadãos respeitando RBAC do session.
 * - super_admin/gestor_geral/presidencia/social: vê todos
 * - gestor_unidade/profissional/recepcao: filtra por unitIdOrigem in user_units
 *
 * Search usa trigram (similarity > 0.3) em nomeCompleto + nomeSocial + cpf + telefonePrincipal.
 */
export async function listCidadaos(filters: CidadaoListFilters, session: Session | null) {
  if (!session) return { items: [], nextCursor: null };

  const units = getUserUnits(session);
  const limit = Math.min(filters.limit ?? 50, 100);

  // Filtro de unidade: se user não tem acesso global, restringe pelo array
  const unitFilter =
    units === "all"
      ? filters.unitScopes && filters.unitScopes.length > 0
        ? { unitIdOrigem: { in: filters.unitScopes } }
        : {}
      : { unitIdOrigem: { in: units } };

  // Filtro de status: default = ativo
  const status = filters.status ?? "ativo";
  const statusFilter =
    status === "ativo"
      ? { deletedAt: null, anonimizadoEm: null }
      : status === "anonimizado"
        ? { anonimizadoEm: { not: null } }
        : { deletedAt: { not: null } };

  // Idade: derivada de dataNascimento
  let dataNascimentoFilter: { gte?: Date; lte?: Date } | undefined;
  if (filters.idadeMin !== undefined || filters.idadeMax !== undefined) {
    dataNascimentoFilter = {};
    const now = new Date();
    if (filters.idadeMax !== undefined) {
      dataNascimentoFilter.gte = new Date(
        now.getFullYear() - filters.idadeMax - 1,
        now.getMonth(),
        now.getDate() + 1,
      );
    }
    if (filters.idadeMin !== undefined) {
      dataNascimentoFilter.lte = new Date(
        now.getFullYear() - filters.idadeMin,
        now.getMonth(),
        now.getDate(),
      );
    }
  }

  // Busca trigram: implementada via raw SQL pra usar `similarity()` e gin index
  // mas pra MVP usamos ILIKE (mais simples) que ainda hits o trigram index automaticamente.
  // (Plano 3 evolução: raw query com similarity > 0.3 explícito)
  const searchTerm = filters.search?.trim();
  const searchFilter = searchTerm
    ? {
        OR: [
          { nomeCompleto: { contains: searchTerm, mode: "insensitive" as const } },
          { nomeSocial: { contains: searchTerm, mode: "insensitive" as const } },
          { cpf: { contains: normalizeCpf(searchTerm) } },
          { telefonePrincipal: { contains: normalizeCpf(searchTerm) } },
        ],
      }
    : {};

  const cidadaos = await db.cidadao.findMany({
    where: {
      ...unitFilter,
      ...statusFilter,
      ...(dataNascimentoFilter && { dataNascimento: dataNascimentoFilter }),
      ...searchFilter,
    },
    include: {
      familia: { select: { id: true, nomeReferencia: true } },
    },
    orderBy: [{ nomeCompleto: "asc" }],
    take: limit + 1,
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
  });

  const hasMore = cidadaos.length > limit;
  const items = hasMore ? cidadaos.slice(0, limit) : cidadaos;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

/** Busca cidadão por ID respeitando RBAC. Retorna null se não autorizado ou não encontrado. */
export async function getCidadao(id: string, session: Session | null) {
  if (!session) return null;
  const cidadao = await db.cidadao.findUnique({
    where: { id },
    include: {
      familia: true,
      enderecos: true,
      anexos: { where: { deletedAt: null } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!cidadao) return null;

  // RBAC: confere se user tem acesso à unidade de origem
  const allowed = can(session, "view", "ficha_cidada", {
    unitScope: cidadao.unitIdOrigem as UnitScope,
  });
  return allowed ? cidadao : null;
}

/**
 * Estatísticas agregadas pra dashboard (cards de KPI).
 * Respeitando RBAC: usuário com acesso restrito vê só dados da sua unidade.
 */
export async function getCidadaoStats(session: Session | null) {
  if (!session) return null;
  const units = getUserUnits(session);
  const unitFilter = units === "all" ? {} : { unitIdOrigem: { in: units } };

  const [total, ativos, deletados, porUnidade] = await Promise.all([
    db.cidadao.count({ where: unitFilter }),
    db.cidadao.count({ where: { ...unitFilter, deletedAt: null, anonimizadoEm: null } }),
    db.cidadao.count({ where: { ...unitFilter, deletedAt: { not: null } } }),
    db.cidadao.groupBy({
      by: ["unitIdOrigem"],
      where: { ...unitFilter, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    ativos,
    deletados,
    porUnidade: porUnidade.map((p) => ({
      unidade: p.unitIdOrigem as UnitScope,
      total: p._count._all,
    })),
  };
}

/**
 * Auxiliar: calcula idade a partir de dataNascimento.
 */
export function calcularIdade(dataNascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const mes = hoje.getMonth() - dataNascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < dataNascimento.getDate())) {
    idade--;
  }
  return idade;
}

/**
 * Normaliza inputs de CEP em endereços antes de salvar.
 * (Future: validateCpf + outras normalizações automaticas via wrapper)
 */
export function normalizeEnderecoInput(input: { cep: string }): { cep: string } {
  return { ...input, cep: normalizeCep(input.cep) };
}
