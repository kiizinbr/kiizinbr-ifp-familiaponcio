/**
 * Dev helper (descartável): promove a educadora@ifp.local a GESTOR_UNIDADE,
 * mantendo o vínculo PROFISSIONAL com a unidade educacional. Assim um único
 * login consegue tanto resolver a unidade (resolverPorUser) quanto passar nos
 * guards das ações de gestora (criar comunicado/autorizado, autorização imagem).
 *
 * Rodar: pnpm --filter @ifp/database exec tsx scripts/promove-gestora.ts
 * Reverter: prisma.usuarioPerfil.delete do par (userId, GESTOR_UNIDADE).
 */
import { PrismaClient, Perfil } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "educadora@ifp.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Usuário ${email} não encontrado — rode o seed antes.`);

  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: user.id, perfil: Perfil.GESTOR_UNIDADE } },
    update: {},
    create: { userId: user.id, perfil: Perfil.GESTOR_UNIDADE },
  });

  const perfis = await prisma.usuarioPerfil.findMany({
    where: { userId: user.id },
    select: { perfil: true },
  });
  console.log(`OK: ${email} agora tem perfis -> ${perfis.map((p) => p.perfil).join(", ")}`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
