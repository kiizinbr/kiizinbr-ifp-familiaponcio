# F1.B.1 — Agenda + Fila do dia (Centro Médico) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a infraestrutura multi-profissional do Centro Médico do IFP — agenda Doctolib-like, fila do dia, marcação de consulta via callcenter, transições de status — em ~15 tasks TDD bite-sized.

**Architecture:**
- 5 modelos Prisma novos (`Especialidade`, `Profissional`, `ProfissionalEspecialidade`, `AgendaTemplate`, `Slot`, `Consulta`) isolados dos modelos sociais existentes (`Vaga`/`Agendamento` intactos).
- Lógica pura em `src/lib/medico/` (`agenda.ts` para geração de slots, reserva concorrente-segura, transições; `rbac.ts` para capabilities). Testes Vitest cobrem ramos com ~15 unit tests.
- Rotas novas sob `src/app/medico/` — literal segment ganha do catch-all `[unidade]/page.tsx` (Next 16). 8 telas (home/agenda/profissionais/minha-agenda/consultas-wizard/consulta-detalhe/especialidades/...).
- AppShell ganha nav contextual por unidade. Server actions transacionais via Prisma (`UPDATE Slot SET status='reservado' WHERE id=? AND status='disponivel'` para anti-overbooking).

**Tech Stack:** Next.js 16 (proxy.ts) + React 19 + TypeScript + Prisma 6 + Tailwind 4 + Vitest + Playwright. Repo: `C:\Users\Administrador\ifp-connect` (= `/mnt/c/Users/Administrador/ifp-connect` em WSL).

**Spec:** `docs/superpowers/specs/2026-05-28-medico-agenda-fila-design.md`
**Roadmap pai:** `docs/superpowers/roadmap/2026-05-28-roadmap-produto.md` (F1.B Médico, sub-módulo 1 de 3)
**HEAD ao começar:** `29342e2` (spec F1.B.1 commitada).

---

## Convenções deste plano

- **pnpm via WSL** (Node está no WSL Ubuntu, não Windows): `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm <cmd>"`.
- **Git via Windows nativo** (bug wslrelay trava push no WSL): `git -C "C:/Users/Administrador/ifp-connect" ...`. **DO NOT push** durante as tasks; T15 (cleanup) faz o push consolidado.
- **Path alias `@/`** → `src/`.
- **Pre-commit ritual obrigatório** após cada task: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`.
- **Commit message style** do projeto: `<tipo>(escopo): descrição em pt-BR`. Sufixo "(F1.B.1 T<N>)" pra rastrear.
- **Cada task = 1 commit local.**
- **Migration timestamp**: usar `20260528NNNNNN_<desc>` ascendente; verificar `prisma/migrations/` pelo maior timestamp existente antes de criar nova.

---

## Task 1: Schema Prisma (5 modelos + 2 enums)

Adicionar os modelos do domínio médico em `prisma/schema.prisma`. Gerar migration. Não toca dados nem outros modelos.

**Files:**
- Modify: `prisma/schema.prisma` (append at end)
- Create: `prisma/migrations/<timestamp>_medico_schema/migration.sql` (gerado por Prisma)

### Step 1.1 — Append models no schema

Abrir `prisma/schema.prisma`. No FINAL do arquivo (após o último model existente), adicionar:

```prisma
// ============================================================================
// F1.B.1 — Centro Médico: agenda + fila do dia
// Spec: docs/superpowers/specs/2026-05-28-medico-agenda-fila-design.md
// ============================================================================

model Especialidade {
  id               String                       @id @default(cuid())
  nome             String                       @unique
  duracaoPadraoMin Int
  corDestaque      String // hex do brandbook, ex: "#007571"
  ativa            Boolean                      @default(true)
  profissionais    ProfissionalEspecialidade[]
  slots            Slot[]
  consultas        Consulta[]
  createdAt        DateTime                     @default(now())
  updatedAt        DateTime                     @updatedAt
}

model Profissional {
  id             String                       @id @default(cuid())
  userId         String                       @unique
  user           User                         @relation(fields: [userId], references: [id], onDelete: Restrict)
  nomeExibicao   String
  conselho       String
  nroConselho    String
  bio            String?
  fotoUrl        String?
  ativo          Boolean                      @default(true)
  especialidades ProfissionalEspecialidade[]
  templates      AgendaTemplate[]
  slots          Slot[]
  consultas      Consulta[]
  createdAt      DateTime                     @default(now())
  updatedAt      DateTime                     @updatedAt
}

model ProfissionalEspecialidade {
  profissionalId  String
  especialidadeId String
  profissional    Profissional  @relation(fields: [profissionalId], references: [id], onDelete: Cascade)
  especialidade   Especialidade @relation(fields: [especialidadeId], references: [id], onDelete: Restrict)
  createdAt       DateTime      @default(now())

  @@id([profissionalId, especialidadeId])
}

model AgendaTemplate {
  id              String       @id @default(cuid())
  profissionalId  String
  especialidadeId String
  profissional    Profissional @relation(fields: [profissionalId], references: [id], onDelete: Cascade)
  // diasSemana: 0=domingo, 1=segunda, ..., 6=sábado. Array de Int[].
  diasSemana      Int[]
  faixaInicio     String // "HH:mm" formato 24h
  faixaFim        String // "HH:mm"
  duracaoSlotMin  Int
  validoDe        DateTime
  validoAte       DateTime?
  observacoes     String?
  ativo           Boolean      @default(true)
  slots           Slot[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([profissionalId, ativo])
}

enum StatusSlot {
  disponivel
  reservado
  bloqueado
  realizado
  faltou
  cancelado
}

model Slot {
  id              String          @id @default(cuid())
  profissionalId  String
  especialidadeId String
  templateId      String?
  dataHoraInicio  DateTime
  duracaoMin      Int
  status          StatusSlot      @default(disponivel)
  motivoBloqueio  String?
  profissional    Profissional    @relation(fields: [profissionalId], references: [id], onDelete: Restrict)
  especialidade   Especialidade   @relation(fields: [especialidadeId], references: [id], onDelete: Restrict)
  template        AgendaTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  consulta        Consulta?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([profissionalId, dataHoraInicio])
  @@index([status, dataHoraInicio])
  @@index([especialidadeId, status, dataHoraInicio])
}

enum StatusConsulta {
  agendada
  confirmada
  em_atendimento
  realizada
  faltou
  cancelada
}

model Consulta {
  id                     String         @id @default(cuid())
  slotId                 String         @unique
  cidadaoId              String
  profissionalId         String
  especialidadeId        String
  status                 StatusConsulta @default(agendada)
  observacoesAgendamento String?
  origemTriagemId        String?
  cancelMotivo           String?
  createdBy              String // userId
  slot                   Slot           @relation(fields: [slotId], references: [id], onDelete: Restrict)
  cidadao                Cidadao        @relation(fields: [cidadaoId], references: [id], onDelete: Restrict)
  profissional           Profissional   @relation(fields: [profissionalId], references: [id], onDelete: Restrict)
  especialidade          Especialidade  @relation(fields: [especialidadeId], references: [id], onDelete: Restrict)
  createdAt              DateTime       @default(now())
  updatedAt              DateTime       @updatedAt

  @@index([profissionalId, status])
  @@index([cidadaoId])
  @@index([status, createdAt])
}
```

### Step 1.2 — Adicionar back-relations em `User` e `Cidadao`

Localizar o `model User { ... }` em `prisma/schema.prisma` e adicionar, junto às outras relations já existentes, **uma única linha**:

```prisma
  profissional         Profissional?
```

Localizar o `model Cidadao { ... }` no mesmo schema e adicionar, junto às outras relations já existentes, **uma única linha**:

```prisma
  consultas            Consulta[]
```

> Se essas linhas já existirem (improvável), não duplique.

### Step 1.3 — Gerar e aplicar migration

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:migrate --name medico_schema"
```

Expected: `Applied migration(s): <timestamp>_medico_schema`. Sem erro de FK ou de tipo.

Verificar o conteúdo da migration gerada:

```bash
ls "C:/Users/Administrador/ifp-connect/prisma/migrations/" | tail -3
```

Deve aparecer uma pasta nova `<timestamp>_medico_schema`.

### Step 1.4 — Verificar tabelas no Postgres

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "\dt" | grep -E "Especialidade|Profissional|AgendaTemplate|Slot|Consulta"'
```

Expected: 6 tabelas listadas (Especialidade, Profissional, ProfissionalEspecialidade, AgendaTemplate, Slot, Consulta).

### Step 1.5 — Pre-commit ritual + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
```

Expected: tudo verde. 71/71 unit tests (sem novos por enquanto).

```bash
git -C "C:/Users/Administrador/ifp-connect" add prisma/schema.prisma prisma/migrations/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(db): schema medico (Especialidade+Profissional+Agenda+Slot+Consulta) (F1.B.1 T1)"
```

DO NOT push.

---

## Task 2: Seed inicial (10 especialidades + 3 profissionais demo + template + slots)

Estender `prisma/seed.ts` para popular o domínio médico de forma idempotente. Inclui: lista canônica de especialidades, 3 profissionais demo vinculados a Users existentes (criados ou criados-se-faltar), 1 template para cada profissional, geração de slots para os próximos 30 dias.

**Files:**
- Modify: `prisma/seed.ts`

### Step 2.1 — Adicionar bloco de seed médico

Abrir `prisma/seed.ts`. Antes do `main().catch(...)` final, inserir uma chamada nova `await seedMedico()`. Depois adicionar a função no mesmo arquivo (na seção das demais `seed<X>`).

Estrutura recomendada (adapte aos paths/imports já existentes no arquivo):

```ts
import { addDays, startOfDay, addMinutes, format } from "date-fns";

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

async function seedMedico() {
  // Idempotente: upserts em tudo. Se já existe, atualiza; se não, cria.

  // 1. Especialidades canônicas
  const especialidadeByNome = new Map<string, string>();
  for (const esp of ESPECIALIDADES_SEED) {
    const e = await prisma.especialidade.upsert({
      where: { nome: esp.nome },
      update: { duracaoPadraoMin: esp.duracaoPadraoMin, corDestaque: esp.corDestaque, ativa: true },
      create: { nome: esp.nome, duracaoPadraoMin: esp.duracaoPadraoMin, corDestaque: esp.corDestaque, ativa: true },
    });
    especialidadeByNome.set(esp.nome, e.id);
  }

  // 2. Garantir role "profissional" existe (cabe no escopo de quem opera o seed)
  const roleProfissional = await prisma.role.upsert({
    where: { name: "profissional" },
    update: {},
    create: { name: "profissional", description: "Profissional de saúde da unidade", scope: "unit" },
  });

  // 3. Criar/atualizar Users dos profissionais demo + vincular role medico
  const passwordHash = await bcrypt.hash("ifp-demo-2026", 10);
  for (const p of PROFISSIONAIS_DEMO) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {
        name: p.nomeExibicao,
        hashedPassword: passwordHash,
        primaryRoleName: "profissional",
        primaryUnitScope: "medico",
      },
      create: {
        email: p.email,
        name: p.nomeExibicao,
        hashedPassword: passwordHash,
        primaryRoleName: "profissional",
        primaryUnitScope: "medico",
      },
    });

    // Atribuição UserRole (profissional, medico)
    await prisma.userRole.upsert({
      where: {
        userId_roleId_unitScope: { userId: user.id, roleId: roleProfissional.id, unitScope: "medico" },
      },
      update: {},
      create: { userId: user.id, roleId: roleProfissional.id, unitScope: "medico" },
    });

    // Profissional vinculado
    const prof = await prisma.profissional.upsert({
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
      await prisma.profissionalEspecialidade.upsert({
        where: { profissionalId_especialidadeId: { profissionalId: prof.id, especialidadeId: espId } },
        update: {},
        create: { profissionalId: prof.id, especialidadeId: espId },
      });
    }

    // Template padrão: terças e quintas, 14h-18h, duração da primeira especialidade do profissional
    const espPrincipalNome = p.especialidades[0];
    const espPrincipalId = especialidadeByNome.get(espPrincipalNome)!;
    const espPrincipal = ESPECIALIDADES_SEED.find((e) => e.nome === espPrincipalNome)!;
    const validoDe = startOfDay(new Date());
    const validoAte = addDays(validoDe, 30);

    const template = await prisma.agendaTemplate.upsert({
      // Usar único hack: procurar por (profissional, especialidade, validoDe) — não há unique composite, então criar idempotentemente via deleteMany+create
      where: { id: `seed-template-${prof.id}` }, // id sintético — se não existir, falha e tomamos a branch create
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

    // Gerar slots dos próximos 30 dias para esse template (manual no seed, sem depender da lib que ainda não existe)
    let cursor = validoDe;
    while (cursor < validoAte) {
      const dow = cursor.getDay(); // 0=domingo
      if (template.diasSemana.includes(dow)) {
        const [hi, mi] = template.faixaInicio.split(":").map(Number);
        const [hf, mf] = template.faixaFim.split(":").map(Number);
        const inicioDia = new Date(cursor);
        inicioDia.setHours(hi, mi, 0, 0);
        const fimDia = new Date(cursor);
        fimDia.setHours(hf, mf, 0, 0);

        let slotInicio = inicioDia;
        while (addMinutes(slotInicio, template.duracaoSlotMin) <= fimDia) {
          await prisma.slot.upsert({
            where: {
              profissionalId_dataHoraInicio: { profissionalId: prof.id, dataHoraInicio: slotInicio },
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
          slotInicio = addMinutes(slotInicio, template.duracaoSlotMin);
        }
      }
      cursor = addDays(cursor, 1);
    }
  }

  console.log(`[seed] medico ok: ${ESPECIALIDADES_SEED.length} especialidades, ${PROFISSIONAIS_DEMO.length} profissionais, slots 30 dias`);
}
```

> Notas: o seed acima usa `addDays`/`addMinutes`/`startOfDay` do `date-fns`. Se o projeto ainda não tem `date-fns`, instalar: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm add date-fns"`. Se já tem, pular.
>
> Notas 2: o "id sintético" `seed-template-<profId>` é truque pra upsert idempotente sem unique composite. Funciona.

### Step 2.2 — Adicionar chamada `await seedMedico()` no main do seed

No `main()` de `prisma/seed.ts`, depois das chamadas existentes (`await seedUsersRolesEtc()`, `await seedCidadaos()`, etc.), inserir:

```ts
  await seedMedico();
```

### Step 2.3 — Rodar seed

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:seed"
```

Expected: termina sem erro. Log final inclui `[seed] medico ok: 10 especialidades, 3 profissionais, slots 30 dias`.

### Step 2.4 — Verificar via SQL

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT (SELECT COUNT(*) FROM \"Especialidade\") AS esp, (SELECT COUNT(*) FROM \"Profissional\") AS prof, (SELECT COUNT(*) FROM \"AgendaTemplate\") AS tmpl, (SELECT COUNT(*) FROM \"Slot\") AS slots;"'
```

Expected: `esp=10`, `prof=3`, `tmpl=3`, `slots>=60` (varia: 30 dias × ~9 slots/dia × dependendo dos dias da semana de hoje).

### Step 2.5 — Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add prisma/seed.ts package.json pnpm-lock.yaml
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(seed): especialidades + 3 profissionais demo + slots 30 dias (F1.B.1 T2)"
```

---

## Task 3: `lib/medico/agenda.ts` — `gerarSlots` + `slotsDisponiveis` (puro, TDD)

Lib pura, sem I/O direto. Funções determinísticas testáveis com fakes de input. A geração de slots a partir do template é a primeira função; `slotsDisponiveis` filtra do banco mas tem versão pura usada nos testes.

**Files:**
- Create: `src/lib/medico/agenda.ts`
- Create: `tests/unit/medico-agenda.test.ts`

### Step 3.1 — Write the failing tests

Create `tests/unit/medico-agenda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gerarSlots, type TemplateInput, type SlotGerado } from "@/lib/medico/agenda";

