// TODO operacional pós-deploy: criar user real para Sarah Pôncio com role presidencia. Spec 2026-05-28 §7 (decisões deferidas).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GLOBAL_ROLES, ROLE_DESCRIPTIONS, ROLE_NAMES } from "../src/lib/rbac-types";
import type { RoleName, UnitScope } from "../src/lib/rbac-types";
import { seedCidadaos } from "./seed-cidadaos";

const db = new PrismaClient();

interface UserRoleSpec {
  roleName: RoleName;
  unitScope: UnitScope | null;
}

interface DemoUserSpec {
  email: string;
  name: string;
  password: string;
  primaryRoleName: RoleName;
  primaryUnitScope: UnitScope | null;
  roles: UserRoleSpec[];
}

const DEMO_PASSWORD = "ifp-demo-2026";
const ERICK_PASSWORD = "ifp-dev-2026";

const DEMO_USERS: DemoUserSpec[] = [
  {
    email: "raquel.barros@familiaponcio.org.br",
    name: "Raquel Barros",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "medico",
    roles: [{ roleName: "gestor_unidade", unitScope: "medico" }],
  },
  {
    email: "luciana@familiaponcio.org.br",
    name: "Luciana",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "capacitacao",
    roles: [{ roleName: "gestor_unidade", unitScope: "capacitacao" }],
  },
  {
    email: "livia@familiaponcio.org.br",
    name: "Livia",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "esportivo",
    roles: [{ roleName: "gestor_unidade", unitScope: "esportivo" }],
  },
  {
    email: "danielle@familiaponcio.org.br",
    name: "Danielle",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "recreativo",
    roles: [{ roleName: "gestor_unidade", unitScope: "recreativo" }],
  },
  {
    email: "regina@familiaponcio.org.br",
    name: "Regina",
    password: DEMO_PASSWORD,
    primaryRoleName: "social",
    primaryUnitScope: null,
    roles: [{ roleName: "social", unitScope: null }],
  },
  {
    email: "maria.callcenter@familiaponcio.org.br",
    name: "Maria Silva",
    password: DEMO_PASSWORD,
    primaryRoleName: "recepcao",
    primaryUnitScope: "medico",
    roles: [{ roleName: "recepcao", unitScope: "medico" }],
  },
  {
    email: "saulo@familiaponcio.org.br",
    name: "Saulo Pôncios",
    password: DEMO_PASSWORD,
    primaryRoleName: "presidencia",
    primaryUnitScope: null,
    roles: [{ roleName: "presidencia", unitScope: null }],
  },
  {
    email: "simone@familiaponcio.org.br",
    name: "Simone Pôncios",
    password: DEMO_PASSWORD,
    primaryRoleName: "presidencia",
    primaryUnitScope: null,
    roles: [{ roleName: "presidencia", unitScope: null }],
  },
];

async function seedRoles() {
  for (const name of ROLE_NAMES) {
    await db.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name] },
      create: {
        name,
        description: ROLE_DESCRIPTIONS[name],
        scope: GLOBAL_ROLES.includes(name) ? "global" : "unit",
      },
    });
  }
  console.log(`Seeded ${ROLE_NAMES.length} roles`);
}

async function ensureUserRole(userId: string, roleName: RoleName, unitScope: UnitScope | null) {
  const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
  const existing = await db.userRole.findFirst({
    where: { userId, roleId: role.id, unitScope },
  });
  if (!existing) {
    await db.userRole.create({
      data: { userId, roleId: role.id, unitScope },
    });
  }
}

async function seedUser(spec: {
  email: string;
  name: string;
  password: string;
  primaryRoleName: RoleName;
  primaryUnitScope: UnitScope | null;
  roles: UserRoleSpec[];
}) {
  const hashedPassword = await bcrypt.hash(spec.password, 12);
  const user = await db.user.upsert({
    where: { email: spec.email },
    update: {
      name: spec.name,
      primaryRoleName: spec.primaryRoleName,
      primaryUnitScope: spec.primaryUnitScope,
    },
    create: {
      email: spec.email,
      name: spec.name,
      hashedPassword,
      primaryRoleName: spec.primaryRoleName,
      primaryUnitScope: spec.primaryUnitScope,
    },
  });
  for (const r of spec.roles) {
    await ensureUserRole(user.id, r.roleName, r.unitScope);
  }
  return user;
}

