# Encaminhamento + Busca Ativa (Médico, Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o buraco entre o clínico geral e o especialista: o pedido do GP vira um `Encaminhamento` rastreável que cai numa fila de "busca ativa" no callcenter, que agenda reaproveitando o wizard de nova consulta.

**Architecture:** Entidade de 1ª classe `Encaminhamento` com máquina de estados (`aguardando_agendamento → {agendado, cancelado}`), espelhando o núcleo transacional de `lib/capacitacao/matricula.ts`. O agendamento liga `Consulta ↔ Encaminhamento` e flipa o status DENTRO da mesma transação anti-overbooking do `reservarSlot` (sem aninhar `$transaction`, padrão `aplicarTransicaoConsulta`). UI nova deriva 100% do Design Kit (accent teal do médico).

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 + Postgres, Vitest (unit), Playwright (e2e). Núcleo lógico via **ralph-loop** (TDD, testes-primeiro); UI via **frontend-design** dentro do kit.

**Spec:** `docs/superpowers/specs/2026-06-03-encaminhamento-busca-ativa-design.md`

---

## Convenções do projeto (ler antes de começar)

- **WSL:** todo `pnpm` roda dentro do Ubuntu: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm …"`. Postgres dev na porta 5433.
- **Verify via ARQUIVO `.sh`**, nunca `bash -lc '…inline…'` (o marshalling PowerShell→wsl mascara o exit code). Use o script `_verify-encaminhamento.sh` criado na Task 0.
- **git push** sempre pelo git nativo do Windows: `git -C "C:\Users\Administrador\ifp-connect" push origin main`. Mensagem de commit **sem aspas duplas**.
- **`noUncheckedIndexedAccess: true`** — acessos indexados (`arr[0]`, `TRANSICOES[x]`) podem ser `undefined`; o molde de `matricula.ts` já lida com isso (os `Record<…, ReadonlySet>` têm todas as chaves).
- **Migrations:** `pnpm db:migrate --name <nome>` (carrega `.env.local`). NÃO escrever SQL à mão.
- **Server Actions multi-tenant** SEMPRE chamam `canAccessUnidade(session, "medico")` na borda, além do papel — elas resolvem por header `Next-Action`, não herdam o gate de rota do proxy (memória `reference-server-action-unit-gate`).
- **Cor-de-dado** (`especialidade.corDestaque`) é preservada inline; nunca tokenizada.

---

## File Structure

**Criar:**

- `src/lib/medico/encaminhamento.ts` — núcleo puro + transacional (máquina de estados, erros tipados, criar/cancelar/agendar). Espelha `lib/capacitacao/matricula.ts`.
- `tests/unit/encaminhamento-puro.test.ts` — máquina de estados pura.
- `tests/unit/encaminhamento-mock.test.ts` — núcleo transacional (db mock via `vi.hoisted`).
- `src/app/medico/consultas/[id]/encaminhamento-actions.ts` — server actions criar/cancelar (do prontuário).
- `src/app/medico/consultas/[id]/_encaminhamento-panel.tsx` — seção da coluna 3 (form + lista). Server component.
- `src/app/medico/encaminhamentos/page.tsx` — a fila "A agendar".
- `src/app/medico/encaminhamentos/actions.ts` — cancelar a partir da fila.
- `tests/e2e/encaminhamento.spec.ts` — smoke ponta-a-ponta.
- `_verify-encaminhamento.sh` — script de ritual (gitignored).

**Modificar:**

- `prisma/schema.prisma` — enum `StatusEncaminhamento` + model `Encaminhamento` + FK `Consulta.origemEncaminhamentoId` + reversas.
- `src/lib/audit.ts` — 3 novas `AuditAction`.
- `src/lib/medico/rbac.ts` — `podeEncaminhar` + `podeAgendarEncaminhamento`.
- `src/lib/medico/agenda.ts` — `ReservarSlotInput.origemEncaminhamentoId` + flip transacional do encaminhamento.
- `src/app/medico/consultas/nova/actions.ts` — `reservarConsultaAction` repassa `encaminhamentoId`.
- `src/app/medico/consultas/nova/page.tsx` — wizard detecta `encaminhamentoId`, pré-preenche e trava cidadão+especialidade.
- `src/app/medico/consultas/[id]/page.tsx` — busca especialidades + encaminhamentos da consulta; renderiza `<EncaminhamentoPanel>` na coluna 3.
- `src/lib/medico/nav.ts` — item "A agendar" → `/medico/encaminhamentos`.
- `tests/unit/medico-rbac.test.ts` — casos das 2 funções novas.
- `prisma/seed.ts` — 1 consulta `em_atendimento` + 1 encaminhamento `aguardando_agendamento` + slots da especialidade-alvo (demo + e2e).

---

## Task 0: Script de verify + branch

**Files:**

- Create: `_verify-encaminhamento.sh`

- [ ] **Step 1: Criar o script de ritual** (gitignored por `/_*.sh`)

```bash
#!/usr/bin/env bash
set -uo pipefail
cd /mnt/c/Users/Administrador/ifp-connect || { echo "VERIFY=FAIL cd"; exit 1; }
echo "===== FORMAT ====="; pnpm format
echo "===== FORMAT:CHECK ====="; pnpm format:check; FMT=$?
echo "===== TYPECHECK ====="; pnpm typecheck; TC=$?
echo "===== LINT ====="; pnpm lint; LINT=$?
echo "===== TEST ====="; pnpm test; TEST=$?
echo "===== BUILD ====="; pnpm build; BUILD=$?
echo "RESULT format=$FMT typecheck=$TC lint=$LINT test=$TEST build=$BUILD"
if [ "$FMT" -eq 0 ] && [ "$TC" -eq 0 ] && [ "$LINT" -eq 0 ] && [ "$TEST" -eq 0 ] && [ "$BUILD" -eq 0 ]; then
  echo "VERIFY=PASS"; else echo "VERIFY=FAIL"; fi
```

- [ ] **Step 2: Confirmar containers de pé**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm dev:up"`
Expected: containers `ifp_postgres_dev` + `ifp_minio_dev` up.

