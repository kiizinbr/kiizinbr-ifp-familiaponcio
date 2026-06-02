import type { StatusNota } from "@prisma/client";

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
