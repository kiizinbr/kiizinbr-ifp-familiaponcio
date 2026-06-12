/**
 * Seed ESCOPADO de Capacitação para STAGING.
 *
 * A staging tem os dados REAIS do Amplimed (~18.9k cidadãos) — este script
 * NUNCA toca neles. Ele cria SOMENTE:
 *   1. Capacitação demo: 3 cursos + 2 instrutores + 3 turmas + 9 matrículas
 *      (espelho de seedCapacitacao em prisma/seed.ts — duplicado aqui porque
 *      seed.ts executa main() no import; importar rodaria a seed inteira).
 *   2. Os 5 cidadãos demo de capacitação de prisma/seed-cidadaos.ts (CPFs
 *      fictícios determinísticos). Todo registro demo criado aqui carrega
 *      MARCADOR POSITIVO: id fixo "seed-*" (curso, instrutor, turma, família,
 *      cidadão). A convenção do projeto (ops/vm/_count-demo.sh): demo = id
 *      FORA do MigracaoAmplimedMap continua valendo (nunca inserimos no map),
 *      mas NÃO serve pra limpeza: cadastros reais feitos pelo app também
 *      ficam fora do map. Limpeza futura deve keyar nos ids "seed-*".
 *   3. User da instrutora (papel profissional:capacitacao, senha
 *      DEMO_PASSWORD + mustChangePassword — staging tem PII real) +
 *      Instrutor.userId.
 *
 * GUARDAS:
 *   (a) Nenhum delete/deleteMany/updateMany. UPDATE apenas em registros de
 *       capacitação reconhecíveis como criados por seed (id fixo "seed-*" ou,
 *       p/ bases semeadas antes do id fixo, turma cujo cursoId é "seed-curso-*").
 *       Colisão com dado NÃO-seed ABORTA (transação reverte tudo):
 *         - Turma: codigo já usado por turma não-seed (codigo é digitável por
 *           humano — a UI sugere "Ex: INFO-2026-01");
 *         - Cidadao: CPF já usado por registro não reconhecido como o demo
 *           (migrado do Amplimed OU cadastro manual da equipe);
 *         - User: e-mail da instrutora já usado por conta cuja senha não é a
 *           DEMO_PASSWORD (conta real).
 *   (b) Contagens antes/depois por model: "AUDIT: <model> antes=N depois=M" —
 *       impressas também no caminho de erro (prefixo "AUDIT(erro)").
 *   (c) Aborta se DATABASE_URL não estiver definida ou SEED_CONFIRM !== "staging"
 *       (confirmação explícita do banco-alvo; alvo logado sem credenciais).
 *   (d) Todos os writes numa ÚNICA transação: abort = zero writes.
 *
 * Uso local:    SEED_CONFIRM=staging pnpm seed:capacitacao:staging   (carrega .env.local)
 * Uso staging:  SEED_CONFIRM=staging DATABASE_URL=<staging> tsx scripts/seed-capacitacao-staging.ts
 * Idempotente: rodável N vezes sem duplicar nada.
 */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
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

