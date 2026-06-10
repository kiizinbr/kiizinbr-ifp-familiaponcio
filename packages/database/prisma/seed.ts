import { hash } from "bcryptjs";
import {
  GravidadeAlergia,
  ModalidadeCurso,
  Perfil,
  PrismaClient,
  StatusAgendamento,
  StatusElegibilidade,
  StatusMatricula,
  StatusPresenca,
  StatusTurma,
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
  await seedCapacitacao();
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

// ============================================================
// Capacitação (Fase 3) — instrutor, curso, turma BB-2026-1,
// matrículas e 2 aulas com chamada (vertical do certificado)
// ============================================================
async function seedCapacitacao() {
  const senha = process.env.SEED_MEDICO_PASSWORD; // reusa a senha dev dos profissionais
  if (!senha) {
    console.warn("  ! SEED_MEDICO_PASSWORD não definido — pulando seed da Capacitação.");
    return;
  }

  const unidadeCap = await prisma.unidade.findUniqueOrThrow({
    where: { slug: "capacitacao" },
  });

  // 1) Instrutor (sem registro de conselho — não é profissão regulamentada)
  const senhaHash = await hash(senha, 12);
  const instrutorUser = await prisma.user.upsert({
    where: { email: "instrutor@ifp.local" },
    update: { senhaHash, ativo: true },
    create: {
      email: "instrutor@ifp.local",
      senhaHash,
      nome: "Carlos Barbosa",
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: instrutorUser.id, perfil: Perfil.PROFISSIONAL } },
    update: {},
    create: { userId: instrutorUser.id, perfil: Perfil.PROFISSIONAL },
  });
  await prisma.usuarioUnidade.upsert({
    where: { userId_unidadeId: { userId: instrutorUser.id, unidadeId: unidadeCap.id } },
    update: {},
    create: { userId: instrutorUser.id, unidadeId: unidadeCap.id },
  });
  const instrutor = await prisma.profissional.upsert({
    where: { userId: instrutorUser.id },
    update: { ativo: true },
    create: {
      userId: instrutorUser.id,
      unidadeId: unidadeCap.id,
      especialidade: "Barbeiro",
    },
  });
  console.log("  ✓ Instrutor Carlos Barbosa (instrutor@ifp.local)");

  // 2) Curso + turma piloto (presença mínima 80% — regra CapacitaSUAS da pesquisa)
  let curso = await prisma.curso.findFirst({
    where: { unidadeId: unidadeCap.id, nome: "Barbearia Profissional" },
  });
  if (!curso) {
    curso = await prisma.curso.create({
      data: {
        unidadeId: unidadeCap.id,
        nome: "Barbearia Profissional",
        modalidade: ModalidadeCurso.PRATICO,
        cargaHorariaTotal: 80,
        presencaMinimaPct: 80,
        requerModelos: true,
      },
    });
  }
  const inicioTurma = new Date();
  inicioTurma.setDate(inicioTurma.getDate() - 30);
  const turma = await prisma.turma.upsert({
    where: { codigo: "BB-2026-1" },
    update: { status: StatusTurma.EM_ANDAMENTO },
    create: {
      unidadeId: unidadeCap.id,
      cursoId: curso.id,
      codigo: "BB-2026-1",
      profissionalId: instrutor.id,
      diasHorario: "Seg/Qua 14h-17h",
      sala: "Sala 2",
      inicioEm: inicioTurma,
      vagasTotais: 12,
      status: StatusTurma.EM_ANDAMENTO,
    },
  });
  console.log("  ✓ Curso Barbearia Profissional + turma BB-2026-1");

  // 3) Elegibilidade + matrículas das 3 fichas de exemplo
  const fichas = await prisma.fichaCidada.findMany({
    where: { cpf: { in: ["11111111111", "22222222222", "33333333333"] } },
    orderBy: { cpf: "asc" },
  });
  const matriculas = [];
  for (const ficha of fichas) {
    await prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId: ficha.id, unidadeId: unidadeCap.id } },
      update: { status: StatusElegibilidade.APROVADO },
      create: {
        fichaId: ficha.id,
        unidadeId: unidadeCap.id,
        status: StatusElegibilidade.APROVADO,
        motivo: "Seed de desenvolvimento",
      },
    });
    // membroId null não conta no unique composto do Postgres — checa antes de criar
    let mat = await prisma.matricula.findFirst({
      where: { turmaId: turma.id, fichaId: ficha.id, membroId: null },
    });
    if (!mat) {
      mat = await prisma.matricula.create({
        data: {
          unidadeId: unidadeCap.id,
          turmaId: turma.id,
          fichaId: ficha.id,
          status: StatusMatricula.ATIVA,
          criadoPor: instrutorUser.id,
        },
      });
    }
    matriculas.push(mat);
  }
  console.log(`  ✓ ${matriculas.length} matrículas ativas na BB-2026-1`);

  // 4) Duas aulas passadas com chamada lançada e selada
  const aulasDef = [
    { diasAtras: 7, conteudo: "Fundamentos e biossegurança" },
    { diasAtras: 3, conteudo: "Corte na prática" },
  ];
  for (let i = 0; i < aulasDef.length; i++) {
    const def = aulasDef[i];
    const dataAula = new Date();
    dataAula.setDate(dataAula.getDate() - def.diasAtras);
    dataAula.setHours(14, 0, 0, 0);
    let aula = await prisma.aula.findFirst({
      where: { turmaId: turma.id, data: dataAula },
    });
    if (!aula) {
      aula = await prisma.aula.create({
        data: {
          unidadeId: unidadeCap.id,
          turmaId: turma.id,
          data: dataAula,
          conteudo: def.conteudo,
          profissionalId: instrutor.id,
          encerradaEm: new Date(dataAula.getTime() + 3 * 3600 * 1000),
        },
      });
    }
    for (let m = 0; m < matriculas.length; m++) {
      // aula 2: terceiro aluno faltou (alimenta o painel de evasão)
      const status =
        i === 1 && m === 2 ? StatusPresenca.FALTA : StatusPresenca.PRESENTE;
      await prisma.presenca.upsert({
        where: { aulaId_matriculaId: { aulaId: aula.id, matriculaId: matriculas[m].id } },
        update: { status },
        create: { aulaId: aula.id, matriculaId: matriculas[m].id, status },
      });
    }
  }
  console.log("  ✓ 2 aulas com chamada (1 falta na aula 2)");

  // 5) Turma 2 FRESCA (sem aulas) — pra testar o fluxo de chamada do zero na UI
  const inicioTurma2 = new Date();
  inicioTurma2.setDate(inicioTurma2.getDate() - 7);
  const turma2 = await prisma.turma.upsert({
    where: { codigo: "BB-2026-2" },
    update: {},
    create: {
      unidadeId: unidadeCap.id,
      cursoId: curso.id,
      codigo: "BB-2026-2",
      profissionalId: instrutor.id,
      diasHorario: "Ter/Qui 9h-12h",
      sala: "Sala 1",
      inicioEm: inicioTurma2,
      vagasTotais: 12,
      status: StatusTurma.EM_ANDAMENTO,
    },
  });
  for (const ficha of fichas) {
    const ja = await prisma.matricula.findFirst({
      where: { turmaId: turma2.id, fichaId: ficha.id, membroId: null },
    });
    if (!ja) {
      await prisma.matricula.create({
        data: {
          unidadeId: unidadeCap.id,
          turmaId: turma2.id,
          fichaId: ficha.id,
          status: StatusMatricula.ATIVA,
          criadoPor: instrutorUser.id,
        },
      });
    }
  }
  console.log("  ✓ Turma BB-2026-2 fresca (3 matrículas, sem aulas)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