---

## Task 1: Schema — model `Encaminhamento` + enum + FK + reversas

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar o enum** (junto dos outros enums do bloco Médico, após `enum StatusConsulta`)

```prisma
enum StatusEncaminhamento {
  aguardando_agendamento
  agendado
  cancelado
}
```

- [ ] **Step 2: Adicionar o model `Encaminhamento`** (após `model Consulta`)

```prisma
/// F1.B — pedido do GP para especialista. Vira fila de busca ativa no callcenter.
/// Máquina de estados em lib/medico/encaminhamento.ts (espelha matricula.ts).
model Encaminhamento {
  id               String               @id @default(cuid())
  cidadaoId        String
  consultaOrigemId String
  especialidadeId  String
  motivo           String?              @db.Text
  status           StatusEncaminhamento @default(aguardando_agendamento)
  createdBy        String // userId do profissional que pediu
  canceladoMotivo  String?

  cidadao          Cidadao        @relation(fields: [cidadaoId], references: [id], onDelete: Restrict)
  consultaOrigem   Consulta       @relation("EncaminhamentoConsultaOrigem", fields: [consultaOrigemId], references: [id], onDelete: Restrict)
  especialidade    Especialidade  @relation(fields: [especialidadeId], references: [id], onDelete: Restrict)
  consultasAgendadas Consulta[]   @relation("ConsultaOrigemEncaminhamento")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
  @@index([cidadaoId])
}
```

- [ ] **Step 3: Adicionar o FK reverso na `Consulta`** (dentro de `model Consulta`, ao lado de `origemTriagemId`)

```prisma
  origemEncaminhamentoId String?
  origemEncaminhamento   Encaminhamento? @relation("ConsultaOrigemEncaminhamento", fields: [origemEncaminhamentoId], references: [id], onDelete: SetNull)
  encaminhamentosOrigem  Encaminhamento[] @relation("EncaminhamentoConsultaOrigem")
```

> ⚠️ Há **duas** relações Consulta↔Encaminhamento (origem do pedido + consulta agendada), por isso ambas são **nomeadas** (`EncaminhamentoConsultaOrigem` e `ConsultaOrigemEncaminhamento`). Prisma exige nome quando há >1 relação entre os mesmos models.

- [ ] **Step 4: Adicionar as reversas em `Cidadao` e `Especialidade`**

Em `model Cidadao` (junto de `matriculas Matricula[]`):

```prisma
  encaminhamentos Encaminhamento[]
```

Em `model Especialidade` (junto de `consultas Consulta[]`):

```prisma
  encaminhamentos Encaminhamento[]
```

- [ ] **Step 5: Gerar a migration**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:migrate --name f1b_encaminhamento_busca_ativa"`
Expected: cria `prisma/migrations/<ts>_f1b_encaminhamento_busca_ativa/` + roda `prisma generate`. Sem erro de relação ambígua.

- [ ] **Step 6: Sanidade do client gerado**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck"`
Expected: PASS (tipos `Encaminhamento`/`StatusEncaminhamento` disponíveis em `@prisma/client`).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(medico): schema Encaminhamento + FK Consulta.origemEncaminhamentoId (F1.B)"
```

---

## Task 2: Audit actions

**Files:**

- Modify: `src/lib/audit.ts:62`

- [ ] **Step 1: Adicionar as 3 actions ao union** (após `| "lista_espera_promovida"`, antes do `;`)

```ts
  // Encaminhamento (F1.B)
  | "encaminhamento_criado"
  | "encaminhamento_agendado"
  | "encaminhamento_cancelado";
```

- [ ] **Step 2: Typecheck + commit**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck"`
Expected: PASS.

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): AuditAction de encaminhamento (F1.B)"
```

---

## Task 3: Testes puros (máquina de estados) — VERMELHOS

**Files:**

- Create: `tests/unit/encaminhamento-puro.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```ts
import { describe, expect, it } from "vitest";
import {
  podeTransicionarEncaminhamento,
  TRANSICOES_ENCAMINHAMENTO,
} from "@/lib/medico/encaminhamento";

// Núcleo PURO: máquina de estados do encaminhamento. Sem DB.
describe("podeTransicionarEncaminhamento (máquina de estados)", () => {
  it("aguardando_agendamento → agendado é válido", () => {
    expect(podeTransicionarEncaminhamento("aguardando_agendamento", "agendado")).toBe(true);
  });
  it("aguardando_agendamento → cancelado é válido", () => {
    expect(podeTransicionarEncaminhamento("aguardando_agendamento", "cancelado")).toBe(true);
  });
  it("agendado → cancelado é inválido (terminal)", () => {
    expect(podeTransicionarEncaminhamento("agendado", "cancelado")).toBe(false);
  });
  it("cancelado → agendado é inválido (terminal)", () => {
    expect(podeTransicionarEncaminhamento("cancelado", "agendado")).toBe(false);
  });
  it("estados terminais têm conjunto de transições vazio", () => {
    expect(TRANSICOES_ENCAMINHAMENTO.agendado.size).toBe(0);
    expect(TRANSICOES_ENCAMINHAMENTO.cancelado.size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que FALHA** (módulo ainda não existe)

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test encaminhamento-puro"`
Expected: FAIL — `Cannot find module '@/lib/medico/encaminhamento'`.

- [ ] **Step 3: Commit do teste vermelho**

```bash
git add tests/unit/encaminhamento-puro.test.ts
git commit -m "test(medico): máquina de estados de encaminhamento (vermelho)"
```

---

## Task 4: Testes transacionais (mock db) — VERMELHOS

**Files:**

- Create: `tests/unit/encaminhamento-mock.test.ts`