// ============================================================================
// F1.B.1 — Centro Médico: especialidades + profissionais demo + slots
// ============================================================================

const ESPECIALIDADES_SEED = [
  { nome: "Clínico Geral", duracaoPadraoMin: 30, corDestaque: "#007571" }, // teal escuro
  { nome: "Enfermagem", duracaoPadraoMin: 20, corDestaque: "#10C2BB" }, // teal claro
  { nome: "Pediatria", duracaoPadraoMin: 30, corDestaque: "#FF772E" }, // laranja vibrante
  { nome: "Ginecologia", duracaoPadraoMin: 40, corDestaque: "#C24D0F" }, // laranja escuro
  { nome: "Odontologia", duracaoPadraoMin: 45, corDestaque: "#752C05" }, // marrom
  { nome: "Psicologia", duracaoPadraoMin: 50, corDestaque: "#6B6B6B" }, // muted
  { nome: "Fisioterapia", duracaoPadraoMin: 45, corDestaque: "#4A4A49" }, // ink
  { nome: "Fonoaudiologia", duracaoPadraoMin: 45, corDestaque: "#007571" },
  { nome: "Endocrinologia", duracaoPadraoMin: 30, corDestaque: "#10C2BB" },
  { nome: "Neurologia", duracaoPadraoMin: 30, corDestaque: "#752C05" },
] as const;

const PROFISSIONAIS_DEMO = [
  {
    email: "dr.joao@familiaponcio.org.br",
    nomeExibicao: "Dr. João Silva",
    conselho: "CRM-RJ",
    nroConselho: "12345",
    especialidades: ["Clínico Geral", "Pediatria"],
  },
  {
    email: "dra.maria@familiaponcio.org.br",
    nomeExibicao: "Dra. Maria Souza",
    conselho: "CRM-RJ",
    nroConselho: "67890",
    especialidades: ["Ginecologia"],
  },
  {
    email: "psi.ana@familiaponcio.org.br",
    nomeExibicao: "Psic. Ana Lima",
    conselho: "CRP-RJ",
    nroConselho: "00123",
    especialidades: ["Psicologia"],
  },
] as const;

