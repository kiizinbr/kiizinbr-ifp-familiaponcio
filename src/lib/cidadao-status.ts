/**
 * Status de exibição do Cidadão (Plano 4 melhorias — Task 1).
 *
 * Dois eixos ORTOGONAIS:
 * - Ciclo de vida: `statusCadastro` (rascunho | ativo | inativo)
 * - Flags de compliance: `deletedAt` (soft delete) e `anonimizadoEm` (LGPD)
 *
 * Para exibição, as flags têm precedência sobre o ciclo de vida.
 */

export type StatusTone = "red" | "amber" | "emerald" | "slate";

export interface StatusDisplay {
  label: string;
  tone: StatusTone;
}

export interface StatusInput {
  deletedAt: Date | null;
  anonimizadoEm: Date | null;
  statusCadastro: string;
}

const CICLO_LABELS: Record<string, StatusDisplay> = {
  rascunho: { label: "Rascunho", tone: "slate" },
  ativo: { label: "Ativo", tone: "emerald" },
  inativo: { label: "Inativo", tone: "slate" },
};

export function statusDisplay(input: StatusInput): StatusDisplay {
  if (input.deletedAt) return { label: "Excluído", tone: "red" };
  if (input.anonimizadoEm) return { label: "Anonimizado", tone: "amber" };
  return CICLO_LABELS[input.statusCadastro] ?? { label: input.statusCadastro, tone: "slate" };
}
