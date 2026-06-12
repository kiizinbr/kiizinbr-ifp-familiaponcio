/**
 * Seed ESCOPADO de Capacitação para STAGING.
 *
 * A staging tem os dados REAIS do Amplimed (~18.9k cidadãos) — este script
 * NUNCA toca neles. Ele cria SOMENTE:
 *   1. Capacitação demo: 3 cursos + 2 instrutores + 3 turmas + 9 matrículas
 *      (espelho de seedCapacitacao em prisma/seed.ts — duplicado aqui porque
 *      seed.ts executa main() no import; importar rodaria a seed inteira).
 *   2. Os 5 cidadãos demo de capacitação de prisma/seed-cidadaos.ts (CPFs
 *      fictícios determinísticos). "Demo" segue a convenção do projeto
 *      (ops/vm/_count-demo.sh): demo = id FORA do MigracaoAmplimedMap.
 *      Este script só CRIA cidadãos e nunca insere no map → continuam
 *      distinguíveis dos migrados.
 *   3. User da instrutora (papel profissional:capacitacao, senha
 *      DEMO_PASSWORD — mesma mecânica da seed dev) + Instrutor.userId.
 *
 * GUARDAS:
 *   (a) Nenhum delete/deleteMany/updateMany. UPDATE apenas em registros de
 *       capacitação de ids/códigos fixos "seed-*" criados por este script
 *       (Curso/Instrutor/Turma/Matricula dos cidadãos demo). Cidadao, Familia,
 *       User e Role: find → create; NUNCA update. Se um CPF demo colidir com
 *       cidadão migrado (presente no MigracaoAmplimedMap), ABORTA.
 *   (b) Contagens antes/depois por model: "AUDIT: <model> antes=N depois=M".
 *   (c) Aborta com erro claro se DATABASE_URL não estiver definida.
 *
 * Uso local:    pnpm seed:capacitacao:staging   (carrega .env.local)
 * Uso staging:  DATABASE_URL do PG da staging no ambiente + tsx scripts/seed-capacitacao-staging.ts
 * Idempotente: rodável N vezes sem duplicar nada.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ── Guarda (c): DATABASE_URL obrigatória, antes de qualquer conexão ─────────
if (!process.env.DATABASE_URL) {
  console.error(
    "[seed-capacitacao-staging] ERRO: DATABASE_URL não definida. " +
      "Local: rode via `pnpm seed:capacitacao:staging` (carrega .env.local). " +
      "Staging: exporte DATABASE_URL do Postgres da staging antes de rodar.",
  );
  process.exit(1);
}

const db = new PrismaClient();

/** Mesma mecânica da seed dev (prisma/seed.ts). */
const DEMO_PASSWORD = "ifp-demo-2026";

const INSTRUTORA_LOGIN = {
  email: "profa.marta@familiaponcio.org.br",
  name: "Profa. Marta Lúcia",
  instrutorId: "seed-instr-marta",
} as const;

