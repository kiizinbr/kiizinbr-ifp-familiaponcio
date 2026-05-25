"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { canAccessUnit } from "@/lib/rbac";
import { podeAgendar, podeGerenciarVaga, vagaAceitaAgendamento } from "@/lib/funil";
import { UNIT_SCOPES, type UnitScope } from "@/lib/rbac-types";

export type FunilResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const OCUPA = ["agendado", "confirmado", "realizado"];

/** Cria uma vaga (capacidade + janela). RBAC: gestão + acesso à unidade. */
export async function criarVagaAction(input: {
  unidade: string;
  titulo: string;
  descricao?: string;
  slotsTotais: number;
  abreEm?: string;
  fechaEm?: string;
}): Promise<FunilResult<{ id: string }>> {
  const session = await auth();
  if (!session || !podeGerenciarVaga(session)) {
    return { ok: false, error: "Sem permissão para criar vaga" };
  }
  if (!UNIT_SCOPES.includes(input.unidade as UnitScope)) {
    return { ok: false, error: "Unidade inválida" };
  }
  if (!canAccessUnit(session, input.unidade as UnitScope)) {
    return { ok: false, error: "Sem acesso a esta unidade" };
  }
  if (!input.titulo?.trim()) return { ok: false, error: "Título é obrigatório" };
  const slots = Number(input.slotsTotais);
  if (!Number.isInteger(slots) || slots < 1) return { ok: false, error: "Slots deve ser ≥ 1" };

  const vaga = await db.vaga.create({
    data: {
      unidade: input.unidade,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      slotsTotais: slots,
      abreEm: input.abreEm ? new Date(input.abreEm) : null,
      fechaEm: input.fechaEm ? new Date(input.fechaEm) : null,
      criadoPorId: session.user.id,
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "vaga_criada",
    entityType: "vaga",
    entityId: vaga.id,
    meta: { unidade: input.unidade, titulo: vaga.titulo, slots },
  });

  revalidatePath("/app/vagas");
  return { ok: true, data: { id: vaga.id } };
}

export async function criarVagaAndRedirect(input: Parameters<typeof criarVagaAction>[0]) {
  const r = await criarVagaAction(input);
  if (r.ok) redirect(`/app/vagas/${r.data.id}` as Route);
  return r;
}

/** Encerra uma vaga (não aceita mais agendamentos). */
export async function encerrarVagaAction(vagaId: string): Promise<FunilResult> {
  const session = await auth();
  if (!session || !podeGerenciarVaga(session)) return { ok: false, error: "Sem permissão" };
  const vaga = await db.vaga.findUnique({ where: { id: vagaId }, select: { unidade: true } });
  if (!vaga) return { ok: false, error: "Vaga não encontrada" };
  if (!canAccessUnit(session, vaga.unidade as UnitScope)) return { ok: false, error: "Sem acesso" };

  await db.vaga.update({ where: { id: vagaId }, data: { status: "encerrada" } });
  revalidatePath(`/app/vagas/${vagaId}`);
  revalidatePath("/app/vagas");
  return { ok: true, data: undefined };
}

/** Cria um agendamento checando capacidade dentro de transação (anti-overbooking). */
export async function criarAgendamentoAction(
  vagaId: string,
  input: {
    nomeInteressado: string;
    telefone: string;
    horario: string;
    consenteContato: boolean;
    observacoes?: string;
  },
): Promise<FunilResult> {
  const session = await auth();
  if (!session || !podeAgendar(session)) return { ok: false, error: "Sem permissão para agendar" };
  if (!input.nomeInteressado?.trim() || !input.telefone?.trim() || !input.horario) {
    return { ok: false, error: "Nome, telefone e horário são obrigatórios" };
  }

  const vaga = await db.vaga.findUnique({ where: { id: vagaId }, select: { unidade: true } });
  if (!vaga) return { ok: false, error: "Vaga não encontrada" };
  if (!canAccessUnit(session, vaga.unidade as UnitScope)) return { ok: false, error: "Sem acesso" };

  const telefone = input.telefone.trim();
  try {
    const ag = await db.$transaction(async (tx) => {
      const v = await tx.vaga.findUniqueOrThrow({
        where: { id: vagaId },
        select: { status: true, slotsTotais: true, fechaEm: true },
      });
      const ags = await tx.agendamento.findMany({
        where: { vagaId },
        select: { status: true, telefone: true },
      });
      const ocupados = ags.filter((a) => OCUPA.includes(a.status)).length;
      if (!vagaAceitaAgendamento(v, ocupados)) {
        throw new Error("Vaga sem slots disponíveis ou fora da janela.");
      }
      if (ags.some((a) => a.telefone === telefone && OCUPA.includes(a.status))) {
        throw new Error("Já há um agendamento ativo para este telefone nesta vaga.");
      }
      return tx.agendamento.create({
        data: {
          vagaId,
          nomeInteressado: input.nomeInteressado.trim(),
          telefone,
          horario: new Date(input.horario),
          consenteContato: Boolean(input.consenteContato),
          observacoes: input.observacoes?.trim() || null,
          criadoPorId: session.user.id,
        },
      });
    });

    await logEvent({
      userId: session.user.id,
      action: "agendamento_criado",
      entityType: "agendamento",
      entityId: ag.id,
      meta: { vagaId, telefone, nome: ag.nomeInteressado },
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao agendar" };
  }

  revalidatePath(`/app/vagas/${vagaId}`);
  return { ok: true, data: undefined };
}

const TRANSICOES = {
  confirmar: { status: "confirmado", action: "agendamento_confirmado" },
  cancelar: { status: "cancelado", action: "agendamento_cancelado" },
  faltou: { status: "faltou", action: "agendamento_faltou" },
  realizar: { status: "realizado", action: "agendamento_realizado" },
} as const;

/** Muda o status de um agendamento (confirmar/cancelar/faltou/realizar). */
export async function transicionarAgendamento(
  agendamentoId: string,
  acao: keyof typeof TRANSICOES,
): Promise<FunilResult> {
  const session = await auth();
  if (!session || !podeAgendar(session)) return { ok: false, error: "Sem permissão" };

  const ag = await db.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { vagaId: true, cidadaoId: true, vaga: { select: { unidade: true } } },
  });
  if (!ag) return { ok: false, error: "Agendamento não encontrado" };
  if (!canAccessUnit(session, ag.vaga.unidade as UnitScope))
    return { ok: false, error: "Sem acesso" };

  const t = TRANSICOES[acao];
  await db.agendamento.update({ where: { id: agendamentoId }, data: { status: t.status } });

  await logEvent({
    userId: session.user.id,
    action: t.action,
    entityType: "agendamento",
    entityId: agendamentoId,
    ...(ag.cidadaoId ? { rootEntityType: "cidadao", rootEntityId: ag.cidadaoId } : {}),
    meta: { vagaId: ag.vagaId },
  });

  revalidatePath(`/app/vagas/${ag.vagaId}`);
  return { ok: true, data: undefined };
}

/**
 * Ponte agendamento → ficha: vincula um Cidadao recém-criado ao agendamento
 * (chamado pelo fluxo "Criar ficha do interessado"). Marca como realizado e
 * registra na timeline do cidadão (aggregate root).
 */
export async function vincularCidadaoAoAgendamento(
  agendamentoId: string,
  cidadaoId: string,
): Promise<FunilResult> {
  const session = await auth();
  if (!session || !podeAgendar(session)) return { ok: false, error: "Sem permissão" };

  const ag = await db.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { vagaId: true, vaga: { select: { unidade: true } } },
  });
  if (!ag) return { ok: false, error: "Agendamento não encontrado" };
  if (!canAccessUnit(session, ag.vaga.unidade as UnitScope))
    return { ok: false, error: "Sem acesso" };

  await db.agendamento.update({
    where: { id: agendamentoId },
    data: { cidadaoId, status: "realizado" },
  });

  await logEvent({
    userId: session.user.id,
    action: "agendamento_realizado",
    entityType: "agendamento",
    entityId: agendamentoId,
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { vagaId: ag.vagaId },
  });

  revalidatePath(`/app/vagas/${ag.vagaId}`);
  revalidatePath(`/app/cidadaos/${cidadaoId}`);
  return { ok: true, data: undefined };
}
