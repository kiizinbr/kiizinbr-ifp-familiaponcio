/**
 * Diff de campos da Ficha Cidadã (melhorias Task 2).
 * Usado pra registrar `meta.changedFields` no evento `ficha_updated` — que a
 * timeline lê e aplica a redação de campos sensíveis (Refinement B do Plano 3).
 *
 * Puro: compara dois registros já normalizados pelo caller. Considera só as
 * chaves presentes em `novo`. null/undefined/'' são equivalentes (sem mudança).
 */

function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function changedFields(
  antigo: Record<string, unknown>,
  novo: Record<string, unknown>,
): string[] {
  return Object.keys(novo).filter((k) => norm(antigo[k]) !== norm(novo[k]));
}
