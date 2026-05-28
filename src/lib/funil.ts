/**
 * Funil de captação — Fatia A (agendamento interno).
 * Padrão "pure core, I/O shell": cálculo de capacidade é puro/testável; leitura faz RBAC.
 */

import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { canAccessUnit, getUserUnits, hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

/** Status que ocupam um slot da vaga. */
const OCUPA_SLOT = new Set(["agendado", "confirmado", "realizado"]);

/** Slots disponíveis = capacidade − agendamentos ativos. Nunca negativo. Puro. */
export function slotsDisponiveis(slotsTotais: number, agendamentos: { status: string }[]): number {
  const ocupados = agendamentos.filter((a) => OCUPA_SLOT.has(a.status)).length;
  return Math.max(0, slotsTotais - ocupados);
}

/** A vaga aceita um novo agendamento? (aberta, dentro da janela, com slot livre). Puro. */
export function vagaAceitaAgendamento(
  vaga: { status: string; slotsTotais: number; fechaEm: Date | null },
  ocupados: number,
): boolean {
  if (vaga.status !== "aberta") return false;
  if (vaga.fechaEm && vaga.fechaEm.getTime() <= Date.now()) return false;
  return ocupados < vaga.slotsTotais;
}

/** Quem cria/edita vagas. */
export function podeGerenciarVaga(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}

/** Quem agenda entrevistas (callcenter/recepção + social + coordenação). */
export function podeAgendar(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "gestor_unidade", "social", "recepcao");
}

/** Lista vagas respeitando a unidade do usuário (global/social veem todas). */
export async function listVagas(session: Session | null) {
  if (!session) return [];
  const units = getUserUnits(session);
  const where = units === "all" ? {} : { unidade: { in: units } };
  return db.vaga.findMany({
    where,
    include: { agendamentos: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Busca uma vaga + seus agendamentos, respeitando RBAC de unidade. */
export async function getVaga(id: string, session: Session | null) {
  if (!session) return null;
  const vaga = await db.vaga.findUnique({
    where: { id },
    include: {
      agendamentos: {
        include: { cidadao: { select: { id: true, nomeCompleto: true } } },
        orderBy: { horario: "asc" },
      },
      criadoPor: { select: { name: true, email: true } },
    },
  });
  if (!vaga) return null;
  return canAccessUnit(session, vaga.unidade as UnitScope) ? vaga : null;
}
