import type { StatusConsulta } from "@prisma/client";
import { db } from "@/lib/db";

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

function parseHHMM(s: string): { h: number; m: number } {
  const [h = 0, m = 0] = s.split(":").map(Number);
  return { h, m };
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Gera slots disponíveis derivados de um template recorrente.
 *
 * Pura: não toca banco. Use em testes e como base do seed/job.
 */
export function gerarSlots(tmpl: TemplateInput, opts: GerarSlotsOpts = {}): SlotGerado[] {
  const slots: SlotGerado[] = [];
  const inicio = startOfUtcDay(tmpl.validoDe);
  const fim = tmpl.validoAte ?? opts.limiteSuperior;
  if (!fim) {
    throw new Error("gerarSlots: validoAte é null e limiteSuperior não foi fornecido");
  }

  const fimUtc = startOfUtcDay(fim);
  const { h: hIni, m: mIni } = parseHHMM(tmpl.faixaInicio);
  const { h: hFim, m: mFim } = parseHHMM(tmpl.faixaFim);

  let dia = inicio;
  while (dia < fimUtc) {
    if (tmpl.diasSemana.includes(dia.getUTCDay())) {
      const inicioFaixaDia = new Date(dia);
      inicioFaixaDia.setUTCHours(hIni, mIni, 0, 0);
      const fimFaixaDia = new Date(dia);
      fimFaixaDia.setUTCHours(hFim, mFim, 0, 0);

      let cursor = inicioFaixaDia;
      while (cursor.getTime() + tmpl.duracaoSlotMin * 60_000 <= fimFaixaDia.getTime()) {
        slots.push({
          profissionalId: tmpl.profissionalId,
          especialidadeId: tmpl.especialidadeId,
          dataHoraInicio: new Date(cursor),
          duracaoMin: tmpl.duracaoSlotMin,
        });
        cursor = new Date(cursor.getTime() + tmpl.duracaoSlotMin * 60_000);
      }
    }
    dia = addDays(dia, 1);
  }

  return slots;
}

// ============================================================================
// Reserva transacional anti-overbooking (F1.B.1 T4)
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
}

/**
 * Reserva um slot atomicamente. Usa updateMany com filtro de status pra evitar
 * race condition: só atualiza se ainda estava "disponivel". Se 0 linhas → outro
 * já pegou → lança SlotIndisponivelError.
 */
export async function reservarSlot(input: ReservarSlotInput) {
  return db.$transaction(async (tx) => {
    const upd = await tx.slot.updateMany({
      where: { id: input.slotId, status: "disponivel" },
      data: { status: "reservado" },
    });
    if (upd.count === 0) {
      throw new SlotIndisponivelError(input.slotId);
    }
    return tx.consulta.create({
      data: {
        slotId: input.slotId,
        cidadaoId: input.cidadaoId,
        profissionalId: input.profissionalId,
        especialidadeId: input.especialidadeId,
        createdBy: input.createdBy,
        observacoesAgendamento: input.observacoesAgendamento,
        origemTriagemId: input.origemTriagemId,
        status: "agendada",
      },
    });
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

export async function transicionarConsulta(consultaId: string, para: StatusConsulta) {
  return db.$transaction(async (tx) => {
    const c = await tx.consulta.findUniqueOrThrow({ where: { id: consultaId } });
    if (!TRANSICOES[c.status].has(para)) {
      throw new TransicaoInvalidaError(c.status, para);
    }
    const updated = await tx.consulta.update({ where: { id: consultaId }, data: { status: para } });
    const slotStatus = STATUS_SLOT_DERIVADO[para];
    await tx.slot.update({ where: { id: c.slotId }, data: { status: slotStatus } });
    return updated;
  });
}
