import { z } from "zod";

/**
 * Receita multi-item — funções PURAS (sem DB, sem "use server") compartilhadas
 * pelo client receita-itens.tsx, pela action emitirReceitaAction e pelos testes.
 * Molde: src/lib/medico/cid10.ts (schema + cap + normalizador num módulo importável).
 */

/** Cap de itens por receita — espelhado pelo client receita-itens.tsx (constante local lá). */
export const MAX_RECEITA_ITENS = 20;

/** Item como trafega no hidden `itensJson` e nas linhas da UI. */
export interface ReceitaItemDraft {
  medicamento: string;
  posologia: string;
  quantidade: string | null;
  via: string | null;
}

/** Shape do hidden `itensJson` (wire format do form de receita). Nunca confiar no cliente. */
export const ReceitaItensSchema = z
  .array(
    z.object({
      medicamento: z.string().trim().min(1).max(300),
      posologia: z.string().trim().min(1).max(500),
      quantidade: z.string().trim().max(120).nullish(),
      via: z.string().trim().max(120).nullish(),
    }),
  )
  .min(1)
  .max(MAX_RECEITA_ITENS);

export type ReceitaItensInput = z.infer<typeof ReceitaItensSchema>;

/** Normaliza: trim já feito pelo zod; quantidade/via vazios → null. */
export function normalizarReceitaItens(itens: ReceitaItensInput): ReceitaItemDraft[] {
  return itens.map((it) => ({
    medicamento: it.medicamento,
    posologia: it.posologia,
    quantidade: it.quantidade?.trim() || null,
    via: it.via?.trim() || null,
  }));
}
