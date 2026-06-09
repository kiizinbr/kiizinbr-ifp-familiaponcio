# Motor de Agenda Genérico — Fase 1 (core + médico delega) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair a lógica de agenda do médico para um core resource-agnostic (`src/lib/agenda/core.ts`) e fazer o médico delegar a ele — **com zero mudança de comportamento** (a suíte existente é a rede de não-regressão).

**Architecture:** O core expõe 3 peças puras/genéricas — `gerarSlots` (geração por janela recorrente, sem profissional/especialidade), `criarMaquinaEstados` (máquina de transições genérica) e `reservarCAS` (encapsula o invariante anti-overbooking "count===1 = reservei", recebendo um _thunk_ de `updateMany` para não acoplar Prisma). `src/lib/medico/agenda.ts` passa a chamar o core; as tabelas `Slot`/`Consulta` e a API pública do médico ficam idênticas.

**Tech Stack:** TypeScript, Next.js App Router, Prisma/Postgres, Vitest (node, `tests/unit/**/*.test.ts`). pnpm roda no WSL Ubuntu. Esta fase **não tem migration** e **não toca UI**.

> **Como rodar testes nesta fase (WSL):**
> `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test <arquivo>"`
> Os testes do core são **puros** (sem DB). Os testes de integração do médico (`medico-agenda.test.ts`) exigem `pnpm dev:up` + seed; rode-os na Task 4 como rede de não-regressão.

---

## File Structure

- **Create** `src/lib/agenda/core.ts` — core resource-agnostic: `gerarSlots`, `criarMaquinaEstados`, `reservarCAS` (+ tipos `JanelaDisponibilidade`, `SlotBase`).
- **Create** `tests/unit/agenda-core.test.ts` — testes puros do core.
- **Modify** `src/lib/medico/agenda.ts` — `gerarSlots`/`reservarSlot`/`aplicarTransicaoConsulta` delegam ao core; API pública e tipos (`TemplateInput`, `SlotGerado`, erros) inalterados.
- **Net (não modificar)** `tests/unit/medico-agenda.test.ts` — rede de não-regressão.

---

### Task 1: Core — `gerarSlots` genérico + tipos

**Files:**

- Create: `src/lib/agenda/core.ts`
- Test: `tests/unit/agenda-core.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/agenda-core.test.ts
import { describe, expect, it } from "vitest";
import { gerarSlots, type JanelaDisponibilidade } from "@/lib/agenda/core";

const baseDate = new Date("2026-06-01T00:00:00Z"); // segunda-feira
const janela: JanelaDisponibilidade = {
  diasSemana: [2, 4], // terça, quinta
  faixaInicio: "14:00",
  faixaFim: "16:00",
  duracaoSlotMin: 30,
  validoDe: baseDate,
  validoAte: new Date("2026-06-15T00:00:00Z"),
};

describe("core.gerarSlots", () => {
  it("gera slots só nos dias da semana definidos", () => {
    const datas = [
      ...new Set(gerarSlots(janela).map((s) => s.dataHoraInicio.toISOString().slice(0, 10))),
    ];
    expect(datas).toContain("2026-06-02");
    expect(datas).toContain("2026-06-04");
    expect(datas).not.toContain("2026-06-01");
    expect(datas).not.toContain("2026-06-03");
  });

  it("respeita faixa horária e duração", () => {
    const terca = gerarSlots(janela).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    expect(terca).toHaveLength(4);
    expect(terca[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
    expect(terca[3]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("15:30");
  });

  it("não corta slot pela metade quando a duração não cabe", () => {
    const t = gerarSlots({ ...janela, diasSemana: [2], faixaFim: "14:45" }).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    expect(t).toHaveLength(1);
    expect(t[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
  });

  it("retorna SlotBase puro (só dataHoraInicio + duracaoMin) — sem recurso", () => {
    const s = gerarSlots(janela)[0]!;
    expect(Object.keys(s).sort()).toEqual(["dataHoraInicio", "duracaoMin"]);
    expect(s.duracaoMin).toBe(30);
  });

  it("validoAte nulo respeita limiteSuperior", () => {
    const limite = new Date("2026-06-10T00:00:00Z");
    const slots = gerarSlots({ ...janela, validoAte: null }, { limiteSuperior: limite });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.dataHoraInicio.getTime() < limite.getTime())).toBe(true);
  });

  it("lança quando validoAte é null e não há limiteSuperior", () => {
    expect(() => gerarSlots({ ...janela, validoAte: null })).toThrow(/limiteSuperior/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: FAIL — `Cannot find module '@/lib/agenda/core'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/agenda/core.ts

