import type { StatusNota } from "@prisma/client";
import { db } from "@/lib/db";
import { aplicarTransicaoConsulta } from "@/lib/medico/agenda";

/**
 * Núcleo do prontuário médico (F1.B.2). Este arquivo concentra as funções PURAS
 * (sem acesso a banco) — IMC, validação de sinais vitais e a máquina de estados
 * da nota. A parte transacional (salvarRascunho/assinarNota/adicionarAddendo)
 * entra na T5, neste mesmo arquivo.
 */

export interface SinaisVitaisInput {
  paSistolica?: number | null;
  paDiastolica?: number | null;
  fcBpm?: number | null;
  frIrpm?: number | null;
  tempC?: number | null;
  pesoKg?: number | null;
  alturaCm?: number | null;
  spo2?: number | null;
}

/**
 * IMC derivado (NÃO persistido — §0.5). Retorna `null` se peso ou altura
 * estiverem ausentes ou não-positivos (evita divisão por zero). Arredonda 1 casa.
 */
export function calcularImc(
  pesoKg: number | null | undefined,
  alturaCm: number | null | undefined,
): number | null {
  if (pesoKg == null || alturaCm == null) return null;
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const alturaM = alturaCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  return Math.round(imc * 10) / 10;
}

export interface VitalWarning {
  campo: keyof SinaisVitaisInput;
  valor: number;
  mensagem: string;
}

/** Faixas plausíveis por sinal vital (warning, nunca bloqueia — §0.5). [min, max] inclusivo. */
const FAIXAS_PLAUSIVEIS: Record<keyof SinaisVitaisInput, readonly [number, number]> = {
  paSistolica: [70, 250],
  paDiastolica: [40, 150],
  fcBpm: [30, 220],
  frIrpm: [8, 60],
  tempC: [30, 43],
  pesoKg: [0.5, 400],
  alturaCm: [30, 250],
  spo2: [50, 100],
};

/**
 * Valida sinais vitais como WARNING — nunca lança, nunca bloqueia o atendimento (§0.5).
 * Campos ausentes/null são ignorados. Retorna [] se tudo plausível.
 */
export function validarSinaisVitais(v: SinaisVitaisInput): VitalWarning[] {
  const warnings: VitalWarning[] = [];
  const campos = Object.keys(FAIXAS_PLAUSIVEIS) as (keyof SinaisVitaisInput)[];
  for (const campo of campos) {
    const valor = v[campo];
    if (valor == null) continue;
    const [min, max] = FAIXAS_PLAUSIVEIS[campo];
    if (valor < min || valor > max) {
      warnings.push({
        campo,
        valor,
        mensagem: `${campo} fora da faixa plausível (${min}–${max}): ${valor}`,
      });
    }
  }
  return warnings;
}

/**
 * Máquina de estados PURA da nota de evolução:
 * `rascunho → assinada`; `assinada` é terminal/imutável (§0.4).
 */
const TRANSICOES_NOTA: Record<StatusNota, ReadonlySet<StatusNota>> = {
  rascunho: new Set<StatusNota>(["assinada"]),
  assinada: new Set<StatusNota>(),
};

export function podeTransicionarNota(de: StatusNota, para: StatusNota): boolean {
  return TRANSICOES_NOTA[de].has(para);
}

export class TransicaoNotaInvalidaError extends Error {
  constructor(
    public readonly de: StatusNota,
    public readonly para: StatusNota,
  ) {
    super(`Transição de nota inválida: ${de} → ${para}`);
    this.name = "TransicaoNotaInvalidaError";
  }
}

// ============================================================================
// T5 — orquestração transacional (salvar rascunho / assinar / addendo)
// ============================================================================

export class NotaAssinadaError extends Error {
  constructor(public readonly notaId: string) {
    super(`Nota ${notaId} já está assinada; correções devem ser feitas via addendo`);
    this.name = "NotaAssinadaError";
  }
}