- [ ] **Step 1: Escrever o teste falho** (espelha `capacitacao-matricula-mock.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    encaminhamento: {
      findUniqueOrThrow: f(),
      create: f(),
      update: f(),
    },
    consulta: { findUniqueOrThrow: f() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(db)
      : Promise.all(arg as unknown[]),
  );
  return { dbMock: db };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  agendarEncaminhamento,
  aplicarTransicaoEncaminhamento,
  cancelarEncaminhamento,
  ConsultaOrigemInvalidaError,
  criarEncaminhamento,
  EncaminhamentoNaoPendenteError,
  TransicaoEncaminhamentoInvalidaError,
} from "@/lib/medico/encaminhamento";

function reset() {
  for (const m of [dbMock.encaminhamento, dbMock.consulta]) {
    for (const fn of Object.values(m)) fn.mockReset();
  }
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
}

const base = {
  cidadaoId: "c1",
  consultaOrigemId: "co1",
  especialidadeId: "e1",
  createdBy: "u1",
};

describe("criarEncaminhamento", () => {
  beforeEach(reset);

  it("consulta de origem do cidadão → cria aguardando_agendamento", async () => {
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ id: "co1", cidadaoId: "c1" });
    dbMock.encaminhamento.create.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    await criarEncaminhamento(base);
    expect(dbMock.encaminhamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "aguardando_agendamento", cidadaoId: "c1" }),
      }),
    );
  });

  it("consulta de origem de OUTRO cidadão → ConsultaOrigemInvalidaError, sem create", async () => {
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ id: "co1", cidadaoId: "OUTRO" });
    await expect(criarEncaminhamento(base)).rejects.toBeInstanceOf(ConsultaOrigemInvalidaError);
    expect(dbMock.encaminhamento.create).not.toHaveBeenCalled();
  });
});

describe("aplicarTransicaoEncaminhamento", () => {
  beforeEach(reset);

  it("transição válida → update com o novo status", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "agendado");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });

  it("transição inválida (já agendado) → TransicaoEncaminhamentoInvalidaError, sem update", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({ id: "enc1", status: "agendado" });
    await expect(
      aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "cancelado"),
    ).rejects.toBeInstanceOf(TransicaoEncaminhamentoInvalidaError);
    expect(dbMock.encaminhamento.update).not.toHaveBeenCalled();
  });

  it("cancelar passa canceladoMotivo no update", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "cancelado", "duplicado");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ canceladoMotivo: "duplicado" }) }),
    );
  });
});

describe("agendarEncaminhamento (tx-aware)", () => {
  beforeEach(reset);

  it("pendente → flipa para agendado", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await agendarEncaminhamento(dbMock as never, "enc1");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });

  it("não-pendente (já cancelado) → EncaminhamentoNaoPendenteError", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await expect(agendarEncaminhamento(dbMock as never, "enc1")).rejects.toBeInstanceOf(
      EncaminhamentoNaoPendenteError,
    );
  });
});

describe("cancelarEncaminhamento", () => {
  beforeEach(reset);
  it("abre $transaction 1x e flipa para cancelado", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await cancelarEncaminhamento("enc1", "paciente desistiu");
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelado" }) }),
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar FALHA**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test encaminhamento-mock"`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/encaminhamento-mock.test.ts
git commit -m "test(medico): núcleo transacional de encaminhamento (vermelho)"
```

---

## Task 5: Núcleo `encaminhamento.ts` — VERDE `[ralph-loop]`

> **Execução recomendada:** ralph-loop com `--completion-promise ENCAMINHAMENTO-CORE-GREEN`, allowlist = só `src/lib/medico/encaminhamento.ts`. Verify por `wsl -d Ubuntu -- bash _verify-encaminhamento.sh` (só conta verde com `VERIFY=PASS`). NÃO editar os testes pra passar (é TDD).

**Files:**

- Create: `src/lib/medico/encaminhamento.ts`

- [ ] **Step 1: Implementar o núcleo** (espelha `lib/capacitacao/matricula.ts`)

```ts
import type { Encaminhamento, Prisma, StatusEncaminhamento } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Núcleo lógico do Encaminhamento (F1.B). Espelha lib/capacitacao/matricula.ts:
 * erros tipados + máquina de estados + transições tx-aware (sem aninhar $transaction).
 */

// ── Erros tipados ──────────────────────────────────────────────────────────
export class EncaminhamentoNaoPendenteError extends Error {
  constructor(public readonly encaminhamentoId: string) {
    super(`Encaminhamento ${encaminhamentoId} não está aguardando agendamento`);
    this.name = "EncaminhamentoNaoPendenteError";
  }
}
export class TransicaoEncaminhamentoInvalidaError extends Error {
  constructor(
    public readonly de: StatusEncaminhamento,
    public readonly para: StatusEncaminhamento,
  ) {
    super(`Transição de encaminhamento inválida: ${de} → ${para}`);
    this.name = "TransicaoEncaminhamentoInvalidaError";
  }
}
export class ConsultaOrigemInvalidaError extends Error {
  constructor(
    public readonly consultaOrigemId: string,
    public readonly cidadaoId: string,
  ) {
    super(`Consulta ${consultaOrigemId} não pertence ao cidadão ${cidadaoId}`);
    this.name = "ConsultaOrigemInvalidaError";
  }
}

// ── Máquina de estados ──────────────────────────────────────────────────────
// agendado/cancelado = terminais (Set vazio).
export const TRANSICOES_ENCAMINHAMENTO: Record<
  StatusEncaminhamento,
  ReadonlySet<StatusEncaminhamento>
> = {
  aguardando_agendamento: new Set<StatusEncaminhamento>(["agendado", "cancelado"]),
  agendado: new Set<StatusEncaminhamento>(),
  cancelado: new Set<StatusEncaminhamento>(),
};

export function podeTransicionarEncaminhamento(
  de: StatusEncaminhamento,
  para: StatusEncaminhamento,
): boolean {
  return TRANSICOES_ENCAMINHAMENTO[de].has(para);
}

// ── Criar ───────────────────────────────────────────────────────────────────
export interface CriarEncaminhamentoInput {
  cidadaoId: string;
  consultaOrigemId: string;
  especialidadeId: string;
  motivo?: string;
  createdBy: string;
}

/** Cria um pedido `aguardando_agendamento`. Valida que a consulta de origem é do cidadão. */
export async function criarEncaminhamento(
  input: CriarEncaminhamentoInput,
): Promise<Encaminhamento> {
  return db.$transaction(async (tx) => {
    const consulta = await tx.consulta.findUniqueOrThrow({ where: { id: input.consultaOrigemId } });
    if (consulta.cidadaoId !== input.cidadaoId) {
      throw new ConsultaOrigemInvalidaError(input.consultaOrigemId, input.cidadaoId);
    }
    return tx.encaminhamento.create({
      data: {
        cidadaoId: input.cidadaoId,
        consultaOrigemId: input.consultaOrigemId,
        especialidadeId: input.especialidadeId,
        motivo: input.motivo,
        createdBy: input.createdBy,
        status: "aguardando_agendamento",
      },
    });
  });
}

// ── Transições tx-aware (espelha aplicarTransicaoMatricula) ─────────────────
export async function aplicarTransicaoEncaminhamento(
  tx: Prisma.TransactionClient,
  encaminhamentoId: string,
  para: StatusEncaminhamento,
  canceladoMotivo?: string,
): Promise<Encaminhamento> {
  const e = await tx.encaminhamento.findUniqueOrThrow({ where: { id: encaminhamentoId } });
  if (!podeTransicionarEncaminhamento(e.status, para)) {
    throw new TransicaoEncaminhamentoInvalidaError(e.status, para);
  }
  return tx.encaminhamento.update({
    where: { id: encaminhamentoId },
    data: { status: para, ...(canceladoMotivo !== undefined ? { canceladoMotivo } : {}) },
  });
}

/**
 * Flipa para `agendado` DENTRO da transação de reserva do slot (chamada por
 * reservarSlot). Valida que ainda estava pendente — barra dupla marcação.
 */
export async function agendarEncaminhamento(
  tx: Prisma.TransactionClient,
  encaminhamentoId: string,
): Promise<Encaminhamento> {
  const e = await tx.encaminhamento.findUniqueOrThrow({ where: { id: encaminhamentoId } });
  if (e.status !== "aguardando_agendamento") {
    throw new EncaminhamentoNaoPendenteError(encaminhamentoId);
  }
  return aplicarTransicaoEncaminhamento(tx, encaminhamentoId, "agendado");
}

/** Cancela (GP/gestor). Wrapper $transaction. */
export async function cancelarEncaminhamento(
  encaminhamentoId: string,
  motivo?: string,
): Promise<Encaminhamento> {
  return db.$transaction((tx) =>
    aplicarTransicaoEncaminhamento(tx, encaminhamentoId, "cancelado", motivo),
  );
}
```

- [ ] **Step 2: Rodar os testes e confirmar VERDE**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh` (lê a saída; só verde com `VERIFY=PASS`)
Expected: `encaminhamento-puro` + `encaminhamento-mock` passam; ritual completo `VERIFY=PASS`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/medico/encaminhamento.ts
git commit -m "feat(medico): núcleo lógico de encaminhamento (máquina de estados + tx-aware)"
```

---

## Task 6: RBAC — `podeEncaminhar` + `podeAgendarEncaminhamento`

**Files:**

- Modify: `src/lib/medico/rbac.ts`
- Modify: `tests/unit/medico-rbac.test.ts`

- [ ] **Step 1: Escrever os testes falhos** (anexar ao final de `tests/unit/medico-rbac.test.ts`)

```ts
import { podeEncaminhar, podeAgendarEncaminhamento } from "@/lib/medico/rbac";

function sess(...roles: string[]) {
  return {
    user: { id: "u1", roles: roles.map((name) => ({ name, unitScope: "medico" })) },
  } as never;
}

describe("podeEncaminhar (criar/cancelar pedido)", () => {
  it("profissional pode", () => expect(podeEncaminhar(sess("profissional"))).toBe(true));
  it("gestor_unidade pode", () => expect(podeEncaminhar(sess("gestor_unidade"))).toBe(true));
  it("super_admin pode", () => expect(podeEncaminhar(sess("super_admin"))).toBe(true));
  it("recepcao NÃO pode criar pedido", () => expect(podeEncaminhar(sess("recepcao"))).toBe(false));
  it("sem sessão → false", () => expect(podeEncaminhar(null)).toBe(false));
});

describe("podeAgendarEncaminhamento (trabalhar a fila)", () => {
  it("recepcao (callcenter) pode", () =>
    expect(podeAgendarEncaminhamento(sess("recepcao"))).toBe(true));
  it("gestor_unidade pode", () =>
    expect(podeAgendarEncaminhamento(sess("gestor_unidade"))).toBe(true));
  it("super_admin pode", () => expect(podeAgendarEncaminhamento(sess("super_admin"))).toBe(true));
  it("profissional NÃO agenda", () =>
    expect(podeAgendarEncaminhamento(sess("profissional"))).toBe(false));
  it("sem sessão → false", () => expect(podeAgendarEncaminhamento(null)).toBe(false));
});
```

> ⚠️ Confira o helper de sessão já existente no topo de `medico-rbac.test.ts`; se houver um equivalente, **reutilize-o** em vez de declarar `sess` de novo (evita redeclaração).

- [ ] **Step 2: Rodar e confirmar FALHA**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test medico-rbac"`
Expected: FAIL — `podeEncaminhar`/`podeAgendarEncaminhamento` não exportados.

- [ ] **Step 3: Implementar as 2 funções** (anexar ao final de `src/lib/medico/rbac.ts`)

```ts
// ── F1.B Encaminhamento ───────────────────────────────────────────────

/** Criar/cancelar pedido de encaminhamento (§RBAC): GP + gestão. NÃO recepção. */
export function podeEncaminhar(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/** Trabalhar a fila "A agendar" e agendar (callcenter/recepção + gestão). */
export function podeAgendarEncaminhamento(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao");
}
```

- [ ] **Step 4: Rodar e confirmar VERDE + commit**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test medico-rbac"`
Expected: PASS.

```bash
git add src/lib/medico/rbac.ts tests/unit/medico-rbac.test.ts
git commit -m "feat(medico): RBAC podeEncaminhar + podeAgendarEncaminhamento (+ testes)"
```

---

## Task 7: Enganchar o flip na transação de reserva

**Files:**

- Modify: `src/lib/medico/agenda.ts:96-133`
- Modify: `tests/unit/encaminhamento-mock.test.ts` (1 caso novo)

- [ ] **Step 1: Estender `ReservarSlotInput` + chamar `agendarEncaminhamento` na tx** (em `src/lib/medico/agenda.ts`)

Adicionar o import no topo:

```ts
import { agendarEncaminhamento } from "@/lib/medico/encaminhamento";
```

Adicionar o campo na interface `ReservarSlotInput`:

```ts
  origemEncaminhamentoId?: string;
```

Dentro de `reservarSlot`, persistir o FK no create e flipar o encaminhamento DENTRO da mesma `tx`:

```ts
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
```

> Sem aninhar `$transaction`: `agendarEncaminhamento` recebe a `tx` (padrão `aplicarTransicaoConsulta`). Se o encaminhamento não estiver mais pendente (corrida do duplo-Agendar), ele lança `EncaminhamentoNaoPendenteError` e a transação inteira reverte — o slot volta a `disponivel`. **Sem risco de circular import:** `encaminhamento.ts` não importa `agenda.ts`.

- [ ] **Step 2: Adicionar 1 caso ao `encaminhamento-mock.test.ts`** (reservarSlot flipa o encaminhamento)

Estender o `dbMock` de `vi.hoisted` com `slot: { updateMany: f() }` e importar `reservarSlot`. Caso:

```ts
describe("reservarSlot com origemEncaminhamentoId", () => {
  beforeEach(reset);
  it("cria consulta com o FK e flipa o encaminhamento para agendado", async () => {
    dbMock.slot.updateMany.mockResolvedValue({ count: 1 });
    dbMock.consulta.create.mockResolvedValue({ id: "cons1" });
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await reservarSlot({
      slotId: "s1",
      cidadaoId: "c1",
      profissionalId: "p1",
      especialidadeId: "e1",
      createdBy: "u1",
      origemEncaminhamentoId: "enc1",
    });
    expect(dbMock.consulta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origemEncaminhamentoId: "enc1" }),
      }),
    );
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });
});
```

> Ajuste o `reset()` pra incluir `dbMock.slot`. `reservarSlot` importado de `@/lib/medico/agenda`.

- [ ] **Step 3: Rodar verify + commit**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh`
Expected: `VERIFY=PASS`.

```bash
git add src/lib/medico/agenda.ts tests/unit/encaminhamento-mock.test.ts
git commit -m "feat(medico): reservarSlot liga consulta ao encaminhamento e flipa status na mesma tx"
```

---

## Task 8: Server actions (criar/cancelar) + wizard repassa encaminhamentoId

**Files:**

- Create: `src/app/medico/consultas/[id]/encaminhamento-actions.ts`
- Create: `src/app/medico/encaminhamentos/actions.ts`
- Modify: `src/app/medico/consultas/nova/actions.ts`

- [ ] **Step 1: Criar `encaminhamento-actions.ts` (criar a partir da consulta)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEncaminhar } from "@/lib/medico/rbac";
import { criarEncaminhamento } from "@/lib/medico/encaminhamento";
import { logEvent } from "@/lib/audit";

export async function criarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeEncaminhar(session)) throw new Error("Sem permissão");

  const consultaOrigemId = String(formData.get("consultaOrigemId"));
  const cidadaoId = String(formData.get("cidadaoId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || undefined;

  const enc = await criarEncaminhamento({
    cidadaoId,
    consultaOrigemId,
    especialidadeId,
    motivo,
    createdBy: session!.user.id,
  });
  await logEvent({
    userId: session!.user.id,
    action: "encaminhamento_criado",
    entityType: "encaminhamento",
    entityId: enc.id,
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { especialidadeId, consultaOrigemId },
  });
  revalidatePath(`/medico/consultas/${consultaOrigemId}`);
}
```

- [ ] **Step 2: Criar `encaminhamentos/actions.ts` (cancelar a partir da fila)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEncaminhar } from "@/lib/medico/rbac";
import { cancelarEncaminhamento } from "@/lib/medico/encaminhamento";
import { logEvent } from "@/lib/audit";

