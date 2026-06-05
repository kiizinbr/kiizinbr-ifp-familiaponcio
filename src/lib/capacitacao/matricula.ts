import type { Matricula, Prisma, StatusMatricula } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Núcleo lógico de matrícula da Capacitação (F1.A.1). Espelha o padrão do Médico:
 * anti-overbooking transacional (`reservarSlot`) + máquina de estados tx-aware
 * (`aplicarTransicaoConsulta`) de `lib/medico/agenda.ts`.
 */

// ── Erros tipados ──────────────────────────────────────────────────────────
export class TurmaLotadaError extends Error {
  constructor(public readonly turmaId: string) {
    super(`Turma ${turmaId} está lotada`);
    this.name = "TurmaLotadaError";
  }
}
export class MatriculaDuplicadaError extends Error {
  constructor(
    public readonly turmaId: string,
    public readonly cidadaoId: string,
  ) {
    super(`Cidadão ${cidadaoId} já tem matrícula na turma ${turmaId}`);
    this.name = "MatriculaDuplicadaError";
  }
}
export class TransicaoMatriculaInvalidaError extends Error {
  constructor(
    public readonly de: StatusMatricula,
    public readonly para: StatusMatricula,
  ) {
    super(`Transição de matrícula inválida: ${de} → ${para}`);
    this.name = "TransicaoMatriculaInvalidaError";
  }
}
export class ListaEsperaVaziaError extends Error {
  constructor(public readonly turmaId: string) {
    super(`Turma ${turmaId} não tem ninguém na lista de espera`);
    this.name = "ListaEsperaVaziaError";
  }
}

// ── Máquina de estados (§0.7 completa) ──────────────────────────────────────
// Terminais (concluido/reprovado/desistente/cancelado) = Set vazio.
export const TRANSICOES_MATRICULA: Record<StatusMatricula, ReadonlySet<StatusMatricula>> = {
  lista_espera: new Set<StatusMatricula>(["inscrito", "cancelado"]),
  inscrito: new Set<StatusMatricula>(["confirmado", "cancelado"]),
  confirmado: new Set<StatusMatricula>(["cursando", "cancelado"]),
  cursando: new Set<StatusMatricula>(["concluido", "reprovado", "desistente", "cancelado"]),
  concluido: new Set<StatusMatricula>(),
  reprovado: new Set<StatusMatricula>(),
  desistente: new Set<StatusMatricula>(),
  cancelado: new Set<StatusMatricula>(),
};

export function podeTransicionarMatricula(de: StatusMatricula, para: StatusMatricula): boolean {
  return TRANSICOES_MATRICULA[de].has(para);
}

/** Status que ocupam vaga (contam para a capacidade da turma). */
export const STATUS_OCUPA_VAGA: ReadonlySet<StatusMatricula> = new Set<StatusMatricula>([
  "inscrito",
  "confirmado",
  "cursando",
]);
const STATUS_OCUPA_VAGA_LIST: StatusMatricula[] = ["inscrito", "confirmado", "cursando"];

// ── Matrícula transacional anti-overcapacity (espelha reservarSlot) ─────────
export interface MatricularInput {
  turmaId: string;
  cidadaoId: string;
  createdBy: string;
  observacoes?: string;
  origemTriagemId?: string;
}

/**
 * Matricula um cidadão numa turma de forma atômica. Se a turma já está cheia
 * (status ativos == capacidade), entra como `lista_espera` (§0.3a). Matrícula
 * duplicada não-cancelada → MatriculaDuplicadaError.
 */
export async function matricular(input: MatricularInput): Promise<Matricula> {
  return db.$transaction(async (tx) => {
    // Lock pessimista na Turma: serializa a checagem de capacidade entre matrículas
    // concorrentes na mesma turma (evita overbooking). Diferente de reservarSlot, não
    // há linha única pra flipar — então travamos a Turma e contamos na mesma tx.
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${input.turmaId} FOR UPDATE`;

    const existente = await tx.matricula.findUnique({
      where: { turmaId_cidadaoId: { turmaId: input.turmaId, cidadaoId: input.cidadaoId } },
    });
    if (existente && existente.status !== "cancelado") {
      throw new MatriculaDuplicadaError(input.turmaId, input.cidadaoId);
    }

    const turma = await tx.turma.findUniqueOrThrow({ where: { id: input.turmaId } });
    const ativas = await tx.matricula.count({
      where: { turmaId: input.turmaId, status: { in: STATUS_OCUPA_VAGA_LIST } },
    });
    const status: StatusMatricula = ativas < turma.capacidade ? "inscrito" : "lista_espera";

    return tx.matricula.create({
      data: {
        turmaId: input.turmaId,
        cidadaoId: input.cidadaoId,
        createdBy: input.createdBy,
        observacoes: input.observacoes,
        origemTriagemId: input.origemTriagemId,
        status,
      },
    });
  });
}

// ── Transições tx-aware + wrapper (espelha aplicarTransicaoConsulta) ────────
export async function aplicarTransicaoMatricula(
  tx: Prisma.TransactionClient,
  matriculaId: string,
  para: StatusMatricula,
  motivoSaida?: string,
): Promise<Matricula> {
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  if (!podeTransicionarMatricula(m.status, para)) {
    throw new TransicaoMatriculaInvalidaError(m.status, para);
  }
  return tx.matricula.update({
    where: { id: matriculaId },
    data: { status: para, ...(motivoSaida !== undefined ? { motivoSaida } : {}) },
  });
}

export async function transicionarMatricula(
  matriculaId: string,
  para: StatusMatricula,
  motivoSaida?: string,
): Promise<Matricula> {
  return db.$transaction((tx) => aplicarTransicaoMatricula(tx, matriculaId, para, motivoSaida));
}

/**
 * Promoção MANUAL da lista de espera (§0.3a): pega a 1ª matrícula em
 * `lista_espera` (mais antiga) e promove para `inscrito`, se houver vaga.
 */
export async function promoverDaListaEspera(turmaId: string): Promise<Matricula> {
  return db.$transaction(async (tx) => {
    // Mesmo lock da matricular: serializa a checagem de capacidade na promoção.
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${turmaId} FOR UPDATE`;

    const proximo = await tx.matricula.findFirst({
      where: { turmaId, status: "lista_espera" },
      orderBy: { createdAt: "asc" },
    });
    if (!proximo) {
      throw new ListaEsperaVaziaError(turmaId);
    }

    const turma = await tx.turma.findUniqueOrThrow({ where: { id: turmaId } });
    const ativas = await tx.matricula.count({
      where: { turmaId, status: { in: STATUS_OCUPA_VAGA_LIST } },
    });
    if (ativas >= turma.capacidade) {
      throw new TurmaLotadaError(turmaId);
    }

    return aplicarTransicaoMatricula(tx, proximo.id, "inscrito");
  });
}
