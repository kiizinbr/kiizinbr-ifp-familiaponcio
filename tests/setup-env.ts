/**
 * Vitest setup: carrega .env.local para testes de integração que tocam o banco
 * (ex.: tests/unit/medico-agenda.test.ts via `import { db }`).
 *
 * Por quê: `vitest run` não carrega .env.local (ao contrário dos scripts
 * `db:*` que usam dotenv-cli). Sem DATABASE_URL no process.env, `new
 * PrismaClient()` em src/lib/db.ts não conecta e os testes de integração
 * falham por config, não por código.
 *
 * Seguro pra CI: só seta variáveis AINDA NÃO presentes (no-override). No CI o
 * DATABASE_URL já vem do workflow env e não há arquivo .env.local — então isto
 * vira no-op. Hand-parse (sem dependência `dotenv`) pra evitar o problema de
 * virtual-store estrito do pnpm com libs transitivas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return; // arquivo ausente (ex.: CI) — nada a fazer
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue; // no-override

    let value = trimmed.slice(eq + 1).trim();
    // Remove aspas envolventes (simples ou duplas)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();
