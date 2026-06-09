import type { Prisma, StatusConsulta } from "@prisma/client";
import { db } from "@/lib/db";
import { agendarEncaminhamento } from "@/lib/medico/encaminhamento";
import * as core from "@/lib/agenda/core";

export interface TemplateInput {
  profissionalId: string;
  especialidadeId: string;
  diasSemana: readonly number[]; // 0=dom..6=sáb
  faixaInicio: string; // "HH:mm"
  faixaFim: string;
  duracaoSlotMin: number;
  validoDe: Date;
  validoAte: Date | null;
}

export interface SlotGerado {
  profissionalId: string;
  especialidadeId: string;
  dataHoraInicio: Date;
  duracaoMin: number;
}

interface GerarSlotsOpts {
  limiteSuperior?: Date; // quando validoAte é null
}

/**
 * Gera slots do médico a partir de um template recorrente. Delega a geração de
 * horários ao core resource-agnostic (`@/lib/agenda/core`) e anexa o recurso
 * médico (profissional + especialidade) a cada slot. Mantém a API anterior.
 */
export function gerarSlots(tmpl: TemplateInput, opts: GerarSlotsOpts = {}): SlotGerado[] {
  const base = core.gerarSlots(
    {
      diasSemana: tmpl.diasSemana,
      faixaInicio: tmpl.faixaInicio,
      faixaFim: tmpl.faixaFim,
      duracaoSlotMin: tmpl.duracaoSlotMin,
      validoDe: tmpl.validoDe,
      validoAte: tmpl.validoAte,
    },
    { limiteSuperior: opts.limiteSuperior },
  );
  return base.map((s) => ({
    profissionalId: tmpl.profissionalId,
    especialidadeId: tmpl.especialidadeId,
    dataHoraInicio: s.dataHoraInicio,
    duracaoMin: s.duracaoMin,
  }));
}

// ============================================================================
// Reserva transacional anti-overbooking (F1.B.1 T4) — via core.reservarCAS
// ============================================================================

export class SlotIndisponivelError extends Error {
  constructor(public readonly slotId: string) {
    super(`Slot ${slotId} não está mais disponível`);
    this.name = "SlotIndisponivelError";
  }
}

export interface ReservarSlotInput {
  slotId: string;
  cidadaoId: string;
  profissionalId: string;
  especialidadeId: string;
  createdBy: string;
  observacoesAgendamento?: string;
  origemTriagemId?: string;
  origemEncaminhamentoId?: string;
}

/**
 * Reserva um slot atomicamente. O compare-and-swap anti-overbooking vive em
 * `core.reservarCAS` (só atualiza se ainda estava "disponivel"); se não ganhou,
 * lança SlotIndisponivelError.
 */
export async function reservarSlot(input: ReservarSlotInput) {
  return db.$transaction(async (tx) => {
    const ganhou = await core.reservarCAS(() =>
      tx.slot.updateMany({
        where: { id: input.slotId, status: "disponivel" },
        data: { status: "reservado" },
      }),
    );
    if (!ganhou) {
      throw new SlotIndisponivelError(input.slotId);
    }
    const consulta = await tx.consulta.create({
      data: {
        slotId: input.slotId,
        cidadaoId: input.cidadaoId,
        profissionalId: input.profissionalId,
        especialidadeId: input.especialidadeId,
        createdBy: input.createdBy,
        observacoesAgendamento: input.observacoesAgendamento,
        origemTriagemId: input.origemTriagemId,
        origemEncaminhamentoId: input.origemEncaminhamentoId,
        status: "agendada",
      },
    });
    if (input.origemEncaminhamentoId) {
      await agendarEncaminhamento(tx, input.origemEncaminhamentoId);
    }
    return consulta;
  });
}

// ============================================================================
// Manutenção de slots + máquina de estados de consulta (F1.B.1 T5)
// ============================================================================

export class SlotComConsultaError extends Error {
  constructor(public readonly slotId: string) {
    super(`Slot ${slotId} tem consulta vinculada; cancele a consulta antes de bloquear`);
    this.name = "SlotComConsultaError";
  }
}

export class TransicaoInvalidaError extends Error {
  constructor(
    public readonly de: StatusConsulta,
    public readonly para: StatusConsulta,
  ) {
    super(`Transição inválida de ${de} para ${para}`);
    this.name = "TransicaoInvalidaError";
  }
}

const TRANSICOES: Record<StatusConsulta, ReadonlySet<StatusConsulta>> = {
  agendada: new Set(["confirmada", "em_atendimento", "faltou", "cancelada"]),
  confirmada: new Set(["em_atendimento", "faltou", "cancelada"]),
  em_atendimento: new Set(["realizada", "faltou", "cancelada"]),
  realizada: new Set(),
  faltou: new Set(),
  cancelada: new Set(),
};

