// Seed MÍNIMO de PRODUÇÃO — cria SÓ o Super Admin inicial + as 4 unidades.
//
// Diferente de prisma/seed.ts (seed DEV completo, com famílias/CPFs fictícios,
// prontuários e fixtures de IDOR), este seed NUNCA injeta dados de teste na base.
// Use-o em produção para destravar o primeiro login do Super Admin.
//
// Gate explícito: só roda com SEED_ADMIN_ONLY=true (evita rodar por engano).
// Idempotente: re-rodar apenas reafirma a senha/perfil do admin (upsert).
//
// Uso (no servidor):
//   SEED_ADMIN_ONLY=true \
//   SEED_SUPER_ADMIN_EMAIL=admin@ifp.org.br \
//   SEED_SUPER_ADMIN_PASSWORD='<senha-forte>' \
//   pnpm --filter @ifp/database seed:admin
import { hash } from "bcryptjs";
import { Perfil, PrismaClient, TipoUnidade } from "@prisma/client";

const prisma = new PrismaClient();

// As 4 unidades do IFP — dados institucionais reais (não são fixtures de teste).
const unidades = [
  {
    tipo: TipoUnidade.MEDICO,
    slug: "medico",
    nome: "Centro Médico IFP",
    endereco: "Rod. Washington Luiz — Jardim Gramacho, Duque de Caxias/RJ",
  },
  {
    tipo: TipoUnidade.CAPACITACAO,
    slug: "capacitacao",
    nome: "Centro de Capacitação IFP",
    endereco: "Rod. Washington Luiz — Jardim Gramacho, Duque de Caxias/RJ",
  },
  {
    tipo: TipoUnidade.ESPORTIVO,
    slug: "esportivo",
    nome: "Centro Esportivo IFP",
    endereco: "Rod. Washington Luiz — Jardim Gramacho, Duque de Caxias/RJ",
  },
  {
    tipo: TipoUnidade.EDUCACIONAL,
    slug: "educacional",
    nome: "Centro Recreativo / Educacional IFP",
    endereco: "Rod. Washington Luiz — Jardim Gramacho, Duque de Caxias/RJ",
  },
];

async function main() {
  if (process.env.SEED_ADMIN_ONLY !== "true") {
    throw new Error(
      "seed-admin: gate fechado. Defina SEED_ADMIN_ONLY=true para rodar o seed mínimo de Super Admin.",
    );
  }

  const seedEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!seedEmail || !seedPassword) {
    throw new Error(
      "seed-admin: SEED_SUPER_ADMIN_EMAIL e SEED_SUPER_ADMIN_PASSWORD são obrigatórios.",
    );
  }

  console.log("> Seed-admin (mínimo de produção) iniciando...");

  // Unidades institucionais (idempotente por tipo).
  for (const u of unidades) {
    await prisma.unidade.upsert({
      where: { tipo: u.tipo },
      update: { nome: u.nome, slug: u.slug, endereco: u.endereco },
      create: u,
    });
    console.log(`  ✓ Unidade ${u.slug}`);
  }

  // Super Admin — mesmo upsert do seed.ts (idempotente; só reafirma senha/perfil).
  const senhaHash = await hash(seedPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: seedEmail },
    update: { senhaHash, ativo: true },
    create: {
      email: seedEmail,
      senhaHash,
      nome: "Super Admin IFP",
      ativo: true,
    },
  });

  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: admin.id, perfil: Perfil.SUPER_ADMIN } },
    update: {},
    create: { userId: admin.id, perfil: Perfil.SUPER_ADMIN },
  });
  console.log(`  ✓ Super Admin (${seedEmail})`);
  console.log("> Seed-admin concluído — NENHUM dado de teste foi criado.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