export async function cancelarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeEncaminhar(session)) throw new Error("Sem permissão");

  const id = String(formData.get("encaminhamentoId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || undefined;
  await cancelarEncaminhamento(id, motivo);
  await logEvent({
    userId: session!.user.id,
    action: "encaminhamento_cancelado",
    entityType: "encaminhamento",
    entityId: id,
    meta: { motivo },
  });
  revalidatePath("/medico/encaminhamentos");
}
```

- [ ] **Step 3: Estender `reservarConsultaAction`** (em `src/app/medico/consultas/nova/actions.ts`)

Ler o param + repassar + logar o agendamento do encaminhamento:

```ts
const encaminhamentoId = String(formData.get("encaminhamentoId") ?? "").trim() || undefined;
```

No `reservarSlot({...})` adicionar `origemEncaminhamentoId: encaminhamentoId,`. Após o `logEvent` de `consulta_agendada`:

```ts
if (encaminhamentoId) {
  await logEvent({
    userId: session!.user.id,
    action: "encaminhamento_agendado",
    entityType: "encaminhamento",
    entityId: encaminhamentoId,
    meta: { consultaId: consulta.id },
  });
}
```

No `catch` do `SlotIndisponivelError`, preservar o param no redirect de volta:

```ts
const enc = encaminhamentoId ? `&encaminhamentoId=${encaminhamentoId}` : "";
redirect(
  `/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}${enc}&erro=slot_indisponivel` as Route,
);
```

- [ ] **Step 4: Typecheck + commit**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck && pnpm lint"`
Expected: PASS.

```bash
git add "src/app/medico/consultas/[id]/encaminhamento-actions.ts" src/app/medico/encaminhamentos/actions.ts src/app/medico/consultas/nova/actions.ts
git commit -m "feat(medico): server actions de encaminhamento (criar/cancelar) + booking repassa encaminhamentoId"
```

---

## Task 9: GP cria o pedido — coluna 3 do prontuário `[frontend-design]`

**Files:**

- Create: `src/app/medico/consultas/[id]/_encaminhamento-panel.tsx`
- Modify: `src/app/medico/consultas/[id]/page.tsx`

> Visual 100% no kit (classes do `prontuario.module.css` já existentes: `.card`, `.cardHeader`, `.tick`, `.cardTitle`, `.body`, `.chip`, `.btn`, `.btnPrimary`). Accent teal do médico vem do shell.

- [ ] **Step 1: Criar o `EncaminhamentoPanel`** (server component — form posta direto na action)

```tsx
import Link from "next/link";
import type { Route } from "next";
import type { Especialidade, Encaminhamento } from "@prisma/client";
import { criarEncaminhamentoAction } from "./encaminhamento-actions";
import styles from "./prontuario.module.css";

type EncComEsp = Encaminhamento & { especialidade: Pick<Especialidade, "nome" | "corDestaque"> };

const STATUS_LABEL: Record<string, string> = {
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  cancelado: "Cancelado",
};

export function EncaminhamentoPanel({
  consultaId,
  cidadaoId,
  especialidades,
  encaminhamentos,
  podeEncaminhar,
}: {
  consultaId: string;
  cidadaoId: string;
  especialidades: Pick<Especialidade, "id" | "nome">[];
  encaminhamentos: EncComEsp[];
  podeEncaminhar: boolean;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.tick} />
        <h3 className={styles.cardTitle}>Encaminhar a especialista</h3>
      </div>
      <div className={styles.body}>
        {encaminhamentos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {encaminhamentos.map((e) => (
              <div key={e.id} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{e.especialidade.nome}</span>
                <span style={{ color: "var(--text-3)" }}> · {STATUS_LABEL[e.status]}</span>
                {e.motivo ? (
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>{e.motivo}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {podeEncaminhar ? (
          <form
            action={criarEncaminhamentoAction}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input type="hidden" name="consultaOrigemId" value={consultaId} />
            <input type="hidden" name="cidadaoId" value={cidadaoId} />
            <select name="especialidadeId" required defaultValue="" className={styles.cidInput}>
              <option value="" disabled>
                Especialidade…
              </option>
              {especialidades.map((esp) => (
                <option key={esp.id} value={esp.id}>
                  {esp.nome}
                </option>
              ))}
            </select>
            <textarea
              name="motivo"
              placeholder="Motivo (ex.: ansiedade e depressão)"
              className={styles.note}
              style={{ minHeight: 64 }}
            />
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Encaminhar
            </button>
          </form>
        ) : (
          <p className={styles.muted}>Só o profissional/gestão registra encaminhamento.</p>
        )}

        {encaminhamentos.some((e) => e.status === "aguardando_agendamento") && (
          <Link
            href={"/medico/encaminhamentos" as Route}
            className={styles.lk}
            style={{ display: "inline-block", marginTop: 12, fontSize: 12 }}
          >
            Ver fila de agendamento →
          </Link>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Plugar na página** (`src/app/medico/consultas/[id]/page.tsx`)

Após o fetch de `historico` (linha ~90), buscar especialidades ativas + encaminhamentos da consulta:

```ts
const [especialidadesAtivas, encaminhamentos] = await Promise.all([
  db.especialidade.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  }),
  db.encaminhamento.findMany({
    where: { consultaOrigemId: consulta.id },
    include: { especialidade: { select: { nome: true, corDestaque: true } } },
    orderBy: { createdAt: "desc" },
  }),
]);
const podeEnc = podeEncaminhar(session);
```

Importar no topo: `import { podeEncaminhar } from "@/lib/medico/rbac";` (somar ao import existente de `@/lib/medico/rbac`) e `import { EncaminhamentoPanel } from "./_encaminhamento-panel";`.

Na **coluna 3** (a `<div className={styles.col}>` final), **substituir o placeholder "Encaminhamento"** (item do array `SOON`/seção `.soon` "Chega no F1.B.3") por:

```tsx
<EncaminhamentoPanel
  consultaId={consulta.id}
  cidadaoId={consulta.cidadaoId}
  especialidades={especialidadesAtivas}
  encaminhamentos={encaminhamentos}
  podeEncaminhar={podeEnc}