/** Janela de disponibilidade recorrente — base da geração de slots (resource-agnostic). */
export interface JanelaDisponibilidade {
  diasSemana: readonly number[]; // 0=dom..6=sáb
  faixaInicio: string; // "HH:mm"
  faixaFim: string;
  duracaoSlotMin: number;
  validoDe: Date;
  validoAte: Date | null;
}

/** Slot gerado, sem recurso — o consumidor anexa profissionalId/assistenteSocialId/etc. */
export interface SlotBase {
  dataHoraInicio: Date;
  duracaoMin: number;
}

export interface GerarSlotsOpts {
  limiteSuperior?: Date; // usado quando validoAte é null
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h = 0, m = 0] = s.split(":").map(Number);
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
 * Gera slots disponíveis derivados de uma janela recorrente. PURO (não toca banco).
 * Generalização do antigo `medico/agenda.gerarSlots` sem profissional/especialidade.
 */
export function gerarSlots(janela: JanelaDisponibilidade, opts: GerarSlotsOpts = {}): SlotBase[] {
  const slots: SlotBase[] = [];
  const inicio = startOfUtcDay(janela.validoDe);
  const fim = janela.validoAte ?? opts.limiteSuperior;
  if (!fim) {
    throw new Error("gerarSlots: validoAte é null e limiteSuperior não foi fornecido");
  }
  const fimUtc = startOfUtcDay(fim);
  const { h: hIni, m: mIni } = parseHHMM(janela.faixaInicio);
  const { h: hFim, m: mFim } = parseHHMM(janela.faixaFim);

  let dia = inicio;
  while (dia < fimUtc) {
    if (janela.diasSemana.includes(dia.getUTCDay())) {
      const ini = new Date(dia);
      ini.setUTCHours(hIni, mIni, 0, 0);
      const fimDia = new Date(dia);
      fimDia.setUTCHours(hFim, mFim, 0, 0);
      let cursor = ini;
      while (cursor.getTime() + janela.duracaoSlotMin * 60_000 <= fimDia.getTime()) {
        slots.push({ dataHoraInicio: new Date(cursor), duracaoMin: janela.duracaoSlotMin });
        cursor = new Date(cursor.getTime() + janela.duracaoSlotMin * 60_000);
      }
    }
    dia = addDays(dia, 1);
  }
  return slots;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda/core.ts tests/unit/agenda-core.test.ts
git commit -m "feat(agenda): core gerarSlots generico (resource-agnostic) + testes"
```

---

### Task 2: Core — `criarMaquinaEstados`

**Files:**

- Modify: `src/lib/agenda/core.ts`
- Test: `tests/unit/agenda-core.test.ts`

- [ ] **Step 1: Write the failing test** (append ao arquivo de teste)

```ts
import { criarMaquinaEstados } from "@/lib/agenda/core";

describe("core.criarMaquinaEstados", () => {
  const m = criarMaquinaEstados<"a" | "b" | "c">({
    a: new Set(["b", "c"]),
    b: new Set(["c"]),
    c: new Set([]),
  });
  it("pode() respeita as transições", () => {
    expect(m.pode("a", "b")).toBe(true);
    expect(m.pode("a", "c")).toBe(true);
    expect(m.pode("b", "a")).toBe(false);
    expect(m.pode("c", "a")).toBe(false);
  });
  it("alvos() devolve o conjunto de destinos", () => {
    expect([...m.alvos("a")].sort()).toEqual(["b", "c"]);
    expect(m.alvos("c").size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: FAIL — `criarMaquinaEstados` is not exported.

- [ ] **Step 3: Write minimal implementation** (append a `core.ts`)

```ts
/** Máquina de estados genérica: dado um mapa de transições, valida `de -> para`. */
export function criarMaquinaEstados<S extends string>(transicoes: Record<S, ReadonlySet<S>>) {
  return {
    pode: (de: S, para: S): boolean => transicoes[de].has(para),
    alvos: (de: S): ReadonlySet<S> => transicoes[de],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda/core.ts tests/unit/agenda-core.test.ts
git commit -m "feat(agenda): core criarMaquinaEstados generico + testes"
```

---

### Task 3: Core — `reservarCAS`

**Files:**

- Modify: `src/lib/agenda/core.ts`
- Test: `tests/unit/agenda-core.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { reservarCAS } from "@/lib/agenda/core";

describe("core.reservarCAS", () => {
  it("retorna true quando o updateMany afeta exatamente 1 linha", async () => {
    expect(await reservarCAS(async () => ({ count: 1 }))).toBe(true);
  });
  it("retorna false quando 0 linhas (alguém já pegou o slot)", async () => {
    expect(await reservarCAS(async () => ({ count: 0 }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: FAIL — `reservarCAS` is not exported.

- [ ] **Step 3: Write minimal implementation** (append a `core.ts`)

```ts
/**
 * Encapsula o invariante anti-overbooking: recebe um thunk que faz o
 * `updateMany` compare-and-swap (status disponível -> reservado, com filtro de
 * status no WHERE). Retorna true se reservou (count === 1), false se outro já
 * pegou. O caller monta o updateMany tipado da SUA tabela (Slot, SlotSocial…),
 * mantendo o core sem acoplamento com Prisma.
 */
export async function reservarCAS(updateMany: () => Promise<{ count: number }>): Promise<boolean> {
  const { count } = await updateMany();
  return count === 1;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/agenda-core.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda/core.ts tests/unit/agenda-core.test.ts
git commit -m "feat(agenda): core reservarCAS (invariante anti-overbooking via thunk) + testes"
```

---

### Task 4: Médico delega ao core (refactor sem mudar comportamento)

**Files:**

- Modify: `src/lib/medico/agenda.ts`
- Net (não modificar): `tests/unit/medico-agenda.test.ts`

> Esta é uma refatoração sob cobertura de testes existentes. Não há teste novo — a suíte do médico é o RED/GREEN.

- [ ] **Step 1: Rodar a suíte do médico ANTES (baseline verde)**

Pré-requisito: DB dev de pé + semeado.
Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm dev:up && pnpm db:deploy && pnpm db:seed && pnpm test tests/unit/medico-agenda.test.ts tests/unit/agenda-schema.test.ts"`
Expected: PASS (baseline antes do refactor).

- [ ] **Step 2: Refatorar `gerarSlots` do médico pra delegar**

Em `src/lib/medico/agenda.ts`, trocar o corpo de `gerarSlots` (mantendo a assinatura `(tmpl: TemplateInput, opts) => SlotGerado[]`) por delegação ao core + anexar o recurso médico:

```ts
import * as core from "@/lib/agenda/core";
// ... manter TemplateInput, SlotGerado, GerarSlotsOpts.

export function gerarSlots(tmpl: TemplateInput, opts: GerarSlotsOpts = {}): SlotGerado[] {
  const base = core.gerarSlots(
    {
      diasSemana: tmpl.diasSemana,
      faixaInicio: tmpl.faixaInicio,
      faixaFim: tmpl.faixaFim,
      duracaoSlotMin: tmpl.duracaoSlotMin,
      validoDe: tmpl.validoDe,
      validoAte: tmpl.validoAte,
    },
    { limiteSuperior: opts.limiteSuperior },
  );
  return base.map((s) => ({
    profissionalId: tmpl.profissionalId,
    especialidadeId: tmpl.especialidadeId,
    dataHoraInicio: s.dataHoraInicio,
    duracaoMin: s.duracaoMin,
  }));
}
```

Remover as funções locais `parseHHMM`, `addDays`, `startOfUtcDay` se ficarem sem uso (o lint `no-unused-vars` acusa).

- [ ] **Step 3: Refatorar `reservarSlot` (e o CAS de `reagendarConsulta`) pra usar `core.reservarCAS`**

```ts
export async function reservarSlot(input: ReservarSlotInput) {
  return db.$transaction(async (tx) => {
    const ganhou = await core.reservarCAS(() =>
      tx.slot.updateMany({
        where: { id: input.slotId, status: "disponivel" },
        data: { status: "reservado" },
      }),
    );
    if (!ganhou) throw new SlotIndisponivelError(input.slotId);

    const consulta = await tx.consulta.create({
      data: {
        slotId: input.slotId,
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
    if (input.origemEncaminhamentoId) {
      await agendarEncaminhamento(tx, input.origemEncaminhamentoId);
    }
    return consulta;
  });
}
```

Em `reagendarConsulta`, trocar o segundo CAS (linhas ~264-268) por: `const ganhou = await core.reservarCAS(() => tx.slot.updateMany({ where: { id: novoSlotId, status: "disponivel" }, data: { status: "reservado" } })); if (!ganhou) throw new SlotIndisponivelError(novoSlotId);`

- [ ] **Step 4: Refatorar a máquina de estados pra usar `core.criarMaquinaEstados`**

Manter o mapa `TRANSICOES`, validar via core em `aplicarTransicaoConsulta`:

```ts
const maquinaConsulta = core.criarMaquinaEstados<StatusConsulta>(TRANSICOES);

export async function aplicarTransicaoConsulta(
  tx: Prisma.TransactionClient,
  consultaId: string,
  para: StatusConsulta,
) {
  const c = await tx.consulta.findUniqueOrThrow({ where: { id: consultaId } });
  if (!maquinaConsulta.pode(c.status, para)) {
    throw new TransicaoInvalidaError(c.status, para);
  }
  const updated = await tx.consulta.update({ where: { id: consultaId }, data: { status: para } });
  const slotStatus = STATUS_SLOT_DERIVADO[para];
  await tx.slot.update({ where: { id: c.slotId }, data: { status: slotStatus } });
  return updated;
}
```

- [ ] **Step 5: Rodar a suíte do médico DEPOIS (continua verde = zero regressão)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test tests/unit/medico-agenda.test.ts tests/unit/agenda-schema.test.ts tests/unit/agenda-core.test.ts"`
Expected: PASS — mesmos resultados do Step 1 (comportamento idêntico) + core verde.

- [ ] **Step 6: Gate completo + commit**

Run (via .sh, conforme CLAUDE.md — exit code confiável): `wsl -d Ubuntu -- bash /mnt/c/Users/Administrador/ifp-connect/_gate.sh` (ou `pnpm typecheck && pnpm lint && pnpm build`).
Expected: typecheck/lint/build verdes.

```bash
git add src/lib/medico/agenda.ts
git commit -m "refactor(agenda): medico delega ao core (gerarSlots/reservarCAS/maquina) sem mudar comportamento"
```

---

## Fora desta fase (próximos planos)

- **Fase 2 — Buraco #3 (dinâmico médico):** `criarSlotAdHoc` no core + slot ad-hoc no balcão (`consultas/nova`) + walk-in "atender agora".
- **Fase 3 — Buraco #2 (agendar social):** migration aditiva `SlotSocial`/`EntrevistaSocial`/`StatusEntrevista` + rota `social/agenda` + ligação `Triagem`, reusando o core desta fase.
- **Fase 4 — Buraco #1 (agenda do dia):** extrair `agenda-dia.ts` + board `medico/agenda-dia`.

Cada fase ganha seu próprio plano (a Fase 1 fixa a API do core que elas consomem).

## Self-review (writing-plans)

- **Cobertura do spec §3.1/§3.2:** core (gerarSlots/maquina/reservarCAS) = Tasks 1-3; médico delega = Task 4. ✓ `criarSlotAdHoc` é §3.3 (Fase 2) — fora desta fase de propósito.
- **Placeholders:** nenhum — todo passo tem código/comando reais.
- **Consistência de tipos:** `JanelaDisponibilidade`/`SlotBase`/`reservarCAS(thunk)`/`criarMaquinaEstados` usados igual em Tasks 1-4; `SlotGerado`/`TemplateInput` do médico preservados.
