import { readFileSync } from "node:fs";
import {
  parseLinhaAluno,
  normalizarAluno,
  type AlunoNormalizado,
} from "../src/lib/capacitacao/import-alunos";

/**
 * DRY-RUN do import de alunas da Capacitação. SÓ LÊ e relata — não escreve nada no
 * banco. A carga real (com gravação) é tarefa da Fase 1, em produção, após a base
 * legal LGPD. Uso: pnpm import:alunos:dry "<caminho-do-csv>"
 */
const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: pnpm import:alunos:dry "<caminho-do-csv>"');
  process.exit(1);
}

const conteudo = readFileSync(caminho, "utf-8");
const corpo = conteudo
  .split(/\r?\n/)
  .filter((l) => l.trim().length > 0)
  .slice(1); // pula header

const normalizadas: AlunoNormalizado[] = [];
const statusNaoMapeados = new Map<string, number>();
let naoParseadas = 0;
for (const linha of corpo) {
  const row = parseLinhaAluno(linha);
  if (!row) {
    naoParseadas++;
    continue;
  }
  const norm = normalizarAluno(row);
  normalizadas.push(norm);
  if (norm.status === null) {
    const bruto = row.status || "(vazio)";
    statusNaoMapeados.set(bruto, (statusNaoMapeados.get(bruto) ?? 0) + 1);
  }
}

const limpas = normalizadas.filter((n) => n.problemas.length === 0);
const aRevisar = normalizadas.filter((n) => n.problemas.length > 0);

function rankear(chave: (n: AlunoNormalizado) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const n of normalizadas) m.set(chave(n), (m.get(chave(n)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

console.log("=== DRY-RUN: import de alunas da Capacitação (NADA é gravado) ===");
console.log(`Linhas no corpo: ${corpo.length}`);
console.log(`Parseadas: ${normalizadas.length} · Não-parseadas: ${naoParseadas}`);
console.log(`Limpas (sem problema): ${limpas.length} · A revisar: ${aRevisar.length}`);

console.log("\n-- Por curso --");
for (const [curso, n] of rankear((a) => a.curso || "(vazio)")) console.log(`  ${n}\t${curso}`);

console.log("\n-- Por turno --");
for (const [turno, n] of rankear((a) => a.turno || "(vazio)")) console.log(`  ${n}\t${turno}`);

console.log("\n-- Tipos de problema (nas linhas a revisar) --");
const probs = new Map<string, number>();
for (const n of aRevisar) {
  for (const p of n.problemas) {
    const chave = p.replace(/:.*/, "");
    probs.set(chave, (probs.get(chave) ?? 0) + 1);
  }
}
for (const [p, n] of [...probs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${p}`);

if (statusNaoMapeados.size > 0) {
  console.log("\n-- Valores de status NÃO mapeados (precisam de regra) --");
  for (const [s, n] of [...statusNaoMapeados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
    console.log(`  ${n}\t"${s}"`);
}

console.log("\nNada foi escrito no banco. Carga real = Fase 1 (produção + base legal LGPD).");
