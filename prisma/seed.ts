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
}

main().finally(() => db.$disconnect());
