import { hash } from "bcryptjs";
import {
  GravidadeAlergia,
  Perfil,
  PrismaClient,
  StatusAgendamento,
  StatusElegibilidade,
  TipoUnidade,
} from "@prisma/client";

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

  await seedCentroMedico();
}

// ============================================================
// Centro Médico (Fase 1) — médica, fichas, agenda de HOJE
// ============================================================
async function seedCentroMedico() {
  const medicoPassword = process.env.SEED_MEDICO_PASSWORD;
  if (!medicoPassword) {
    console.warn(
      "  ! SEED_MEDICO_PASSWORD não definido — pulando seed do Centro Médico.",
    );
    return;
  }

  const unidadeMedico = await prisma.unidade.findUniqueOrThrow({
    where: { slug: "medico" },
  });

  // 1) Usuária médica + perfil PROFISSIONAL + vínculo com a unidade
  const senhaHash = await hash(medicoPassword, 12);
  const medica = await prisma.user.upsert({
    where: { email: "medico@ifp.local" },
    update: { senhaHash, ativo: true },
    create: {
      email: "medico@ifp.local",
      senhaHash,
      nome: "Dra. Ana Souza",
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: medica.id, perfil: Perfil.PROFISSIONAL } },
    update: {},
    create: { userId: medica.id, perfil: Perfil.PROFISSIONAL },
  });
  await prisma.usuarioUnidade.upsert({
    where: { userId_unidadeId: { userId: medica.id, unidadeId: unidadeMedico.id } },
    update: {},
    create: { userId: medica.id, unidadeId: unidadeMedico.id },
  });
  const profissional = await prisma.profissional.upsert({
    where: { userId: medica.id },
    update: { ativo: true },
    create: {
      userId: medica.id,
      unidadeId: unidadeMedico.id,
      registroConselho: "52-12345-0",
      ufConselho: "RJ",
      especialidade: "Clínica Geral",
    },
  });
  console.log("  ✓ Profissional Dra. Ana Souza (medico@ifp.local)");

  // 2) Fichas de exemplo, aprovadas na unidade médico
  const fichasExemplo = [
    {
      protocolo: "IFP-2026-900001",
      nomeCompleto: "João da Silva",
      cpf: "11111111111",
      dataNascimento: new Date("1985-03-12"),
      telefone: "(21) 99999-0001",
    },
    {
      protocolo: "IFP-2026-900002",
      nomeCompleto: "Maria Oliveira",
      cpf: "22222222222",
      dataNascimento: new Date("1992-07-25"),
      telefone: "(21) 99999-0002",
    },
    {
      protocolo: "IFP-2026-900003",
      nomeCompleto: "Pedro Santos",
      cpf: "33333333333",
      dataNascimento: new Date("1978-11-02"),
      telefone: "(21) 99999-0003",
    },
  ];

  const fichas = [];
  for (const f of fichasExemplo) {
    const ficha = await prisma.fichaCidada.upsert({
      where: { cpf: f.cpf },
      update: {},
      create: f,
    });
    await prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId: ficha.id, unidadeId: unidadeMedico.id } },
      update: { status: StatusElegibilidade.APROVADO },
      create: {
        fichaId: ficha.id,
        unidadeId: unidadeMedico.id,
        status: StatusElegibilidade.APROVADO,
        motivo: "Seed de desenvolvimento",
      },
    });
    fichas.push(ficha);
    console.log(`  ✓ Ficha ${f.protocolo} (${f.nomeCompleto}) aprovada no médico`);
  }

  // 3) Histórico clínico da ficha 1 — alimenta os chips da prancha
  const [joao] = fichas;
  const jaTemAlergia = await prisma.alergia.findFirst({
    where: { fichaId: joao.id, descricao: "Dipirona" },
  });
  if (!jaTemAlergia) {
    await prisma.alergia.create({
      data: {
        fichaId: joao.id,
        descricao: "Dipirona",
        gravidade: GravidadeAlergia.GRAVE,
      },
    });
  }
  const jaTemCondicao = await prisma.condicaoCronica.findFirst({
    where: { fichaId: joao.id, descricao: "Asma" },
  });
  if (!jaTemCondicao) {
    await prisma.condicaoCronica.create({
      data: { fichaId: joao.id, descricao: "Asma", cid10: "J45" },
    });
  }
  console.log("  ✓ Histórico clínico do João (alergia Dipirona GRAVE + Asma)");

  // 4) 3 agendamentos de HOJE (recriados a cada seed — agenda sempre atual)
  const hoje0 = new Date();
  hoje0.setHours(0, 0, 0, 0);
  const amanha0 = new Date(hoje0);
  amanha0.setDate(amanha0.getDate() + 1);
  await prisma.agendamento.deleteMany({
    where: {
      profissionalId: profissional.id,
      inicioEm: { gte: hoje0, lt: amanha0 },
      atendimento: null, // não apaga agendamento que já virou atendimento
    },
  });

  const horarios = [
    { hora: 9, minuto: 0, motivo: "Consulta de rotina" },
    { hora: 10, minuto: 30, motivo: "Dor de cabeça recorrente" },
    { hora: 14, minuto: 0, motivo: "Retorno — exames" },
  ];
  for (let i = 0; i < horarios.length; i++) {
    const h = horarios[i];
    const inicio = new Date(hoje0);
    inicio.setHours(h.hora, h.minuto, 0, 0);
    const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
    const jaExiste = await prisma.agendamento.findFirst({
      where: { profissionalId: profissional.id, inicioEm: inicio },
    });
    if (!jaExiste) {
      await prisma.agendamento.create({
        data: {
          unidadeId: unidadeMedico.id,
          fichaId: fichas[i].id,
          profissionalId: profissional.id,
          inicioEm: inicio,
          fimEm: fim,
          status: StatusAgendamento.CONFIRMADO,
          motivo: h.motivo,
          criadoPor: medica.id,
        },
      });
    }
  }
  console.log("  ✓ 3 agendamentos de hoje (09:00, 10:30, 14:00)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