// ── Guarda (c): confirmação explícita do banco-alvo ─────────────────────────
// O pnpm script carrega .env.local via dotenv-cli, mas uma DATABASE_URL já
// exportada (ex.: sessão anterior apontando pra staging) vence silenciosamente
// — e o CL-SRV-DC01 tem múltiplos Postgres. Exigimos SEED_CONFIRM=staging e
// logamos o alvo (sem credenciais) antes de qualquer write.
if (process.env.SEED_CONFIRM !== "staging") {
  console.error(
    "[seed-capacitacao-staging] ERRO: defina SEED_CONFIRM=staging para confirmar o banco-alvo. " +
      "Ex.: SEED_CONFIRM=staging pnpm seed:capacitacao:staging",
  );
  process.exit(1);
}
try {
  const alvo = new URL(String(process.env.DATABASE_URL));
  console.log(`[seed] banco-alvo: ${alvo.hostname}:${alvo.port || "5432"}${alvo.pathname}`);
} catch {
  console.log("[seed] banco-alvo: DATABASE_URL não parseável como URL (prosseguindo)");
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
  /** Marcador POSITIVO de demo: id fixo "seed-cid-*" (colisão com cuid impossível). */
  seedId: string;
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
    seedId: "seed-cid-ana-beatriz",
    familia: "Família Silva",
    nomeCompleto: "Ana Beatriz Silva",
    dataNascimento: "2008-07-22",
    telefone: "(21) 97654-3210",
    genero: "feminino",
    endereco: END_SILVA,
  },
  {
    seedId: "seed-cid-carla-regina",
    familia: "Família Silva",
    nomeCompleto: "Carla Regina Silva",
    dataNascimento: "1982-05-14",
    telefone: "(21) 96543-2109",
    genero: "feminino",
    rendaFamiliar: 1800,
    endereco: END_SILVA,
  },
  {
    seedId: "seed-cid-rafael-augusto",
    familia: "Família Oliveira",
    nomeCompleto: "Rafael Augusto Oliveira",
    dataNascimento: "1995-06-17",
    telefone: "(21) 99888-7777",
    genero: "masculino",
    beneficioSocial: "nenhum",
  },
  {
    seedId: "seed-cid-camila",
    familia: "Família Rodrigues",
    nomeCompleto: "Camila Rodrigues",
    dataNascimento: "2006-11-29",
    telefone: "(21) 96555-4444",
    genero: "feminino",
  },
  {
    seedId: "seed-cid-beatriz-mendes",
    familia: "Família Carvalho",
    nomeCompleto: "Beatriz Carvalho Mendes",
    dataNascimento: "1992-09-21",
    telefone: "(21) 94333-2222",
    genero: "feminino",
    rendaFamiliar: 2400,
  },
];

/**
 * Ids fixos das famílias demo. Familia.nomeReferencia NÃO é unique e
 * "Família Silva" etc. são sobrenomes comuníssimos — buscar por nome poderia
 * anexar cidadão demo a uma família REAL. Busca/criação SEMPRE por estes ids.
 */
const FAMILIA_SEED_IDS: Record<string, string> = {
  "Família Silva": "seed-fam-silva",
  "Família Oliveira": "seed-fam-oliveira",
  "Família Rodrigues": "seed-fam-rodrigues",
  "Família Carvalho": "seed-fam-carvalho",
};

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
async function garantirRoleProfissional(tx: Prisma.TransactionClient): Promise<string> {
  const existente = await tx.role.findUnique({ where: { name: "profissional" } });
  if (existente) return existente.id;
  const criado = await tx.role.create({
    data: {
      name: "profissional",
      description: "Profissional que atende em uma unidade",
      scope: "unit",
    },
  });
  return criado.id;
}

/**
 * User da instrutora: find → create (nunca update) + UserRole profissional:capacitacao.
 * Guarda (a): se o e-mail já existir, só prosseguimos se for a conta demo deste
 * seed (senha ainda = DEMO_PASSWORD). Conta real com esse e-mail → ABORT, sem
 * conceder papel nem vincular Instrutor.userId a conta alheia.
 */
async function seedInstrutoraUser(
  tx: Prisma.TransactionClient,
  roleId: string,
  hashedPassword: string,
): Promise<string> {
  let user = await tx.user.findUnique({ where: { email: INSTRUTORA_LOGIN.email } });
  if (!user) {
    user = await tx.user.create({
      data: {
        email: INSTRUTORA_LOGIN.email,
        name: INSTRUTORA_LOGIN.name,
        hashedPassword,
        mustChangePassword: true, // staging tem PII real — senha demo não pode persistir
        primaryRoleName: "profissional",
        primaryUnitScope: "capacitacao",
      },
    });
    console.log(`[seed] user instrutora criado: ${INSTRUTORA_LOGIN.email}`);
  } else {
    const ehContaSeed =
      user.hashedPassword !== null && (await bcrypt.compare(DEMO_PASSWORD, user.hashedPassword));
    if (!ehContaSeed) {
      throw new Error(
        `[seed-capacitacao-staging] ABORTADO: ${INSTRUTORA_LOGIN.email} já existe e NÃO é ` +
          `a conta demo deste seed (senha difere da DEMO_PASSWORD — conta real ou senha já ` +
          `trocada). Nenhum papel concedido nem vínculo de instrutor alterado.`,
      );
    }
    console.log(
      `[seed] user instrutora já existe (conta demo reconhecida pela senha; sem update): ${INSTRUTORA_LOGIN.email}`,
    );
  }

  const jaTemPapel = await tx.userRole.findFirst({
    where: { userId: user.id, roleId, unitScope: "capacitacao" },
  });
  if (!jaTemPapel) {
    await tx.userRole.create({ data: { userId: user.id, roleId, unitScope: "capacitacao" } });
  }
  return user.id;
}

