# Motor de Agenda — Fases 2-4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar task-a-task. Steps usam checkbox (`- [ ]`).

**Goal:** Completar os 3 buracos do motor de agenda sobre o core da Fase 1 — agendamento dinâmico (médico), agendar entrevista do Serviço Social, e agenda do dia.

**Architecture:** O core `src/lib/agenda/core.ts` ganha `criarSlotAdHoc` (delegate-based, igual `reservarCAS`). Médico e Social consomem; nenhuma tabela do médico muda; social ganha tabelas próprias via migration aditiva.

**Tech Stack:** Next.js App Router, Prisma/Postgres (dev 5433), vitest node-only. pnpm roda no WSL Ubuntu. Verify via `.sh` no WSL.

**Base (Fase 1, pronta):** `core.gerarSlots` (puro), `core.reservarCAS` (thunk CAS), `core.criarMaquinaEstados`. Médico delega. 38 testes verdes.

---

## Fase 2 — Agendamento dinâmico (médico): slot ad-hoc no balcão + walk-in

**Files:**

- Modify: `src/lib/agenda/core.ts` (add `criarSlotAdHoc`)
- Test: `tests/unit/agenda-core.test.ts` (add ad-hoc cases)
- Modify: `src/lib/medico/agenda.ts` (add `reservarSlotAdHoc`, `SlotJaExisteError`)
- Test: `tests/unit/medico-agenda.test.ts` (ad-hoc + walk-in + race)
- Modify: `src/lib/medico/agenda-schema.ts` (add `criarSlotAdHocSchema`)
- Test: `tests/unit/agenda-schema.test.ts`
- Modify: `src/app/medico/consultas/nova/actions.ts` (add `criarSlotAdHocAction`)
- Modify: `src/app/medico/consultas/nova/page.tsx` (form ad-hoc no branch "sem horário" + botão "atender agora")

### Task 2.1: core.criarSlotAdHoc (TDD puro)

- [ ] **Step 1 — teste falho** em `agenda-core.test.ts`:

```ts
describe("core.criarSlotAdHoc", () => {
  it("cria via delegate com status disponivel + recurso mesclado", async () => {
    const calls: any[] = [];
    const create = async (data: any) => {
      calls.push(data);
      return { id: "s1", ...data };
    };
    const slot = await criarSlotAdHoc({
      create,
      recurso: { profissionalId: "p1", especialidadeId: "e1" },
      dataHoraInicio: new Date("2026-06-09T13:00:00Z"),
      duracaoMin: 30,
    });
    expect(calls[0].status).toBe("disponivel");
    expect(calls[0].profissionalId).toBe("p1");
    expect(calls[0].duracaoMin).toBe(30);
    expect((slot as any).id).toBe("s1");
  });
  it("rejeita duracaoMin <= 0", async () => {
    await expect(
      criarSlotAdHoc({
        create: async () => ({}),
        recurso: {},
        dataHoraInicio: new Date(),
        duracaoMin: 0,
      }),
    ).rejects.toThrow(/duracao/i);
  });
});
```

Importar `criarSlotAdHoc` no topo do arquivo de teste.

- [ ] **Step 2 — rodar (FAIL):** `criarSlotAdHoc is not exported`.
- [ ] **Step 3 — implementar** em `core.ts`:

```ts
export interface CriarSlotAdHocArgs<T> {
  create: (
    data: Record<string, unknown> & {
      dataHoraInicio: Date;
      duracaoMin: number;
      status: "disponivel";
    },
  ) => Promise<T>;
  recurso: Record<string, unknown>; // { profissionalId, especialidadeId } | { assistenteSocialId }
  dataHoraInicio: Date;
  duracaoMin: number;
}
/** Cria um slot disponível on-demand (o "dinâmico"). Delegate-based: o caller passa o
 *  create da SUA tabela; o core padroniza status + mescla o recurso. Pure de I/O. */
export async function criarSlotAdHoc<T>(args: CriarSlotAdHocArgs<T>): Promise<T> {
  if (args.duracaoMin <= 0) throw new Error("criarSlotAdHoc: duracaoMin deve ser > 0");
  return args.create({
    ...args.recurso,
    dataHoraInicio: args.dataHoraInicio,
    duracaoMin: args.duracaoMin,
    status: "disponivel",
  });
}
```

- [ ] **Step 4 — rodar (PASS).**
- [ ] **Step 5 — commit:** `feat(agenda): core.criarSlotAdHoc (slot dinamico delegate-based)`

