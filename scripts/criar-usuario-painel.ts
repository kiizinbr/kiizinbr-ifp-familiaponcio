/**
 * Cria/atualiza o usuario de quiosque do painel de uma unidade.
 * Uso: pnpm painel:criar-usuario medico "Senha123!"
 * (a senha precisa ter >= 8 chars; mustChangePassword fica false p/ o quiosque ficar logado)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const unidade = process.argv[2];
  const senha = process.argv[3];
  if (!unidade || !senha || senha.length < 8) {
    console.error("Uso: pnpm painel:criar-usuario <unidade> <senha (>=8 chars)>");
    process.exitCode = 1;
    return;
  }

  // garante o role 'painel' (scope unit)
  const role = await db.role.upsert({
    where: { name: "painel" },
    update: {},
    create: { name: "painel", description: "Quiosque de painel de chamada (TV)", scope: "unit" },
  });

  const email = `painel.${unidade}@familiaponcio.org.br`;
  const hashedPassword = await bcrypt.hash(senha, 12);
  const user = await db.user.upsert({
    where: { email },
    update: { mustChangePassword: false, primaryRoleName: "painel", primaryUnitScope: unidade },
    create: {
      email,
      name: `Painel ${unidade}`,
      hashedPassword,
      mustChangePassword: false,
      primaryRoleName: "painel",
      primaryUnitScope: unidade,
    },
  });

  const jaTem = await db.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, unitScope: unidade },
  });
  if (!jaTem) {
    await db.userRole.create({ data: { userId: user.id, roleId: role.id, unitScope: unidade } });
  }

  console.log(`Quiosque pronto: ${email} (papel painel/${unidade}). Logue a TV com essa senha.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
