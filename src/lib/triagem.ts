/**
 * Triagem Social (Plano 4 — fatia estrutural).
 *
 * Padrão "pure core, I/O shell" (igual ao cidadao-history):
 * - `deveAtivarCidadao` é PURA → testável sem banco.
 * - As funções de leitura fazem RBAC + query.
 */

import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { canAccessUnit, hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

/** Roles que conduzem triagem: assistente social + super_admin. */
export function podeFazerTriagem(session: Session | null): boolean {
  return hasAnyRole(session, "social", "super_admin");
}

/**
 * Regra de ativação do cadastro: o cidadão passa a `ativo` quando pelo menos uma
 * unidade aprovou a elegibilidade na triagem. Pura — sem I/O.
 */
export function deveAtivarCidadao(elegibilidades: { status: string }[]): boolean {
  return elegibilidades.some((e) => e.status === "aprovado");
}

/** Busca uma triagem com cidadão, autor e elegibilidades. RBAC: só quem conduz triagem. */
export async function getTriagem(id: string, session: Session | null) {
  if (!podeFazerTriagem(session)) return null;
  return db.triagem.findUnique({
    where: { id },
    include: {
      cidadao: {
        select: { id: true, nomeCompleto: true, unitIdOrigem: true, statusCadastro: true },
      },
      assistenteSocial: { select: { id: true, name: true, email: true } },
      elegibilidades: true,
    },
  });
}

/** A triagem aberta mais recente de um cidadão (ou null). */
export async function getTriagemAbertaPorCidadao(cidadaoId: string, session: Session | null) {
  if (!podeFazerTriagem(session)) return null;
  return db.triagem.findFirst({
    where: { cidadaoId, status: "aberta" },
    include: { elegibilidades: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Lista as triagens abertas (fila do Serviço Social). */
export async function listTriagensPendentes(session: Session | null) {
  if (!podeFazerTriagem(session)) return [];
  return db.triagem.findMany({
    where: { status: "aberta" },
    include: {
      cidadao: { select: { id: true, nomeCompleto: true, unitIdOrigem: true } },
      assistenteSocial: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Contagem de triagens abertas (KPI do dashboard social). */
export async function countTriagensAbertas(session: Session | null): Promise<number> {
  if (!podeFazerTriagem(session)) return 0;
  return db.triagem.count({ where: { status: "aberta" } });
}

/**
 * Encaminhamentos da triagem para uma unidade (aprovado/encaminhado) — visão do gestor.
 * RBAC: só quem tem acesso à unidade (gestor da unidade, coordenação, social, super_admin).
 * Substitui a notificação por e-mail (in-app por ora).
 */
export async function listEncaminhamentosUnidade(unidade: string, session: Session | null) {
  if (!session) return [];
  if (!canAccessUnit(session, unidade as UnitScope)) return [];
  return db.elegibilidadeUnidade.findMany({
    where: { unidade, status: { in: ["aprovado", "encaminhado"] } },
    include: {
      triagem: {
        include: { cidadao: { select: { id: true, nomeCompleto: true } } },
      },
    },
    orderBy: { decididoEm: "desc" },
    take: 20,
  });
}