### Task 2.2: médico reservarSlotAdHoc (TDD integração)

- [ ] **Step 1 — teste falho** em `medico-agenda.test.ts` (padrão `fixtures()` + cleanup inline):

```ts
describe("reservarSlotAdHoc (encaixe/walk-in)", () => {
  it("cria slot ad-hoc disponivel e reserva numa transacao", async () => {
    const f = await fixtures();
    const dh = new Date(Date.now() + 3600_000);
    const consulta = await reservarSlotAdHoc({
      profissionalId: f.prof.id,
      especialidadeId: f.esp.id,
      cidadaoId: f.cidadao.id,
      createdBy: f.erick.id,
      dataHoraInicio: dh,
      duracaoMin: 30,
    });
    const slot = await db.slot.findUniqueOrThrow({ where: { id: consulta.slotId } });
    expect(slot.templateId).toBeNull();
    expect(slot.status).toBe("reservado");
    expect(consulta.status).toBe("agendada");
    await db.consulta.delete({ where: { id: consulta.id } });
    await db.slot.delete({ where: { id: slot.id } });
  });
  it("walk-in (dataHoraInicio=now) entra na fila", async () => {
    /* idem com new Date() */
  });
});
```

- [ ] **Step 2 — rodar (FAIL).**
- [ ] **Step 3 — implementar** em `medico/agenda.ts`:

```ts
export class SlotJaExisteError extends Error {
  constructor() {
    super("Ja existe um horario para esse profissional nesse instante");
    this.name = "SlotJaExisteError";
  }
}
export interface ReservarSlotAdHocInput {
  profissionalId: string;
  especialidadeId: string;
  cidadaoId: string;
  createdBy: string;
  dataHoraInicio: Date;
  duracaoMin: number;
  observacoesAgendamento?: string;
  origemTriagemId?: string;
  origemEncaminhamentoId?: string;
}
export async function reservarSlotAdHoc(input: ReservarSlotAdHocInput) {
  try {
    return await db.$transaction(async (tx) => {
      const slot = await core.criarSlotAdHoc({
        create: (data) => tx.slot.create({ data: data as Prisma.SlotUncheckedCreateInput }),
        recurso: { profissionalId: input.profissionalId, especialidadeId: input.especialidadeId },
        dataHoraInicio: input.dataHoraInicio,
        duracaoMin: input.duracaoMin,
      });
      const ganhou = await core.reservarCAS(() =>
        tx.slot.updateMany({
          where: { id: slot.id, status: "disponivel" },
          data: { status: "reservado" },
        }),
      );
      if (!ganhou) throw new SlotIndisponivelError(slot.id);
      const consulta = await tx.consulta.create({
        data: {
          slotId: slot.id,
          cidadaoId: input.cidadaoId,
          profissionalId: input.profissionalId,
          especialidadeId: input.especialidadeId,
          createdBy: input.createdBy,
          observacoesAgendamento: input.observacoesAgendamento,
          origemTriagemId: input.origemTriagemId,
          origemEncaminhamentoId: input.origemEncaminhamentoId,
          status: "agendada",
        },
      });
      if (input.origemEncaminhamentoId)
        await agendarEncaminhamento(tx, input.origemEncaminhamentoId);
      return consulta;
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002")
      throw new SlotJaExisteError();
    throw e;
  }
}
```

- [ ] **Step 4 — rodar (PASS)** (precisa DB dev: `pnpm dev:up && pnpm db:seed`).
- [ ] **Step 5 — commit:** `feat(medico): reservarSlotAdHoc (encaixe + walk-in) sobre o core`

### Task 2.3: schema + action + UI

- [ ] `criarSlotAdHocSchema` em `agenda-schema.ts` (campos: cidadaoId, profissionalId, especialidadeId não-vazios; `dataHoraInicio` coercível a Date; `duracaoMin` int>0) + teste em `agenda-schema.test.ts`. Commit.
- [ ] `criarSlotAdHocAction(formData)` em `nova/actions.ts` espelhando `reservarConsultaAction` mas chamando `reservarSlotAdHoc`; trata `SlotJaExisteError` → `?erro=slot_existe`. Walk-in: `atenderAgoraAction(formData)` = mesma action com `dataHoraInicio=new Date()`, `duracaoMin=30`.
- [ ] UI em `nova/page.tsx`: no branch `slots.length===0` (linha ~247) trocar o Card estático por um `<form action={criarSlotAdHocAction}>` com `<input type="datetime-local" name="dataHoraInicio">` + select de profissional da especialidade + `SubmitButton`. E acima da lista de slots, um `<form action={atenderAgoraAction}>` com select de profissional + `SubmitButton` "Atender agora (encaixe)". Buscar profissionais da especialidade: confirmar a relação `Profissional`↔`Especialidade` no schema durante execução.
- [ ] Verify: `pnpm typecheck && lint && test && build`. Playwright: marcar consulta sem slot via ad-hoc + walk-in aparece na recepção. Commit.