/>
```

> Mantenha o card "Prescrição" como `.soon` (continua F1.B.3) e o card "Privacidade". Só o de Encaminhamento vira funcional.

- [ ] **Step 3: Verify + commit**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh`
Expected: `VERIFY=PASS`.

```bash
git add "src/app/medico/consultas/[id]/_encaminhamento-panel.tsx" "src/app/medico/consultas/[id]/page.tsx"
git commit -m "feat(medico): coluna 3 do prontuário cria encaminhamento (GP)"
```

---

## Task 10: Fila "A agendar" + nav `[frontend-design]`

**Files:**

- Create: `src/app/medico/encaminhamentos/page.tsx`
- Modify: `src/lib/medico/nav.ts`

- [ ] **Step 1: Criar a fila** (`src/app/medico/encaminhamentos/page.tsx`)

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { podeAgendarEncaminhamento, podeEncaminhar } from "@/lib/medico/rbac";
import { cancelarEncaminhamentoAction } from "./actions";

function diasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default async function EncaminhamentosPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeAgendarEncaminhamento(session) && !podeEncaminhar(session)) redirect("/medico" as Route);

  const fila = await db.encaminhamento.findMany({
    where: { status: "aguardando_agendamento" },
    include: { cidadao: { select: { nomeCompleto: true } }, especialidade: true },
    orderBy: { createdAt: "asc" },
  });

  const podeAgendar = podeAgendarEncaminhamento(session);
  const podeCancelar = podeEncaminhar(session);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Instituto Família Pôncio · Centro Médico"
        titulo="A agendar"
        descricao={`${fila.length} ${fila.length === 1 ? "pedido aguardando" : "pedidos aguardando"} agendamento`}
      />

      {fila.length === 0 ? (
        <EmptyState
          titulo="Nada na fila"
          descricao="Nenhum encaminhamento aguardando agendamento. Os pedidos do clínico aparecem aqui."
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cidadão</th>
                <th>Especialidade</th>
                <th>Motivo</th>
                <th>Espera</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {fila.map((e) => {
                const dias = diasDesde(e.createdAt);
                return (
                  <tr key={e.id}>
                    <td className="cell-strong">{e.cidadao.nomeCompleto}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: e.especialidade.corDestaque,
                            flex: "none",
                          }}
                        />
                        {e.especialidade.nome}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-3)", maxWidth: 280 }}>{e.motivo ?? "—"}</td>
                    <td className="cell-mono">
                      {dias === 0 ? "hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {podeAgendar ? (
                        <Link
                          href={`/medico/consultas/nova?encaminhamentoId=${e.id}` as Route}
                          className="btn btn-primary btn-sm"
                        >
                          Agendar
                        </Link>
                      ) : null}
                      {podeCancelar ? (
                        <form
                          action={cancelarEncaminhamentoAction}
                          style={{ display: "inline", marginLeft: 8 }}
                        >
                          <input type="hidden" name="encaminhamentoId" value={e.id} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            Cancelar
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MedicoShell>
  );
}
```

> Confirme a assinatura real de `MedicoHeader` (props `eyebrow`/`titulo`/`descricao`/`acao`) em `components/medico/medico-shell.tsx` — usada igual na Fila (`medico/page.tsx`). Ajuste se divergir.

- [ ] **Step 2: Adicionar o item na nav** (`src/lib/medico/nav.ts`)

Importar a capability e inserir o item depois de "Agenda semanal", visível pra quem trabalha/cria a fila:

```ts
import { podeAgendarEncaminhamento, podeEncaminhar } from "@/lib/medico/rbac";
```

```ts
if (podeAgendarEncaminhamento(session) || hasAnyRole(session, "profissional")) {
  items.push({ label: "A agendar", href: "/medico/encaminhamentos" });
}
```

> `podeAgendarEncaminhamento` cobre recepção/gestão/admin; o `profissional` também enxerga a fila (rastro), conforme spec "leitura para os dois grupos". `podeEncaminhar` importado fica disponível caso prefira `|| podeEncaminhar(session)` no lugar do `hasAnyRole(... "profissional")`.

- [ ] **Step 3: Verify + commit**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh`
Expected: `VERIFY=PASS`.

```bash
git add src/app/medico/encaminhamentos/page.tsx src/lib/medico/nav.ts
git commit -m "feat(medico): fila A agendar (/medico/encaminhamentos) + item de nav"
```

---

## Task 11: Wizard pré-preenchido por `encaminhamentoId`

**Files:**

- Modify: `src/app/medico/consultas/nova/page.tsx`

- [ ] **Step 1: Detectar o param e pular passos 1–2**

Na assinatura de `searchParams`, adicionar `encaminhamentoId?: string`. No início do componente (após `const sp = await searchParams;`), se houver `encaminhamentoId`, carregar o encaminhamento e **derivar** `cidadaoId`+`especialidadeId` dele (sobrepondo o que vier na URL):

```ts
let encaminhamentoId = sp.encaminhamentoId;
let cidadaoIdFixo = sp.cidadaoId;
let especialidadeIdFixo = sp.especialidadeId;

if (encaminhamentoId) {
  const enc = await db.encaminhamento.findUnique({
    where: { id: encaminhamentoId },
    include: { cidadao: true, especialidade: true },
  });
  // Já agendado/cancelado, ou inexistente → ignora o atalho e segue o wizard normal.
  if (!enc || enc.status !== "aguardando_agendamento") {
    encaminhamentoId = undefined;
  } else {
    cidadaoIdFixo = enc.cidadaoId;
    especialidadeIdFixo = enc.especialidadeId;
  }
}
```

Trocar os usos de `sp.cidadaoId`/`sp.especialidadeId` que controlam o passo do wizard por `cidadaoIdFixo`/`especialidadeIdFixo`, de modo que, com `encaminhamentoId` válido, o fluxo caia direto no **passo 3 (slots)**.

- [ ] **Step 2: Propagar `encaminhamentoId` no form de reserva**

No `<form action={reservarConsultaAction}>` do passo 3 (slots), adicionar (quando houver):

```tsx
{
  encaminhamentoId ? (
    <input type="hidden" name="encaminhamentoId" value={encaminhamentoId} />
  ) : null;
}
```

E no `MedicoHeader`/eyebrow do passo 3, sinalizar o contexto: `eyebrow={encaminhamentoId ? "Agendando encaminhamento" : ...}` mostrando cidadão + especialidade travados.

- [ ] **Step 3: Verify + commit**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh`
Expected: `VERIFY=PASS`.

```bash
git add src/app/medico/consultas/nova/page.tsx
git commit -m "feat(medico): wizard pré-preenche e trava cidadão+especialidade do encaminhamento"
```

---

## Task 12: Seed (consulta em_atendimento + encaminhamento + slots)

**Files:**

- Modify: `prisma/seed.ts`

- [ ] **Step 1: Garantir dados de demo idempotentes**

Adicionar ao seed (após o seed de consultas/slots médico existente), de forma idempotente (cheque por `findFirst` antes de criar):

1. Uma `Consulta` `em_atendimento` de um cidadão demo com um profissional (a consulta do GP).
2. Um `Encaminhamento` `aguardando_agendamento` desse cidadão, `consultaOrigemId` = a consulta acima, `especialidadeId` = uma especialidade que **tenha slots disponíveis futuros** (ex.: Psicologia/Psiquiatria), `createdBy` = userId do profissional.
3. Confirmar que existem `Slot` `disponivel` futuros pra essa especialidade (o gerador de slots do seed já cria; senão, criar alguns seg–sex).

> Use os helpers/constantes já existentes no `seed.ts` (emails demo, especialidades). Idempotência: `if (!(await db.encaminhamento.findFirst({ where: { cidadaoId, especialidadeId, status: "aguardando_agendamento" } }))) { … }`.

- [ ] **Step 2: Rodar o seed e conferir**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:seed"`
Expected: sem erro; rodar 2x não duplica (idempotente).

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(seed): consulta em_atendimento + encaminhamento aguardando + slots (demo/e2e)"
```

---

## Task 13: e2e smoke

**Files:**

- Create: `tests/e2e/encaminhamento.spec.ts`

> Espelha o login per-unidade de `tests/e2e/capacitacao.spec.ts` (helper `tests/e2e/helpers/login.ts`). Senha demo `ifp-demo-2026`.

- [ ] **Step 1: Escrever o smoke**

Fluxo:

1. Login como `dr.joao@familiaponcio.org.br` (profissional) → abrir a consulta `em_atendimento` seedada (`/medico` → clicar nela, ou navegar direto pelo id se o seed expõe um id estável) → na coluna 3, escolher especialidade + motivo → "Encaminhar". Asserir que o pedido aparece listado com "Aguardando agendamento".
2. Login como `maria.callcenter@familiaponcio.org.br` (recepção) → `/medico/encaminhamentos` → asserir a linha do cidadão + "Agendar" visível.
3. Clicar "Agendar" → wizard em `/medico/consultas/nova?encaminhamentoId=…` já no passo de slots (cidadão+especialidade travados) → reservar o 1º slot.
4. Asserir redirect pra `/medico/consultas/<novaId>` E que `/medico/encaminhamentos` **não lista mais** aquele pedido (sumiu da fila).

```ts
import { test, expect } from "@playwright/test";
import { loginUnidade } from "./helpers/login";

test("GP encaminha → fila → callcenter agenda → some da fila", async ({ page }) => {
  // 1. GP cria o pedido
  await loginUnidade(page, "medico", "dr.joao@familiaponcio.org.br");
  // … abrir a consulta em_atendimento (via /medico) e submeter o form de encaminhamento …

  // 2. callcenter vê a fila
  await loginUnidade(page, "medico", "maria.callcenter@familiaponcio.org.br");
  await page.goto("/medico/encaminhamentos");
  await expect(page.getByRole("cell").first()).toBeVisible();

  // 3. Agendar reaproveita o wizard
  await page.getByRole("link", { name: "Agendar" }).first().click();
  await expect(page).toHaveURL(/encaminhamentoId=/);
  // … reservar o 1º slot …

  // 4. sumiu da fila
  await page.goto("/medico/encaminhamentos");
  // asserir que o pedido agendado não está mais listado
});
```

> Complete os passos elididos conforme os seletores reais (use `getByRole`/`getByText`; veja `capacitacao.spec.ts`). Se navegar pela consulta por id for frágil, exponha um id estável no seed ou navegue via UI.

- [ ] **Step 2: Rodar o e2e**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test:e2e encaminhamento"`
Expected: PASS (1 teste).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/encaminhamento.spec.ts
git commit -m "test(e2e): smoke do fluxo de encaminhamento (GP → fila → agenda)"
```

---

## Task 14: Verify final + memória + push

- [ ] **Step 1: Ritual completo verde**

Run: `wsl -d Ubuntu -- bash _verify-encaminhamento.sh`
Expected: `VERIFY=PASS` (format/typecheck/lint/unit/build) + e2e do encaminhamento verde.

- [ ] **Step 2: Atualizar a memória do projeto**

Anotar em `project-ifp-connect`: F1.B Encaminhamento Fase 1 entregue (entidade + máquina de estados + fila + wizard pré-preenchido), commit/`origin/main`, limitação anotada (cancelar a consulta agendada NÃO reabre o encaminhamento na Fase 1).

- [ ] **Step 3: Push**

Run: `git -C "C:\Users\Administrador\ifp-connect" push origin main`
Expected: `… main -> main`.

---

## Self-Review (preenchido)

**Cobertura da spec:**

- Modelo de dados (enum + model + FK + reversas) → Task 1. ✓
- Máquina de estados + núcleo puro/transacional (`criar/cancelar/agendar`, erros tipados) → Tasks 3–5. ✓
- RBAC `podeEncaminhar`/`podeAgendarEncaminhamento` + gate de unidade → Task 6 (+ actions Task 8). ✓
- Tela 1 (GP cria na consulta) → Task 9. ✓
- Tela 2 (fila do callcenter + "esperando há N dias" + Agendar/Cancelar) → Task 10. ✓
- Tela 3 (wizard reaproveitado, booking transacional liga consulta↔encaminhamento e flipa status) → Tasks 7 + 11 + 8. ✓
- Rastro/audit (`encaminhamento_criado/agendado/cancelado`) → Task 2 + actions. ✓
- Testes unit (puro+mock) + RBAC + e2e → Tasks 3,4,6,13. ✓
- Casos de borda: especialidade sem slot (pedido entra na fila do mesmo jeito; atendente vê "sem horários" no wizard) — comportamento natural, sem código extra; **duplicado avisa-não-bloqueia** → **lacuna**: a spec §borda pede um aviso (não bloqueio) de pedido duplicado. Decisão: na Fase 1 o `criarEncaminhamento` NÃO bloqueia duplicado (permite N pedidos), e o aviso é cosmético — **deixado fora do código** por ora; se Erick quiser o aviso visual, é um incremento no `EncaminhamentoPanel` (checar se já há `aguardando_agendamento` mesma especialidade e mostrar nota). Anotado, não implementado. Concorrência (duplo-Agendar) → coberto pela validação de status na tx (Task 7). ✓

**Placeholders:** nenhum "TBD"/"TODO" com lógica pendente; os trechos elididos do e2e (seletores) estão explicitamente marcados como "complete conforme seletores reais" — aceitável num smoke que depende da UI final.

**Consistência de tipos:** `StatusEncaminhamento` (Task 1) usado em `encaminhamento.ts` (Task 5); `agendarEncaminhamento(tx, id)` (Task 5) chamado em `agenda.ts` (Task 7); `origemEncaminhamentoId` no schema (Task 1) = no `ReservarSlotInput` (Task 7) = no form/action (Tasks 8/11). `criarEncaminhamentoAction`/`cancelarEncaminhamentoAction` definidas (Task 8) e consumidas (Tasks 9/10). ✓