// Helpers de data inline (sem dependência nova; mesma lógica do lib/medico/agenda.ts)
function addDaysSeed(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMinutesSeed(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}
function startOfDaySeed(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function seedMedico() {
  // Idempotente: upserts em tudo. Se já existe, atualiza; se não, cria.

  // 1. Especialidades canônicas
  const especialidadeByNome = new Map<string, string>();
  for (const esp of ESPECIALIDADES_SEED) {
    const e = await db.especialidade.upsert({
      where: { nome: esp.nome },
      update: { duracaoPadraoMin: esp.duracaoPadraoMin, corDestaque: esp.corDestaque, ativa: true },
      create: {
        nome: esp.nome,
        duracaoPadraoMin: esp.duracaoPadraoMin,
        corDestaque: esp.corDestaque,
        ativa: true,
      },
    });
    especialidadeByNome.set(esp.nome, e.id);
  }

  // 2. Profissionais demo: cria User (via seedUser) + role profissional:medico + Profissional
  for (const p of PROFISSIONAIS_DEMO) {
    const user = await seedUser({
      email: p.email,
      name: p.nomeExibicao,
      password: DEMO_PASSWORD,
      primaryRoleName: "profissional",
      primaryUnitScope: "medico",
      roles: [{ roleName: "profissional", unitScope: "medico" }],
    });

    const prof = await db.profissional.upsert({
      where: { userId: user.id },
      update: {
        nomeExibicao: p.nomeExibicao,
        conselho: p.conselho,
        nroConselho: p.nroConselho,
        ativo: true,
      },
      create: {
        userId: user.id,
        nomeExibicao: p.nomeExibicao,
        conselho: p.conselho,
        nroConselho: p.nroConselho,
        ativo: true,
      },
    });

    // Especialidades many-to-many
    for (const espNome of p.especialidades) {
      const espId = especialidadeByNome.get(espNome);
      if (!espId) continue;
      await db.profissionalEspecialidade.upsert({
        where: {
          profissionalId_especialidadeId: { profissionalId: prof.id, especialidadeId: espId },
        },
        update: {},
        create: { profissionalId: prof.id, especialidadeId: espId },
      });
    }

    // Template padrão: terças e quintas, 14h-18h, duração da especialidade principal
    const espPrincipalNome = p.especialidades[0];
    const espPrincipalId = especialidadeByNome.get(espPrincipalNome)!;
    const espPrincipal = ESPECIALIDADES_SEED.find((e) => e.nome === espPrincipalNome)!;
    const validoDe = startOfDaySeed(new Date());
    const validoAte = addDaysSeed(validoDe, 30);

    const template = await db.agendaTemplate.upsert({
      // id sintético = upsert idempotente sem unique composite no template
      where: { id: `seed-template-${prof.id}` },
      update: {
        diasSemana: [2, 4],
        faixaInicio: "14:00",
        faixaFim: "18:00",
        duracaoSlotMin: espPrincipal.duracaoPadraoMin,
        validoDe,
        validoAte,
        ativo: true,
      },
      create: {
        id: `seed-template-${prof.id}`,
        profissionalId: prof.id,
        especialidadeId: espPrincipalId,
        diasSemana: [2, 4],
        faixaInicio: "14:00",
        faixaFim: "18:00",
        duracaoSlotMin: espPrincipal.duracaoPadraoMin,
        validoDe,
        validoAte,
        ativo: true,
      },
    });

    // Gerar slots dos próximos 30 dias (manual; lib gerarSlots nasce na T3)
    let cursor = validoDe;
    while (cursor < validoAte) {
      if (template.diasSemana.includes(cursor.getDay())) {
        const [hi = 0, mi = 0] = template.faixaInicio.split(":").map(Number);
        const [hf = 0, mf = 0] = template.faixaFim.split(":").map(Number);
        const inicioDia = new Date(cursor);
        inicioDia.setHours(hi, mi, 0, 0);
        const fimDia = new Date(cursor);
        fimDia.setHours(hf, mf, 0, 0);

        let slotInicio = inicioDia;
        while (addMinutesSeed(slotInicio, template.duracaoSlotMin) <= fimDia) {
          await db.slot.upsert({
            where: {
              profissionalId_dataHoraInicio: {
                profissionalId: prof.id,
                dataHoraInicio: slotInicio,
              },
            },
            update: {},
            create: {
              profissionalId: prof.id,
              especialidadeId: template.especialidadeId,
              templateId: template.id,
              dataHoraInicio: slotInicio,
              duracaoMin: template.duracaoSlotMin,
              status: "disponivel",
            },
          });
          slotInicio = addMinutesSeed(slotInicio, template.duracaoSlotMin);
        }
      }
      cursor = addDaysSeed(cursor, 1);
    }
  }

  console.log(
    `[seed] medico ok: ${ESPECIALIDADES_SEED.length} especialidades, ${PROFISSIONAIS_DEMO.length} profissionais, slots 30 dias`,
  );
}

// ── Capacitação (F1.A.1) — cursos, instrutores, turmas e matrículas demo ──
async function seedCapacitacao(createdById: string) {
  const CURSOS_SEED = [
    {
      id: "seed-curso-info",
      nome: "Informática Básica",
      area: "Tecnologia",
      cargaHorariaTotal: 40,
      modalidade: "presencial",
      capacidadePadrao: 16,
      descricao:
        "Windows, internet, e-mail e o pacote Office para o dia a dia e o mercado de trabalho.",
    },
    {
      id: "seed-curso-costura",
      nome: "Corte e Costura",
      area: "Geração de Renda",
      cargaHorariaTotal: 60,
      modalidade: "presencial",
      capacidadePadrao: 12,
      descricao: "Do molde ao acabamento: costura reta, overloque e peças sob medida.",
    },
    {
      id: "seed-curso-padaria",
      nome: "Panificação Artesanal",
      area: "Gastronomia",
      cargaHorariaTotal: 80,
      modalidade: "presencial",
      capacidadePadrao: 10,
      descricao: "Pães, fermentação natural e confeitaria básica para geração de renda familiar.",
    },
  ] as const;

  for (const c of CURSOS_SEED) {
    await db.curso.upsert({
      where: { id: c.id },
      update: {
        nome: c.nome,
        area: c.area,
        descricao: c.descricao,
        cargaHorariaTotal: c.cargaHorariaTotal,
        modalidade: c.modalidade,
        capacidadePadrao: c.capacidadePadrao,
        ativo: true,
      },
      create: {
        id: c.id,
        nome: c.nome,
        area: c.area,
        descricao: c.descricao,
        cargaHorariaTotal: c.cargaHorariaTotal,
        modalidade: c.modalidade,
        capacidadePadrao: c.capacidadePadrao,
        createdById,
      },
    });
  }

  const INSTRUTORES_SEED = [
    {
      id: "seed-instr-carlos",
      nomeExibicao: "Prof. Carlos Andrade",
      bio: "Analista de sistemas com 12 anos de docência em inclusão digital.",
    },
    {
      id: "seed-instr-marta",
      nomeExibicao: "Profa. Marta Lúcia",
      bio: "Estilista e costureira industrial; oficinas de geração de renda.",
    },
  ] as const;

  for (const i of INSTRUTORES_SEED) {
    await db.instrutor.upsert({
      where: { id: i.id },
      update: { nomeExibicao: i.nomeExibicao, bio: i.bio, ativo: true },
      create: { id: i.id, nomeExibicao: i.nomeExibicao, bio: i.bio },
    });
  }

  const hoje = startOfDaySeed(new Date());
  const TURMAS_SEED = [
    {
      codigo: "INFO-2026-01",
      cursoId: "seed-curso-info",
      instrutorId: "seed-instr-carlos",
      status: "inscricoes_abertas",
      capacidade: 4, // pequena de propósito → demonstra lista de espera
      local: "Sala 2 — Sede",
      inicio: addDaysSeed(hoje, 7),
      fim: addDaysSeed(hoje, 45),
    },
    {
      codigo: "COST-2026-01",
      cursoId: "seed-curso-costura",
      instrutorId: "seed-instr-marta",
      status: "em_andamento",
      capacidade: 12,
      local: "Ateliê — Anexo",
      inicio: addDaysSeed(hoje, -10),
      fim: addDaysSeed(hoje, 30),
    },
    {
      codigo: "PAO-2026-01",
      cursoId: "seed-curso-padaria",
      instrutorId: null,
      status: "planejada",
      capacidade: 10,
      local: "Cozinha-escola",
      inicio: addDaysSeed(hoje, 20),
      fim: addDaysSeed(hoje, 60),
    },
  ] as const;

  const turmaIdByCodigo = new Map<string, string>();
  for (const t of TURMAS_SEED) {
    const turma = await db.turma.upsert({
      where: { codigo: t.codigo },
      update: {
        cursoId: t.cursoId,
        instrutorId: t.instrutorId,
        status: t.status,
        capacidade: t.capacidade,
        local: t.local,
        dataInicio: t.inicio,
        dataFim: t.fim,
      },
      create: {
        codigo: t.codigo,
        cursoId: t.cursoId,
        instrutorId: t.instrutorId,
        status: t.status,
        capacidade: t.capacidade,
        local: t.local,
        dataInicio: t.inicio,
        dataFim: t.fim,
      },
    });
    turmaIdByCodigo.set(t.codigo, turma.id);
  }

  const cidadaos = await db.cidadao.findMany({
    orderBy: { nomeCompleto: "asc" },
    take: 8,
    select: { id: true },
  });

  // (índice do cidadão, código da turma, status) — desenha um estado de demo rico:
  // INFO lotada (4 ativos) + 2 na lista de espera; COST em andamento com 1 concluído.
  const MATRICULAS_SEED = [
    { ci: 0, turma: "INFO-2026-01", status: "confirmado" },
    { ci: 1, turma: "INFO-2026-01", status: "confirmado" },
    { ci: 2, turma: "INFO-2026-01", status: "cursando" },
    { ci: 3, turma: "INFO-2026-01", status: "inscrito" },
    { ci: 4, turma: "INFO-2026-01", status: "lista_espera" },
    { ci: 5, turma: "INFO-2026-01", status: "lista_espera" },
    { ci: 1, turma: "COST-2026-01", status: "cursando" },
    { ci: 6, turma: "COST-2026-01", status: "cursando" },
    { ci: 7, turma: "COST-2026-01", status: "concluido" },
  ] as const;

  let matriculas = 0;
  for (const m of MATRICULAS_SEED) {
    const cidadao = cidadaos[m.ci];
    const turmaId = turmaIdByCodigo.get(m.turma);
    if (!cidadao || !turmaId) continue;
    await db.matricula.upsert({
      where: { turmaId_cidadaoId: { turmaId, cidadaoId: cidadao.id } },
      update: { status: m.status },
      create: { turmaId, cidadaoId: cidadao.id, status: m.status, createdBy: createdById },
    });
    matriculas++;
  }

  console.log(
    `[seed] capacitacao ok: ${CURSOS_SEED.length} cursos, ${INSTRUTORES_SEED.length} instrutores, ${TURMAS_SEED.length} turmas, ${matriculas} matriculas`,
  );
}

// ── Encaminhamento (F1.B) — consulta em_atendimento do GP + 1 pedido aguardando ──
async function seedEncaminhamentoDemo() {
  const cidadao = await db.cidadao.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const clinico = await db.especialidade.findUnique({ where: { nome: "Clínico Geral" } });
  const psicologia = await db.especialidade.findUnique({ where: { nome: "Psicologia" } });
  const drJoao = await db.user.findUnique({
    where: { email: "dr.joao@familiaponcio.org.br" },
    include: { profissional: true },
  });
  if (!cidadao || !clinico || !psicologia || !drJoao?.profissional) {
    console.log("[seed] encaminhamento demo pulado (faltou cidadão/especialidade/profissional)");
    return;
  }
  const prof = drJoao.profissional;

  // 1. Slot + consulta em_atendimento do GP (ids fixos = idempotente)
  const slotGpId = "seed-enc-slot-gp";
  const dataGp = new Date();
  dataGp.setHours(9, 0, 0, 0);
  await db.slot.upsert({
    where: { id: slotGpId },
    update: {},
    create: {
      id: slotGpId,
      profissionalId: prof.id,
      especialidadeId: clinico.id,
      dataHoraInicio: dataGp,
      duracaoMin: clinico.duracaoPadraoMin,
      status: "reservado",
    },
  });
  const consultaGpId = "seed-enc-consulta-gp";
  await db.consulta.upsert({
    where: { id: consultaGpId },
    update: {},
    create: {
      id: consultaGpId,
      slotId: slotGpId,
      cidadaoId: cidadao.id,
      profissionalId: prof.id,
      especialidadeId: clinico.id,
      status: "em_atendimento",
      createdBy: drJoao.id,
    },
  });

  // 2. Encaminhamento aguardando_agendamento → Psicologia (tem slots futuros)
  await db.encaminhamento.upsert({
    where: { id: "seed-enc-demo" },
    update: {},
    create: {
      id: "seed-enc-demo",
      cidadaoId: cidadao.id,
      consultaOrigemId: consultaGpId,
      especialidadeId: psicologia.id,
      motivo: "Ansiedade e quadro depressivo — avaliação com Psicologia.",
      createdBy: drJoao.id,
      status: "aguardando_agendamento",
    },
  });
  console.log("[seed] encaminhamento demo ok (consulta em_atendimento + 1 pedido a Psicologia)");
}

async function main() {
  await seedRoles();

  // Erick = super_admin (senha diferente, conta principal)
  const erick = await seedUser({
    email: "erick.ramos@familiaponcio.org.br",
    name: "Erick Ramos",
    password: ERICK_PASSWORD,
    primaryRoleName: "super_admin",
    primaryUnitScope: null,
    roles: [{ roleName: "super_admin", unitScope: null }],
  });
  console.log("Seeded erick.ramos as super_admin");

  // Demo users — todos com senha ifp-demo-2026
  for (const spec of DEMO_USERS) {
    await seedUser(spec);
  }
  console.log(`Seeded ${DEMO_USERS.length} demo users (senha: ${DEMO_PASSWORD})`);

  // Cidadãos exemplo pra demo (Plano 3)
  await seedCidadaos(db, erick.id);

  // Centro Médico — especialidades + profissionais + slots (F1.B.1)
  await seedMedico();

  // Encaminhamento demo (F1.B) — consulta em_atendimento + 1 pedido aguardando
  await seedEncaminhamentoDemo();

  // Capacitação — cursos + instrutores + turmas + matrículas (F1.A.1)
  await seedCapacitacao(erick.id);
}

main().finally(() => db.$disconnect());
