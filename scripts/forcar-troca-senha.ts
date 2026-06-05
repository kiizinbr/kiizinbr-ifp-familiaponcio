/**
 * Ops / go-live: força TODOS os usuários a trocarem a senha no próximo login
 * (mustChangePassword = true). Rode UMA vez antes de ir a produção para neutralizar
 * senhas demo/provisórias conhecidas (ex.: ifp-demo-2026 do seed). Idempotente.
 *
 *   pnpm seguranca:forcar-troca
 *
 * Cada pessoa cai em /conta/senha no próximo acesso e define uma senha própria.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const r = await db.user.updateMany({ data: { mustChangePassword: true } });
  console.log(`mustChangePassword=true aplicado a ${r.count} usuário(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