async function seedCursosInstrutoresTurmas(
  tx: Prisma.TransactionClient,
  createdById: string,
  instrutoraUserId: string,
): Promise<Map<string, string>> {
  for (const c of CURSOS_SEED) {
    await tx.curso.upsert({
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
    await tx.instrutor.upsert({
      where: { id: i.id },
      update: { nomeExibicao: i.nomeExibicao, bio: i.bio, ativo: true, ...(userId && { userId }) },
      create: { id: i.id, nomeExibicao: i.nomeExibicao, bio: i.bio, ...(userId && { userId }) },
    });
  }

  const hoje = startOfDaySeed(new Date());
  const TURMAS_SEED = [
    {
      id: "seed-turma-info",
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
      id: "seed-turma-cost",
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
      id: "seed-turma-pao",
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
    // Guarda (a): Turma.codigo é @unique mas digitável por humano (o form de
    // turma nova até sugere "Ex: INFO-2026-01"). UPDATE só em turma
    // reconhecível como seed: id fixo "seed-turma-*" ou (base semeada antes do
    // id fixo) cursoId "seed-curso-*". Qualquer outra → ABORT, sem tocar nela.
    const existente = await tx.turma.findUnique({ where: { codigo: t.codigo } });
    if (existente && existente.id !== t.id && !existente.cursoId.startsWith("seed-curso-")) {
      throw new Error(
        `[seed-capacitacao-staging] ABORTADO: turma ${t.codigo} já existe (id=${existente.id}) ` +
          `e NÃO é reconhecível como turma seed. Nada foi alterado nela.`,
      );
    }
    const dados = {
      cursoId: t.cursoId,
      instrutorId: t.instrutorId,
      status: t.status,
      capacidade: t.capacidade,
      local: t.local,
      dataInicio: t.inicio,
      dataFim: t.fim,
    };
    const turma = existente
      ? await tx.turma.update({ where: { id: existente.id }, data: dados })
      : await tx.turma.create({ data: { id: t.id, codigo: t.codigo, ...dados } });
    turmaIdByCodigo.set(t.codigo, turma.id);
  }
  console.log(
    `[seed] capacitacao base ok: ${CURSOS_SEED.length} cursos, ${INSTRUTORES_SEED.length} instrutores, ${TURMAS_SEED.length} turmas`,
  );
  return turmaIdByCodigo;
}

/**
 * Cidadãos demo: find por CPF → create com id fixo "seed-cid-*" (marcador
 * positivo de demo). NUNCA update.
 * Guarda (a): se o CPF já existir e o registro NÃO for reconhecível como o
 * próprio demo (id "seed-cid-*" OU mesmo nome+nascimento — a origem do CPF
 * determinístico), ABORTA. Cobre cidadão MIGRADO do Amplimed E cadastro
 * manual feito pela equipe (ambos fora do nosso escopo).
 */
async function seedCidadaosDemo(
  tx: Prisma.TransactionClient,
  createdById: string,
): Promise<string[]> {
  const familiaIdByNome = new Map<string, string>();
  const ids: string[] = [];

  for (const spec of CIDADAOS_CAPACITACAO) {
    const cpf = generateValidCpf(`${spec.nomeCompleto}-${spec.dataNascimento}`);
    const existente = await tx.cidadao.findUnique({ where: { cpf } });

    if (existente) {
      const migrado = await tx.migracaoAmplimedMap.findFirst({
        where: { entidade: "cidadao", idDestino: existente.id },
      });
      if (migrado) {
        throw new Error(
          `[seed-capacitacao-staging] ABORTADO: CPF demo ${cpf} (${spec.nomeCompleto}) ` +
            `colide com cidadão MIGRADO do Amplimed (id=${existente.id}). Nada foi alterado nele.`,
        );
      }
      const reconhecidoComoDemo =
        existente.id === spec.seedId ||
        (existente.nomeCompleto === spec.nomeCompleto &&
          existente.dataNascimento?.toISOString().slice(0, 10) === spec.dataNascimento);
      if (!reconhecidoComoDemo) {
        throw new Error(
          `[seed-capacitacao-staging] ABORTADO: CPF demo ${cpf} (${spec.nomeCompleto}) ` +
            `pertence a registro NÃO reconhecido como demo (id=${existente.id}; provável ` +
            `cadastro manual da equipe). Nada foi alterado nele.`,
        );
      }
      console.log(`[seed] cidadão demo já existe (reusado, sem update): ${spec.nomeCompleto}`);
      ids.push(existente.id);
      continue;
    }

    // Família demo: busca/criação por id fixo "seed-fam-*" (nomeReferencia NÃO
    // é unique — buscar por nome poderia anexar demo a uma família REAL).
    let familiaId = familiaIdByNome.get(spec.familia);
    if (!familiaId) {
      const familiaSeedId = FAMILIA_SEED_IDS[spec.familia];
      if (!familiaSeedId) {
        throw new Error(
          `[seed-capacitacao-staging] família demo sem id seed mapeado: ${spec.familia}`,
        );
      }
      const familiaExistente = await tx.familia.findUnique({ where: { id: familiaSeedId } });
      const familia =
        familiaExistente ??
        (await tx.familia.create({ data: { id: familiaSeedId, nomeReferencia: spec.familia } }));
      familiaId = familia.id;
      familiaIdByNome.set(spec.familia, familiaId);
    }

    const criado = await tx.cidadao.create({
      data: {
        id: spec.seedId,
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
  tx: Prisma.TransactionClient,
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
    await tx.matricula.upsert({
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

  try {
    // bcrypt é caro (~centenas de ms) — calcula FORA da transação.
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

    // Guarda (d): transação única — qualquer abort reverte TUDO (zero writes),
    // honrando o "Nada foi alterado" das mensagens de erro.
    await db.$transaction(
      async (tx) => {
        const roleId = await garantirRoleProfissional(tx);
        const instrutoraUserId = await seedInstrutoraUser(tx, roleId, hashedPassword);

        // createdBy: SEMPRE a instrutora seed — nunca um admin real (atribuição
        // limpa na auditoria; mesmo padrão do user dedicado do ETL Amplimed).
        const createdById = instrutoraUserId;

        const turmaIdByCodigo = await seedCursosInstrutoresTurmas(
          tx,
          createdById,
          instrutoraUserId,
        );
        const cidadaoIds = await seedCidadaosDemo(tx, createdById);
        await seedMatriculas(tx, cidadaoIds, turmaIdByCodigo, createdById);
      },
      { maxWait: 15_000, timeout: 120_000 },
    );
  } catch (erro) {
    // Guarda (b) também no erro: evidência do estado do banco na falha.
    const aposErro = await contagens().catch(() => null);
    if (aposErro) {
      for (const model of AUDIT_MODELS) {
        console.log(`AUDIT(erro): ${model} antes=${antes[model]} depois=${aposErro[model]}`);
      }
    }
    throw erro;
  }

  const depois = await contagens();
  for (const model of AUDIT_MODELS) {
    console.log(`AUDIT: ${model} antes=${antes[model]} depois=${depois[model]}`);
  }
  console.log(
    `[seed-capacitacao-staging] ok — instrutora ${INSTRUTORA_LOGIN.email} ` +
      `(senha demo padrão da seed; mustChangePassword=true)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