// ── Helpers de data (mesma lógica de prisma/seed.ts) ────────────────────────
function addDaysSeed(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDaySeed(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Gera CPF válido determinístico a partir de uma seed string.
 * Duplicado de prisma/seed-cidadaos.ts (não exportado lá) — mesma função,
 * mesmos CPFs pros mesmos nomes.
 */
function generateValidCpf(seed: string): string {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  let nineDigits = String(hash).padStart(9, "0").slice(-9);

  if (/^(\d)\1{8}$/.test(nineDigits)) {
    nineDigits = `${nineDigits.slice(0, 8)}${(parseInt(nineDigits.charAt(0), 10) + 1) % 10}`;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nineDigits.charAt(i), 10) * (10 - i);
  let d10 = (sum * 10) % 11;
  if (d10 >= 10) d10 = 0;

  sum = 0;
  const tenDigits = nineDigits + d10;
  for (let i = 0; i < 10; i++) sum += parseInt(tenDigits.charAt(i), 10) * (11 - i);
  let d11 = (sum * 10) % 11;
  if (d11 >= 10) d11 = 0;

  return tenDigits + d11;
}

// ── Dados demo de capacitação (espelho de seedCapacitacao em prisma/seed.ts) ─
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

// ── Os 5 cidadãos demo de capacitação (espelho de prisma/seed-cidadaos.ts) ──
interface CidadaoDemoSpec {
  familia: string;
  nomeCompleto: string;
  dataNascimento: string; // YYYY-MM-DD
  telefone: string;
  genero: string;
  rendaFamiliar?: number;
  beneficioSocial?: string;
  endereco?: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
}

const END_SILVA = {
  cep: "25020-130",
  logradouro: "Avenida Presidente Kennedy",
  numero: "1024",
  bairro: "Jardim Primavera",
  cidade: "Duque de Caxias",
  uf: "RJ",
} as const;

const CIDADAOS_CAPACITACAO: CidadaoDemoSpec[] = [
  {
    familia: "Família Silva",
    nomeCompleto: "Ana Beatriz Silva",
    dataNascimento: "2008-07-22",
    telefone: "(21) 97654-3210",
    genero: "feminino",
    endereco: END_SILVA,
  },
  {
    familia: "Família Silva",
    nomeCompleto: "Carla Regina Silva",
    dataNascimento: "1982-05-14",
    telefone: "(21) 96543-2109",
    genero: "feminino",
    rendaFamiliar: 1800,
    endereco: END_SILVA,
  },
  {
    familia: "Família Oliveira",
    nomeCompleto: "Rafael Augusto Oliveira",
    dataNascimento: "1995-06-17",
    telefone: "(21) 99888-7777",
    genero: "masculino",
    beneficioSocial: "nenhum",
  },
  {
    familia: "Família Rodrigues",
    nomeCompleto: "Camila Rodrigues",
    dataNascimento: "2006-11-29",
    telefone: "(21) 96555-4444",
    genero: "feminino",
  },
  {
    familia: "Família Carvalho",
    nomeCompleto: "Beatriz Carvalho Mendes",
    dataNascimento: "1992-09-21",
    telefone: "(21) 94333-2222",
    genero: "feminino",
    rendaFamiliar: 2400,
  },
];

// ── AUDIT (guarda b) ─────────────────────────────────────────────────────────
const AUDIT_MODELS = [
  "Role",
  "User",
  "UserRole",
  "Familia",
  "Cidadao",
  "Curso",
  "Instrutor",
  "Turma",
  "Matricula",
  "MigracaoAmplimedMap",
] as const;

async function contagens(): Promise<Record<string, number>> {
  return {
    Role: await db.role.count(),
    User: await db.user.count(),
    UserRole: await db.userRole.count(),
    Familia: await db.familia.count(),
    Cidadao: await db.cidadao.count(),
    Curso: await db.curso.count(),
    Instrutor: await db.instrutor.count(),
    Turma: await db.turma.count(),
    Matricula: await db.matricula.count(),
    MigracaoAmplimedMap: await db.migracaoAmplimedMap.count(),
  };
}

// ── Passos ───────────────────────────────────────────────────────────────────

/** Role 'profissional': find → create. NUNCA update (fora do escopo do script). */
async function garantirRoleProfissional(): Promise<string> {
  const existente = await db.role.findUnique({ where: { name: "profissional" } });
  if (existente) return existente.id;
  const criado = await db.role.create({
    data: {
      name: "profissional",
      description: "Profissional que atende em uma unidade",
      scope: "unit",
    },
  });
  return criado.id;
}

/** User da instrutora: find → create (nunca update) + UserRole profissional:capacitacao. */
async function seedInstrutoraUser(roleId: string): Promise<string> {
  let user = await db.user.findUnique({ where: { email: INSTRUTORA_LOGIN.email } });
  if (!user) {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    user = await db.user.create({
      data: {
        email: INSTRUTORA_LOGIN.email,
        name: INSTRUTORA_LOGIN.name,
        hashedPassword,
        primaryRoleName: "profissional",
        primaryUnitScope: "capacitacao",
      },
    });
    console.log(`[seed] user instrutora criado: ${INSTRUTORA_LOGIN.email}`);
  } else {
    console.log(`[seed] user instrutora já existe: ${INSTRUTORA_LOGIN.email} (sem update)`);
  }

  const jaTemPapel = await db.userRole.findFirst({
    where: { userId: user.id, roleId, unitScope: "capacitacao" },
  });
  if (!jaTemPapel) {
    await db.userRole.create({ data: { userId: user.id, roleId, unitScope: "capacitacao" } });
  }
  return user.id;
}

async function seedCursosInstrutoresTurmas(
  createdById: string,
  instrutoraUserId: string,
): Promise<Map<string, string>> {
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

  for (const i of INSTRUTORES_SEED) {
    // Marta ganha o vínculo de login (F1.A.2): Instrutor.userId → user instrutora.
    const userId = i.id === INSTRUTORA_LOGIN.instrutorId ? instrutoraUserId : undefined;
    await db.instrutor.upsert({
      where: { id: i.id },
      update: { nomeExibicao: i.nomeExibicao, bio: i.bio, ativo: true, ...(userId && { userId }) },
      create: { id: i.id, nomeExibicao: i.nomeExibicao, bio: i.bio, ...(userId && { userId }) },
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
  console.log(
    `[seed] capacitacao base ok: ${CURSOS_SEED.length} cursos, ${INSTRUTORES_SEED.length} instrutores, ${TURMAS_SEED.length} turmas`,
  );
  return turmaIdByCodigo;
}

/**
 * Cidadãos demo: find por CPF → create. NUNCA update.
 * Guarda (a): se o CPF já existir E pertencer a um cidadão MIGRADO do Amplimed
 * (presente no MigracaoAmplimedMap), aborta — colisão com dado real.
 */
async function seedCidadaosDemo(createdById: string): Promise<string[]> {
  const familiaIdByNome = new Map<string, string>();
  const ids: string[] = [];

  for (const spec of CIDADAOS_CAPACITACAO) {
    const cpf = generateValidCpf(`${spec.nomeCompleto}-${spec.dataNascimento}`);
    const existente = await db.cidadao.findUnique({ where: { cpf } });

    if (existente) {
      const migrado = await db.migracaoAmplimedMap.findFirst({
        where: { entidade: "cidadao", idDestino: existente.id },
      });
      if (migrado) {
        throw new Error(
          `[seed-capacitacao-staging] ABORTADO: CPF demo ${cpf} (${spec.nomeCompleto}) ` +
            `colide com cidadão MIGRADO do Amplimed (id=${existente.id}). Nada foi alterado nele.`,
        );
      }
      console.log(`[seed] cidadão demo já existe (reusado, sem update): ${spec.nomeCompleto}`);
      ids.push(existente.id);
      continue;
    }

    // Família: find → create (nunca update)
    let familiaId = familiaIdByNome.get(spec.familia);
    if (!familiaId) {
      const familiaExistente = await db.familia.findFirst({
        where: { nomeReferencia: spec.familia },
      });
      const familia =
        familiaExistente ?? (await db.familia.create({ data: { nomeReferencia: spec.familia } }));
      familiaId = familia.id;
      familiaIdByNome.set(spec.familia, familiaId);
    }

    const criado = await db.cidadao.create({
      data: {
        nomeCompleto: spec.nomeCompleto,
        cpf,
        dataNascimento: new Date(spec.dataNascimento),
        telefonePrincipal: spec.telefone,
        genero: spec.genero,
        rendaFamiliar: spec.rendaFamiliar,
        beneficioSocial: spec.beneficioSocial,
        unitIdOrigem: "capacitacao",
        familiaId,
        createdById,
        ...(spec.endereco && {
          enderecos: {
            create: [
              {
                tipo: "residencial",
                cep: spec.endereco.cep.replace(/\D/g, ""),
                logradouro: spec.endereco.logradouro,
                numero: spec.endereco.numero,
                bairro: spec.endereco.bairro,
                cidade: spec.endereco.cidade,
                uf: spec.endereco.uf,
                isPrincipal: true,
              },
            ],
          },
        }),
      },
    });
    console.log(`[seed] cidadão demo criado: ${spec.nomeCompleto}`);
    ids.push(criado.id);
  }
  return ids;
}

/**
 * Matrículas SOMENTE entre os 5 cidadãos demo (índices c0–c4) e as turmas seed.
 * Mesmo estado rico da seed dev (9 matrículas; lá com 8 cidadãos, aqui remapeado
 * pra 5): INFO lotada (4 ativos, capacidade 4) + 1 lista de espera; COST em
 * andamento com 1 concluído.
 */
async function seedMatriculas(
  cidadaoIds: string[],
  turmaIdByCodigo: Map<string, string>,
  createdById: string,
): Promise<void> {
  const MATRICULAS_SEED = [
    { ci: 0, turma: "INFO-2026-01", status: "confirmado" },
    { ci: 1, turma: "INFO-2026-01", status: "confirmado" },
    { ci: 2, turma: "INFO-2026-01", status: "cursando" },
    { ci: 3, turma: "INFO-2026-01", status: "inscrito" },
    { ci: 4, turma: "INFO-2026-01", status: "lista_espera" },
    { ci: 0, turma: "COST-2026-01", status: "cursando" },
    { ci: 1, turma: "COST-2026-01", status: "cursando" },
    { ci: 3, turma: "COST-2026-01", status: "cursando" },
    { ci: 4, turma: "COST-2026-01", status: "concluido" },
  ] as const;

  let matriculas = 0;
  for (const m of MATRICULAS_SEED) {
    const cidadaoId = cidadaoIds[m.ci];
    const turmaId = turmaIdByCodigo.get(m.turma);
    if (!cidadaoId || !turmaId) continue;
    await db.matricula.upsert({
      where: { turmaId_cidadaoId: { turmaId, cidadaoId } },
      update: { status: m.status },
      create: { turmaId, cidadaoId, status: m.status, createdBy: createdById },
    });
    matriculas++;
  }
  console.log(`[seed] ${matriculas} matrículas demo ok (só entre cidadãos demo)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const antes = await contagens();

  const roleId = await garantirRoleProfissional();
  const instrutoraUserId = await seedInstrutoraUser(roleId);

  // createdBy: prefere um super_admin existente; senão a própria instrutora.
  const admin = await db.user.findFirst({ where: { primaryRoleName: "super_admin" } });
  const createdById = admin?.id ?? instrutoraUserId;

  const turmaIdByCodigo = await seedCursosInstrutoresTurmas(createdById, instrutoraUserId);
  const cidadaoIds = await seedCidadaosDemo(createdById);
  await seedMatriculas(cidadaoIds, turmaIdByCodigo, createdById);

  const depois = await contagens();
  for (const model of AUDIT_MODELS) {
    console.log(`AUDIT: ${model} antes=${antes[model]} depois=${depois[model]}`);
  }
  console.log(
    `[seed-capacitacao-staging] ok — instrutora ${INSTRUTORA_LOGIN.email} (senha demo padrão da seed)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