export class NotaNaoAssinadaError extends Error {
  constructor(public readonly notaId: string) {
    super(`Nota ${notaId} ainda não está assinada; addendo só é permitido após a assinatura`);
    this.name = "NotaNaoAssinadaError";
  }
}

export interface DiagnosticoInput {
  codigoCid?: string | null;
  descricao: string;
  principal?: boolean;
}

export interface SalvarRascunhoInput {
  consultaId: string;
  cidadaoId: string;
  profissionalId: string;
  texto?: string | null;
  vitais?: SinaisVitaisInput;
  diagnosticos?: DiagnosticoInput[];
}

/**
 * Upsert da nota de evolução enquanto a consulta está em atendimento (§0.3).
 * Rejeita com NotaAssinadaError se a nota já foi assinada (imutável — §0.4).
 * Quando `diagnosticos` é fornecido, recria a lista (deleteMany → createMany).
 */
export async function salvarRascunho(input: SalvarRascunhoInput) {
  return db.$transaction(async (tx) => {
    const existente = await tx.notaEvolucao.findUnique({
      where: { consultaId: input.consultaId },
    });
    if (existente && existente.status === "assinada") {
      throw new NotaAssinadaError(existente.id);
    }

    const { vitais } = input;
    const dados = {
      cidadaoId: input.cidadaoId,
      profissionalId: input.profissionalId,
      texto: input.texto ?? null,
      paSistolica: vitais?.paSistolica ?? null,
      paDiastolica: vitais?.paDiastolica ?? null,
      fcBpm: vitais?.fcBpm ?? null,
      frIrpm: vitais?.frIrpm ?? null,
      tempC: vitais?.tempC ?? null,
      pesoKg: vitais?.pesoKg ?? null,
      alturaCm: vitais?.alturaCm ?? null,
      spo2: vitais?.spo2 ?? null,
    };

    const nota = await tx.notaEvolucao.upsert({
      where: { consultaId: input.consultaId },
      create: { consultaId: input.consultaId, ...dados },
      update: dados,
    });

    if (input.diagnosticos) {
      await tx.diagnosticoNota.deleteMany({ where: { notaId: nota.id } });
      if (input.diagnosticos.length > 0) {
        await tx.diagnosticoNota.createMany({
          data: input.diagnosticos.map((d) => ({
            notaId: nota.id,
            codigoCid: d.codigoCid ?? null,
            descricao: d.descricao,
            principal: d.principal ?? false,
          })),
        });
      }
    }

    return nota;
  });
}

/**
 * Assina a nota e conclui a consulta atomicamente (§3/§5 fluxo A). "Assinar e
 * concluir" = ato único: marca a nota como assinada (imutável) e transiciona a
 * consulta em_atendimento → realizada na MESMA transação, reusando
 * aplicarTransicaoConsulta (evita $transaction aninhado).
 */
export async function assinarNota(notaId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const nota = await tx.notaEvolucao.findUniqueOrThrow({ where: { id: notaId } });
    if (!podeTransicionarNota(nota.status, "assinada")) {
      throw new TransicaoNotaInvalidaError(nota.status, "assinada");
    }
    const assinada = await tx.notaEvolucao.update({
      where: { id: notaId },
      data: { status: "assinada", assinadaEm: new Date(), assinadaPor: userId },
    });
    await aplicarTransicaoConsulta(tx, nota.consultaId, "realizada");
    return assinada;
  });
}

/**
 * Adiciona um addendo append-only a uma nota ASSINADA (§0.4). Nunca toca o
 * registro original. Rejeita com NotaNaoAssinadaError se a nota ainda é rascunho.
 */
export async function adicionarAddendo(notaId: string, autorId: string, texto: string) {
  return db.$transaction(async (tx) => {
    const nota = await tx.notaEvolucao.findUniqueOrThrow({ where: { id: notaId } });
    if (nota.status !== "assinada") {
      throw new NotaNaoAssinadaError(notaId);
    }
    return tx.addendoNota.create({ data: { notaId, autorId, texto } });
  });
}