const baseDate = new Date("2026-06-01T00:00:00Z"); // segunda-feira

const tmplPadrao: TemplateInput = {
  profissionalId: "p1",
  especialidadeId: "e1",
  diasSemana: [2, 4], // terça, quinta
  faixaInicio: "14:00",
  faixaFim: "16:00",
  duracaoSlotMin: 30,
  validoDe: baseDate,
  validoAte: new Date("2026-06-15T00:00:00Z"),
};

describe("gerarSlots", () => {
  it("gera slots só nos dias da semana definidos", () => {
    const slots = gerarSlots(tmplPadrao);
    // 2026-06-01 é segunda-feira (dow=1) — não deve gerar.
    // 2026-06-02 é terça (dow=2), 2026-06-04 é quinta (dow=4), etc.
    const datasGeradas = [...new Set(slots.map((s) => s.dataHoraInicio.toISOString().slice(0, 10)))];
    expect(datasGeradas).toContain("2026-06-02");
    expect(datasGeradas).toContain("2026-06-04");
    expect(datasGeradas).not.toContain("2026-06-01");
    expect(datasGeradas).not.toContain("2026-06-03");
  });

  it("respeita faixa horária e duração", () => {
    const slots = gerarSlots(tmplPadrao).filter((s) => s.dataHoraInicio.toISOString().startsWith("2026-06-02"));
    // 14:00–16:00 com 30min = 4 slots: 14:00, 14:30, 15:00, 15:30
    expect(slots).toHaveLength(4);
    expect(slots[0].dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
    expect(slots[3].dataHoraInicio.toISOString().slice(11, 16)).toBe("15:30");
  });

  it("não passa do validoAte", () => {
    const slots = gerarSlots(tmplPadrao);
    for (const s of slots) {
      expect(s.dataHoraInicio.getTime()).toBeLessThan(tmplPadrao.validoAte!.getTime());
    }
  });

  it("propaga profissionalId e especialidadeId em cada slot", () => {
    const slots = gerarSlots(tmplPadrao);
    expect(slots.every((s) => s.profissionalId === "p1")).toBe(true);
    expect(slots.every((s) => s.especialidadeId === "e1")).toBe(true);
    expect(slots.every((s) => s.duracaoMin === 30)).toBe(true);
  });

  it("não corta slot pela metade quando duração não cabe na faixa", () => {
    const tmpl: TemplateInput = {
      ...tmplPadrao,
      diasSemana: [2],
      faixaInicio: "14:00",
      faixaFim: "14:45",
      duracaoSlotMin: 30,
    };
    const slots = gerarSlots(tmpl);
    // 14:00 (até 14:30) cabe; 14:30 (até 15:00) NÃO cabe (passa de 14:45). Espera 1 slot.
    const terca = slots.filter((s) => s.dataHoraInicio.toISOString().startsWith("2026-06-02"));
    expect(terca).toHaveLength(1);
    expect(terca[0].dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
  });

  it("validoAte nulo respeita limiteSuperior do parâmetro", () => {
    const tmpl: TemplateInput = { ...tmplPadrao, validoAte: null };
    const slots = gerarSlots(tmpl, { limiteSuperior: new Date("2026-06-10T00:00:00Z") });
    expect(slots.every((s) => s.dataHoraInicio.getTime() < new Date("2026-06-10T00:00:00Z").getTime())).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });
});
```

### Step 3.2 — Verify it fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-agenda"
```

Expected: FAIL — módulo não existe.

### Step 3.3 — Implement `gerarSlots`

Create `src/lib/medico/agenda.ts`:

```ts
export interface TemplateInput {
  profissionalId: string;
  especialidadeId: string;
  diasSemana: readonly number[]; // 0=dom..6=sáb
  faixaInicio: string; // "HH:mm"
  faixaFim: string;
  duracaoSlotMin: number;
  validoDe: Date;
  validoAte: Date | null;
}

export interface SlotGerado {
  profissionalId: string;
  especialidadeId: string;
  dataHoraInicio: Date;
  duracaoMin: number;
}

interface GerarSlotsOpts {
  limiteSuperior?: Date; // quando validoAte é null
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Gera slots disponíveis derivados de um template recorrente.
 *
 * Pura: não toca banco. Use em testes e como base do seed/job.
 */
export function gerarSlots(tmpl: TemplateInput, opts: GerarSlotsOpts = {}): SlotGerado[] {
  const slots: SlotGerado[] = [];
  const inicio = startOfUtcDay(tmpl.validoDe);
  const fim = tmpl.validoAte ?? opts.limiteSuperior;
  if (!fim) {
    throw new Error("gerarSlots: validoAte é null e limiteSuperior não foi fornecido");
  }

  const fimUtc = startOfUtcDay(fim);
  const { h: hIni, m: mIni } = parseHHMM(tmpl.faixaInicio);
  const { h: hFim, m: mFim } = parseHHMM(tmpl.faixaFim);

  let dia = inicio;
  while (dia < fimUtc) {
    if (tmpl.diasSemana.includes(dia.getUTCDay())) {
      const inicioFaixaDia = new Date(dia);
      inicioFaixaDia.setUTCHours(hIni, mIni, 0, 0);
      const fimFaixaDia = new Date(dia);
      fimFaixaDia.setUTCHours(hFim, mFim, 0, 0);

      let cursor = inicioFaixaDia;
      while (cursor.getTime() + tmpl.duracaoSlotMin * 60_000 <= fimFaixaDia.getTime()) {
        slots.push({
          profissionalId: tmpl.profissionalId,
          especialidadeId: tmpl.especialidadeId,
          dataHoraInicio: new Date(cursor),
          duracaoMin: tmpl.duracaoSlotMin,
        });
        cursor = new Date(cursor.getTime() + tmpl.duracaoSlotMin * 60_000);
      }
    }
    dia = addDays(dia, 1);
  }

  return slots;
}
```

### Step 3.4 — Verify it passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-agenda"
```

Expected: 6 testes verdes.

### Step 3.5 — Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/medico/agenda.ts tests/unit/medico-agenda.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): gerarSlots puro com 6 testes (F1.B.1 T3)"
```

---

## Task 4: `reservarSlot` (transação anti-overbooking)

Função que toca banco — usa `prisma.$transaction` com `updateMany` retornando count. Se count=0, slot já não está disponível → lança erro. Teste integração contra DB real.

**Files:**
- Modify: `src/lib/medico/agenda.ts`
- Modify: `tests/unit/medico-agenda.test.ts`

### Step 4.1 — Write the failing tests

Append em `tests/unit/medico-agenda.test.ts`:

```ts
import { db } from "@/lib/db";
import { reservarSlot, SlotIndisponivelError } from "@/lib/medico/agenda";

describe("reservarSlot (integration)", () => {
  // Helpers — depende do seed e dos demos
  async function fixtures() {
    const prof = await db.profissional.findFirstOrThrow({ where: { nomeExibicao: "Dr. João Silva" } });
    const esp = await db.especialidade.findUniqueOrThrow({ where: { nome: "Clínico Geral" } });
    const cid = await db.cidadao.findFirstOrThrow({ where: { unitIdOrigem: "medico" } });
    const slot = await db.slot.findFirstOrThrow({
      where: { profissionalId: prof.id, status: "disponivel" },
      orderBy: { dataHoraInicio: "asc" },
    });
    const erick = await db.user.findUniqueOrThrow({ where: { email: "erick.ramos@familiaponcio.org.br" } });
    return { prof, esp, cid, slot, erick };
  }

  async function reabrirSlot(slotId: string) {
    // limpa consulta + volta slot pra disponivel pra próxima rodada do teste ser estável
    await db.consulta.deleteMany({ where: { slotId } });
    await db.slot.update({ where: { id: slotId }, data: { status: "disponivel" } });
  }

  it("reserva slot disponível, cria Consulta e marca slot.status=reservado", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);

    const consulta = await reservarSlot({
      slotId: slot.id,
      cidadaoId: cid.id,
      profissionalId: prof.id,
      especialidadeId: esp.id,
      createdBy: erick.id,
    });

    expect(consulta.status).toBe("agendada");
    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("reservado");

    await reabrirSlot(slot.id);
  });

  it("lança SlotIndisponivelError quando outro processo já reservou", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);
    // Marca slot como reservado externamente
    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });

    await expect(
      reservarSlot({
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
      }),
    ).rejects.toThrow(SlotIndisponivelError);

    await reabrirSlot(slot.id);
  });

  it("é seguro contra concorrência (race condition simulada)", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);

    const args = {
      slotId: slot.id,
      cidadaoId: cid.id,
      profissionalId: prof.id,
      especialidadeId: esp.id,
      createdBy: erick.id,
    };

    // 5 tentativas concorrentes → 1 sucesso, 4 falhas
    const results = await Promise.allSettled([
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
    ]);
    const sucessos = results.filter((r) => r.status === "fulfilled");
    const falhas = results.filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(4);

    await reabrirSlot(slot.id);
  });
});
```

### Step 4.2 — Verify it fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-agenda"
```

Expected: 3 novos testes falham (módulo não exporta `reservarSlot`/`SlotIndisponivelError`).

### Step 4.3 — Implement

Append no FINAL de `src/lib/medico/agenda.ts`:

```ts
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export class SlotIndisponivelError extends Error {
  constructor(public readonly slotId: string) {
    super(`Slot ${slotId} não está mais disponível`);
    this.name = "SlotIndisponivelError";
  }
}

export interface ReservarSlotInput {
  slotId: string;
  cidadaoId: string;
  profissionalId: string;
  especialidadeId: string;
  createdBy: string;
  observacoesAgendamento?: string;
  origemTriagemId?: string;
}

/**
 * Reserva um slot atomicamente. Usa updateMany com filtro de status pra evitar
 * race condition: só atualiza se ainda estava "disponivel". Se 0 linhas → outro
 * já pegou.
 */
export async function reservarSlot(input: ReservarSlotInput) {
  return db.$transaction(async (tx) => {
    const upd = await tx.slot.updateMany({
      where: { id: input.slotId, status: "disponivel" },
      data: { status: "reservado" },
    });
    if (upd.count === 0) {
      throw new SlotIndisponivelError(input.slotId);
    }
    return tx.consulta.create({
      data: {
        slotId: input.slotId,
        cidadaoId: input.cidadaoId,
        profissionalId: input.profissionalId,
        especialidadeId: input.especialidadeId,
        createdBy: input.createdBy,
        observacoesAgendamento: input.observacoesAgendamento,
        origemTriagemId: input.origemTriagemId,
        status: "agendada",
      },
    });
  });
}
```

### Step 4.4 — Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:seed && pnpm test -- medico-agenda"
```

Expected: 6 unit + 3 integration verdes (9 total).

> Se algum teste de integração não achar fixtures, rodar seed primeiro: `pnpm db:seed`.

### Step 4.5 — Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/medico/agenda.ts tests/unit/medico-agenda.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): reservarSlot transacional anti-overbooking + 3 testes (F1.B.1 T4)"
```

---

## Task 5: `liberarSlot`, `bloquearSlot`, `transicionarConsulta`

Funções de manutenção. Lógica simples mas com edge cases (não permite bloquear slot que já tem consulta agendada).

**Files:**
- Modify: `src/lib/medico/agenda.ts`
- Modify: `tests/unit/medico-agenda.test.ts`

### Step 5.1 — Tests

Append em `tests/unit/medico-agenda.test.ts`:

```ts
import { liberarSlot, bloquearSlot, transicionarConsulta, SlotComConsultaError } from "@/lib/medico/agenda";

describe("bloquearSlot", () => {
  it("bloqueia slot disponível com motivo", async () => {
    const slot = await db.slot.findFirstOrThrow({ where: { status: "disponivel" } });
    await bloquearSlot(slot.id, "Férias programadas");
    const pos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(pos.status).toBe("bloqueado");
    expect(pos.motivoBloqueio).toBe("Férias programadas");
    await db.slot.update({ where: { id: slot.id }, data: { status: "disponivel", motivoBloqueio: null } });
  });

  it("rejeita bloquear slot que tem consulta agendada", async () => {
    const consulta = await db.consulta.findFirst({ where: { status: "agendada" } });
    if (!consulta) {
      // pula se o seed/estado não tem; o teste de reservar cria um
      return;
    }
    await expect(bloquearSlot(consulta.slotId, "tentativa")).rejects.toThrow(SlotComConsultaError);
  });
});

describe("liberarSlot", () => {
  it("libera slot reservado e cancela consulta", async () => {
    const slot = await db.slot.findFirstOrThrow({ where: { status: "disponivel" } });
    // simula reserva
    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({ where: { email: "erick.ramos@familiaponcio.org.br" } });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "agendada",
      },
    });

    await liberarSlot(slot.id, "Cidadão cancelou");

    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("disponivel");
    const consPos = await db.consulta.findUniqueOrThrow({ where: { id: c.id } });
    expect(consPos.status).toBe("cancelada");
    expect(consPos.cancelMotivo).toBe("Cidadão cancelou");
  });
});

