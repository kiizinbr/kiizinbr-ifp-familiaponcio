/**
 * Higiene de texto clínico legado (F2 — sprint cid10).
 *
 * Campos como `Cidadao.alergias`/`condicoesCronicas`/`medicamentosEmUso` vieram
 * da migração Amplimed com HTML cru (`<br>`, `&nbsp;`…) — a Amplimed armazenava
 * rich-text e o mapper migrou o texto 1:1. O React escapa na renderização,
 * então a tag aparece como TEXTO LITERAL na UI. A limpeza acontece na camada de
 * EXIBIÇÃO (+ no defaultValue do form de edição, que sanea a fonte gradualmente
 * via saves normais) — NENHUM update em massa no banco nesta sprint.
 */

/** Entidades HTML básicas presentes no legado (decode mínimo, sem dependência). */
const ENTIDADES_HTML: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
};

/**
 * Remove HTML cru de texto clínico: `<br>` (qualquer variação) vira `\n`,
 * demais tags são removidas, entidades básicas são decodificadas e o whitespace
 * horizontal é colapsado PRESERVANDO as quebras de linha (`\n` é separador
 * semântico — `chipsClinicos` divide por ele). Texto já limpo passa intacto.
 * Retorna `""` para entrada nula/vazia.
 */
export function limparTextoClinico(texto: string | null | undefined): string {
  if (!texto) return "";
  const semHtml = texto
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot);/g, (entidade) => ENTIDADES_HTML[entidade] ?? entidade);
  return semHtml
    .split("\n")
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter((linha) => linha.length > 0)
    .join("\n");
}

/**
 * Divide texto clínico em chips: limpa o HTML primeiro e divide por
 * vírgula/ponto-e-vírgula/quebra de linha (o `<br>` legado vira `\n` e portanto
 * também separa). Unifica a lógica antes duplicada em `chips()`
 * (medico/pacientes/[id]) e `chipsDe()` (medico/consultas/[id] — migra
 * pós-merge da F1).
 */
export function chipsClinicos(texto: string | null | undefined): string[] {
  return limparTextoClinico(texto)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
