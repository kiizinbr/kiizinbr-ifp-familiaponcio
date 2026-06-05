/**
 * Frequência da Capacitação (F1.A.2). Puro: o cálculo de percentual de presença
 * é a base da regra de 80% do certificado (F1.A.3). Sem banco.
 */

/** Percentual de presença (0-100, arredondado). 0 quando não há aulas registradas. */
export function percentualPresenca(presentes: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((presentes / total) * 100);
}

export interface ResumoFrequencia {
  total: number;
  presentes: number;
  faltas: number;
  percentual: number;
}

/** Resumo de frequência de uma matrícula a partir das suas presenças registradas. */
export function resumoFrequencia(presencas: readonly { presente: boolean }[]): ResumoFrequencia {
  const total = presencas.length;
  const presentes = presencas.filter((p) => p.presente).length;
  return {
    total,
    presentes,
    faltas: total - presentes,
    percentual: percentualPresenca(presentes, total),
  };
}
