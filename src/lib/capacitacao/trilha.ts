/**
 * Trilha da turma (F2): jornada derivada DOS FATOS, sem schema novo.
 * Puro, sem banco. A turma não tem "nº de aulas planejado" no schema
 * (não há `diasHorario`/`totalAulas`), então NÃO inventamos um "de Y": a
 * `cargaHorariaTotal` é horas-curso, não horas/encontro — derivar Y dali
 * mentiria pro usuário. A trilha mostra só o que é verdade:
 *   - quantas aulas JÁ foram registradas (datas distintas de chamada);
 *   - a data de formatura = `dataFim` da turma.
 *
 * Copy honesta: "Aula X registrada · formatura em DD/MM" (nunca "X de Y").
 */

/** Normaliza um Date para a chave do dia (YYYY-MM-DD), ignorando hora/fuso. */
function chaveDoDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Nº de aulas registradas = nº de DATAS DISTINTAS de chamada.
 * A presença é gravada por matrícula×data (`@@unique[matriculaId, data]`),
 * então várias matrículas na mesma data contam como 1 aula.
 */
export function aulasRegistradas(datas: readonly Date[]): number {
  const dias = new Set<string>();
  for (const d of datas) {
    dias.add(chaveDoDia(d));
  }
  return dias.size;
}

export interface Trilha {
  /** Aulas (datas distintas) já registradas na turma. */
  aulasRegistradas: number;
  /** Data de formatura = dataFim da turma. */
  formatura: Date;
}

/**
 * Deriva a trilha a partir das datas de presença da turma e da data de fim.
 * `datasPresenca` pode vir com repetições (uma entrada por matrícula×data) —
 * a função deduplica por dia.
 */
export function deriveTrilha(input: { datasPresenca: readonly Date[]; dataFim: Date }): Trilha {
  return {
    aulasRegistradas: aulasRegistradas(input.datasPresenca),
    formatura: input.dataFim,
  };
}
