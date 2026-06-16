import type { StatusTurma } from "@prisma/client";

/**
 * Máquina de estados da Turma (Capacitação). Antes a turma travava em 'planejada'
 * para sempre (sem action de transição). Concluída/cancelada são terminais.
 */
export const TRANSICOES_TURMA: Record<StatusTurma, ReadonlySet<StatusTurma>> = {
  planejada: new Set<StatusTurma>(["inscricoes_abertas", "cancelada"]),
  inscricoes_abertas: new Set<StatusTurma>(["em_andamento", "cancelada"]),
  em_andamento: new Set<StatusTurma>(["concluida", "cancelada"]),
  concluida: new Set<StatusTurma>(),
  cancelada: new Set<StatusTurma>(),
};

export function podeTransicionarTurma(de: StatusTurma, para: StatusTurma): boolean {
  return TRANSICOES_TURMA[de].has(para);
}

/** Status para os quais a turma pode ir a partir de `de` (para renderizar botões). */
export function proximosStatusTurma(de: StatusTurma): StatusTurma[] {
  return [...TRANSICOES_TURMA[de]];
}

/**
 * Status em que a turma ainda pode ter dados básicos (datas/local/capacidade) editados.
 * Depois que entra em andamento, conclui ou cancela, os dados ficam congelados — alunos
 * já estão se organizando em cima deles. Decisão institucional.
 */
export const STATUS_TURMA_EDITAVEIS: ReadonlySet<StatusTurma> = new Set<StatusTurma>([
  "planejada",
  "inscricoes_abertas",
]);

export function podeEditarTurma(status: StatusTurma): boolean {
  return STATUS_TURMA_EDITAVEIS.has(status);
}
