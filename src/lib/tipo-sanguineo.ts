/**
 * Normalização de tipo sanguíneo texto-livre (B6 — higiene de dados migrados).
 *
 * O banco guarda `Cidadao.tipoSanguineo String?` (livre, pra acomodar legado),
 * mas o schema Zod valida com `z.enum` dos 8 grupos ABO/Rh. A migração Amplimed
 * gravou texto-livre ("O Positivo", "o+", "A POS"…) só com `trim()` — ao reabrir
 * e salvar a ficha, o `z.enum` rejeitava e TRAVAVA o save inteiro (nenhum campo
 * persistia). Este normalizador converte o texto-livre pro enum no boundary de
 * validação (z.preprocess) e pré-seleciona no form. Só EXIBIÇÃO/entrada: o
 * schema do banco NÃO muda e o dado raw segue no banco até um save reescrever.
 */

/** Os 8 grupos ABO/Rh aceitos pelo schema (z.enum em cidadao-schema.ts). */
export const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type TipoSanguineo = (typeof TIPOS_SANGUINEOS)[number];

/**
 * Normaliza tipo sanguíneo texto-livre (migração Amplimed: "O Positivo", "o+",
 * "A POS", "Rh+ O"…) para o enum estrito. Irreconhecível → undefined (NUNCA erro
 * — fica vazio/placeholder). Só normalização de EXIBIÇÃO/entrada: o schema do
 * banco (String? livre) NÃO muda e o dado raw segue no banco até um save reescrever.
 */
export function normalizeTipoSanguineo(raw: string | null | undefined): TipoSanguineo | undefined {
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  // Rh PRIMEIRO: "+"/"POS"/"POSITIV" → +; "-"/"NEG"/"NEGATIV" → -. Detectar o Rh
  // antes do grupo e remover as PALAVRAS de Rh do texto evita falso-positivo de
  // grupo dentro delas (ex.: a letra O em "NEGATIVO" casaria grupo "O").
  const temPos = up.includes("+") || up.includes("POS");
  const temNeg = up.includes("-") || up.includes("NEG");
  if (temPos === temNeg) return undefined; // ambíguo ou ausente → não chuta
  const sinal = temPos ? "+" : "-";
  // Remove palavras de Rh (POSITIVO/NEGATIVO/POS/NEG/RH) antes de procurar o grupo.
  const semRh = up.replace(/POSITIV[OA]?|NEGATIV[OA]?|POS|NEG|RH/g, "");
  // grupo ABO: procura AB antes de A/B (senão "AB" casa "A"). Sem grupo → desconhecido.
  const grupo = semRh.includes("AB")
    ? "AB"
    : semRh.includes("O")
      ? "O"
      : semRh.includes("B")
        ? "B"
        : semRh.includes("A")
          ? "A"
          : null;
  if (!grupo) return undefined;
  const candidato = `${grupo}${sinal}` as TipoSanguineo;
  return TIPOS_SANGUINEOS.includes(candidato) ? candidato : undefined;
}
