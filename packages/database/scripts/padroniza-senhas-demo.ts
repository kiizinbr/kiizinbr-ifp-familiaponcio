/**
 * Dev helper (descartável): põe a MESMA senha em todos os usuários @ifp.local,
 * pra facilitar a demonstração (um login por módulo, mas uma senha só).
 * Rodar: pnpm --filter @ifp/database exec tsx scripts/padroniza-senhas-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SENHA_DEMO = "ifp2026!"; // min. 8 chars (regra do LoginDto)

async function main() {
  const hash = await bcrypt.hash(SENHA_DEMO, 10);
  const res = await prisma.user.updateMany({
    where: { email: { endsWith: "@ifp.local" } },
    data: { senhaHash: hash },
  });
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@ifp.local" } },
    select: { email: true, perfis: { select: { perfil: true } } },
    orderBy: { email: "asc" },
  });
  console.log(`OK: senha "${SENHA_DEMO}" aplicada a ${res.count} usuários:`);
  for (const u of users) {
    console.log(`  - ${u.email}  [${u.perfis.map((p) => p.perfil).join(", ")}]`);
  }
}

main()
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
