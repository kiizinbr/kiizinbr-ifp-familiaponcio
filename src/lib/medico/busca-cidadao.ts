/**
 * Busca de cidadão para o passo 1 do wizard /medico/consultas/nova.
 *
 * Lógica pura e testável (sem Prisma) — espelha o padrão da capacitação
 * (buscarCandidatosAction): REUSA buildCidadaoSearchFilter (que já corrige o LIKE
 * '%%' quebrado e bate nos índices trigram) e só acrescenta o escopo do médico:
 * nunca oferecer ficha soft-deletada nem anonimizada.
 */

import type { Prisma } from "@prisma/client";
import { buildCidadaoSearchFilter } from "@/lib/cidadao";

/** Mínimo de caracteres úteis (pós-trim) pra disparar a busca incremental. */
export const BUSCA_CIDADAO_MIN_CHARS = 2;

/** True quando a query tem caracteres suficientes pra valer uma ida ao banco. */
export function buscaCidadaoValida(query: string): boolean {
  return query.trim().length >= BUSCA_CIDADAO_MIN_CHARS;
}

/**
 * Monta o `where` da busca do wizard: filtro de termo (trigram, reusado) +
 * exclusão de fichas apagadas/anonimizadas. Determinístico — testável sem DB.
 */
export function buildBuscaCidadaoWhere(query: string): Prisma.CidadaoWhereInput {
  return {
    deletedAt: null,
    anonimizadoEm: null,
    ...buildCidadaoSearchFilter(query),
  };
}
