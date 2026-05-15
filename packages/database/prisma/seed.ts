import { hash } from "bcryptjs";
import { Perfil, PrismaClient, TipoUnidade } from "@prisma/client";

const prisma = new PrismaClient();

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
  console.log("> Seed iniciando...");

  for (const u of unidades) {
    await prisma.unidade.upsert({
      where: { tipo: u.tipo },
      update: { nome: u.nome, slug: u.slug, endereco: u.endereco },
      create: u,
    });
    console.log(`  ✓ Unidade ${u.slug}`);
  }

  const seedEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@ifp.local";
  const seedPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!seedPassword) {
    console.warn(
      "  ! SEED_SUPER_ADMIN_PASSWORD não definido — pulando criação do Super Admin.",
    );
    return;
  }

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
