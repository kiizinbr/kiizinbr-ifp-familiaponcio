/**
 * CRUD da Ficha Cidadã com RBAC integrado.
 *
 * Decisões §0.5 (RLS), §0.6 (busca trigram), §0.9 (soft delete + LGPD)
 * fechadas no Plano 2 e Plano 3.
 */

import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeCpf } from "@/lib/cpf";
import { normalizeCep } from "@/lib/cep";
import { can, getUserUnits, podeVerSaudeCidadao, podeVerSocioCidadao } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

export type CidadaoStatus = "ativo" | "anonimizado" | "deletado";

export interface CidadaoListFilters {
  search?: string;
  unitScopes?: UnitScope[];
  /** Eixo de compliance: ativo (não deletado/anonimizado) | anonimizado | deletado. */
  status?: CidadaoStatus;
  /** Eixo de ciclo de vida (ortogonal ao status de compliance). */
  statusCadastro?: "rascunho" | "ativo" | "inativo";
  /** Idade mínima inclusiva. */
  idadeMin?: number;
  /** Idade máxima inclusiva. */
  idadeMax?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Monta o filtro Prisma de busca da listagem de cidadãos a partir do termo.
 * Extraído de listCidadaos para teste unitário puro (sem DB).
 */
export function buildCidadaoSearchFilter(search: string | undefined): Prisma.CidadaoWhereInput {
  const searchTerm = search?.trim();
  if (!searchTerm) return {};

  // cpf/telefone só entram quando o termo tem dígitos: senão normalizeCpf()
  // devolve "" e `contains: ""` vira LIKE '%%', casando TODOS os registros
  // (achado #2 — mesma pegadinha já corrigida no wizard de nova consulta).
  const digits = normalizeCpf(searchTerm);
  const or: Prisma.CidadaoWhereInput[] = [
    { nomeCompleto: { contains: searchTerm, mode: "insensitive" } },
    { nomeSocial: { contains: searchTerm, mode: "insensitive" } },
  ];
  if (digits) {
    or.push({ cpf: { contains: digits } }, { telefonePrincipal: { contains: digits } });
  }
  return { OR: or };
}

/**
 * Lista cidadãos respeitando RBAC do session.
 * - super_admin/presidencia/social: vê todos
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

  // Busca: ILIKE em nome/nomeSocial + cpf/telefone (estes só quando há dígitos —
  // ver buildCidadaoSearchFilter; senão `contains: ""` vira LIKE '%%' e casa tudo).
  const searchFilter = buildCidadaoSearchFilter(filters.search);

  const cidadaos = await db.cidadao.findMany({
    where: {
      ...unitFilter,
      ...statusFilter,
      ...(filters.statusCadastro ? { statusCadastro: filters.statusCadastro } : {}),
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
 * Campos sensíveis da Ficha Cidadã, particionados por base legal de acesso.
 * SAÚDE (PHI) — visível só com podeVerSaudeCidadao; SOCIO — só com podeVerSocioCidadao.
 */
export interface CamposSensiveisCidadao {
  tipoSanguineo: string | null;
  alergias: string | null;
  medicamentosEmUso: string | null;
  condicoesCronicas: string | null;
  rendaFamiliar: Prisma.Decimal | null;
  pessoasNaCasa: number | null;
  beneficioSocial: string | null;
  escolaridade: string | null;
  trabalha: boolean | null;
  trabalhoDescricao: string | null;
}

const SAUDE_REDACTED = {
  tipoSanguineo: null,
  alergias: null,
  medicamentosEmUso: null,
  condicoesCronicas: null,
} satisfies Partial<CamposSensiveisCidadao>;

const SOCIO_REDACTED = {
  rendaFamiliar: null,
  pessoasNaCasa: null,
  beneficioSocial: null,
  escolaridade: null,
  trabalha: null,
  trabalhoDescricao: null,
} satisfies Partial<CamposSensiveisCidadao>;

/**
 * Pura: devolve uma CÓPIA do cidadão com os blocos sensíveis nulados conforme a
 * capability. Enforcement na CAMADA DE DADOS (não no JSX): mesmo que um caller
 * serialize/logue o resultado, o PHI/socio sem permissão já saiu como null.
 * Não muta a entrada.
 */
export function redactCidadaoSensiveis<T extends CamposSensiveisCidadao>(
  cidadao: T,
  caps: { podeVerSaude: boolean; podeVerSocio: boolean },
): T {
  return {
    ...cidadao,
    ...(caps.podeVerSaude ? {} : SAUDE_REDACTED),
    ...(caps.podeVerSocio ? {} : SOCIO_REDACTED),
  };
}

/**
 * Igual a getCidadao mas REDIGE os campos sensíveis pelo session. Use SEMPRE este
 * para EXIBIR a ficha; getCidadao (cru) só em fluxos que comprovadamente precisam
 * do dado completo e já checaram permissão de escrita por bloco (ex.: B2).
 */
export async function getCidadaoView(id: string, session: Session | null) {
  const cidadao = await getCidadao(id, session);
  if (!cidadao) return null;
  return redactCidadaoSensiveis(cidadao, {
    podeVerSaude: podeVerSaudeCidadao(session),
    podeVerSocio: podeVerSocioCidadao(session),
  });
}

/** Chaves dos blocos sensíveis — usadas pela omissão de escrita (B2). */
const CAMPOS_SAUDE_CIDADAO = [
  "tipoSanguineo",
  "alergias",
  "medicamentosEmUso",
  "condicoesCronicas",
] as const;
const CAMPOS_SOCIO_CIDADAO = [
  "rendaFamiliar",
  "pessoasNaCasa",
  "beneficioSocial",
  "escolaridade",
  "trabalha",
  "trabalhoDescricao",
] as const;

/**
 * Pura: devolve uma CÓPIA do payload de update SEM os campos sensíveis que o
 * caller não pode escrever. Remover a chave (vs nular) preserva o valor atual no
 * banco — recepção editando o básico não zera saúde/socio que ela nem vê.
 * Não muta a entrada.
 */
export function omitCamposSensiveisSemPermissao<T extends Record<string, unknown>>(
  data: T,
  caps: { podeEscreverSaude: boolean; podeEscreverSocio: boolean },
): Partial<T> {
  const out: Partial<T> = { ...data };
  if (!caps.podeEscreverSaude) {
    for (const campo of CAMPOS_SAUDE_CIDADAO) delete out[campo];
  }
  if (!caps.podeEscreverSocio) {
    for (const campo of CAMPOS_SOCIO_CIDADAO) delete out[campo];
  }
  return out;
}

/**
 * Pura: valores de anonimização IRREVERSÍVEL da Ficha (D1 / direito ao esquecimento).
 * Mascara os obrigatórios identificáveis, reduz a dataNascimento ao 1º de janeiro do
 * ano (mantém faixa etária pra estatística, perde a data exata) e nula PII opcional +
 * foto + saúde + socioeconômico. NÃO grava `anonimizadoEm` (a action põe o timestamp,
 * mantendo a função determinística). Preserva só agregados (unitIdOrigem, statusCadastro).
 */
export function dadosAnonimizadosCidadao(cidadao: { id: string; dataNascimento: Date }) {
  return {
    nomeCompleto: "[anonimizado]",
    cpf: `ANON-${cidadao.id}`,
    dataNascimento: new Date(Date.UTC(cidadao.dataNascimento.getUTCFullYear(), 0, 1)),
    telefonePrincipal: "[anonimizado]",
    nomeSocial: null,
    rg: null,
    documentoAlternativo: null,
    corRaca: null,
    estadoCivil: null,
    naturalidade: null,
    nomeMae: null,
    nomePai: null,
    escolaAtual: null,
    telefoneSecundario: null,
    email: null,
    whatsappConsente: false,
    fotoUrl: null,
    tipoSanguineo: null,
    alergias: null,
    medicamentosEmUso: null,
    condicoesCronicas: null,
    rendaFamiliar: null,
    pessoasNaCasa: null,
    beneficioSocial: null,
    escolaridade: null,
    trabalha: null,
    trabalhoDescricao: null,
  };
}

/** Pura: anonimização de Endereço — mascara logradouro/cep, nula o resto, mantém cidade/uf. */
export function dadosAnonimizadosEndereco() {
  return {
    logradouro: "[anonimizado]",
    numero: null,
    complemento: null,
    bairro: null,
    cep: "00000000",
    pontoReferencia: null,
  };
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
