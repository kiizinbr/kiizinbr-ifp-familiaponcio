/**
 * Seed da tabela de referência Cid10 (T0 da frente CID-10) a partir dos CSVs
 * DATASUS (CID-10 v2008) commitados em prisma/data/:
 *   - CID-10-CATEGORIAS.CSV    → CAT;CLASSIF;DESCRICAO;...
 *   - CID-10-SUBCATEGORIAS.CSV → SUBCAT;CLASSIF;RESTRSEXO;CAUSAOBITO;DESCRICAO;...
 *
 * Arquivos em latin-1, separados por ";", linhas CRLF. Decodificação via
 * buffer.toString("latin1") — sem dependência nova. Idempotente: createMany
 * com skipDuplicates em chunks de 1.000 (rodar de novo é no-op). Data-only:
 * NENHUMA mudança de schema; só popula a tabela já existente.
 *
 * Rodar: pnpm exec dotenv -e .env.local -- tsx scripts/seed-cid10.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Mesmo formato de código do prontuário e da migração (CID_CODIGO_RE em
 * src/lib/medico/cid10.ts e src/lib/migracao-amplimed/cid10.ts).
 */
const CODIGO_VALIDO = /^[A-TV-Z]\d{2}(\.\d{1,2})?$/;

/** "J069" → "J06.9"; categorias de 3 caracteres ficam como estão. */
function normalizarCodigo(bruto: string): string {
  const cod = bruto.trim().toUpperCase();
  return cod.length > 3 ? `${cod.slice(0, 3)}.${cod.slice(3)}` : cod;
}

interface LinhaCid {
  codigo: string;
  descricao: string;
}

function parseCsv(arquivo: string, colCodigo: number, colDescricao: number): LinhaCid[] {
  const linhas = readFileSync(arquivo).toString("latin1").split(/\r?\n/);
  const out: LinhaCid[] = [];
  // slice(1) pula o header (CAT;.../SUBCAT;...)
  for (const linha of linhas.slice(1)) {
    if (!linha.trim()) continue;
    const campos = linha.split(";");
    const codigo = normalizarCodigo(campos[colCodigo] ?? "");
    const descricao = (campos[colDescricao] ?? "").trim();
    // Códigos U (U04, U80, U99…) ficam fora: não passam no formato usado pelo
    // prontuário/migração — seriam buscáveis mas nunca validáveis.
    if (!CODIGO_VALIDO.test(codigo) || !descricao) continue;
    out.push({ codigo, descricao });
  }
  return out;
}

async function main() {
  const dataDir = path.resolve(import.meta.dirname, "../prisma/data");
  const categorias = parseCsv(path.join(dataDir, "CID-10-CATEGORIAS.CSV"), 0, 2);
  const subcategorias = parseCsv(path.join(dataDir, "CID-10-SUBCATEGORIAS.CSV"), 0, 4);

  // SUBCATEGORIAS repete categorias sem subdivisão (ex.: A09, V98) — dedupe
  // por código, com a categoria vencendo (descrições são equivalentes).
  const porCodigo = new Map<string, LinhaCid>();
  for (const row of [...categorias, ...subcategorias]) {
    if (!porCodigo.has(row.codigo)) porCodigo.set(row.codigo, row);
  }
  const rows = [...porCodigo.values()];
  console.log(
    `CSV: ${categorias.length} categorias + ${subcategorias.length} subcategorias → ` +
      `${rows.length} códigos únicos`,
  );

  let inseridos = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await db.cid10.createMany({
      data: rows.slice(i, i + 1000),
      skipDuplicates: true,
    });
    inseridos += r.count;
  }

  // Verificação: contagem mínima + amostra com subcategoria pontuada.
  const total = await db.cid10.count();
  const amostra = await db.cid10.findUnique({ where: { codigo: "J06.9" } });
  console.log(`Inseridos agora: ${inseridos}; total na tabela Cid10: ${total}`);
  console.log(`Amostra J06.9: ${amostra ? amostra.descricao : "AUSENTE"}`);
  if (total < 10000 || !amostra) {
    throw new Error("Verificação do seed falhou: esperado >= 10000 códigos e J06.9 presente");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