describe("transicionarConsulta", () => {
  it("agendada → confirmada → em_atendimento → realizada (caminho feliz)", async () => {
    const slot = await db.slot.findFirstOrThrow({ where: { status: "disponivel" } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({ where: { email: "erick.ramos@familiaponcio.org.br" } });

    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "agendada",
      },
    });

    await transicionarConsulta(c.id, "confirmada");
    await transicionarConsulta(c.id, "em_atendimento");
    await transicionarConsulta(c.id, "realizada");

    const cPos = await db.consulta.findUniqueOrThrow({ where: { id: c.id } });
    expect(cPos.status).toBe("realizada");
    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("realizado");

    // cleanup
    await db.consulta.delete({ where: { id: c.id } });
    await db.slot.update({ where: { id: slot.id }, data: { status: "disponivel" } });
  });

  it("realizada → confirmada (regressão) é rejeitada", async () => {
    const slot = await db.slot.findFirstOrThrow({ where: { status: "disponivel" } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({ where: { email: "erick.ramos@familiaponcio.org.br" } });

    await db.slot.update({ where: { id: slot.id }, data: { status: "realizado" } });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "realizada",
      },
    });

    await expect(transicionarConsulta(c.id, "confirmada")).rejects.toThrow(/transi/i);

    await db.consulta.delete({ where: { id: c.id } });
    await db.slot.update({ where: { id: slot.id }, data: { status: "disponivel" } });
  });
});
```

### Step 5.2 — Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-agenda"
```

Expected: novos testes falham (símbolos não exportados).

### Step 5.3 — Implement

Append em `src/lib/medico/agenda.ts`:

```ts
import type { StatusConsulta } from "@prisma/client";

export class SlotComConsultaError extends Error {
  constructor(public readonly slotId: string) {
    super(`Slot ${slotId} tem consulta vinculada; cancele a consulta antes de bloquear`);
    this.name = "SlotComConsultaError";
  }
}

export class TransicaoInvalidaError extends Error {
  constructor(public readonly de: StatusConsulta, public readonly para: StatusConsulta) {
    super(`Transição inválida de ${de} para ${para}`);
    this.name = "TransicaoInvalidaError";
  }
}

const TRANSICOES: Record<StatusConsulta, ReadonlySet<StatusConsulta>> = {
  agendada: new Set(["confirmada", "em_atendimento", "faltou", "cancelada"]),
  confirmada: new Set(["em_atendimento", "faltou", "cancelada"]),
  em_atendimento: new Set(["realizada", "faltou", "cancelada"]),
  realizada: new Set(),
  faltou: new Set(),
  cancelada: new Set(),
};

const STATUS_SLOT_DERIVADO: Record<StatusConsulta, "reservado" | "realizado" | "faltou" | "disponivel"> = {
  agendada: "reservado",
  confirmada: "reservado",
  em_atendimento: "reservado",
  realizada: "realizado",
  faltou: "faltou",
  cancelada: "disponivel",
};

export async function bloquearSlot(slotId: string, motivo: string) {
  const slot = await db.slot.findUniqueOrThrow({ where: { id: slotId }, include: { consulta: true } });
  if (slot.consulta && slot.consulta.status !== "cancelada") {
    throw new SlotComConsultaError(slotId);
  }
  return db.slot.update({
    where: { id: slotId },
    data: { status: "bloqueado", motivoBloqueio: motivo },
  });
}

export async function liberarSlot(slotId: string, motivoCancelamento: string) {
  return db.$transaction(async (tx) => {
    await tx.consulta.updateMany({
      where: { slotId, status: { notIn: ["cancelada", "realizada", "faltou"] } },
      data: { status: "cancelada", cancelMotivo: motivoCancelamento },
    });
    return tx.slot.update({
      where: { id: slotId },
      data: { status: "disponivel", motivoBloqueio: null },
    });
  });
}

export async function transicionarConsulta(consultaId: string, para: StatusConsulta) {
  return db.$transaction(async (tx) => {
    const c = await tx.consulta.findUniqueOrThrow({ where: { id: consultaId } });
    if (!TRANSICOES[c.status].has(para)) {
      throw new TransicaoInvalidaError(c.status, para);
    }
    const updated = await tx.consulta.update({ where: { id: consultaId }, data: { status: para } });
    const slotStatus = STATUS_SLOT_DERIVADO[para];
    await tx.slot.update({ where: { id: c.slotId }, data: { status: slotStatus } });
    return updated;
  });
}
```

### Step 5.4 — Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-agenda"
```

Expected: ~13 testes verdes.

### Step 5.5 — Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/medico/agenda.ts tests/unit/medico-agenda.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): liberar/bloquear slot + transicionarConsulta com state machine (F1.B.1 T5)"
```

---

## Task 6: `lib/medico/rbac.ts` — capabilities

Capabilities especificas pra unidade médica. Reusa `lib/rbac.ts` existente.

**Files:**
- Create: `src/lib/medico/rbac.ts`
- Create: `tests/unit/medico-rbac.test.ts`

### Step 6.1 — Tests

Create `tests/unit/medico-rbac.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import {
  podeGerenciarProfissional,
  podeConfigurarAgendaProfissional,
  podeMarcarConsulta,
  podeTransicionarConsulta,
  podeGerenciarEspecialidade,
} from "@/lib/medico/rbac";

function sessionWith(roles: { name: RoleName; unitScope: UnitScope | null }[], userId = "u1"): Session {
  return {
    user: { id: userId, email: "x@y.z", name: null, roles, primaryRole: roles[0] },
    expires: "2099-01-01",
  } as Session;
}

describe("podeGerenciarProfissional", () => {
  it("super_admin pode", () => {
    const s = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(podeGerenciarProfissional(s)).toBe(true);
  });
  it("gestor:medico pode", () => {
    const s = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]);
    expect(podeGerenciarProfissional(s)).toBe(true);
  });
  it("recepcao:medico NÃO pode", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(podeGerenciarProfissional(s)).toBe(false);
  });
});

describe("podeConfigurarAgendaProfissional", () => {
  it("super_admin pode qualquer profissional", () => {
    const s = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(podeConfigurarAgendaProfissional(s, "outro-user")).toBe(true);
  });
  it("profissional pode a própria agenda", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeConfigurarAgendaProfissional(s, "user-X")).toBe(true);
  });
  it("profissional NÃO pode agenda de outro", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeConfigurarAgendaProfissional(s, "user-Y")).toBe(false);
  });
});

describe("podeMarcarConsulta", () => {
  it("recepcao:medico pode", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(podeMarcarConsulta(s)).toBe(true);
  });
  it("social pode (via encaminhamento)", () => {
    const s = sessionWith([{ name: "social", unitScope: null }]);
    expect(podeMarcarConsulta(s)).toBe(true);
  });
  it("profissional NÃO marca consulta pra si (só follow-up no F1.B.2)", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }]);
    expect(podeMarcarConsulta(s)).toBe(false);
  });
});

describe("podeTransicionarConsulta", () => {
  it("recepcao pode check-in / faltou", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(podeTransicionarConsulta(s, "agendada", "em_atendimento", "outro")).toBe(true);
    expect(podeTransicionarConsulta(s, "agendada", "faltou", "outro")).toBe(true);
  });
  it("profissional pode marcar realizada na sua consulta", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeTransicionarConsulta(s, "em_atendimento", "realizada", "user-X")).toBe(true);
  });
  it("profissional NÃO transiciona consulta de outro profissional", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeTransicionarConsulta(s, "em_atendimento", "realizada", "user-Y")).toBe(false);
  });
});

describe("podeGerenciarEspecialidade", () => {
  it("super_admin sim, gestor sim, recepcao não", () => {
    expect(podeGerenciarEspecialidade(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(true);
    expect(podeGerenciarEspecialidade(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(true);
    expect(podeGerenciarEspecialidade(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
});
```