/** Máquina de estados da consulta, sobre o core genérico. */
const maquinaConsulta = core.criarMaquinaEstados<StatusConsulta>(TRANSICOES);

const STATUS_SLOT_DERIVADO: Record<
  StatusConsulta,
  "reservado" | "realizado" | "faltou" | "disponivel"
> = {
  agendada: "reservado",
  confirmada: "reservado",
  em_atendimento: "reservado",
  realizada: "realizado",
  faltou: "faltou",
  cancelada: "disponivel",
};

export async function bloquearSlot(slotId: string, motivo: string) {
  const slot = await db.slot.findUniqueOrThrow({
    where: { id: slotId },
    include: { consulta: true },
  });
  if (slot.consulta && slot.consulta.status !== "cancelada") {
    throw new SlotComConsultaError(slotId);
  }
  return db.slot.update({
    where: { id: slotId },
    data: { status: "bloqueado", motivoBloqueio: motivo },
  });
}

export async function liberarSlot(slotId: string, motivoCancelamento: string) {
  return db.$transaction(async (tx) => {
    await tx.consulta.updateMany({
      where: { slotId, status: { notIn: ["cancelada", "realizada", "faltou"] } },
      data: { status: "cancelada", cancelMotivo: motivoCancelamento },
    });
    return tx.slot.update({
      where: { id: slotId },
      data: { status: "disponivel", motivoBloqueio: null },
    });
  });
}

/**
 * Aplica a transição de status da consulta DENTRO de uma transação existente
 * (`tx`). A validade da transição vem do core (`maquinaConsulta.pode`).
 */
export async function aplicarTransicaoConsulta(
  tx: Prisma.TransactionClient,
  consultaId: string,
  para: StatusConsulta,
) {
  const c = await tx.consulta.findUniqueOrThrow({ where: { id: consultaId } });
  if (!maquinaConsulta.pode(c.status, para)) {
    throw new TransicaoInvalidaError(c.status, para);
  }
  const updated = await tx.consulta.update({ where: { id: consultaId }, data: { status: para } });
  const slotStatus = STATUS_SLOT_DERIVADO[para];
  await tx.slot.update({ where: { id: c.slotId }, data: { status: slotStatus } });
  return updated;
}

export async function transicionarConsulta(consultaId: string, para: StatusConsulta) {
  return db.$transaction((tx) => aplicarTransicaoConsulta(tx, consultaId, para));
}

// ============================================================================
// Reagendamento em 1 passo (mover consulta de slot)
// ============================================================================

/** Status em que a consulta pode ser reagendada (ainda não começou nem terminou). */
export const STATUS_REAGENDAVEL: ReadonlySet<StatusConsulta> = new Set(["agendada", "confirmada"]);

export class ConsultaNaoReagendavelError extends Error {
  constructor(public readonly status: StatusConsulta) {
    super(`Consulta com status ${status} não pode ser reagendada`);
    this.name = "ConsultaNaoReagendavelError";
  }
}

/**
 * Reagenda uma consulta para um novo slot numa única transação: reserva o novo slot
 * (compare-and-swap anti-overbooking via core), libera o slot antigo e move a consulta.
 * Só agendada/confirmada. Lança SlotIndisponivelError se o novo slot já foi pego.
 */
export async function reagendarConsulta(consultaId: string, novoSlotId: string) {
  return db.$transaction(async (tx) => {
    const consulta = await tx.consulta.findUniqueOrThrow({ where: { id: consultaId } });
    if (!STATUS_REAGENDAVEL.has(consulta.status)) {
      throw new ConsultaNaoReagendavelError(consulta.status);
    }
    if (consulta.slotId === novoSlotId) return consulta; // mesmo horário, no-op

    const ganhou = await core.reservarCAS(() =>
      tx.slot.updateMany({
        where: { id: novoSlotId, status: "disponivel" },
        data: { status: "reservado" },
      }),
    );
    if (!ganhou) throw new SlotIndisponivelError(novoSlotId);

    const novoSlot = await tx.slot.findUniqueOrThrow({ where: { id: novoSlotId } });
    await tx.slot.update({ where: { id: consulta.slotId }, data: { status: "disponivel" } });

    return tx.consulta.update({
      where: { id: consultaId },
      data: {
        slotId: novoSlotId,
        profissionalId: novoSlot.profissionalId,
        especialidadeId: novoSlot.especialidadeId,
      },
    });
  });
}
