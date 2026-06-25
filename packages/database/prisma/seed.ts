import { hash } from "bcryptjs";
import {
  EscopoImagem,
  GravidadeAlergia,
  ModalidadeCurso,
  Parentesco,
  Perfil,
  PrioridadeSinal,
  PrioridadeTriagem,
  PrismaClient,
  SentidoCheck,
  SituacaoMoradia,
  StatusAgendamento,
  StatusDiario,
  StatusElegibilidade,
  StatusEncaminhamento,
  StatusEvento,
  StatusMatricula,
  StatusPresenca,
  StatusSinalizacao,
  StatusTriagem,
  StatusTurma,
  TipoRegistroRotina,
  TipoSinalizacao,
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
  await seedEducacional();
  await seedEsportivo();
  await seedUsuariosErick();
  await seedPresidencia();
  await seedDadosPresidencia();
  await seedServicoSocial();
  await seedConquistasFamilia();
}

// ============================================================
// Serviço Social — fila de triagem de exemplo (porta de entrada).
// Reusa as fichas criadas em seedCentroMedico(); idempotente (zera
// as triagens dessas fichas antes de recriar).
// ============================================================
async function seedServicoSocial() {
  const fichas = await prisma.fichaCidada.findMany({
    where: { cpf: { in: ["11111111111", "22222222222", "33333333333"] } },
  });
  const porCpf = new Map(fichas.map((f) => [f.cpf, f]));

  const ids = fichas.map((f) => f.id);
  if (ids.length) {
    await prisma.triagem.deleteMany({ where: { fichaId: { in: ids } } });
  }

  const agora = Date.now();
  const diasAtras = (d: number) => new Date(agora - d * 86_400_000);

  const exemplos = [
    {
      cpf: "22222222222",
      status: StatusTriagem.PENDENTE,
      prioridade: PrioridadeTriagem.URGENTE,
      motivoSolicitacao: "Insegurança alimentar — encaminhada pelo CRAS.",
      criadoEm: diasAtras(2),
    },
    {
      cpf: "11111111111",
      status: StatusTriagem.PENDENTE,
      prioridade: PrioridadeTriagem.ALTA,
      motivoSolicitacao: "Família com criança fora da creche; busca vaga no Centro Educacional.",
      criadoEm: diasAtras(6),
    },
    {
      cpf: "33333333333",
      status: StatusTriagem.EM_ANDAMENTO,
      prioridade: PrioridadeTriagem.MEDIA,
      motivoSolicitacao: "Avaliação de elegibilidade para o Centro de Capacitação.",
      criadoEm: diasAtras(1),
      iniciadaEm: new Date(agora - 3_600_000),
    },
  ];

  let n = 0;
  for (const e of exemplos) {
    const ficha = porCpf.get(e.cpf);
    if (!ficha) continue;
    await prisma.triagem.create({
      data: {
        fichaId: ficha.id,
        status: e.status,
        prioridade: e.prioridade,
        motivoSolicitacao: e.motivoSolicitacao,
        criadoEm: e.criadoEm,
        ...(e.iniciadaEm ? { iniciadaEm: e.iniciadaEm } : {}),
      },
    });
    n++;
  }
  console.log(`  ✓ ${n} triagens de exemplo na fila do Serviço Social`);

  // --- Encaminhamentos + sinalizações de Ponte de exemplo ---
  const unidades = await prisma.unidade.findMany({ select: { id: true, slug: true } });
  const unidPorSlug = new Map(unidades.map((u) => [u.slug, u.id]));
  const joao = porCpf.get("11111111111");
  const maria = porCpf.get("22222222222");
  const pedro = porCpf.get("33333333333");
  const medico = unidPorSlug.get("medico");
  const capacitacao = unidPorSlug.get("capacitacao");
  const esportivo = unidPorSlug.get("esportivo");
  const educacional = unidPorSlug.get("educacional");

  // Idempotência: zera encaminhamentos/sinalizações das fichas de exemplo.
  if (ids.length) {
    await prisma.encaminhamento.deleteMany({ where: { fichaId: { in: ids } } });
    await prisma.sinalizacaoPonte.deleteMany({ where: { fichaId: { in: ids } } });
  }

  if (joao && maria && pedro && medico && capacitacao && esportivo && educacional) {
    await prisma.encaminhamento.createMany({
      data: [
        {
          fichaId: joao.id,
          unidadeOrigemId: medico,
          unidadeDestinoId: capacitacao,
          status: StatusEncaminhamento.PENDENTE,
          prioridade: PrioridadeSinal.NORMAL,
          motivo: "Titular apto a curso de qualificação após alta clínica.",
          criadoEm: diasAtras(3),
        },
        {
          fichaId: maria.id,
          unidadeOrigemId: medico,
          unidadeDestinoId: esportivo,
          status: StatusEncaminhamento.PENDENTE,
          prioridade: PrioridadeSinal.URGENTE,
          motivo: "Atividade física orientada por recomendação médica.",
          criadoEm: diasAtras(1),
        },
        {
          fichaId: pedro.id,
          unidadeOrigemId: medico,
          unidadeDestinoId: educacional,
          status: StatusEncaminhamento.ACEITO,
          prioridade: PrioridadeSinal.NORMAL,
          motivo: "Vaga na creche para neto sob guarda.",
          criadoEm: diasAtras(4),
          respondidoEm: diasAtras(2),
        },
      ],
    });

    await prisma.sinalizacaoPonte.createMany({
      data: [
        {
          fichaId: joao.id,
          unidadeOrigemId: medico,
          tipo: TipoSinalizacao.ALERTA,
          prioridade: PrioridadeSinal.URGENTE,
          descricao: "Paciente com asma e sem acompanhamento — sugere avaliação social.",
          status: StatusSinalizacao.PENDENTE,
          criadoEm: diasAtras(1),
        },
        {
          fichaId: maria.id,
          unidadeOrigemId: educacional,
          tipo: TipoSinalizacao.OBSERVACAO,
          prioridade: PrioridadeSinal.NORMAL,
          descricao: "Família relatou dificuldade de transporte para a unidade.",
          status: StatusSinalizacao.PENDENTE,
          criadoEm: diasAtras(2),
        },
      ],
    });
    console.log("  ✓ 3 encaminhamentos + 2 sinalizações de Ponte de exemplo");
  }
}