---

## Fase 3 — Agendar a entrevista do Serviço Social (migration aditiva)

**Files:**

- Modify: `prisma/schema.prisma` (SlotSocial, EntrevistaSocial, enum StatusEntrevistaSocial; relations inversas em User/Cidadao/Triagem)
- Migration: `pnpm db:migrate --name add_agenda_social`
- Create: `src/lib/social/agenda.ts` (reservarEntrevista, gerarSlotsSociais, transição entrevista — delega ao core)
- Test: `tests/unit/social-agenda.test.ts`
- Create: `src/app/social/agenda/page.tsx` + `actions.ts` (disponibilidade + marcar entrevista)
- Modify: `src/lib/triagem.ts` (fila de pendentes considera entrevistas agendadas)

### Task 3.1: migration aditiva

- [ ] Adicionar ao `schema.prisma`:

```prisma
enum StatusEntrevistaSocial { agendada realizada faltou cancelada }

model SlotSocial {
  id                     String   @id @default(cuid())
  assistenteSocialId     String
  assistenteSocial       User     @relation("SlotSocialAssistente", fields: [assistenteSocialId], references: [id])
  dataHoraInicio         DateTime
  duracaoMin             Int      @default(30)
  status                 StatusSlot @default(disponivel)
  motivoBloqueio         String?
  entrevista             EntrevistaSocial?
  createdAt              DateTime @default(now())
  @@unique([assistenteSocialId, dataHoraInicio])
  @@index([dataHoraInicio])
}

model EntrevistaSocial {
  id                  String   @id @default(cuid())
  slotSocialId        String   @unique
  slotSocial          SlotSocial @relation(fields: [slotSocialId], references: [id])
  cidadaoId           String
  cidadao             Cidadao  @relation("EntrevistaCidadao", fields: [cidadaoId], references: [id])
  assistenteSocialId  String
  assistenteSocial    User     @relation("EntrevistaAssistente", fields: [assistenteSocialId], references: [id])
  status              StatusEntrevistaSocial @default(agendada)
  observacoes         String?
  triagemId           String?  @unique
  triagem             Triagem? @relation(fields: [triagemId], references: [id])
  createdBy           String
  createdAt           DateTime @default(now())
}
```

Relations inversas: `User` → `slotsSociais SlotSocial[] @relation("SlotSocialAssistente")` + `entrevistasSociais EntrevistaSocial[] @relation("EntrevistaAssistente")`; `Cidadao` → `entrevistasSociais EntrevistaSocial[] @relation("EntrevistaCidadao")`; `Triagem` → `entrevistaSocial EntrevistaSocial?`.

- [ ] `pnpm db:migrate --name add_agenda_social` (aditivo — não toca dados existentes; **dev DB tem PII real, migration NÃO é destrutiva**).
- [ ] Teste de schema (pure) em `social-agenda.test.ts` verificando enums/shape via `@prisma/client`. Commit: `feat(social): migration aditiva SlotSocial/EntrevistaSocial`

### Task 3.2: lib/social/agenda.ts (delega ao core)

- [ ] TDD integração (padrão fixtures): `reservarEntrevista({ slotSocialId, cidadaoId, assistenteSocialId, createdBy })` usa `core.reservarCAS(() => tx.slotSocial.updateMany(...))` + cria `EntrevistaSocial`. `gerarSlotsSociais(janela)` = `core.gerarSlots` + anexa assistenteSocialId. `criarSlotSocialAdHoc` = `core.criarSlotAdHoc({ create: tx.slotSocial.create, recurso: {assistenteSocialId} })`. Máquina `maquinaEntrevista = core.criarMaquinaEstados(TRANSICOES_ENTREVISTA)` com `agendada→{realizada,faltou,cancelada}`. `realizarEntrevista(id, triagemId)` seta status=realizada + liga triagemId.
- [ ] Race test (5 reservas paralelas no mesmo slotSocial → 1 ganha) — prova o anti-overbooking reusado. Commit.

