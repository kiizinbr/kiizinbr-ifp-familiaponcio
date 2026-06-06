/**
 * Indicadores do Centro Médico (gestão). Puro: agrega contagens em taxas.
 * Comparecimento/falta são calculados sobre as consultas que "chegaram à hora"
 * (realizada + faltou) — cancelamento prévio não conta como no-show.
 */

export interface ContagemConsultas {
  agendada: number;
  confirmada: number;
  em_atendimento: number;
  realizada: number;
  faltou: number;
  cancelada: number;
}

export interface IndicadoresConsulta {
  total: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
  ativas: number; // agendada + confirmada + em_atendimento
  taxaComparecimento: number;
  taxaFalta: number;
  taxaCancelamento: number;
}

const pct = (n: number, d: number): number => (d <= 0 ? 0 : Math.round((n / d) * 100));

export function calcularIndicadores(c: ContagemConsultas): IndicadoresConsulta {
  const total = c.agendada + c.confirmada + c.em_atendimento + c.realizada + c.faltou + c.cancelada;
  const base = c.realizada + c.faltou;
  return {
    total,
    realizadas: c.realizada,
    faltas: c.faltou,
    canceladas: c.cancelada,
    ativas: c.agendada + c.confirmada + c.em_atendimento,
    taxaComparecimento: pct(c.realizada, base),
    taxaFalta: pct(c.faltou, base),
    taxaCancelamento: pct(c.cancelada, total),
  };
}

export interface ContagemSlots {
  disponivel: number;
  reservado: number;
  realizado: number;
  faltou: number;
}

/** Ocupação da agenda: ocupados / (ocupados + disponíveis). Exclui bloqueados/cancelados. */
export function taxaOcupacao(s: ContagemSlots): number {
  const ocupados = s.reservado + s.realizado + s.faltou;
  return pct(ocupados, ocupados + s.disponivel);
}

/** Converte o resultado de um `groupBy({ by: ["status"], _count: true })` num Record com zeros. */
export function contagemDeGroupBy<K extends string>(
  rows: ReadonlyArray<{ status: K; _count: number }>,
  chaves: readonly K[],
): Record<K, number> {
  const out = Object.fromEntries(chaves.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) out[r.status] = r._count;
  return out;
}
