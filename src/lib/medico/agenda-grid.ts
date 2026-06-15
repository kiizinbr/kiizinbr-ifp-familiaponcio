/**
 * Helpers puros para a grade da Agenda semanal (médico).
 *
 * F8 (perf): a página carrega os slots da semana via Prisma (janela
 * `dataHoraInicio >= inicio && < fim`) e antes refazia um `Array.filter`
 * O(7×N) por coluna de dia. Aqui agrupamos os slots em buckets por dia uma
 * única vez (O(N)), e a coluna lê `Map.get` (O(1)).
 *
 * Fuso (CRÍTICO): a chave usa campos LOCAIS (`getFullYear/getMonth/getDate`),
 * espelhando exatamente o filtro que a página já fazia. NÃO usar `toISOString()`
 * (UTC) aqui — isso mudaria em qual coluna o slot cai numa runtime UTC
 * (regressão visual sutil). A padronização local↔UTC é um item separado.
 */

/** Slot mínimo que o agrupamento precisa enxergar. */
export interface SlotComInicio {
  dataHoraInicio: Date;
}

/** Limite defensivo de slots carregados por semana (anti-payload anômalo). */
export const MAX_SLOTS_SEMANA = 2000;

/**
 * Chave de dia em horário LOCAL — `${ano}-${mes}-${dia}` (mes 0-based, sem
 * padding; o que importa é casar a chave do bucket com a do dia consultado).
 */
export function chaveDiaLocal(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Agrupa os slots por dia local numa única passada. A ordem dentro de cada
 * bucket preserva a ordem de entrada (a página já passa os slots ordenados por
 * `dataHoraInicio asc`).
 */
export function agruparSlotsPorDiaLocal<T extends SlotComInicio>(
  slots: readonly T[],
): Map<string, T[]> {
  const porDia = new Map<string, T[]>();
  for (const s of slots) {
    const chave = chaveDiaLocal(s.dataHoraInicio);
    const arr = porDia.get(chave);
    if (arr) arr.push(s);
    else porDia.set(chave, [s]);
  }
  return porDia;
}
