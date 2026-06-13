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
 *
 * LIMITAÇÃO CONHECIDA (fix exige migration — fora desta branch):
 * - `mode: "insensitive"` vira ILIKE no Postgres: faz fold de CAIXA, NÃO de
 *   ACENTO. Como as descrições DATASUS são acentuadas, "infeccao" não acha
 *   "Infecção". Não bloqueia (cai no texto livre), mas degrada a captura do
 *   código estruturado. Fix correto: extensão `unaccent` (queryRaw
 *   `unaccent(descricao) ILIKE unaccent($1)`) ou coluna `descricaoNorm`.
 * - `contains` (ILIKE '%termo%') não usa o @@index([descricao]) btree → seq
 *   scan. Aceitável no volume fixo (~12k linhas read-only, take 12); índice de
 *   verdade exigiria GIN pg_trgm. Ambos atacados juntos numa migration futura.
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
 * Anti-tampering híbrido + anti-forja de código:
 * - código existe na tabela Cid10 → descrição gravada é a OFICIAL (snapshot
 *   canônico em DiagnosticoNota);
 * - código NÃO existe MAS a tabela foi consultada com sucesso
 *   (`tabelaConsultada`) → REBAIXA a texto livre (codigoCid = null), mantendo a
 *   descrição: o registro não finge estrutura CID oficial com código forjado,
 *   sem bloquear o atendimento (o diagnóstico continua salvo);
 * - tabela indisponível (`tabelaConsultada = false`) → mantém o código enviado
 *   intocado, pois não há como afirmar que o código é inválido — nunca bloqueia.
 *
 * Pela UI um código sempre vem da própria tabela (busca server-side), então o
 * caminho de rebaixamento só dispara em POST forjado pelo profissional.
 */
export function canonicalizarDescricoes(
  itens: DiagnosticoChip[],
  oficiais: Map<string, string>,
  tabelaConsultada: boolean,
): DiagnosticoChip[] {
  return itens.map((d) => {
    if (!d.codigoCid) return d;
    const oficial = oficiais.get(d.codigoCid);
    if (oficial) return { ...d, descricao: oficial };
    // Código inexistente numa tabela consultada com sucesso → rebaixa a texto livre.
    if (tabelaConsultada) return { ...d, codigoCid: null };
    // Tabela indisponível: não dá pra refutar o código → mantém intocado.
    return d;
  });
}