### Task 3.3: rota social/agenda + ligação triagem

- [ ] `src/app/social/agenda/page.tsx` — lista slots sociais disponíveis + form de disponibilidade (template OU ad-hoc) + marcar entrevista de um cidadão. Deriva do scaffold do kit (REGRA DURA). `actions.ts` com as server actions (RBAC: papel `social`).
- [ ] `triagem.ts`: `listTriagensPendentes` passa a considerar entrevistas `realizada` sem triagem fechada (ou expõe `listEntrevistasAgendadas`). Manter retrocompat.
- [ ] Verify completo + Playwright (login social, agendar entrevista, realizar → vira triagem). Commit.

---

## Fase 4 — Agenda do dia (médico): extrair query + board

**Files:**

- Create: `src/lib/medico/agenda-dia.ts` (`buildJanelaDia`, `getConsultasHoje`)
- Test: `tests/unit/agenda-dia.test.ts` (puro, Prisma mockado)
- Modify: `src/app/medico/page.tsx`, `recepcao/page.tsx`, `minha-fila/page.tsx` (consomem a função)
- Create: `src/app/medico/agenda-dia/page.tsx` (board)

### Task 4.1: extrair agenda-dia.ts (TDD puro com mock)

- [ ] **Step 1 — teste falho** `agenda-dia.test.ts` (`vi.mock("@/lib/db")`):

```ts
it("buildJanelaDia retorna inicio 00:00 e fim 23:59 do mesmo dia", () => {
  const { inicioDia, fimDia } = buildJanelaDia(new Date("2026-06-09T15:00:00"));
  expect(inicioDia.getHours()).toBe(0);
  expect(fimDia.getHours()).toBe(23);
});
it("getConsultasHoje aplica filtro extra de profissional quando fornecido", async () => {
  // mock db.consulta.findMany; assert where contém profissional + status quando filtro passado
});
```

- [ ] **Step 3 — implementar:**

```ts
export function buildJanelaDia(agora: Date = new Date()): { inicioDia: Date; fimDia: Date } {
  const inicioDia = new Date(agora);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(agora);
  fimDia.setHours(23, 59, 59, 999);
  return { inicioDia, fimDia };
}
export interface ConsultasHojeOpts {
  filtro?: Prisma.ConsultaWhereInput;
  include?: Prisma.ConsultaInclude;
}
export function getConsultasHoje(opts: ConsultasHojeOpts = {}) {
  const { inicioDia, fimDia } = buildJanelaDia();
  return db.consulta.findMany({
    where: { ...opts.filtro, slot: { dataHoraInicio: { gte: inicioDia, lte: fimDia } } },
    include: opts.include ?? { slot: true, cidadao: true, profissional: true, especialidade: true },
    orderBy: { slot: { dataHoraInicio: "asc" } },
  });
}
```

- [ ] **Step 4 — PASS. Commit.**

### Task 4.2: as 3 páginas consomem (DRY) + board

- [ ] `medico/page.tsx:44` → `getConsultasHoje()` (include completo). `recepcao/page.tsx:52` → `getConsultasHoje({ include: <parcial> })`. `minha-fila/page.tsx:27` → `getConsultasHoje({ filtro: { profissional: { userId }, status: { in: ["agendada","confirmada","em_atendimento"] } }, include: <parcial> })`. Verificar build verde (comportamento idêntico).
- [ ] `src/app/medico/agenda-dia/page.tsx` — board profissionais×horas a partir de `getConsultasHoje()` + slots livres. Deriva do scaffold do kit. Linkar no chrome do médico.
- [ ] Verify completo + Playwright (as 3 telas iguais ao antes + board novo). Commit.

---

## Critérios de sucesso (do spec §5)

- Médico: 0 regressão + marca consulta SEM template (ad-hoc) + walk-in.
- Social: agenda entrevista real com a assistente, que vira `Triagem` ao realizar.
- Existe board "agenda do dia" no médico.
- Sem faturamento em lugar nenhum.

## Notas de execução

- Ritual: `pnpm format && format:check && typecheck && lint && test` (+ `build` antes de push). Verify via `.sh` no WSL.
- Commit msgs ASCII sem aspas duplas. Push pelo git nativo Windows.
- DB dev tem **PII real migrada da Amplimed** — migrations aditivas OK, NUNCA rodar anonimização/delete em massa.
- `clsx`/`cn` para classe condicional (prettier-tailwind mangla template literal).