// ============================================================
// Usuários pessoais do Erick — um por perfil/unidade, p/ teste
// manual rápido. Senha única em SEED_ERICK_PASSWORD (gitignored).
// ============================================================
async function seedUsuariosErick() {
  const senha = process.env.SEED_ERICK_PASSWORD;
  if (!senha) {
    console.warn("  ! SEED_ERICK_PASSWORD não definido — pulando usuários do Erick.");
    return;
  }
  const senhaHash = await hash(senha, 12);

  // Espelhos dos personas de cada vertical. GESTOR/PROFISSIONAL precisam de
  // Profissional ATIVO lotado na unidade (resolverPorUser exige lotação).
  const personas: Array<{
    email: string;
    nome: string;
    perfil: Perfil;
    unidadeSlug?: string;
    profissional?: { registroConselho?: string; ufConselho?: string; especialidade: string };
  }> = [
    {
      email: "erick.medico@ifp.local",
      nome: "Erick (Médico)",
      perfil: Perfil.PROFISSIONAL,
      unidadeSlug: "medico",
      profissional: {
        registroConselho: "52-99999-9",
        ufConselho: "RJ",
        especialidade: "Clínica Geral",
      },
    },
    {
      email: "erick.capacitacao@ifp.local",
      nome: "Erick (Instrutor)",
      perfil: Perfil.PROFISSIONAL,
      unidadeSlug: "capacitacao",
      profissional: { especialidade: "Instrutor" },
    },
    {
      email: "erick.educacional@ifp.local",
      nome: "Erick (Educador)",
      perfil: Perfil.PROFISSIONAL,
      unidadeSlug: "educacional",
      profissional: { especialidade: "Educador Infantil" },
    },
    {
      email: "erick.gestor@ifp.local",
      nome: "Erick (Gestor)",
      perfil: Perfil.GESTOR_UNIDADE,
      unidadeSlug: "educacional",
      profissional: { especialidade: "Gestão Escolar" },
    },
    {
      email: "erick.esporte@ifp.local",
      nome: "Erick (Sensei)",
      perfil: Perfil.PROFISSIONAL,
      unidadeSlug: "esportivo",
      profissional: { especialidade: "Sensei" },
    },
    {
      email: "erick.social@ifp.local",
      nome: "Erick (Serviço Social)",
      perfil: Perfil.SERVICO_SOCIAL,
    },
    {
      email: "erick.presidencia@ifp.local",
      nome: "Erick (Presidência)",
      perfil: Perfil.PRESIDENCIA, // visão executiva: não precisa de lotação
    },
  ];

  for (const p of personas) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { senhaHash, ativo: true },
      create: { email: p.email, senhaHash, nome: p.nome, ativo: true },
    });
    await prisma.usuarioPerfil.upsert({
      where: { userId_perfil: { userId: user.id, perfil: p.perfil } },
      update: {},
      create: { userId: user.id, perfil: p.perfil },
    });
    if (p.unidadeSlug) {
      const unidade = await prisma.unidade.findUniqueOrThrow({
        where: { slug: p.unidadeSlug },
      });
      await prisma.usuarioUnidade.upsert({
        where: { userId_unidadeId: { userId: user.id, unidadeId: unidade.id } },
        update: {},
        create: { userId: user.id, unidadeId: unidade.id },
      });
      if (p.profissional) {
        await prisma.profissional.upsert({
          where: { userId: user.id },
          update: { ativo: true },
          create: { userId: user.id, unidadeId: unidade.id, ...p.profissional },
        });
      }
    }
    console.log(`  ✓ ${p.nome} (${p.email})`);
  }
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
  const joao = fichas[0];
  if (!joao) throw new Error("Seed: nenhuma ficha criada para o módulo médico.");
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
  for (const [i, h] of horarios.entries()) {
    const fichaDoHorario = fichas[i];
    if (!fichaDoHorario) continue;
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
          fichaId: fichaDoHorario.id,
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
  // Trilha (módulos + ementa) do curso — alimenta a tela de detalhe do curso.
  // Idempotente: só cria se o curso ainda não tiver módulos.
  const temModulos = await prisma.moduloCurso.count({ where: { cursoId: curso.id } });
  if (temModulos === 0) {
    const trilha = [
      {
        nome: "Fundamentos e biossegurança",
        cargaHoraria: 20,
        itens: ["Higiene e esterilização", "Anatomia capilar", "Equipamentos e EPIs"],
      },
      {
        nome: "Cortes masculinos",
        cargaHoraria: 32,
        itens: ["Cortes na tesoura", "Máquina e pente", "Degradê e acabamento"],
      },
      {
        nome: "Barba e atendimento",
        cargaHoraria: 28,
        itens: ["Desenho e modelagem de barba", "Atendimento ao cliente", "Gestão do próprio negócio"],
      },
    ];
    for (const [i, m] of trilha.entries()) {
      await prisma.moduloCurso.create({
        data: {
          cursoId: curso.id,
          ordem: i + 1,
          nome: m.nome,
          cargaHoraria: m.cargaHoraria,
          itens: {
            create: m.itens.map((descricao, j) => ({ ordem: j + 1, descricao })),
          },
        },
      });
    }
    console.log("  ✓ Trilha do curso Barbearia (3 módulos + ementa)");
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

  // Dependente MENOR (15 anos) numa ficha elegível — fixture do consentimento (LGPD).
  const fichaMenor = fichas.find((f) => f.cpf === "11111111111");
  if (fichaMenor) {
    const existe = await prisma.membroFamiliar.findFirst({
      where: { fichaId: fichaMenor.id, nomeCompleto: "Lucas da Silva (menor)" },
    });
    if (!existe) {
      const nasc = new Date();
      nasc.setFullYear(nasc.getFullYear() - 15);
      await prisma.membroFamiliar.create({
        data: {
          fichaId: fichaMenor.id,
          nomeCompleto: "Lucas da Silva (menor)",
          dataNascimento: nasc,
          parentesco: "FILHO",
        },
      });
    }
    console.log("  ✓ Dependente menor Lucas (15) na capacitação — fixture consentimento");
  }

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
  for (const [i, def] of aulasDef.entries()) {
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
    for (const [m, matricula] of matriculas.entries()) {
      // aula 2: terceiro aluno faltou (alimenta o painel de evasão)
      const status =
        i === 1 && m === 2 ? StatusPresenca.FALTA : StatusPresenca.PRESENTE;
      await prisma.presenca.upsert({
        where: { aulaId_matriculaId: { aulaId: aula.id, matriculaId: matricula.id } },
        update: { status },
        create: { aulaId: aula.id, matriculaId: matricula.id, status },
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

// ============================================================
// Educacional / Creche (Fase 3) — educadora, família Sandra+Ana,
// Jardim A, autorizados (1 revogado), autorizações de imagem
// (default negado) e 1 dia completo com diário FECHADO.
// ============================================================
async function seedEducacional() {
  const senha = process.env.SEED_MEDICO_PASSWORD; // reusa a senha dev dos profissionais
  if (!senha) {
    console.warn("  ! SEED_MEDICO_PASSWORD não definido — pulando seed do Educacional.");
    return;
  }

  const unidadeEdu = await prisma.unidade.findUniqueOrThrow({
    where: { slug: "educacional" },
  });

  // 0) Limpa o estado DE HOJE (checks + diário): a regressão valida-educacional
  // faz check-in/out e sela o diário do dia — sem esta limpeza ela só fica
  // verde na primeira execução do dia (re-rodar = falsas falhas de 409).
  // DiarioDia.data é @db.Date (00:00Z do dia CIVIL em São Paulo — ver
  // janelaDoDiaSP). O dia civil precisa vir do fuso do negócio: usar a data
  // UTC (toISOString) vira o dia seguinte a partir das 21h SP e o seed
  // deixaria de apagar o dia corrente (diário fechado/check-ins sobrando).
  const diaSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const hoje = new Date(`${diaSP}T00:00:00.000Z`);
  await prisma.registroRotina.deleteMany({
    where: { diario: { unidadeId: unidadeEdu.id, data: { gte: hoje } } },
  });
  await prisma.diarioDia.deleteMany({
    where: { unidadeId: unidadeEdu.id, data: { gte: hoje } },
  });
  await prisma.checkInOut.deleteMany({
    where: { unidadeId: unidadeEdu.id, ocorridoEm: { gte: hoje } },
  });
  // Mensageria 1:1 família↔instituto: zera as threads da unidade para a
  // regressão (valida-mensagens) começar sempre de contadores limpos.
  // Ordem importa: mensagens referenciam a conversa (FK).
  await prisma.mensagemFamilia.deleteMany({
    where: { conversa: { unidadeId: unidadeEdu.id } },
  });
  await prisma.conversaFamilia.deleteMany({
    where: { unidadeId: unidadeEdu.id },
  });

  // 1) Educadora (PROFISSIONAL lotada na unidade educacional — sem conselho)
  const senhaHash = await hash(senha, 12);
  const educadoraUser = await prisma.user.upsert({
    where: { email: "educadora@ifp.local" },
    update: { senhaHash, ativo: true },
    create: {
      email: "educadora@ifp.local",
      senhaHash,
      nome: "Prof. Carla Mendes",
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: educadoraUser.id, perfil: Perfil.PROFISSIONAL } },
    update: {},
    create: { userId: educadoraUser.id, perfil: Perfil.PROFISSIONAL },
  });
  await prisma.usuarioUnidade.upsert({
    where: { userId_unidadeId: { userId: educadoraUser.id, unidadeId: unidadeEdu.id } },
    update: {},
    create: { userId: educadoraUser.id, unidadeId: unidadeEdu.id },
  });
  const educadora = await prisma.profissional.upsert({
    where: { userId: educadoraUser.id },
    update: { ativo: true },
    create: {
      userId: educadoraUser.id,
      unidadeId: unidadeEdu.id,
      especialidade: "Educadora Infantil",
    },
  });
  console.log("  ✓ Educadora Prof. Carla (educadora@ifp.local)");

  // 1b) Gestora da unidade — publica comunicados e gerencia autorizados/imagem.
  // resolverPorUser exige Profissional ATIVO na unidade mesmo p/ gestão, então
  // a gestora também ganha cadastro de Profissional (lotação administrativa).
  const gestoraUser = await prisma.user.upsert({
    where: { email: "gestora@ifp.local" },
    update: { senhaHash, ativo: true },
    create: {
      email: "gestora@ifp.local",
      senhaHash,
      nome: "Helena Duarte",
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: gestoraUser.id, perfil: Perfil.GESTOR_UNIDADE } },
    update: {},
    create: { userId: gestoraUser.id, perfil: Perfil.GESTOR_UNIDADE },
  });
  await prisma.usuarioUnidade.upsert({
    where: { userId_unidadeId: { userId: gestoraUser.id, unidadeId: unidadeEdu.id } },
    update: {},
    create: { userId: gestoraUser.id, unidadeId: unidadeEdu.id },
  });
  await prisma.profissional.upsert({
    where: { userId: gestoraUser.id },
    update: { ativo: true },
    create: {
      userId: gestoraUser.id,
      unidadeId: unidadeEdu.id,
      especialidade: "Gestão Escolar",
    },
  });
  console.log("  ✓ Gestora Helena (gestora@ifp.local)");

  // 2) Família: Sandra (titular, com login de responsável) + Ana (5 anos)
  const sandra = await prisma.fichaCidada.upsert({
    where: { cpf: "44444444444" },
    update: {},
    create: {
      protocolo: "IFP-2026-900004",
      nomeCompleto: "Sandra Silva",
      cpf: "44444444444",
      dataNascimento: new Date("1994-02-18"),
      telefone: "(21) 99999-0004",
    },
  });
  await prisma.elegibilidadePorUnidade.upsert({
    where: { fichaId_unidadeId: { fichaId: sandra.id, unidadeId: unidadeEdu.id } },
    update: { status: StatusElegibilidade.APROVADO },
    create: {
      fichaId: sandra.id,
      unidadeId: unidadeEdu.id,
      status: StatusElegibilidade.APROVADO,
      motivo: "Seed de desenvolvimento",
    },
  });
  // Portal da família: ownership vem de User.fichaCidadaId (nunca do client)
  const responsavelUser = await prisma.user.upsert({
    where: { email: "familia@ifp.local" },
    update: { senhaHash, ativo: true, fichaCidadaId: sandra.id },
    create: {
      email: "familia@ifp.local",
      senhaHash,
      nome: "Sandra Silva",
      ativo: true,
      fichaCidadaId: sandra.id,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: {
      userId_perfil: { userId: responsavelUser.id, perfil: Perfil.RESPONSAVEL_FAMILIAR },
    },
    update: {},
    create: { userId: responsavelUser.id, perfil: Perfil.RESPONSAVEL_FAMILIAR },
  });

  let ana = await prisma.membroFamiliar.findFirst({
    where: { fichaId: sandra.id, nomeCompleto: "Ana Silva" },
  });
  if (!ana) {
    ana = await prisma.membroFamiliar.create({
      data: {
        fichaId: sandra.id,
        nomeCompleto: "Ana Silva",
        dataNascimento: new Date("2021-04-10"),
        parentesco: Parentesco.FILHA,
      },
    });
  }
  const jaTemAlergiaAna = await prisma.alergia.findFirst({
    where: { membroId: ana.id, descricao: "Amendoim" },
  });
  if (!jaTemAlergiaAna) {
    await prisma.alergia.create({
      data: {
        fichaId: sandra.id,
        membroId: ana.id, // alergia é DA CRIANÇA (membroId já existia no modelo)
        descricao: "Amendoim",
        gravidade: GravidadeAlergia.GRAVE,
      },
    });
  }
  console.log("  ✓ Família Sandra Silva (familia@ifp.local) + Ana, 5 anos (alergia amendoim)");

  // 2b) Criança de OUTRA família, sem matrícula infantil nesta unidade — id
  // fixo para a regressão (valida-mensagens) testar a parede de tenant do
  // POST /educacional/conversas sem precisar de login extra.
  const joao = await prisma.fichaCidada.findUnique({ where: { cpf: "11111111111" } });
  if (joao) {
    await prisma.membroFamiliar.upsert({
      where: { id: "seed-membro-fora-unidade" },
      update: {},
      create: {
        id: "seed-membro-fora-unidade",
        fichaId: joao.id,
        nomeCompleto: "Caio da Silva",
        dataNascimento: new Date("2020-01-15"),
        parentesco: Parentesco.FILHO,
      },
    });
    console.log("  ✓ Caio da Silva (criança fora da unidade — fixture de tenant)");
  }

  // 3) Turma Jardim A + matrícula da Ana (consentimento Art. 14 na matrícula)
  let turmaInf = await prisma.turmaInfantil.findFirst({
    where: { unidadeId: unidadeEdu.id, nome: "Jardim A" },
  });
  if (!turmaInf) {
    turmaInf = await prisma.turmaInfantil.create({
      data: {
        unidadeId: unidadeEdu.id,
        nome: "Jardim A",
        faixaEtariaMin: 48,
        faixaEtariaMax: 72,
        capacidade: 15,
        profissionalId: educadora.id,
      },
    });
  }
  await prisma.matriculaInfantil.upsert({
    where: { turmaId_membroId: { turmaId: turmaInf.id, membroId: ana.id } },
    update: { ativa: true },
    create: {
      unidadeId: unidadeEdu.id,
      turmaId: turmaInf.id,
      fichaId: sandra.id,
      membroId: ana.id,
      consentimentoLgpdEm: new Date(),
      criadoPor: educadoraUser.id,
    },
  });

  // 3b) SEGUNDA família na MESMA turma — fixture do IDOR família-vs-família das
  // fotos do diário (C3): a educadora sobe foto do Caio (filho do João),
  // e a Sandra (mãe da Ana) NÃO pode ver/baixar a foto do Caio. Caio já existe
  // (seed-membro-fora-unidade, ficha do João); aqui matriculamos ele na turma e
  // criamos a conta do responsável dele (familia2@ifp.local → ficha do João).
  if (joao) {
    await prisma.matriculaInfantil.upsert({
      where: {
        turmaId_membroId: { turmaId: turmaInf.id, membroId: "seed-membro-fora-unidade" },
      },
      update: { ativa: true },
      create: {
        unidadeId: unidadeEdu.id,
        turmaId: turmaInf.id,
        fichaId: joao.id,
        membroId: "seed-membro-fora-unidade",
        consentimentoLgpdEm: new Date(),
        criadoPor: educadoraUser.id,
      },
    });

    const responsavel2User = await prisma.user.upsert({
      where: { email: "familia2@ifp.local" },
      update: { senhaHash, ativo: true, fichaCidadaId: joao.id },
      create: {
        email: "familia2@ifp.local",
        senhaHash,
        nome: "Beatriz da Silva",
        ativo: true,
        fichaCidadaId: joao.id,
      },
    });
    await prisma.usuarioPerfil.upsert({
      where: {
        userId_perfil: {
          userId: responsavel2User.id,
          perfil: Perfil.RESPONSAVEL_FAMILIAR,
        },
      },
      update: {},
      create: { userId: responsavel2User.id, perfil: Perfil.RESPONSAVEL_FAMILIAR },
    });
    console.log("  ✓ Família 2 Beatriz (familia2@ifp.local) + Caio na turma (fixture IDOR fotos)");
  }

  // 4) Autorizações de imagem — default NEGADO; só uso interno concedido
  const escopos: Array<{ escopo: EscopoImagem; concedido: boolean }> = [
    { escopo: EscopoImagem.USO_INTERNO, concedido: true },
    { escopo: EscopoImagem.REDES_IFP, concedido: false },
    { escopo: EscopoImagem.IMPRENSA, concedido: false },
  ];
  for (const { escopo, concedido } of escopos) {
    await prisma.autorizacaoImagem.upsert({
      where: {
        membroId_escopo_versaoTermo: {
          membroId: ana.id,
          escopo,
          versaoTermo: "v1-2026",
        },
      },
      update: { concedido },
      create: {
        fichaId: sandra.id,
        membroId: ana.id,
        escopo,
        concedido,
        versaoTermo: "v1-2026",
        criadoPor: educadoraUser.id,
      },
    });
  }

  // 5) Responsáveis autorizados: mãe, avó (com foto) e tio REVOGADO (testa bloqueio)
  const autorizadosDef = [
    {
      nome: "Sandra Silva",
      documento: "RG 11.111.111-1",
      parentesco: "mãe",
      fotoUrl: null as string | null,
      revogado: false,
    },
    {
      nome: "Maria das Graças",
      documento: "RG 22.222.222-2",
      parentesco: "avó",
      fotoUrl: "https://i.pravatar.cc/96?u=avo-ana",
      revogado: false,
    },
    {
      nome: "Roberto Silva",
      documento: "RG 33.333.333-3",
      parentesco: "tio",
      fotoUrl: null as string | null,
      revogado: true,
    },
  ];
  const autorizadosPorNome = new Map<string, { id: string }>();
  for (const def of autorizadosDef) {
    let aut = await prisma.responsavelAutorizado.findFirst({
      where: { membroId: ana.id, nome: def.nome },
    });
    if (!aut) {
      aut = await prisma.responsavelAutorizado.create({
        data: {
          fichaId: sandra.id,
          membroId: ana.id,
          nome: def.nome,
          documento: def.documento,
          parentesco: def.parentesco,
          fotoUrl: def.fotoUrl,
          revogadoEm: def.revogado ? new Date() : null,
          revogadoPor: def.revogado ? educadoraUser.id : null,
          criadoPor: educadoraUser.id,
        },
      });
    }
    autorizadosPorNome.set(def.nome, aut);
  }
  console.log("  ✓ Jardim A + matrícula da Ana + 3 autorizados (1 revogado)");

  // 6) Dia completo de ONTEM: check-in pela mãe, 3 registros, saída pela avó,
  //    diário FECHADO (visível no portal da família)
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataDiario = new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(ontem)}T00:00:00.000Z`,
  );
  const mae = autorizadosPorNome.get("Sandra Silva");
  const avo = autorizadosPorNome.get("Maria das Graças");
  if (!mae || !avo) throw new Error("Seed: responsáveis autorizados não criados.");

  const diarioExistente = await prisma.diarioDia.findUnique({
    where: { membroId_data: { membroId: ana.id, data: dataDiario } },
  });
  if (!diarioExistente) {
    const ts = (h: number, m: number) => {
      const d = new Date(ontem);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const diario = await prisma.diarioDia.create({
      data: {
        unidadeId: unidadeEdu.id,
        membroId: ana.id,
        data: dataDiario,
        status: StatusDiario.FECHADO,
        fechadoEm: ts(17, 30),
        profissionalId: educadora.id,
      },
    });
    await prisma.registroRotina.createMany({
      data: [
        {
          diarioId: diario.id,
          tipo: TipoRegistroRotina.ALIMENTACAO,
          descricao: "Café da manhã: aceitou bem",
          ocorridoEm: ts(8, 30),
          profissionalId: educadora.id,
        },
        {
          diarioId: diario.id,
          tipo: TipoRegistroRotina.SONO,
          descricao: "Sono 12h30–14h00",
          ocorridoEm: ts(14, 0),
          profissionalId: educadora.id,
        },
        {
          diarioId: diario.id,
          tipo: TipoRegistroRotina.ATIVIDADE,
          descricao: "Pintura com guache — participou animada",
          ocorridoEm: ts(15, 30),
          profissionalId: educadora.id,
        },
      ],
    });
    await prisma.checkInOut.createMany({
      data: [
        {
          unidadeId: unidadeEdu.id,
          membroId: ana.id,
          sentido: SentidoCheck.ENTRADA,
          ocorridoEm: ts(7, 45),
          autorizadoId: mae.id,
          profissionalId: educadora.id,
        },
        {
          unidadeId: unidadeEdu.id,
          membroId: ana.id,
          sentido: SentidoCheck.SAIDA,
          ocorridoEm: ts(17, 10),
          autorizadoId: avo.id,
          profissionalId: educadora.id,
        },
      ],
    });
    console.log("  ✓ Dia de ontem completo (check-in/out + 3 registros + diário FECHADO)");
  }

  // 7) Comunicado crítico sem leitura (pendência no painel da gestora)
  const jaTemComunicado = await prisma.comunicado.findFirst({
    where: { unidadeId: unidadeEdu.id, titulo: "Reunião de responsáveis — Jardim A" },
  });
  if (!jaTemComunicado) {
    await prisma.comunicado.create({
      data: {
        unidadeId: unidadeEdu.id,
        turmaId: turmaInf.id,
        titulo: "Reunião de responsáveis — Jardim A",
        corpo:
          "Reunião na próxima sexta-feira às 17h30 para apresentação do projeto pedagógico do semestre. A presença de ao menos um responsável é importante.",
        critico: true,
        enviadoPor: educadoraUser.id,
      },
    });
    console.log("  ✓ Comunicado crítico sem leitura");
  }

  // 8) Agenda da família (U6): eventos do calendário + confirmação de presença.
  // IDs fixos para a regressão (valida-familia) bater sem depender de busca.
  // Zera o estado de presença do dia (igual ao diário): a regressão grava o
  // "vem amanhã?" — sem limpar, re-rodar deixaria respostas penduradas.
  await prisma.presencaCreche.deleteMany({ where: { membroId: ana.id } });
  await prisma.confirmacaoEvento.deleteMany({
    where: { evento: { unidadeId: unidadeEdu.id } },
  });

  // Datas no futuro (independem do dia da execução) — calendário sempre cheio.
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const proxSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // 8a) Evento da turma Jardim A que PEDE confirmação (RSVP) — fixture central.
  await prisma.eventoUnidade.upsert({
    where: { id: "seed-evento-festa-junina" },
    update: {
      inicioEm: proxSemana,
      status: StatusEvento.AGENDADO,
      pedeConfirmacao: true,
    },
    create: {
      id: "seed-evento-festa-junina",
      unidadeId: unidadeEdu.id,
      turmaId: turmaInf.id,
      titulo: "Festa Junina — Jardim A",
      descricao: "Comidas típicas e quadrilha. Tragam um prato para compartilhar!",
      local: "Pátio do Centro Educacional",
      inicioEm: proxSemana,
      pedeConfirmacao: true,
      criadoPor: educadoraUser.id,
    },
  });

  // 8b) Evento GERAL da unidade, sem RSVP (aparece na agenda, não pede resposta).
  await prisma.eventoUnidade.upsert({
    where: { id: "seed-evento-reuniao-geral" },
    update: { inicioEm: amanha, status: StatusEvento.AGENDADO, pedeConfirmacao: false },
    create: {
      id: "seed-evento-reuniao-geral",
      unidadeId: unidadeEdu.id,
      turmaId: null,
      titulo: "Reunião geral de pais e responsáveis",
      descricao: "Apresentação do calendário do semestre.",
      local: "Auditório",
      inicioEm: amanha,
      pedeConfirmacao: false,
      criadoPor: educadoraUser.id,
    },
  });

  // 8c) Fixture IDOR: evento de OUTRA unidade (capacitação) — a Ana NÃO tem
  // matrícula infantil lá. A família NÃO deve ver na agenda nem conseguir
  // confirmar (POST → 404). Só cria se a unidade de capacitação existir.
  const unidadeCap = await prisma.unidade.findUnique({ where: { slug: "capacitacao" } });
  if (unidadeCap) {
    await prisma.eventoUnidade.upsert({
      where: { id: "seed-evento-outra-unidade" },
      update: { inicioEm: proxSemana, status: StatusEvento.AGENDADO, pedeConfirmacao: true },
      create: {
        id: "seed-evento-outra-unidade",
        unidadeId: unidadeCap.id,
        turmaId: null,
        titulo: "Mostra de cursos — Capacitação",
        descricao: "Evento de outra unidade (fixture IDOR do portal da família).",
        local: "Centro de Capacitação",
        inicioEm: proxSemana,
        pedeConfirmacao: true,
      },
    });
  }
  console.log("  ✓ Agenda da família: 2 eventos visíveis + 1 de outra unidade (IDOR)");
}

// ============================================================
// Presidência — usuário da Sala de Comando (perfil PRESIDENCIA,
// sem lotação) + enriquecimento dos dados agregados do painel.
// ============================================================
async function seedPresidencia() {
  const senha = process.env.SEED_MEDICO_PASSWORD; // reusa a senha dev compartilhada
  if (!senha) {
    console.warn("  ! SEED_MEDICO_PASSWORD não definido — pulando usuário da Presidência.");
    return;
  }
  const senhaHash = await hash(senha, 12);
  const user = await prisma.user.upsert({
    where: { email: "presidencia@ifp.local" },
    update: { senhaHash, ativo: true },
    create: { email: "presidencia@ifp.local", senhaHash, nome: "Presidência IFP", ativo: true },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: user.id, perfil: Perfil.PRESIDENCIA } },
    update: {},
    create: { userId: user.id, perfil: Perfil.PRESIDENCIA },
  });
  console.log("  ✓ Presidência (presidencia@ifp.local)");
}

/**
 * Enriquece as fichas de exemplo com bairro, dados socioeconômicos e mais
 * membros — para o painel da Presidência (Famílias/faixa etária) mostrar
 * números reais em vez de telas vazias. Tudo idempotente.
 */
async function seedDadosPresidencia() {
  const enriquecer: Array<{
    cpf: string;
    bairro: string;
    socio: {
      rendaFamiliarTotal: number;
      rendaPerCapita: number;
      recebeBolsaFamilia: boolean;
      recebeBPC: boolean;
      situacaoMoradia: SituacaoMoradia;
      numeroPessoasMoradia: number;
    };
  }> = [
    {
      cpf: "11111111111", // João
      bairro: "Jardim Gramacho",
      socio: {
        rendaFamiliarTotal: 1200,
        rendaPerCapita: 300,
        recebeBolsaFamilia: true,
        recebeBPC: false,
        situacaoMoradia: SituacaoMoradia.ALUGADA,
        numeroPessoasMoradia: 4,
      },
    },
    {
      cpf: "22222222222", // Maria
      bairro: "Centro",
      socio: {
        rendaFamiliarTotal: 2000,
        rendaPerCapita: 500,
        recebeBolsaFamilia: false,
        recebeBPC: false,
        situacaoMoradia: SituacaoMoradia.PROPRIA,
        numeroPessoasMoradia: 4,
      },
    },
    {
      cpf: "33333333333", // Pedro
      bairro: "Vila São Luís",
      socio: {
        rendaFamiliarTotal: 900,
        rendaPerCapita: 450,
        recebeBolsaFamilia: true,
        recebeBPC: false,
        situacaoMoradia: SituacaoMoradia.CEDIDA,
        numeroPessoasMoradia: 2,
      },
    },
    {
      cpf: "44444444444", // Sandra
      bairro: "Parque Lafaiete",
      socio: {
        rendaFamiliarTotal: 1500,
        rendaPerCapita: 500,
        recebeBolsaFamilia: true,
        recebeBPC: false,
        situacaoMoradia: SituacaoMoradia.ALUGADA,
        numeroPessoasMoradia: 3,
      },
    },
  ];

  for (const e of enriquecer) {
    const ficha = await prisma.fichaCidada.findUnique({ where: { cpf: e.cpf } });
    if (!ficha) continue;
    await prisma.fichaCidada.update({ where: { id: ficha.id }, data: { bairro: e.bairro } });
    await prisma.dadosSocioeconomicos.upsert({
      where: { fichaId: ficha.id },
      update: e.socio,
      create: { fichaId: ficha.id, ...e.socio },
    });
  }

  // Membros extras → variedade de faixa etária no painel
  await garantirMembro("22222222222", "Lucas Oliveira", new Date("2015-05-20"), Parentesco.FILHO);
  await garantirMembro("33333333333", "Beatriz Santos", new Date("2008-09-12"), Parentesco.FILHA);
  console.log("  ✓ Dados de presidência (bairros, socioeconômicos, membros)");
}

async function garantirMembro(
  cpf: string,
  nomeCompleto: string,
  dataNascimento: Date,
  parentesco: Parentesco,
) {
  const ficha = await prisma.fichaCidada.findUnique({ where: { cpf } });
  if (!ficha) return;
  const ja = await prisma.membroFamiliar.findFirst({
    where: { fichaId: ficha.id, nomeCompleto },
  });
  if (!ja) {
    await prisma.membroFamiliar.create({
      data: { fichaId: ficha.id, nomeCompleto, dataNascimento, parentesco },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// ============================================================
// Esportivo (Fase 3) — molde: trio da Capacitação
// ============================================================
async function seedEsportivo() {
  const senha = process.env.SEED_MEDICO_PASSWORD; // reusa a senha dev dos profissionais
  if (!senha) {
    console.warn("  ! SEED_MEDICO_PASSWORD não definido — pulando seed do Esportivo.");
    return;
  }

  const unidadeEsp = await prisma.unidade.findUniqueOrThrow({
    where: { slug: "esportivo" },
  });

  // 1) Sensei (sem registro de conselho)
  const senhaHash = await hash(senha, 12);
  const senseiUser = await prisma.user.upsert({
    where: { email: "esporte@ifp.local" },
    update: { senhaHash, ativo: true },
    create: {
      email: "esporte@ifp.local",
      senhaHash,
      nome: "Ricardo Tanaka",
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.upsert({
    where: { userId_perfil: { userId: senseiUser.id, perfil: Perfil.PROFISSIONAL } },
    update: {},
    create: { userId: senseiUser.id, perfil: Perfil.PROFISSIONAL },
  });
  await prisma.usuarioUnidade.upsert({
    where: { userId_unidadeId: { userId: senseiUser.id, unidadeId: unidadeEsp.id } },
    update: {},
    create: { userId: senseiUser.id, unidadeId: unidadeEsp.id },
  });
  await prisma.profissional.upsert({
    where: { userId: senseiUser.id },
    update: { ativo: true },
    create: {
      userId: senseiUser.id,
      unidadeId: unidadeEsp.id,
      especialidade: "Sensei de Judô",
    },
  });
  console.log("  ✓ Sensei Ricardo Tanaka (esporte@ifp.local)");

  // 2) Modalidades: Judô com trilha de faixas infantil; Futsal sem trilha
  //    (demonstra a validação de "nível fora da trilha")
  const trilhaJudo = [
    "Faixa Branca",
    "Faixa Cinza",
    "Faixa Azul",
    "Faixa Amarela",
    "Faixa Laranja",
    "Faixa Verde",
  ];
  await prisma.modalidade.upsert({
    where: { unidadeId_nome: { unidadeId: unidadeEsp.id, nome: "Judô" } },
    update: { trilhaGraduacoes: trilhaJudo, ativo: true },
    create: { unidadeId: unidadeEsp.id, nome: "Judô", trilhaGraduacoes: trilhaJudo },
  });
  await prisma.modalidade.upsert({
    where: { unidadeId_nome: { unidadeId: unidadeEsp.id, nome: "Futsal" } },
    update: { ativo: true },
    create: { unidadeId: unidadeEsp.id, nome: "Futsal", trilhaGraduacoes: [] },
  });
  console.log("  ✓ Modalidades Judô (6 faixas) e Futsal");

  // 3) Elegibilidade APROVADA no Esportivo para 2 fichas de exemplo
  const fichas = await prisma.fichaCidada.findMany({
    where: { cpf: { in: ["11111111111", "22222222222"] } },
  });
  for (const ficha of fichas) {
    await prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId: ficha.id, unidadeId: unidadeEsp.id } },
      update: { status: StatusElegibilidade.APROVADO },
      create: {
        fichaId: ficha.id,
        unidadeId: unidadeEsp.id,
        status: StatusElegibilidade.APROVADO,
        motivo: "Seed de desenvolvimento",
      },
    });
  }
  console.log(`  ✓ ${fichas.length} fichas APROVADAS no Esportivo`);
}

// ============================================================
// Conquistas da família Sandra (fixture do portal "recebido" + certificados):
// 1 certificado de capacitação (titular Sandra) e 1 graduação esportiva (Ana).
// Idempotente; depende de seedCapacitacao/seedEducacional/seedEsportivo.
// ============================================================
async function seedConquistasFamilia() {
  const senha = process.env.SEED_MEDICO_PASSWORD; // mesma senha dev dos profissionais
  if (!senha) {
    console.warn("  ! SEED_MEDICO_PASSWORD não definido — pulando conquistas da família.");
    return;
  }

  // A ficha da Sandra (titular do login familia@ifp.local) e a Ana (dependente).
  const sandra = await prisma.fichaCidada.findUnique({ where: { cpf: "44444444444" } });
  if (!sandra) {
    console.warn("  ! Ficha da Sandra não encontrada — pulando conquistas da família.");
    return;
  }
  const ana = await prisma.membroFamiliar.findFirst({
    where: { fichaId: sandra.id, nomeCompleto: "Ana Silva" },
  });

  // ── 1) Certificado de capacitação para a Sandra (titular) ──────────────
  const unidadeCap = await prisma.unidade.findUniqueOrThrow({ where: { slug: "capacitacao" } });
  const instrutor = await prisma.profissional.findFirst({
    where: { unidadeId: unidadeCap.id },
  });
  const turmaCap = await prisma.turma.findUnique({ where: { codigo: "BB-2026-1" } });
  if (instrutor && turmaCap) {
    // Elegibilidade aprovada na capacitação (pré-requisito da matrícula).
    await prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId: sandra.id, unidadeId: unidadeCap.id } },
      update: { status: StatusElegibilidade.APROVADO },
      create: {
        fichaId: sandra.id,
        unidadeId: unidadeCap.id,
        status: StatusElegibilidade.APROVADO,
        motivo: "Seed — conquistas da família",
      },
    });
    let matCap = await prisma.matricula.findFirst({
      where: { turmaId: turmaCap.id, fichaId: sandra.id, membroId: null },
    });
    if (!matCap) {
      matCap = await prisma.matricula.create({
        data: {
          unidadeId: unidadeCap.id,
          turmaId: turmaCap.id,
          fichaId: sandra.id,
          status: StatusMatricula.CONCLUIDA,
          criadoPor: instrutor.userId,
        },
      });
    }
    // Certificado com código FIXO → o teste de aceite acha sem adivinhar.
    await prisma.certificado.upsert({
      where: { matriculaId: matCap.id },
      update: {},
      create: {
        unidadeId: unidadeCap.id,
        matriculaId: matCap.id,
        codigoVerificacao: "seed-cert-sandra",
        cargaHorariaCumprida: 40,
        presencaPct: 92.5,
      },
    });
    console.log("  ✓ Certificado de capacitação da Sandra (cód. seed-cert-sandra)");

    // Certificado de OUTRA família (João/11111111111) — fixture do teste de IDOR:
    // o portal da Sandra deve dar 404 ao tentar baixar este PDF.
    const joao = await prisma.fichaCidada.findUnique({ where: { cpf: "11111111111" } });
    const matJoao = joao
      ? await prisma.matricula.findFirst({
          where: { turmaId: turmaCap.id, fichaId: joao.id, membroId: null },
        })
      : null;
    if (matJoao) {
      await prisma.certificado.upsert({
        where: { matriculaId: matJoao.id },
        update: {},
        create: {
          unidadeId: unidadeCap.id,
          matriculaId: matJoao.id,
          codigoVerificacao: "seed-cert-outra-familia",
          cargaHorariaCumprida: 40,
          presencaPct: 88.0,
        },
      });
      console.log("  ✓ Certificado de outra família (cód. seed-cert-outra-familia — fixture IDOR)");
    }
  }

  // ── 2) Graduação esportiva para a Ana (dependente) ─────────────────────
  const unidadeEsp = await prisma.unidade.findUniqueOrThrow({ where: { slug: "esportivo" } });
  const sensei = await prisma.profissional.findFirst({
    where: { unidadeId: unidadeEsp.id },
  });
  const judo = await prisma.modalidade.findFirst({
    where: { unidadeId: unidadeEsp.id, nome: "Judô" },
  });
  if (ana && sensei && judo) {
    const turmaEsp = await prisma.turmaEsportiva.upsert({
      where: { codigo: "JUDO-FAM-2026" },
      update: {},
      create: {
        unidadeId: unidadeEsp.id,
        modalidadeId: judo.id,
        codigo: "JUDO-FAM-2026",
        profissionalId: sensei.id,
        diasHorario: "Ter/Qui 9h-10h30",
        local: "Tatame 1",
        faixaEtariaMin: 4,
        faixaEtariaMax: 12,
        inicioEm: new Date("2026-02-01"),
        vagasTotais: 20,
      },
    });
    let matEsp = await prisma.matriculaEsportiva.findFirst({
      where: { turmaId: turmaEsp.id, fichaId: sandra.id, membroId: ana.id },
    });
    if (!matEsp) {
      matEsp = await prisma.matriculaEsportiva.create({
        data: {
          unidadeId: unidadeEsp.id,
          turmaId: turmaEsp.id,
          fichaId: sandra.id,
          membroId: ana.id,
          status: StatusMatricula.ATIVA,
          criadoPor: sensei.userId,
        },
      });
    }
    await prisma.graduacao.upsert({
      where: { matriculaId_nivel: { matriculaId: matEsp.id, nivel: "Faixa Branca" } },
      update: {},
      create: {
        unidadeId: unidadeEsp.id,
        matriculaId: matEsp.id,
        nivel: "Faixa Branca",
        codigoVerificacao: "seed-grad-ana",
        observacao: "Primeira graduação — fixture do portal da família",
        concedidaPor: sensei.userId,
      },
    });
    console.log("  ✓ Graduação esportiva da Ana (cód. seed-grad-ana)");

    // ── 3) Graduação de OUTRA família (João/11111111111) — fixture IDOR do
    //       diploma esportivo: o portal da Sandra deve dar 404 ao baixar este PDF.
    const joao = await prisma.fichaCidada.findUnique({ where: { cpf: "11111111111" } });
    if (joao) {
      let matJoaoEsp = await prisma.matriculaEsportiva.findFirst({
        where: { turmaId: turmaEsp.id, fichaId: joao.id, membroId: null },
      });
      if (!matJoaoEsp) {
        matJoaoEsp = await prisma.matriculaEsportiva.create({
          data: {
            unidadeId: unidadeEsp.id,
            turmaId: turmaEsp.id,
            fichaId: joao.id,
            status: StatusMatricula.ATIVA,
            criadoPor: sensei.userId,
          },
        });
      }
      await prisma.graduacao.upsert({
        where: { matriculaId_nivel: { matriculaId: matJoaoEsp.id, nivel: "Faixa Branca" } },
        update: {},
        create: {
          unidadeId: unidadeEsp.id,
          matriculaId: matJoaoEsp.id,
          nivel: "Faixa Branca",
          codigoVerificacao: "seed-grad-outra-familia",
          observacao: "Graduação de outra família — fixture IDOR do portal",
          concedidaPor: sensei.userId,
        },
      });
      console.log("  ✓ Graduação de outra família (cód. seed-grad-outra-familia — fixture IDOR)");
    }
  }
}
