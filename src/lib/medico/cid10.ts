import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * CID-10 estruturado no prontuário — funções PURAS (sem DB) compartilhadas
 * pelo combobox do prontuário, pela action de busca (cid10-actions.ts) e pelo
 * parse do hidden `diagnosticosJson` em salvarRascunhoAction.
 */

/**
 * Formato de código CID-10 — MESMA regex de src/lib/migracao-amplimed/cid10.ts
 * (parseCid10Texto) e de scripts/seed-cid10.ts. Se uma mudar, mudar as outras:
 * é o contrato comum entre dado migrado, seed da tabela Cid10 e dado digitado.
 */
export const CID_CODIGO_RE = /^[A-TV-Z]\d{2}(\.\d{1,2})?$/;

/** Cap de diagnósticos por nota (mesmo limite do DiagnosticosSchema e do combobox). */
export const MAX_DIAGNOSTICOS = 10;

/** Linha da tabela de referência Cid10 devolvida pela busca. */
export interface Cid10Item {
  codigo: string;
  descricao: string;
}

/** Diagnóstico como trafega no hidden `diagnosticosJson` e nos chips da UI. */
export interface DiagnosticoChip {
  codigoCid: string | null;
  descricao: string;
  principal: boolean;
}

/** Heurística: o termo digitado parece um código CID (letra seguida de dígito)? */
export function pareceCodigoCid(q: string): boolean {
  return /^[A-Za-z]\d/.test(q.trim());
}

/**
 * Filtro Prisma da busca de CID-10: termo código-like busca por prefixo de
 * código E por descrição; termo textual busca só na descrição (insensitive).
 */
export function buildCid10Filter(q: string): Prisma.Cid10WhereInput {
  const termo = q.trim();
  if (pareceCodigoCid(termo)) {
    return {
      OR: [
        { codigo: { startsWith: termo.toUpperCase() } },
        { descricao: { contains: termo, mode: "insensitive" } },
      ],
    };
  }
  return { descricao: { contains: termo, mode: "insensitive" } };
}

/** Shape do hidden `diagnosticosJson` (wire format do form de evolução). */
export const DiagnosticosSchema = z
  .array(
    z.object({
      codigoCid: z.string().nullable(),
      descricao: z.string().trim().min(1).max(500),
      principal: z.boolean(),
    }),
  )
  .max(MAX_DIAGNOSTICOS);

export type DiagnosticosInput = z.infer<typeof DiagnosticosSchema>;

/**
 * Normaliza a lista vinda do cliente (nunca confiar no hidden input):
 * - código fora do formato CID → diagnóstico sem código (mantém a descrição);
 * - dedupe: por código (quando há) e por descrição case-insensitive (sem código);
 * - exatamente 1 principal quando a lista não é vazia (0 marcados → o primeiro;
 *   >1 marcados → o primeiro marcado vence).
 */
export function normalizarDiagnosticos(itens: DiagnosticosInput): DiagnosticoChip[] {
  const saneados = itens.map((item) => {
    const codigo = item.codigoCid?.trim().toUpperCase() ?? null;
    return {
      codigoCid: codigo && CID_CODIGO_RE.test(codigo) ? codigo : null,
      descricao: item.descricao.trim(),
      principal: item.principal,
    };
  });

  const codigosVistos = new Set<string>();
  const descricoesVistas = new Set<string>();
  const unicos: DiagnosticoChip[] = [];
  for (const d of saneados) {
    if (d.codigoCid) {
      if (codigosVistos.has(d.codigoCid)) continue;
      codigosVistos.add(d.codigoCid);
    } else {
      const chave = d.descricao.toLowerCase();
      if (descricoesVistas.has(chave)) continue;
      descricoesVistas.add(chave);
    }
    unicos.push(d);
  }

  if (unicos.length === 0) return [];
  const idxPrincipal = Math.max(
    0,
    unicos.findIndex((d) => d.principal),
  );
  return unicos.map((d, i) => ({ ...d, principal: i === idxPrincipal }));
}

/**
 * Anti-tampering híbrido: quando o código existe na tabela Cid10, a descrição
 * gravada é a OFICIAL (snapshot canônico em DiagnosticoNota); código
 * regex-válido fora da tabela mantém a descrição enviada — tabela incompleta
 * ou busca indisponível nunca bloqueia o atendimento.
 */
export function canonicalizarDescricoes(
  itens: DiagnosticoChip[],
  oficiais: Map<string, string>,
): DiagnosticoChip[] {
  return itens.map((d) => {
    if (!d.codigoCid) return d;
    const oficial = oficiais.get(d.codigoCid);
    return oficial ? { ...d, descricao: oficial } : d;
  });
}