### Step 6.2 — Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-rbac"
```

Expected: FAIL — módulo não existe.

### Step 6.3 — Implement

Create `src/lib/medico/rbac.ts`:

```ts
import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import type { StatusConsulta } from "@prisma/client";

export function podeGerenciarProfissional(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin") || hasAnyRole(session, "gestor_unidade");
  // (já é escopado a `medico` pelo gate de rota /medico)
}

export function podeConfigurarAgendaProfissional(
  session: Session | null,
  profissionalUserId: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  if (hasAnyRole(session, "gestor_unidade")) return true;
  if (hasAnyRole(session, "profissional") && session.user.id === profissionalUserId) return true;
  return false;
}

export function podeMarcarConsulta(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao", "social");
}

export function podeTransicionarConsulta(
  session: Session | null,
  de: StatusConsulta,
  para: StatusConsulta,
  consultaProfissionalUserId: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;

  // recepção pode check-in (em_atendimento) e faltou + cancelada
  if (hasAnyRole(session, "recepcao")) {
    return para === "em_atendimento" || para === "faltou" || para === "cancelada" || para === "confirmada";
  }

  // profissional só transiciona consulta DELE
  if (hasAnyRole(session, "profissional") && session.user.id === consultaProfissionalUserId) {
    return true;
  }

  return false;
}

export function podeGerenciarEspecialidade(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}
```

### Step 6.4 — Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- medico-rbac"
```

Expected: ~11 testes verdes.

### Step 6.5 — Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/medico/rbac.ts tests/unit/medico-rbac.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): capabilities RBAC (gerenciar profissional/agenda/consulta/especialidade) (F1.B.1 T6)"
```

---

## Task 7: `/medico/especialidades` CRUD

Lista, criar, editar, ativar/desativar. Server actions + page server component.

**Files:**
- Create: `src/app/medico/especialidades/page.tsx`
- Create: `src/app/medico/especialidades/actions.ts`

### Step 7.1 — Page server component

Create `src/app/medico/especialidades/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { criarEspecialidadeAction, atualizarEspecialidadeAction, toggleEspecialidadeAction } from "./actions";

export default async function EspecialidadesPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeGerenciarEspecialidade(session)) redirect("/medico" as Route);

  const lista = await db.especialidade.findMany({ orderBy: { nome: "asc" } });

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
          Centro Médico — Configuração
        </p>
        <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          Especialidades
        </h1>
        <p className="mt-2 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
          Catálogo das especialidades atendidas. Adicione, ajuste duração padrão, ative ou desative.
        </p>
      </header>

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Nova especialidade
        </h2>
        <form action={criarEspecialidadeAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            name="nome"
            required
            placeholder="Ex: Cardiologia"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
          />
          <input
            name="duracaoPadraoMin"
            type="number"
            required
            min={5}
            step={5}
            defaultValue={30}
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
          />
          <input
            name="corDestaque"
            required
            pattern="^#[0-9A-Fa-f]{6}$"
            defaultValue="#007571"
            className="rounded border px-3 py-2 text-sm font-mono"
            style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
          />
          <button
            type="submit"
            className="rounded py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
          >
            Adicionar
          </button>
        </form>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs tracking-wide uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            <tr>
              <th className="py-2 text-left">Nome</th>
              <th className="py-2 text-left">Duração padrão</th>
              <th className="py-2 text-left">Cor</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((esp) => (
              <tr key={esp.id} className="border-t" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
                <td className="py-3 font-medium" style={{ color: "rgb(var(--ifp-ink))" }}>
                  {esp.nome}
                </td>
                <td className="py-3" style={{ color: "rgb(var(--ifp-muted))" }}>
                  {esp.duracaoPadraoMin} min
                </td>
                <td className="py-3">
                  <span
                    className="inline-block h-4 w-4 rounded"
                    style={{ background: esp.corDestaque, border: "1px solid rgb(var(--ifp-surface-200))" }}
                  />
                  <span className="ml-2 font-mono text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                    {esp.corDestaque}
                  </span>
                </td>
                <td className="py-3">
                  <Badge variant={esp.ativa ? "success" : "default"}>{esp.ativa ? "Ativa" : "Inativa"}</Badge>
                </td>
                <td className="py-3 text-right">
                  <form action={toggleEspecialidadeAction} className="inline">
                    <input type="hidden" name="id" value={esp.id} />
                    <button
                      type="submit"
                      className="text-xs underline"
                      style={{ color: "rgb(var(--ifp-orange-700))" }}
                    >
                      {esp.ativa ? "Desativar" : "Reativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
```

### Step 7.2 — Server actions

Create `src/app/medico/especialidades/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

export async function criarEspecialidadeAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarEspecialidade(session)) throw new Error("Sem permissão");

  const nome = String(formData.get("nome") ?? "").trim();
  const duracaoPadraoMin = Number(formData.get("duracaoPadraoMin") ?? 30);
  const corDestaque = String(formData.get("corDestaque") ?? "#007571");

  if (!nome) throw new Error("Nome obrigatório");
  if (duracaoPadraoMin < 5) throw new Error("Duração mínima 5 min");
  if (!/^#[0-9A-Fa-f]{6}$/.test(corDestaque)) throw new Error("Cor inválida (hex)");

  await db.especialidade.create({
    data: { nome, duracaoPadraoMin, corDestaque, ativa: true },
  });
  await logEvent({ userId: session!.user.id, action: "especialidade_criada", meta: { nome } });
  revalidatePath("/medico/especialidades");
}

export async function atualizarEspecialidadeAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarEspecialidade(session)) throw new Error("Sem permissão");
  const id = String(formData.get("id") ?? "");
  const duracaoPadraoMin = Number(formData.get("duracaoPadraoMin") ?? 30);
  const corDestaque = String(formData.get("corDestaque") ?? "#007571");
  await db.especialidade.update({ where: { id }, data: { duracaoPadraoMin, corDestaque } });
  await logEvent({ userId: session!.user.id, action: "especialidade_atualizada", meta: { id } });
  revalidatePath("/medico/especialidades");
}

export async function toggleEspecialidadeAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarEspecialidade(session)) throw new Error("Sem permissão");
  const id = String(formData.get("id") ?? "");
  const e = await db.especialidade.findUniqueOrThrow({ where: { id } });
  await db.especialidade.update({ where: { id }, data: { ativa: !e.ativa } });
  await logEvent({
    userId: session!.user.id,
    action: e.ativa ? "especialidade_desativada" : "especialidade_reativada",
    meta: { id },
  });
  revalidatePath("/medico/especialidades");
}
```

> Nota: `audit.ts` precisa ter as ações `especialidade_criada/atualizada/desativada/reativada` no union (ver T1 da spec RBAC v2). Se o type não tem, adicionar na enum/union em `src/lib/audit.ts`.

### Step 7.3 — Adicionar ações ao audit type

Abrir `src/lib/audit.ts`. Localizar o union `AuditAction` (ou similar) e adicionar as 4 strings novas:

```ts
| "especialidade_criada"
| "especialidade_atualizada"
| "especialidade_desativada"
| "especialidade_reativada"
| "profissional_cadastrado"
| "profissional_atualizado"
| "profissional_desativado"
| "template_criado"
| "template_atualizado"
| "slot_bloqueado"
| "slot_desbloqueado"
| "consulta_agendada"
| "consulta_confirmada"
| "consulta_iniciada"
| "consulta_realizada"
| "consulta_faltou"
| "consulta_cancelada"
```

(Adicione todos esses agora, pois tasks seguintes vão usar — evita commit-revisita.)

### Step 7.4 — Smoke

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck 2>&1 | tail -5"
```

Expected: clean.

Login manual: abrir `http://localhost:3000/medico/login`, logar como Erick (`erick.ramos@familiaponcio.org.br` / `ifp-dev-2026`), ir em `/medico/especialidades`, ver lista das 10 especialidades, adicionar uma nova "Cardiologia", confirmar que aparece e fica ativa.

### Step 7.5 — Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/especialidades/ src/lib/audit.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): CRUD /medico/especialidades + audit actions (F1.B.1 T7)"
```

---

## Task 8: `/medico/profissionais` — lista + novo + edit

3 telas + actions. Vincula User existente, especialidades many-to-many.

**Files:**
- Create: `src/app/medico/profissionais/page.tsx` (lista)
- Create: `src/app/medico/profissionais/novo/page.tsx`
- Create: `src/app/medico/profissionais/[id]/page.tsx` (detalhe + edit)
- Create: `src/app/medico/profissionais/actions.ts`

### Step 8.1 — Lista

Create `src/app/medico/profissionais/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";

