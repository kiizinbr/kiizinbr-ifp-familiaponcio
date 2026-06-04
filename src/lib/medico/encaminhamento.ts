import type { Encaminhamento, Prisma, StatusEncaminhamento } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Núcleo lógico do Encaminhamento (F1.B). Espelha lib/capacitacao/matricula.ts:
 * erros tipados + máquina de estados + transições tx-aware (sem aninhar $transaction).
 */

// ── Erros tipados ──────────────────────────────────────────────────────────
export class EncaminhamentoNaoPendenteError extends Error {
  constructor(public readonly encaminhamentoId: string) {
    super(`Encaminhamento ${encaminhamentoId} não está aguardando agendamento`);
    this.name = "EncaminhamentoNaoPendenteError";
  }
}
export class TransicaoEncaminhamentoInvalidaError extends Error {
  constructor(
    public readonly de: StatusEncaminhamento,
    public readonly para: StatusEncaminhamento,
  ) {
    super(`Transição de encaminhamento inválida: ${de} → ${para}`);
    this.name = "TransicaoEncaminhamentoInvalidaError";
  }
}
export class ConsultaOrigemInvalidaError extends Error {
  constructor(
    public readonly consultaOrigemId: string,
    public readonly cidadaoId: string,
  ) {
    super(`Consulta ${consultaOrigemId} não pertence ao cidadão ${cidadaoId}`);
    this.name = "ConsultaOrigemInvalidaError";
  }
}

// ── Máquina de estados ──────────────────────────────────────────────────────
// agendado/cancelado = terminais (Set vazio).
export const TRANSICOES_ENCAMINHAMENTO: Record<
  StatusEncaminhamento,
  ReadonlySet<StatusEncaminhamento>
> = {
  aguardando_agendamento: new Set<StatusEncaminhamento>(["agendado", "cancelado"]),
  agendado: new Set<StatusEncaminhamento>(),
  cancelado: new Set<StatusEncaminhamento>(),
};

export function podeTransicionarEncaminhamento(
  de: StatusEncaminhamento,
  para: StatusEncaminhamento,
): boolean {
  return TRANSICOES_ENCAMINHAMENTO[de].has(para);
}

// ── Criar ───────────────────────────────────────────────────────────────────
export interface CriarEncaminhamentoInput {
  cidadaoId: string;
  consultaOrigemId: string;
  especialidadeId: string;
  motivo?: string;
  createdBy: string;
}

/** Cria um pedido `aguardando_agendamento`. Valida que a consulta de origem é do cidadão. */
export async function criarEncaminhamento(
  input: CriarEncaminhamentoInput,
): Promise<Encaminhamento> {
  return db.$transaction(async (tx) => {
    const consulta = await tx.consulta.findUniqueOrThrow({ where: { id: input.consultaOrigemId } });
    if (consulta.cidadaoId !== input.cidadaoId) {
      throw new ConsultaOrigemInvalidaError(input.consultaOrigemId, input.cidadaoId);
    }
    return tx.encaminhamento.create({
      data: {
        cidadaoId: input.cidadaoId,
        consultaOrigemId: input.consultaOrigemId,
        especialidadeId: input.especialidadeId,
        motivo: input.motivo,
        createdBy: input.createdBy,
        status: "aguardando_agendamento",
      },
    });
  });
}

// ── Transições tx-aware (espelha aplicarTransicaoMatricula) ─────────────────
export async function aplicarTransicaoEncaminhamento(
  tx: Prisma.TransactionClient,
  encaminhamentoId: string,
  para: StatusEncaminhamento,
  canceladoMotivo?: string,
): Promise<Encaminhamento> {
  const e = await tx.encaminhamento.findUniqueOrThrow({ where: { id: encaminhamentoId } });
  if (!podeTransicionarEncaminhamento(e.status, para)) {
    throw new TransicaoEncaminhamentoInvalidaError(e.status, para);
  }
  return tx.encaminhamento.update({
    where: { id: encaminhamentoId },
    data: { status: para, ...(canceladoMotivo !== undefined ? { canceladoMotivo } : {}) },
  });
}

/**
 * Flipa para `agendado` DENTRO da transação de reserva do slot (chamada por
 * reservarSlot). Valida que ainda estava pendente — barra dupla marcação.
 */
export async function agendarEncaminhamento(
  tx: Prisma.TransactionClient,
  encaminhamentoId: string,
): Promise<Encaminhamento> {
  const e = await tx.encaminhamento.findUniqueOrThrow({ where: { id: encaminhamentoId } });
  if (e.status !== "aguardando_agendamento") {
    throw new EncaminhamentoNaoPendenteError(encaminhamentoId);
  }
  return aplicarTransicaoEncaminhamento(tx, encaminhamentoId, "agendado");
}

/** Cancela (GP/gestor). Wrapper $transaction. */
export async function cancelarEncaminhamento(
  encaminhamentoId: string,
  motivo?: string,
): Promise<Encaminhamento> {
  return db.$transaction((tx) =>
    aplicarTransicaoEncaminhamento(tx, encaminhamentoId, "cancelado", motivo),
  );
}
