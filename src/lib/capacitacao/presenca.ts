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

/**
 * Frequência da TURMA = média das %/aluno (B8) — NÃO a soma de todas as linhas
 * de presença (que ponderava por nº de chamadas e achatava matrículas tardias).
 * Exclui quem tem 0 chamadas (não mente um 0% pra quem ainda não foi chamado).
 * Apenas EXIBIÇÃO agregada — não toca a regra de 80% do certificado (essa usa
 * `resumoFrequencia` da matrícula individual em `avaliarElegibilidade`).
 */
export function frequenciaMediaTurma(
  matriculas: readonly { presencas: readonly { presente: boolean }[] }[],
): number {
  const pcts = matriculas
    .filter((m) => m.presencas.length > 0)
    .map((m) => resumoFrequencia(m.presencas).percentual);
  if (pcts.length === 0) return 0;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}