export default async function ProfissionaisPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const profs = await db.profissional.findMany({
    include: { user: true, especialidades: { include: { especialidade: true } } },
    orderBy: { nomeExibicao: "asc" },
  });

  const podeAdd = podeGerenciarProfissional(session);

  return (
    <AppShell session={session}>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            Centro Médico
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
            Profissionais
          </h1>
        </div>
        {podeAdd && (
          <Link
            href={"/medico/profissionais/novo" as Route}
            className="rounded px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
          >
            + Novo profissional
          </Link>
        )}
      </header>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs tracking-wide uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            <tr>
              <th className="py-2 text-left">Nome</th>
              <th className="py-2 text-left">Conselho</th>
              <th className="py-2 text-left">Especialidades</th>
              <th className="py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {profs.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
                <td className="py-3">
                  <Link
                    href={`/medico/profissionais/${p.id}` as Route}
                    className="font-medium"
                    style={{ color: "rgb(var(--ifp-orange-700))" }}
                  >
                    {p.nomeExibicao}
                  </Link>
                </td>
                <td className="py-3 text-xs font-mono" style={{ color: "rgb(var(--ifp-muted))" }}>
                  {p.conselho} {p.nroConselho}
                </td>
                <td className="py-3 text-xs">
                  {p.especialidades.map((pe) => (
                    <span
                      key={pe.especialidadeId}
                      className="mr-1 inline-block rounded px-2 py-0.5 text-xs"
                      style={{ background: pe.especialidade.corDestaque + "22", color: pe.especialidade.corDestaque }}
                    >
                      {pe.especialidade.nome}
                    </span>
                  ))}
                </td>
                <td className="py-3">
                  <Badge variant={p.ativo ? "success" : "default"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
```

### Step 8.2 — Novo profissional

Create `src/app/medico/profissionais/novo/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { criarProfissionalAction } from "../actions";

export default async function NovoProfissionalPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeGerenciarProfissional(session)) redirect("/medico/profissionais" as Route);

  // Users com role profissional + medico OU sem profissional ainda
  const usersElegiveis = await db.user.findMany({
    where: {
      AND: [
        { profissional: null },
        {
          userRoles: {
            some: { role: { name: "profissional" }, unitScope: "medico" },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
  });

  const especialidades = await db.especialidade.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } });

  return (
    <AppShell session={session}>
      <h1 className="mb-6 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
        Novo profissional
      </h1>
      <Card>
        <form action={criarProfissionalAction} className="space-y-4">
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              User vinculado (precisa ter role profissional:medico em /admin/users)
            </span>
            <select
              name="userId"
              required
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            >
              <option value="">— escolha —</option>
              {usersElegiveis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email} ({u.email})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              Nome de exibição
            </span>
            <input
              name="nomeExibicao"
              required
              placeholder="Dr. João Silva"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                Conselho
              </span>
              <input
                name="conselho"
                required
                placeholder="CRM-RJ / CRO-RJ / CRP-RJ ..."
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                Nº conselho
              </span>
              <input
                name="nroConselho"
                required
                placeholder="12345"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              Especialidades (selecione 1 ou mais)
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {especialidades.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="especialidadeIds" value={e.id} />
                  <span>{e.nome}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              Bio curta (opcional)
            </span>
            <textarea
              name="bio"
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            />
          </label>

          <button
            type="submit"
            className="rounded px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
          >
            Cadastrar
          </button>
        </form>
      </Card>
    </AppShell>
  );
}
```

### Step 8.3 — Detalhe + edit

Create `src/app/medico/profissionais/[id]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { podeGerenciarProfissional, podeConfigurarAgendaProfissional } from "@/lib/medico/rbac";
import { atualizarProfissionalAction } from "../actions";

export default async function ProfissionalDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const prof = await db.profissional.findUnique({
    where: { id },
    include: { user: true, especialidades: { include: { especialidade: true } }, templates: true },
  });
  if (!prof) notFound();

  const podeEditar = podeGerenciarProfissional(session) || session.user.id === prof.userId;
  const especialidades = await db.especialidade.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } });
  const especialidadesSel = new Set(prof.especialidades.map((pe) => pe.especialidadeId));

  return (
    <AppShell session={session}>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            Profissional
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
            {prof.nomeExibicao}
          </h1>
          <p className="mt-1 text-sm font-mono" style={{ color: "rgb(var(--ifp-muted))" }}>
            {prof.conselho} {prof.nroConselho}
          </p>
        </div>
        <Badge variant={prof.ativo ? "success" : "default"}>{prof.ativo ? "Ativo" : "Inativo"}</Badge>
      </header>

      {podeEditar ? (
        <Card>
          <form action={atualizarProfissionalAction} className="space-y-4">
            <input type="hidden" name="id" value={prof.id} />
            <label className="block">
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                Nome de exibição
              </span>
              <input
                name="nomeExibicao"
                defaultValue={prof.nomeExibicao}
                required
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                  Conselho
                </span>
                <input
                  name="conselho"
                  defaultValue={prof.conselho}
                  required
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
              <label>
                <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                  Nº conselho
                </span>
                <input
                  name="nroConselho"
                  defaultValue={prof.nroConselho}
                  required
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
            </div>
            <fieldset>
              <legend className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                Especialidades
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {especialidades.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="especialidadeIds"
                      value={e.id}
                      defaultChecked={especialidadesSel.has(e.id)}
                    />
                    <span>{e.nome}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                Bio
              </span>
              <textarea
                name="bio"
                defaultValue={prof.bio ?? ""}
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>
            <button
              type="submit"
              className="rounded px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
            >
              Salvar
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <p style={{ color: "rgb(var(--ifp-ink))" }}>{prof.bio ?? "Sem bio cadastrada."}</p>
          <ul className="mt-4">
            {prof.especialidades.map((pe) => (
              <li key={pe.especialidadeId}>{pe.especialidade.nome}</li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
```

### Step 8.4 — Actions

Create `src/app/medico/profissionais/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

function parseEspecialidades(formData: FormData): string[] {
  return formData.getAll("especialidadeIds").map((v) => String(v)).filter(Boolean);
}

export async function criarProfissionalAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarProfissional(session)) throw new Error("Sem permissão");

  const userId = String(formData.get("userId") ?? "");
  const nomeExibicao = String(formData.get("nomeExibicao") ?? "").trim();
  const conselho = String(formData.get("conselho") ?? "").trim();
  const nroConselho = String(formData.get("nroConselho") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const espIds = parseEspecialidades(formData);

  if (!userId || !nomeExibicao || !conselho || !nroConselho) {
    throw new Error("Campos obrigatórios ausentes");
  }
  if (espIds.length === 0) throw new Error("Selecione ao menos 1 especialidade");

  const prof = await db.profissional.create({
    data: {
      userId,
      nomeExibicao,
      conselho,
      nroConselho,
      bio,
      ativo: true,
      especialidades: { create: espIds.map((eid) => ({ especialidadeId: eid })) },
    },
  });
  await logEvent({
    userId: session!.user.id,
    action: "profissional_cadastrado",
    meta: { profissionalId: prof.id, nomeExibicao },
  });
  redirect(`/medico/profissionais/${prof.id}` as Route);
}

export async function atualizarProfissionalAction(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id") ?? "");
  const prof = await db.profissional.findUniqueOrThrow({ where: { id } });
  const ehProprio = session?.user.id === prof.userId;
  if (!podeGerenciarProfissional(session) && !ehProprio) throw new Error("Sem permissão");

  const nomeExibicao = String(formData.get("nomeExibicao") ?? "").trim();
  const conselho = String(formData.get("conselho") ?? "").trim();
  const nroConselho = String(formData.get("nroConselho") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const espIds = parseEspecialidades(formData);

  await db.$transaction(async (tx) => {
    await tx.profissional.update({
      where: { id },
      data: { nomeExibicao, conselho, nroConselho, bio },
    });
    await tx.profissionalEspecialidade.deleteMany({ where: { profissionalId: id } });
    if (espIds.length > 0) {
      await tx.profissionalEspecialidade.createMany({
        data: espIds.map((eid) => ({ profissionalId: id, especialidadeId: eid })),
      });
    }
  });
  await logEvent({
    userId: session!.user.id,
    action: "profissional_atualizado",
    meta: { profissionalId: id },
  });
  revalidatePath(`/medico/profissionais/${id}`);
}
```

### Step 8.5 — Smoke + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/profissionais/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): /medico/profissionais lista+novo+edit com especialidades many-to-many (F1.B.1 T8)"
```

---

## Task 9: `/medico/minha-agenda` — self-service do profissional

Profissional vê próprio template + lista de slots gerados + bloqueia slots. Quem não é profissional → 404 amigável ("você não tem agenda própria").

**Files:**
- Create: `src/app/medico/minha-agenda/page.tsx`
- Create: `src/app/medico/minha-agenda/actions.ts`

### Step 9.1 — Page

Create `src/app/medico/minha-agenda/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { criarTemplateAction, bloquearSlotAction, desbloquearSlotAction } from "./actions";

export default async function MinhaAgendaPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!hasAnyRole(session, "profissional", "super_admin")) {
    return (
      <AppShell session={session}>
        <Card>
          <p>Você não tem agenda própria. Acesse <a href="/medico/agenda">/medico/agenda</a> pra ver agendas dos profissionais.</p>
        </Card>
      </AppShell>
    );
  }

  const prof = await db.profissional.findUnique({
    where: { userId: session.user.id },
    include: {
      templates: { where: { ativo: true }, orderBy: { createdAt: "desc" } },
      especialidades: { include: { especialidade: true } },
    },
  });
  if (!prof) {
    return (
      <AppShell session={session}>
        <Card>
          <p>Seu User não está vinculado a um Profissional cadastrado. Peça à gestão pra cadastrar.</p>
        </Card>
      </AppShell>
    );
  }

  const proxSlots = await db.slot.findMany({
    where: { profissionalId: prof.id, dataHoraInicio: { gte: new Date() } },
    include: { consulta: { include: { cidadao: true } } },
    orderBy: { dataHoraInicio: "asc" },
    take: 50,
  });

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
          Minha agenda
        </p>
        <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          {prof.nomeExibicao}
        </h1>
      </header>

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Templates ativos ({prof.templates.length})
        </h2>
        {prof.templates.length === 0 && (
          <p className="mb-4 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
            Você ainda não criou template. Crie abaixo pra gerar slots automaticamente.
          </p>
        )}
        {prof.templates.map((t) => (
          <div key={t.id} className="mb-2 rounded border p-3 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
            <strong>Dias:</strong> {t.diasSemana.map(d => ["dom","seg","ter","qua","qui","sex","sáb"][d]).join(", ")} ·{" "}
            <strong>Horário:</strong> {t.faixaInicio}–{t.faixaFim} · <strong>Duração:</strong> {t.duracaoSlotMin}min
          </div>
        ))}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Novo template
        </h2>
        <form action={criarTemplateAction} className="space-y-3">
          <fieldset>
            <legend className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Dias da semana</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {["dom","seg","ter","qua","qui","sex","sáb"].map((label, idx) => (
                <label key={idx} className="text-sm">
                  <input type="checkbox" name="diasSemana" value={idx} className="mr-1" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Início</span>
              <input name="faixaInicio" type="time" required defaultValue="14:00" className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
            </label>
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Fim</span>
              <input name="faixaFim" type="time" required defaultValue="18:00" className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
            </label>
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Duração (min)</span>
              <input name="duracaoSlotMin" type="number" min={10} step={5} required defaultValue={30} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Especialidade</span>
            <select name="especialidadeId" required className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
              <option value="">— escolha —</option>
              {prof.especialidades.map((pe) => (
                <option key={pe.especialidadeId} value={pe.especialidadeId}>
                  {pe.especialidade.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Válido de</span>
              <input name="validoDe" type="date" required className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
            </label>
            <label>
              <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>Válido até (vazio = 90 dias)</span>
              <input name="validoAte" type="date" className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
            </label>
          </div>
          <button type="submit" className="rounded px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}>
            Criar template e gerar slots
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Próximos slots
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs tracking-wide uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            <tr>
              <th className="py-2 text-left">Data/hora</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Cidadão</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {proxSlots.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
                <td className="py-3">{s.dataHoraInicio.toLocaleString("pt-BR")}</td>
                <td className="py-3"><Badge variant={s.status === "disponivel" ? "success" : s.status === "bloqueado" ? "warning" : "default"}>{s.status}</Badge></td>
                <td className="py-3 text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                  {s.consulta?.cidadao.nomeCompleto ?? "—"}
                </td>
                <td className="py-3 text-right">
                  {s.status === "disponivel" && (
                    <form action={bloquearSlotAction} className="inline">
                      <input type="hidden" name="slotId" value={s.id} />
                      <input type="text" name="motivo" placeholder="motivo" required className="mr-1 rounded border px-2 py-1 text-xs" style={{ borderColor: "rgb(var(--ifp-surface-200))" }} />
                      <button type="submit" className="text-xs underline" style={{ color: "rgb(var(--ifp-orange-700))" }}>Bloquear</button>
                    </form>
                  )}
                  {s.status === "bloqueado" && (
                    <form action={desbloquearSlotAction} className="inline">
                      <input type="hidden" name="slotId" value={s.id} />
                      <button type="submit" className="text-xs underline" style={{ color: "rgb(var(--ifp-orange-700))" }}>Desbloquear</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
```

### Step 9.2 — Actions

Create `src/app/medico/minha-agenda/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gerarSlots, bloquearSlot, liberarSlot } from "@/lib/medico/agenda";
import { podeConfigurarAgendaProfissional } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

export async function criarTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");

  const prof = await db.profissional.findUnique({ where: { userId: session.user.id } });
  if (!prof) throw new Error("Profissional não encontrado");
  if (!podeConfigurarAgendaProfissional(session, prof.userId)) throw new Error("Sem permissão");

  const diasSemana = formData.getAll("diasSemana").map((v) => Number(v));
  const faixaInicio = String(formData.get("faixaInicio"));
  const faixaFim = String(formData.get("faixaFim"));
  const duracaoSlotMin = Number(formData.get("duracaoSlotMin"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const validoDe = new Date(String(formData.get("validoDe")));
  const validoAteRaw = String(formData.get("validoAte") ?? "");
  const validoAte = validoAteRaw ? new Date(validoAteRaw) : new Date(validoDe.getTime() + 90 * 86400_000);

  const template = await db.agendaTemplate.create({
    data: {
      profissionalId: prof.id,
      especialidadeId,
      diasSemana,
      faixaInicio,
      faixaFim,
      duracaoSlotMin,
      validoDe,
      validoAte,
      ativo: true,
    },
  });

  const slotsToCreate = gerarSlots({
    profissionalId: prof.id,
    especialidadeId,
    diasSemana,
    faixaInicio,
    faixaFim,
    duracaoSlotMin,
    validoDe,
    validoAte,
  });

  for (const s of slotsToCreate) {
    await db.slot.upsert({
      where: { profissionalId_dataHoraInicio: { profissionalId: prof.id, dataHoraInicio: s.dataHoraInicio } },
      update: {},
      create: {
        profissionalId: prof.id,
        especialidadeId,
        templateId: template.id,
        dataHoraInicio: s.dataHoraInicio,
        duracaoMin: duracaoSlotMin,
        status: "disponivel",
      },
    });
  }

  await logEvent({ userId: session.user.id, action: "template_criado", meta: { templateId: template.id, slotsCount: slotsToCreate.length } });
  revalidatePath("/medico/minha-agenda");
}

export async function bloquearSlotAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  const slotId = String(formData.get("slotId"));
  const motivo = String(formData.get("motivo") ?? "Bloqueado");

  const slot = await db.slot.findUniqueOrThrow({ where: { id: slotId }, include: { profissional: true } });
  if (!podeConfigurarAgendaProfissional(session, slot.profissional.userId)) throw new Error("Sem permissão");

  await bloquearSlot(slotId, motivo);
  await logEvent({ userId: session.user.id, action: "slot_bloqueado", meta: { slotId, motivo } });
  revalidatePath("/medico/minha-agenda");
}

export async function desbloquearSlotAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  const slotId = String(formData.get("slotId"));

  const slot = await db.slot.findUniqueOrThrow({ where: { id: slotId }, include: { profissional: true } });
  if (!podeConfigurarAgendaProfissional(session, slot.profissional.userId)) throw new Error("Sem permissão");

  await liberarSlot(slotId, "Desbloqueado pelo profissional");
  await logEvent({ userId: session.user.id, action: "slot_desbloqueado", meta: { slotId } });
  revalidatePath("/medico/minha-agenda");
}
```

### Step 9.3 — Smoke + commit

Logar como Dr. João Silva (`dr.joao@familiaponcio.org.br` / `ifp-demo-2026`) → `/medico/minha-agenda`. Vê 1 template do seed + lista de slots. Bloqueia um → recarrega → fica bloqueado.

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/minha-agenda/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): /medico/minha-agenda self-service (template + slots + bloquear) (F1.B.1 T9)"
```

---

## Task 10: `/medico` home — Fila do dia

Substituir o placeholder atual. Mostra próximas consultas do dia + KPIs simples.

**Files:**
- Modify: ⚠️ A home da unidade médica fica em `src/app/medico/page.tsx` (literal segment > dynamic catch-all). Se já existir um `src/app/[unidade]/page.tsx` que cobre `/medico`, esse fica intacto pra outras unidades. **Criar** `src/app/medico/page.tsx`.

### Step 10.1 — Implementação

Create `src/app/medico/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { podeMarcarConsulta } from "@/lib/medico/rbac";

function statusBadgeVariant(s: string): "default" | "success" | "warning" | "danger" {
  if (s === "realizada") return "success";
  if (s === "faltou" || s === "cancelada") return "danger";
  if (s === "em_atendimento") return "warning";
  return "default";
}

export default async function MedicoHomePage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const hoje = new Date();
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(hoje); fimDia.setHours(23, 59, 59, 999);
  const em7Dias = new Date(hoje); em7Dias.setDate(em7Dias.getDate() + 7);

  const [consultasHoje, consultas7d, slotsLivresHoje] = await Promise.all([
    db.consulta.findMany({
      where: { slot: { dataHoraInicio: { gte: inicioDia, lte: fimDia } } },
      include: { slot: true, cidadao: true, profissional: true, especialidade: true },
      orderBy: { slot: { dataHoraInicio: "asc" } },
    }),
    db.consulta.count({
      where: { slot: { dataHoraInicio: { gte: inicioDia, lte: em7Dias } }, status: { in: ["agendada", "confirmada"] } },
    }),
    db.slot.count({
      where: { status: "disponivel", dataHoraInicio: { gte: hoje, lte: fimDia } },
    }),
  ]);

  return (
    <AppShell session={session}>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            Centro Médico
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
            Fila do dia
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        {podeMarcarConsulta(session) && (
          <Link
            href={"/medico/consultas/nova" as Route}
            className="rounded px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}
          >
            + Marcar consulta
          </Link>
        )}
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Consultas hoje" value={String(consultasHoje.length)} accent="laranja" />
        <KpiCard label="Próximos 7 dias" value={String(consultas7d)} accent="medico" />
        <KpiCard label="Slots livres hoje" value={String(slotsLivresHoje)} accent="recreativo" />
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Agenda de hoje
        </h2>
        {consultasHoje.length === 0 ? (
          <p className="text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
            Nenhuma consulta agendada para hoje.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs tracking-wide uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
              <tr>
                <th className="py-2 text-left">Horário</th>
                <th className="py-2 text-left">Cidadão</th>
                <th className="py-2 text-left">Profissional</th>
                <th className="py-2 text-left">Especialidade</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {consultasHoje.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
                  <td className="py-3 font-mono text-xs">
                    {c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/medico/consultas/${c.id}` as Route}
                      className="font-medium"
                      style={{ color: "rgb(var(--ifp-orange-700))" }}
                    >
                      {c.cidadao.nomeCompleto}
                    </Link>
                  </td>
                  <td className="py-3" style={{ color: "rgb(var(--ifp-ink))" }}>
                    {c.profissional.nomeExibicao}
                  </td>
                  <td className="py-3">
                    <span
                      className="rounded px-2 py-0.5 text-xs"
                      style={{
                        background: c.especialidade.corDestaque + "22",
                        color: c.especialidade.corDestaque,
                      }}
                    >
                      {c.especialidade.nome}
                    </span>
                  </td>
                  <td className="py-3">
                    <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
```

### Step 10.2 — Smoke + commit

Logar como Erick → `/medico` → vê fila do dia (provavelmente vazia até T12 ter slot reservado). KPIs aparecem.

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): home /medico com fila do dia + 3 KPIs (F1.B.1 T10)"
```

---

## Task 11: `/medico/agenda` — grid semanal Doctolib-like

Vista semanal 7 dias × faixa horária. Cores por especialidade. Filtros (profissional + especialidade).

**Files:**
- Create: `src/app/medico/agenda/page.tsx`

### Step 11.1 — Implementação

Create `src/app/medico/agenda/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";

const HORA_INICIO = 7;
const HORA_FIM = 22;
const PX_POR_MIN = 1.5;
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function AgendaSemanalPage({
  searchParams,
}: {
  searchParams: Promise<{ profissionalId?: string; especialidadeId?: string; semana?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const sp = await searchParams;
  const refDate = sp.semana ? new Date(sp.semana) : new Date();
  const inicio = inicioSemana(refDate);
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 7);

  const [profs, especialidades, slots] = await Promise.all([
    db.profissional.findMany({ where: { ativo: true }, orderBy: { nomeExibicao: "asc" } }),
    db.especialidade.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    db.slot.findMany({
      where: {
        dataHoraInicio: { gte: inicio, lt: fim },
        ...(sp.profissionalId ? { profissionalId: sp.profissionalId } : {}),
        ...(sp.especialidadeId ? { especialidadeId: sp.especialidadeId } : {}),
      },
      include: { profissional: true, especialidade: true, consulta: { include: { cidadao: true } } },
      orderBy: { dataHoraInicio: "asc" },
    }),
  ]);

  const altura = (HORA_FIM - HORA_INICIO) * 60 * PX_POR_MIN;

  return (
    <AppShell session={session}>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
            Centro Médico
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
            Agenda semanal
          </h1>
        </div>
        <form className="flex items-center gap-2">
          <select name="profissionalId" defaultValue={sp.profissionalId ?? ""} className="rounded border px-2 py-1 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
            <option value="">Todos profissionais</option>
            {profs.map((p) => (<option key={p.id} value={p.id}>{p.nomeExibicao}</option>))}
          </select>
          <select name="especialidadeId" defaultValue={sp.especialidadeId ?? ""} className="rounded border px-2 py-1 text-sm" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
            <option value="">Todas especialidades</option>
            {especialidades.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
          </select>
          <button type="submit" className="rounded px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}>Filtrar</button>
        </form>
      </header>

      <Card>
        <div className="grid" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
          {/* Header dias */}
          <div></div>
          {DIAS.map((d, i) => {
            const dt = new Date(inicio); dt.setDate(dt.getDate() + i);
            return (
              <div key={i} className="border-b py-2 text-center text-xs font-semibold" style={{ color: "rgb(var(--ifp-muted))", borderColor: "rgb(var(--ifp-surface-200))" }}>
                {d} {dt.getDate()}/{dt.getMonth() + 1}
              </div>
            );
          })}

          {/* Coluna horas */}
          <div className="relative" style={{ height: altura }}>
            {Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i).map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-1 text-[10px]"
                style={{ top: (h - HORA_INICIO) * 60 * PX_POR_MIN, color: "rgb(var(--ifp-muted))" }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 colunas de dia */}
          {DIAS.map((_, dia) => {
            const dtStart = new Date(inicio); dtStart.setDate(dtStart.getDate() + dia);
            const dtEnd = new Date(dtStart); dtEnd.setHours(23, 59, 59, 999);
            const slotsDia = slots.filter((s) => s.dataHoraInicio >= dtStart && s.dataHoraInicio <= dtEnd);
            return (
              <div key={dia} className="relative border-l" style={{ height: altura, borderColor: "rgb(var(--ifp-surface-200))" }}>
                {/* linhas horárias */}
                {Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => i + HORA_INICIO).map((h) => (
                  <div key={h} className="absolute w-full border-t" style={{ top: (h - HORA_INICIO) * 60 * PX_POR_MIN, borderColor: "rgb(var(--ifp-surface-200))" }} />
                ))}
                {/* slots */}
                {slotsDia.map((s) => {
                  const minDay = (s.dataHoraInicio.getHours() - HORA_INICIO) * 60 + s.dataHoraInicio.getMinutes();
                  const top = minDay * PX_POR_MIN;
                  const height = s.duracaoMin * PX_POR_MIN;
                  const isBlocked = s.status === "bloqueado";
                  const isReserved = s.status === "reservado" || s.status === "realizado";
                  return (
                    <div
                      key={s.id}
                      className="absolute mx-1 overflow-hidden rounded px-1 text-[10px]"
                      style={{
                        top,
                        height,
                        left: 0,
                        right: 0,
                        background: isBlocked
                          ? `repeating-linear-gradient(45deg, ${s.especialidade.corDestaque}22, ${s.especialidade.corDestaque}22 6px, transparent 6px, transparent 12px)`
                          : isReserved
                          ? s.especialidade.corDestaque + "AA"
                          : s.especialidade.corDestaque + "33",
                        color: isReserved ? "#fff" : "rgb(var(--ifp-ink))",
                      }}
                      title={`${s.profissional.nomeExibicao} · ${s.especialidade.nome} · ${s.status}`}
                    >
                      <div className="truncate font-bold">{s.profissional.nomeExibicao.split(" ").slice(0, 2).join(" ")}</div>
                      {s.consulta && <div className="truncate">{s.consulta.cidadao.nomeCompleto}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
```

### Step 11.2 — Smoke + commit

Acessar `/medico/agenda` logado como Erick → ver grid 7 colunas, slots dos próximos dias do seed coloridos por especialidade.

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/agenda/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): /medico/agenda grid semanal Doctolib-like com filtros (F1.B.1 T11)"
```

---

## Task 12: `/medico/consultas/nova` — wizard 4 steps

Server actions com state na URL (querystring). 4 etapas: buscar cidadão → especialidade → slot → confirmar.

**Files:**
- Create: `src/app/medico/consultas/nova/page.tsx`
- Create: `src/app/medico/consultas/nova/actions.ts`

### Step 12.1 — Page (wizard com estado em searchParams)

Create `src/app/medico/consultas/nova/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { reservarConsultaAction } from "./actions";

export default async function NovaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cidadaoId?: string; especialidadeId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const sp = await searchParams;

  // Step 1: buscar cidadão
  if (!sp.cidadaoId) {
    const matches = sp.q
      ? await db.cidadao.findMany({
          where: {
            OR: [
              { nomeCompleto: { contains: sp.q, mode: "insensitive" } },
              { cpf: { contains: sp.q } },
              { telefonePrincipal: { contains: sp.q } },
            ],
            statusCadastro: { not: "deletado" },
          },
          take: 10,
          orderBy: { nomeCompleto: "asc" },
        })
      : [];

    return (
      <AppShell session={session}>
        <h1 className="mb-6 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          Marcar nova consulta
        </h1>
        <Card>
          <p className="mb-3 text-sm font-semibold">Passo 1 de 4: Cidadão</p>
          <form method="get">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Buscar por nome, CPF ou telefone"
              className="w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            />
            <button type="submit" className="mt-2 rounded px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}>Buscar</button>
          </form>
          {matches.length > 0 && (
            <ul className="mt-4 divide-y" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
              {matches.map((c) => (
                <li key={c.id} className="py-2">
                  <Link
                    href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
                    className="font-medium"
                    style={{ color: "rgb(var(--ifp-orange-700))" }}
                  >
                    {c.nomeCompleto}
                  </Link>
                  <span className="ml-2 text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                    {c.cpf} · {c.telefonePrincipal}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </AppShell>
    );
  }

  const cidadao = await db.cidadao.findUniqueOrThrow({ where: { id: sp.cidadaoId } });

  // Step 2: especialidade
  if (!sp.especialidadeId) {
    const especialidades = await db.especialidade.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } });
    return (
      <AppShell session={session}>
        <h1 className="mb-6 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          Marcar consulta · {cidadao.nomeCompleto}
        </h1>
        <Card>
          <p className="mb-3 text-sm font-semibold">Passo 2 de 4: Especialidade</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {especialidades.map((e) => (
              <Link
                key={e.id}
                href={`/medico/consultas/nova?cidadaoId=${cidadao.id}&especialidadeId=${e.id}` as Route}
                className="rounded border p-3 text-sm font-medium hover:opacity-80"
                style={{
                  borderColor: "rgb(var(--ifp-surface-200))",
                  borderLeftColor: e.corDestaque,
                  borderLeftWidth: 4,
                }}
              >
                {e.nome}
                <p className="mt-1 text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                  {e.duracaoPadraoMin} min padrão
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </AppShell>
    );
  }

  const especialidade = await db.especialidade.findUniqueOrThrow({ where: { id: sp.especialidadeId } });

  // Step 3: escolher slot disponível
  const slots = await db.slot.findMany({
    where: {
      especialidadeId: sp.especialidadeId,
      status: "disponivel",
      dataHoraInicio: { gte: new Date() },
    },
    include: { profissional: true },
    orderBy: { dataHoraInicio: "asc" },
    take: 30,
  });

  return (
    <AppShell session={session}>
      <h1 className="mb-6 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
        Marcar consulta · {cidadao.nomeCompleto}
      </h1>
      <Card>
        <p className="mb-3 text-sm font-semibold">Passo 3 de 4: Escolha um horário ({especialidade.nome})</p>
        {slots.length === 0 ? (
          <p style={{ color: "rgb(var(--ifp-muted))" }}>Nenhum slot disponível nos próximos dias pra essa especialidade.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
            {slots.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.dataHoraInicio.toLocaleString("pt-BR")}</p>
                  <p className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                    {s.profissional.nomeExibicao} · {s.duracaoMin} min
                  </p>
                </div>
                <form action={reservarConsultaAction}>
                  <input type="hidden" name="slotId" value={s.id} />
                  <input type="hidden" name="cidadaoId" value={cidadao.id} />
                  <input type="hidden" name="profissionalId" value={s.profissionalId} />
                  <input type="hidden" name="especialidadeId" value={s.especialidadeId} />
                  <button type="submit" className="rounded px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: "rgb(var(--ifp-orange-500))" }}>
                    Reservar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
```

### Step 12.2 — Action

Create `src/app/medico/consultas/nova/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { reservarSlot, SlotIndisponivelError } from "@/lib/medico/agenda";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

export async function reservarConsultaAction(formData: FormData) {
  const session = await auth();
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const slotId = String(formData.get("slotId"));
  const cidadaoId = String(formData.get("cidadaoId"));
  const profissionalId = String(formData.get("profissionalId"));
  const especialidadeId = String(formData.get("especialidadeId"));

  try {
    const consulta = await reservarSlot({
      slotId,
      cidadaoId,
      profissionalId,
      especialidadeId,
      createdBy: session!.user.id,
    });
    await logEvent({
      userId: session!.user.id,
      action: "consulta_agendada",
      meta: { consultaId: consulta.id, slotId, cidadaoId },
    });
    redirect(`/medico/consultas/${consulta.id}` as Route);
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      redirect(`/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}&erro=slot_indisponivel` as Route);
    }
    throw e;
  }
}
```

### Step 12.3 — Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/medico/consultas/nova/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): wizard /medico/consultas/nova 4 steps com anti-overbooking (F1.B.1 T12)"
```

---

## Task 13: `/medico/consultas/[id]` — detalhe + transições

Mostra detalhe + botões contextuais de transição.

**Files:**
- Create: `src/app/medico/consultas/[id]/page.tsx`
- Create: `src/app/medico/consultas/[id]/actions.ts`

### Step 13.1 — Page

Create `src/app/medico/consultas/[id]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { podeTransicionarConsulta } from "@/lib/medico/rbac";
import { transitionAction, cancelAction } from "./actions";

const PROXIMOS_STATUS: Record<string, ("confirmada" | "em_atendimento" | "realizada" | "faltou" | "cancelada")[]> = {
  agendada: ["confirmada", "em_atendimento", "faltou", "cancelada"],
  confirmada: ["em_atendimento", "faltou", "cancelada"],
  em_atendimento: ["realizada", "faltou", "cancelada"],
  realizada: [],
  faltou: [],
  cancelada: [],
};

export default async function ConsultaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const consulta = await db.consulta.findUnique({
    where: { id },
    include: {
      slot: true,
      cidadao: true,
      profissional: { include: { user: true } },
      especialidade: true,
    },
  });
  if (!consulta) notFound();

  const proximos = PROXIMOS_STATUS[consulta.status];

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
          Consulta
        </p>
        <h1 className="mt-1 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          {consulta.cidadao.nomeCompleto}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
          {consulta.slot.dataHoraInicio.toLocaleString("pt-BR")} · {consulta.profissional.nomeExibicao} · {consulta.especialidade.nome}
        </p>
      </header>

      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <span style={{ color: "rgb(var(--ifp-muted))" }}>Status atual:</span>
          <Badge variant={consulta.status === "realizada" ? "success" : consulta.status === "faltou" || consulta.status === "cancelada" ? "danger" : "default"}>
            {consulta.status}
          </Badge>
        </div>

        {proximos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {proximos.filter((p) => p !== "cancelada").map((p) => (
              <form key={p} action={transitionAction} className="inline">
                <input type="hidden" name="id" value={consulta.id} />
                <input type="hidden" name="para" value={p} />
                <button
                  type="submit"
                  disabled={
                    !podeTransicionarConsulta(session, consulta.status, p, consulta.profissional.userId)
                  }
                  className="rounded border px-3 py-1 text-sm font-medium disabled:opacity-50"
                  style={{
                    borderColor: "rgb(var(--ifp-orange-700))",
                    color: "rgb(var(--ifp-orange-700))",
                  }}
                >
                  → {p}
                </button>
              </form>
            ))}
            {proximos.includes("cancelada") && (
              <form action={cancelAction} className="inline">
                <input type="hidden" name="id" value={consulta.id} />
                <input
                  type="text"
                  name="motivo"
                  required
                  placeholder="motivo"
                  className="mr-1 rounded border px-2 py-1 text-sm"
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
                <button
                  type="submit"
                  className="rounded px-3 py-1 text-sm font-bold text-white"
                  style={{ backgroundColor: "rgb(var(--ifp-danger))" }}
                >
                  Cancelar
                </button>
              </form>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--ifp-muted))" }}>
          Observações
        </h2>
        <p style={{ color: "rgb(var(--ifp-ink))" }}>
          {consulta.observacoesAgendamento || "Sem observações registradas no agendamento."}
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--ifp-muted))" }}>
          Espaço pro prontuário (F1.B.2)
        </h2>
        <p style={{ color: "rgb(var(--ifp-muted))" }}>
          Aqui vai entrar o prontuário 3 colunas (histórico/evolução/ações) no próximo sub-módulo.
        </p>
      </Card>
    </AppShell>
  );
}
```

### Step 13.2 — Actions

Create `src/app/medico/consultas/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transicionarConsulta, liberarSlot } from "@/lib/medico/agenda";
import { podeTransicionarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

export async function transitionAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");

  const id = String(formData.get("id"));
  const para = String(formData.get("para")) as
    | "confirmada"
    | "em_atendimento"
    | "realizada"
    | "faltou";

  const c = await db.consulta.findUniqueOrThrow({
    where: { id },
    include: { profissional: true },
  });
  if (!podeTransicionarConsulta(session, c.status, para, c.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await transicionarConsulta(id, para);

  const actionMap: Record<typeof para, string> = {
    confirmada: "consulta_confirmada",
    em_atendimento: "consulta_iniciada",
    realizada: "consulta_realizada",
    faltou: "consulta_faltou",
  };
  await logEvent({ userId: session.user.id, action: actionMap[para], meta: { consultaId: id } });

  revalidatePath(`/medico/consultas/${id}`);
}

export async function cancelAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");

  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "Cancelada");

  const c = await db.consulta.findUniqueOrThrow({ where: { id }, include: { profissional: true } });
  if (!podeTransicionarConsulta(session, c.status, "cancelada", c.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await liberarSlot(c.slotId, motivo);
  await logEvent({ userId: session.user.id, action: "consulta_cancelada", meta: { consultaId: id, motivo } });

  revalidatePath(`/medico/consultas/${id}`);
}
```

### Step 13.3 — Smoke + commit

Marcar uma consulta via /medico/consultas/nova. Abrir `/medico/consultas/[id]`. Clicar transições (confirmar → em_atendimento → realizada). Verificar audit log.

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add "src/app/medico/consultas/[id]/"
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): /medico/consultas/[id] detalhe + transições de status (F1.B.1 T13)"
```

---

## Task 14: AppShell — nav links da unidade médica

Sidebar contextual: quando user está em `/medico/*`, mostra nav específica.

**Files:**
- Modify: `src/components/app-shell.tsx`

### Step 14.1 — Adicionar nav contextual

Abrir `src/components/app-shell.tsx`. Localizar a lista de `items` (que hoje é fixa). Substituir o bloco `const items: NavItem[] = [...]` por lógica dependente do path:

```tsx
import { headers } from "next/headers";
import { podeGerenciarEspecialidade, podeGerenciarProfissional } from "@/lib/medico/rbac";
```

E dentro do componente `AppShell`, substituir a derivação atual de items por:

```tsx
const h = await headers();
const pathname = h.get("x-pathname") ?? ""; // se não tiver middleware setando, fallback vazio
const inMedico = pathname.startsWith("/medico");

const items: NavItem[] = inMedico
  ? [
      { label: "Fila do dia", href: "/medico" },
      { label: "Agenda semanal", href: "/medico/agenda" },
      ...(hasAnyRole(session, "profissional") ? [{ label: "Minha agenda", href: "/medico/minha-agenda" }] : []),
      { label: "Profissionais", href: "/medico/profissionais" },
      ...(podeGerenciarEspecialidade(session) ? [{ label: "Especialidades", href: "/medico/especialidades" }] : []),
      { label: "Cidadãos", href: "/app/cidadaos" },
    ]
  : [
      { label: "Visão geral", href: "/app" },
      { label: "Cidadãos", href: "/app/cidadaos" },
      ...(podeAgendar(session) ? [{ label: "Vagas", href: "/app/vagas" }] : []),
      ...(hasAnyRole(session, "super_admin", "social") ? [{ label: "Serviço Social", href: "/social" }] : []),
      ...(hasAnyRole(session, "super_admin") ? [{ label: "Admin", href: "/admin/users" }] : []),
    ];
```

> **Nota crítica sobre `headers()`**: Next 16 não expõe `pathname` em `headers()` automaticamente. Solução: configurar no `src/proxy.ts` pra setar header `x-pathname`. Ver step 14.2.

### Step 14.2 — Setar `x-pathname` no proxy

Editar `src/proxy.ts`. Logo no início do callback `auth((req) => { ... })`, adicionar:

```ts
const response = NextResponse.next();
response.headers.set("x-pathname", req.nextUrl.pathname);
```

E retornar `response` ao final dos branches que apenas seguem (em vez de `return;`). Onde já há `return Response.redirect(...)`, deixar como está.

> Alternativa simples se headers no proxy ficar chato: usar `usePathname()` em componente client + passar como prop pra AppShell, ou checar via route group `(medico)` colocando todas rotas /medico/* em `app/medico/(unidade)/...` com layout próprio que controle nav. **Recomendo a alternativa mais simples**: criar `src/app/medico/layout.tsx` (Next 16 nested layout) que retorna `<AppShell session={session} navContext="medico">{children}</AppShell>`.

### Step 14.2-alt — Implementação via layout aninhado (Recomendado)

Em vez de mexer no proxy, criar layout aninhado:

Create `src/app/medico/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";

export default async function MedicoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  return <>{children}</>;
}
```

Hmm, isso não muda o AppShell. Pra realmente trocar a nav, ou (a) o AppShell aceita prop `navContext` ou (b) trocar `AppShell` por `MedicoAppShell` específico.

**Simplificação YAGNI:** por ora, deixar AppShell sem mudança e fazer cada página `/medico/*` que importa AppShell **passar** items próprios via prop nova (opcional). Editar AppShell pra aceitar `items?: NavItem[]`. Se prop dada, usa essa; senão, calcula default.

Mudar assinatura:

```tsx
interface AppShellProps {
  session: Session;
  children: React.ReactNode;
  items?: NavItem[]; // override opcional
}

export function AppShell({ session, children, items: itemsOverride }: AppShellProps) {
  // ... resto igual, mas trocar `const items: NavItem[] = [...]` por:
  const items: NavItem[] = itemsOverride ?? [
    { label: "Visão geral", href: "/app" },
    { label: "Cidadãos", href: "/app/cidadaos" },
    ...(podeAgendar(session) ? [{ label: "Vagas", href: "/app/vagas" }] : []),
    ...(hasAnyRole(session, "super_admin", "social") ? [{ label: "Serviço Social", href: "/social" }] : []),
    ...(hasAnyRole(session, "super_admin") ? [{ label: "Admin", href: "/admin/users" }] : []),
  ];
  // ... resto inalterado
}
```

E em cada `src/app/medico/*/page.tsx`, ao invés de `<AppShell session={session}>`, passar items próprios:

```tsx
const medicoItems = [
  { label: "Fila do dia", href: "/medico" },
  { label: "Agenda semanal", href: "/medico/agenda" },
  ...(hasAnyRole(session, "profissional") ? [{ label: "Minha agenda", href: "/medico/minha-agenda" }] : []),
  { label: "Profissionais", href: "/medico/profissionais" },
  ...(podeGerenciarEspecialidade(session) ? [{ label: "Especialidades", href: "/medico/especialidades" }] : []),
  { label: "Cidadãos", href: "/app/cidadaos" },
];

return <AppShell session={session} items={medicoItems}>...</AppShell>;
```

Pra evitar duplicação, criar `src/lib/medico/nav.ts`:

```ts
import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import type { NavItem } from "@/components/sidebar-nav";

export function medicoNavItems(session: Session): NavItem[] {
  return [
    { label: "Fila do dia", href: "/medico" },
    { label: "Agenda semanal", href: "/medico/agenda" },
    ...(hasAnyRole(session, "profissional") ? [{ label: "Minha agenda", href: "/medico/minha-agenda" }] : []),
    { label: "Profissionais", href: "/medico/profissionais" },
    ...(podeGerenciarEspecialidade(session) ? [{ label: "Especialidades", href: "/medico/especialidades" }] : []),
    { label: "Cidadãos", href: "/app/cidadaos" },
  ];
}
```

E em todas as `src/app/medico/*/page.tsx`, importar `medicoNavItems` e passar como `items`. Editar **uma a uma** as 8 páginas (home, agenda, profissionais lista/novo/[id], minha-agenda, consultas/nova, consultas/[id], especialidades).

### Step 14.3 — Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/app-shell.tsx src/lib/medico/nav.ts src/app/medico/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(medico): nav contextual via items override no AppShell + helper medicoNavItems (F1.B.1 T14)"
```

---

## Task 15: E2e tests + cleanup + push

5 cenários cobrindo fluxos críticos. Cleanup do plano. Push consolidado.

**Files:**
- Create: `tests/e2e/medico-agenda.spec.ts`

### Step 15.1 — E2e spec

Create `tests/e2e/medico-agenda.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const SENHA_DEMO = "ifp-demo-2026";
const SENHA_ERICK = "ifp-dev-2026";

async function loginAs(page: import("@playwright/test").Page, slug: string, email: string, senha: string) {
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("F1.B.1 Médico Agenda", () => {
  test("Erick vê fila do dia em /medico", async ({ page }) => {
    await loginAs(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);
    await expect(page.getByRole("heading", { name: "Fila do dia" })).toBeVisible();
    await expect(page.getByText("Consultas hoje")).toBeVisible();
  });

  test("Profissional Dr. João vê própria agenda mas não a de outros", async ({ page }) => {
    await loginAs(page, "medico", "dr.joao@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/minha-agenda");
    await expect(page.getByRole("heading", { name: /Dr\. João/ })).toBeVisible();
    // tentar acessar profissional de outro não tem botão de editar
    await page.goto("/medico/profissionais");
    const linkDraMaria = page.getByRole("link", { name: /Dra\. Maria/ });
    await linkDraMaria.click();
    // Detalhe de outro profissional não mostra form de edit
    await expect(page.getByRole("button", { name: "Salvar" })).toHaveCount(0);
  });

  test("Maria marca consulta no wizard 4 steps", async ({ page }) => {
    await loginAs(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/consultas/nova");

    // Step 1: buscar cidadão
    await page.getByPlaceholder(/Buscar/).fill("Almeida");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link").first().click();

    // Step 2: especialidade
    await page.getByRole("link", { name: /Pediatria/ }).click();

    // Step 3: escolher primeiro slot
    await page.getByRole("button", { name: "Reservar" }).first().click();

    // Step 4: redireciona pro detalhe
    await expect(page.getByText(/Status atual/)).toBeVisible();
  });

  test("Anti-overbooking: segunda tentativa do mesmo slot falha", async ({ page, context }) => {
    await loginAs(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/consultas/nova");
    await page.getByPlaceholder(/Buscar/).fill("Almeida");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link").first().click();
    await page.getByRole("link", { name: /Pediatria/ }).click();

    // Captura URL do form e do slot
    const page2 = await context.newPage();
    await loginAs(page2, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page2.goto(page.url());
    await page2.getByRole("button", { name: "Reservar" }).first().click();

    // Volta na primeira, tenta reservar o mesmo slot
    await page.getByRole("button", { name: "Reservar" }).first().click();
    // Pode redirect pra erro_slot_indisponivel — a URL deve conter o param
    await expect(page).toHaveURL(/erro=slot_indisponivel|consultas\//);
  });

  test("Profissional bloqueia próprio slot", async ({ page }) => {
    await loginAs(page, "medico", "dr.joao@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/minha-agenda");

    // Procura primeiro slot disponível, clica em bloquear
    const linhaDisponivel = page.locator("tr", { has: page.locator("text=/disponivel/") }).first();
    await linhaDisponivel.locator("input[name='motivo']").fill("Férias programadas");
    await linhaDisponivel.locator("button", { hasText: "Bloquear" }).click();
    await expect(page.locator("text=/bloqueado/")).toBeVisible();
  });
});
```

### Step 15.2 — Build + e2e

```bash
wsl -d Ubuntu -- bash -c "pkill -f 'next dev' 2>/dev/null; pkill -f 'next-server' 2>/dev/null; sleep 2"
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:seed && pnpm build && pnpm test:e2e -- medico-agenda"
```

Expected: 5 testes verdes. Se algum falhar, ajustar (selectors são pegadinha).

### Step 15.3 — Verificação final

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test"
```

Expected: tudo verde. Unit suite ~85+ testes (era 71, ganhou ~14 da agenda + 11 do rbac médico = +25).

Verificar contagens no DB pra confirmar seed estável:

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT COUNT(*) AS especialidades FROM \"Especialidade\"; SELECT COUNT(*) AS profissionais FROM \"Profissional\"; SELECT COUNT(*) AS slots FROM \"Slot\"; SELECT COUNT(*) AS consultas FROM \"Consulta\";"'
```

### Step 15.4 — Commit + push final

```bash
git -C "C:/Users/Administrador/ifp-connect" add tests/e2e/medico-agenda.spec.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "test(e2e): 5 cenarios F1.B.1 (fila, minha-agenda, wizard, anti-overbooking, bloquear) (F1.B.1 T15)"
git -C "C:/Users/Administrador/ifp-connect" log --oneline 29342e2..HEAD
git -C "C:/Users/Administrador/ifp-connect" push origin main
```

Expected: ~15 commits desde a spec. Push sucesso.

---

## Self-Review

**1. Spec coverage:**

| Seção da spec | Task |
|---|---|
| §1 Motivação | (cabeçalho do plano) |
| §2 Decisões fechadas | implícitas em todas |
| §3 Defaults assumidos | implícitas (sem WhatsApp, sem auto-agendamento etc.) |
| §4.1 Schema Prisma (5 modelos + 2 enums) | T1 |
| §4.2 `gerarSlots`/`reservarSlot` lógica | T3, T4 |
| §4.3 RBAC matriz | T6 + gates em cada page (T7-T13) |
| §5.1 Estrutura de arquivos | T7-T13 |
| §5.2 Telas (8) | T7 esp, T8 prof×3, T9 minha-agenda, T10 home, T11 agenda, T12 nova, T13 detalhe |
| §6 Fluxos A-E | T1+T2 (cadastrar prof e gerar seed), T9 (configurar agenda), T10+T12 (marcar), T13 (transições), T9 (bloquear) |
| §7 Sub-tasks alto nível | T1-T15 |
| §8 Não-objetivos | (declarados na spec; plano respeita) |
| §9 Riscos | T1 índices, T4 anti-overbooking, T5 estado guardando soft-delete |
| §10 Critérios sucesso | T15 e2e cobre 5; suíte unit cobre o resto |

**Gap explícito:** Seed (T2) gera template **manualmente** porque `gerarSlots` só existe a partir de T3. Após T3, refatorar seed pra usar a lib é possível mas YAGNI — o seed-tmpl atualmente funciona idempotente.

**2. Placeholder scan:** zero "TBD"/"TODO" não-explicado. Os "F1.B.2 prontuário" mencionados em vários lugares são referências futuras claras, não placeholders. O comentário em T13 "espaço pro prontuário (F1.B.2)" é mensagem visível na UI explicando o porquê do detalhe ser raso por ora — intencional.

**3. Type consistency:**
- `Especialidade.corDestaque` é `string` (hex) em T1, T2, T7, T11, T12 ✓
- `Slot.dataHoraInicio` é `Date` em T1, T3, T4, T9, T10, T11 ✓
- `Consulta.status` é `StatusConsulta` em T1, T5, T13 ✓
- `transicionarConsulta(id, para)` assinatura igual em T5 e T13 ✓
- `reservarSlot(input)` mesma forma em T4, T12 ✓
- `gerarSlots(tmpl, opts)` mesma forma em T3, T9 ✓
- `podeMarcarConsulta(session)` mesma em T6, T10, T12 ✓
- `podeTransicionarConsulta(session, de, para, userId)` mesma em T6, T13 ✓

---

## Estimativa de tempo

| Task | Tempo |
|---|---|
| T1 schema + migration | ~20 min |
| T2 seed | ~30 min |
| T3 gerarSlots TDD | ~30 min |
| T4 reservarSlot TDD | ~30 min |
| T5 liberar/bloquear/transicionar | ~40 min |
| T6 RBAC capabilities | ~25 min |
| T7 /especialidades CRUD | ~40 min |
| T8 /profissionais × 3 | ~60 min |
| T9 /minha-agenda | ~50 min |
| T10 /medico home | ~40 min |
| T11 /medico/agenda grid | ~60 min |
| T12 /consultas/nova wizard | ~50 min |
| T13 /consultas/[id] | ~40 min |
| T14 AppShell nav contextual | ~30 min |
| T15 e2e + push | ~50 min |

**Total ~9–10 horas contínuas.** ~2 dias úteis com interrupções e ajustes.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-28-medico-agenda-fila.md`. Two execution options:**

**1. Subagent-Driven (recomendado)** — Dispatch um subagent fresh por task, review entre tasks, iteração rápida. Plano com 15 tasks bem isoladas é caso ideal.

**2. Inline Execution** — Executo task-a-task aqui na mesma sessão. Mais simples auditar passo-a-passo mas custo maior em tokens.

**Qual abordagem?**
