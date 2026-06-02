# Plano de Implementação TDD — F1.A.1 Capacitação (Catálogo + Turma + Matrícula)

**Data:** 2026-06-02
**Spec:** `docs/superpowers/specs/2026-05-31-f1a1-capacitacao-design.md` (397 linhas, lida inteira)
**Padrão a espelhar:** Médico F1.B.1/F1.B.2 (`c86b5a8`) — `lib/medico/agenda.ts`, `lib/medico/prontuario.ts`, `lib/medico/rbac.ts`, `MedicoShell`, `CONSULTA_VISUAL`, `Consulta.cidadaoId`.
**Estimativa:** ~1,5–2 dias úteis de TDD focado.

> **Vias de execução** (marcadas em cada task):
>
> - `[ralph-loop]` = loop autônomo até vitest verde. SÓ núcleo lógico (puro / transacional via **mock**). UI, e2e, migration e seed **nunca** entram.
> - `[frontend-design]` = telas, forkando os scaffolds do Design Kit (`docs/design-kit/scaffolds/`). Nunca desenhar do zero (regra do CLAUDE.md). UI só depois do núcleo verde.
> - `[manual]` = migration Prisma + `generate` + novas `AuditAction` + seed + wiring de server actions + e2e + verify final + integração DB-real.

---

## §0 — Decisões resolvidas (dono aprovou "usar as recomendações")

- **§0.1** Curso template + Turma instância → **Opção A (2 níveis):** `Curso` reutilizável, `Turma` datada. Espelha Especialidade→Slot.
- **§0.2** Aluno → **Opção A:** reusa `Cidadao` via `cidadaoId` (fonte única, zero duplicação de PII). Modelos novos: `Curso`, `Turma`, `Matricula`, `Instrutor`.
- **§0.3** Quem matricula → **Opção A:** `recepcao:capacitacao` + `gestor_unidade` + `social` (encaminhamento) pela tela interna; **sem portal público** (auto-inscrição = Fase 2).
  - **§0.3a** Capacidade/lista de espera → **lista de espera ENTRA no F1.A.1** (status `lista_espera`); ao lotar bloqueia inscrição direta e cria `lista_espera`. **Promoção é MANUAL** (gestor aciona `promoverDaListaEspera`), não automática. ⚠️ Único ponto que pode mudar se Erick disser o contrário — default escolhido = manual + entra agora.
  - **§0.3b** Pré-requisitos entre cursos → **FORA** (F1.A.3/trilhas).
- **§0.4** Instrutor → **Opção A faseada:** modelo `Instrutor` com `userId` **nullable** já no F1.A.1; login do instrutor é F1.A.2.
- **§0.5** Presença/frequência → **Opção A (NÃO):** F1.A.1 = só Catálogo + Turma + Matrícula; nem gancho de schema de presença.
- **§0.6** Certificado → **Opção A (FORA):** certificado/PDF/QR/80% = F1.A.3; status `concluido` já existe na máquina de estados.
- **§0.7** Máquina de estados da Matrícula → **Opção A (completa):** `inscrito → confirmado → cursando → (concluido | reprovado | desistente)` + `lista_espera` + `cancelado`.
- **§0.8** Funil legacy → **Opção A (independente):** `Turma` é modelo novo, NÃO toca `Vaga`/`Agendamento` nem reusa `StatusVaga`/`StatusAgendamento`.
- **§0.9** LGPD menores → **Opção A (público adulto) + flag de alerta na UI:** se `cidadao.dataNascimento` < 18 no ato, aviso "Aluno menor de idade — consentimento de responsável tratado fora do escopo deste módulo" + registra no audit.
- **§0.10** Rota → **Opção A (`/capacitacao/*` com `CapacitacaoShell` próprio):** atualizar `getLandingPathFor` de `/app/{scope}` para `/capacitacao` + alinhar os dois verticais; replicar como `/medico` resolveu login.

---

## Ordem topológica (dependências duras)

1. **Migration + `prisma generate`** (T1) — ANTES de qualquer `.ts` que importe `StatusMatricula`/`StatusTurma`/tipos novos do `@prisma/client`. Bloqueia T3, T4, T5.
2. **Novas `AuditAction`** (parte de T13, mas o literal entra cedo) — ANTES do wiring de actions; só union TS, sem migration.
3. **Núcleo lógico** (T3 `matricula.ts`, T4 `rbac.ts`) — depende de T1 (enums gerados). Entram no **ralph-loop**.
4. **Suporte UI-agnóstico** (T5 `nav.ts`+`ui.ts`) — depende de T1 (enum p/ `MATRICULA_VISUAL`).
5. **Seed** (T2) — depende de T1; precisa de DB. Manual.
6. **UI** (T6–T12) — depende de T3/T4/T5 + shell. frontend-design.
7. **Wiring + landing + e2e** (T13–T16) — depende de tudo acima. Manual.

> Regra de ouro: o `generate` (T1) é pré-requisito de **compilação** de T3/T4/T5. O ralph-loop NÃO roda migration — então T1 é **manual e precede o loop**. O loop só edita lógica + testes.

---

## Tasks

### T1 — Schema Prisma + migration + generate `[manual]`

**Arquivo:** `prisma/schema.prisma` (+ migration gerada via `pnpm db:migrate --name f1a1_capacitacao`).

Adicionar (estilo confirmado: enum PascalCase prefixo `Status`, valores minúsculo snake_case sem `@map`, enum logo ANTES do model que usa; PK `id String @id @default(cuid())`; `createdAt @default(now())` + `updatedAt @updatedAt`; texto longo `@db.Text`; data pura `@db.Date`; `onDelete` explícito; `@@index` nos FKs e filtros; docstrings `///` citando §0.x):

```prisma
model Curso {
  id                String   @id @default(cuid())
  nome              String
  descricao         String?  @db.Text
  area              String
  cargaHorariaTotal Int
  modalidade        String   @default("presencial") // presencial|online|hibrido
  capacidadePadrao  Int      @default(20)
  thumbUrl          String?
  ativo             Boolean  @default(true)          // soft-delete
  turmas            Turma[]
  createdById       String
  createdBy         User     @relation("CursoCriadoPor", fields: [createdById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@index([ativo, area])
}

model Instrutor {
  id           String   @id @default(cuid())
  userId       String?  @unique                      // §0.4: null = sem login (F1.A.1)
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  nomeExibicao String
  bio          String?
  ativo        Boolean  @default(true)
  turmas       Turma[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum StatusTurma {
  planejada
  inscricoes_abertas
  em_andamento
  concluida
  cancelada
}

model Turma {
  id          String      @id @default(cuid())
  cursoId     String
  curso       Curso       @relation(fields: [cursoId], references: [id], onDelete: Restrict)
  instrutorId String?
  instrutor   Instrutor?  @relation(fields: [instrutorId], references: [id], onDelete: SetNull)
  codigo      String      @unique
  dataInicio  DateTime    @db.Date
  dataFim     DateTime    @db.Date
  local       String?
  capacidade  Int
  status      StatusTurma @default(planejada)
  observacoes String?     @db.Text
  matriculas  Matricula[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@index([cursoId, status])
  @@index([status, dataInicio])
}

enum StatusMatricula {
  inscrito
  confirmado
  cursando
  concluido
  reprovado
  desistente
  lista_espera
  cancelado
}

model Matricula {
  id              String          @id @default(cuid())
  turmaId         String
  turma           Turma           @relation(fields: [turmaId], references: [id], onDelete: Restrict)
  cidadaoId       String
  cidadao         Cidadao         @relation(fields: [cidadaoId], references: [id], onDelete: Restrict)
  status          StatusMatricula @default(inscrito)
  origemTriagemId String?
  observacoes     String?         @db.Text
  motivoSaida     String?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  @@unique([turmaId, cidadaoId])
  @@index([turmaId, status])
  @@index([cidadaoId])
}
```

**Relations reversas a adicionar (mesma migration):**

- `User` → `cursosCriados Curso[] @relation("CursoCriadoPor")` + `instrutor Instrutor?`
- `Cidadao` → `matriculas Matricula[]`

**Critério:** `pnpm db:migrate --name f1a1_capacitacao` aplica sem erro; `pnpm prisma generate` regenera o client com `StatusTurma`/`StatusMatricula` exportados de `@prisma/client`. Verificar no WSL (Postgres :5433). **Sem isto, T3/T4/T5 nem compilam.**

> ⚠️ Inconsistência da spec resolvida: §3 cita "Turma.ativa booleano", mas o sketch 4.1 usa `status=cancelada` como soft-delete. **Decisão: sem campo `ativa` em Turma — soft-delete da turma = `status=cancelada`** (alinhado ao sketch e ao enum). `Curso.ativo` permanece booleano.

---

### T2 — Seed demo `[manual]`

**Arquivo:** `prisma/seed.ts` (estender o seed existente).

Conteúdo: 3 cursos (ex.: "Informática Básica"/Tecnologia/40h, "Gastronomia Inicial"/Gastronomia/60h, "Costura Industrial"/Costura/80h) + 2 instrutores (`userId` null) + 4 turmas em estados variados (`planejada`, `inscricoes_abertas`, `em_andamento`, `concluida`) + ~15 matrículas cobrindo `inscrito`/`confirmado`/`cursando`/`concluido`/`lista_espera`/`desistente`. Pelo menos 1 turma cheia (matrículas ativas == capacidade) + 1+ em `lista_espera` para o e2e de capacidade. Reusar `cidadaoId` de cidadãos já seedados.

**Critério:** `pnpm db:seed` popula sem violar `@@unique([turmaId, cidadaoId])`; dados batem com os fixtures que o e2e (T16) vai consultar. **Não entra no loop** (DB real).

---

### T3 — `lib/capacitacao/matricula.ts` (núcleo lógico) `[ralph-loop]`

**Arquivo de implementação:** `src/lib/capacitacao/matricula.ts`
**Arquivos de teste (VERMELHOS primeiro):** `tests/unit/capacitacao-matricula-puro.test.ts` (padrão a: sem db) + `tests/unit/capacitacao-matricula-mock.test.ts` (padrão b: `vi.hoisted` + `vi.mock("@/lib/db")`).

Espelha `lib/medico/agenda.ts` (reserva anti-overbooking + máquina de estados tx-aware) e o trio puro do `prontuario.ts` (`podeTransicionarNota`).

**Imports no topo da impl:**

```ts
import type { Prisma, StatusMatricula } from "@prisma/client";
import { db } from "@/lib/db";
```

**Funções com assinatura completa:**

```ts
// ── Erros tipados (espelham SlotIndisponivelError / TransicaoInvalidaError) ──
export class TurmaLotadaError extends Error {
  constructor(public readonly turmaId: string) {
    super(`Turma ${turmaId} está lotada`);
    this.name = "TurmaLotadaError";
  }
}
export class MatriculaDuplicadaError extends Error {
  constructor(
    public readonly turmaId: string,
    public readonly cidadaoId: string,
  ) {
    super(`Cidadão ${cidadaoId} já tem matrícula na turma ${turmaId}`);
    this.name = "MatriculaDuplicadaError";
  }
}
export class TransicaoMatriculaInvalidaError extends Error {
  constructor(
    public readonly de: StatusMatricula,
    public readonly para: StatusMatricula,
  ) {
    super(`Transição de matrícula inválida: ${de} → ${para}`);
    this.name = "TransicaoMatriculaInvalidaError";
  }
}
export class ListaEsperaVaziaError extends Error {
  constructor(public readonly turmaId: string) {
    super(`Turma ${turmaId} não tem ninguém na lista de espera`);
    this.name = "ListaEsperaVaziaError";
  }
}

// ── Máquina de estados (§0.7 completa) — trio canônico ──
// terminais (concluido/reprovado/desistente/cancelado) = Set vazio
export const TRANSICOES_MATRICULA: Record<StatusMatricula, ReadonlySet<StatusMatricula>>;
//   lista_espera -> {inscrito, cancelado}
//   inscrito     -> {confirmado, cancelado}
//   confirmado   -> {cursando, cancelado}
//   cursando     -> {concluido, reprovado, desistente, cancelado}
//   concluido/reprovado/desistente/cancelado = new Set()
export function podeTransicionarMatricula(de: StatusMatricula, para: StatusMatricula): boolean;
//   return TRANSICOES_MATRICULA[de].has(para);

// ── Conjuntos auxiliares puros ──
// status que ocupam vaga (contam p/ capacidade): inscrito, confirmado, cursando
export const STATUS_OCUPA_VAGA: ReadonlySet<StatusMatricula>;

// ── Matrícula transacional anti-overcapacity (espelha reservarSlot) ──
export interface MatricularInput {
  turmaId: string;
  cidadaoId: string;
  createdBy: string;
  observacoes?: string;
  origemTriagemId?: string;
}
export async function matricular(input: MatricularInput): Promise<Matricula>;
//   db.$transaction(async (tx) => {
//     1. checar duplicata: tx.matricula.findUnique({ where: { turmaId_cidadaoId } })
//        existente && status !== "cancelado" -> throw MatriculaDuplicadaError
//     2. ler capacidade da turma (tx.turma.findUniqueOrThrow)
//     3. contar ativas: tx.matricula.count({ where: { turmaId, status: { in: [inscrito,confirmado,cursando] } } })
//     4. status inicial = ativas < capacidade ? "inscrito" : "lista_espera"  (§0.3a entra agora)
//     5. tx.matricula.create({ data: { ...input, status } })  (ou upsert reativando cancelado)
//   })

// ── Transições tx-aware + wrapper (espelha aplicarTransicaoConsulta/transicionarConsulta) ──
export async function aplicarTransicaoMatricula(
  tx: Prisma.TransactionClient,
  matriculaId: string,
  para: StatusMatricula,
  motivoSaida?: string, // gravado quando para ∈ {reprovado, desistente, cancelado}
): Promise<Matricula>;
//   findUniqueOrThrow -> if (!podeTransicionarMatricula(m.status, para)) throw TransicaoMatriculaInvalidaError
//   -> tx.matricula.update({ status: para, motivoSaida? })
export async function transicionarMatricula(
  matriculaId: string,
  para: StatusMatricula,
  motivoSaida?: string,
): Promise<Matricula>;
//   db.$transaction((tx) => aplicarTransicaoMatricula(tx, matriculaId, para, motivoSaida))

// ── Promoção manual da lista de espera (§0.3a = manual) ──
export async function promoverDaListaEspera(turmaId: string): Promise<Matricula>;
//   db.$transaction: pega 1ª lista_espera (orderBy createdAt asc); se nenhuma -> ListaEsperaVaziaError;
//   reverifica vaga (ativas < capacidade) senão TurmaLotadaError;
//   aplicarTransicaoMatricula(tx, id, "inscrito")
```

**Testes VERMELHOS a escrever ANTES** (1 linha cada):

_`capacitacao-matricula-puro.test.ts`_ (padrão a — `import { describe, expect, it } from "vitest"`, sem `vi`):

- `podeTransicionarMatricula("inscrito","confirmado") === true`
- `podeTransicionarMatricula("inscrito","cursando") === false` (pula etapa)
- `podeTransicionarMatricula("confirmado","cursando") === true`
- `podeTransicionarMatricula("cursando","concluido") === true`
- `podeTransicionarMatricula("cursando","reprovado") === true`
- `podeTransicionarMatricula("cursando","desistente") === true`
- `podeTransicionarMatricula("lista_espera","inscrito") === true`
- `podeTransicionarMatricula("concluido","cursando") === false` (terminal)
- `podeTransicionarMatricula("cancelado","inscrito") === false` (terminal)
- `TRANSICOES_MATRICULA.concluido.size === 0` (terminal é Set vazio)
- `STATUS_OCUPA_VAGA` contém inscrito/confirmado/cursando e NÃO contém lista_espera/cancelado/concluido

_`capacitacao-matricula-mock.test.ts`_ (padrão b — `vi.hoisted(() => { const f=()=>vi.fn(); const db={ matricula:{findUnique:f(),findUniqueOrThrow:f(),count:f(),create:f(),update:f(),findFirst:f()}, turma:{findUniqueOrThrow:f()}, $transaction:vi.fn() }; db.$transaction.mockImplementation(arg => typeof arg==="function" ? arg(db) : Promise.all(arg)); return {dbMock:db} })` + `vi.mock("@/lib/db", () => ({ db: dbMock }))` + `reset()` re-armando a impl do `$transaction` em `beforeEach`):

- `matricular` com turma vazia (count=0, capacidade=20) → cria status `inscrito` (assert `create` chamado com `data: objectContaining({ status: "inscrito" })`)
- `matricular` com turma cheia (count=20, capacidade=20) → cria status `lista_espera`
- `matricular` com matrícula existente não-cancelada → `rejects.toBeInstanceOf(MatriculaDuplicadaError)` (não chama `create`)
- `matricular` conta só status ativos (assert `count` chamado com `where.status.in` = [inscrito,confirmado,cursando])
- `aplicarTransicaoMatricula` transição válida → `update` chamado 1x com `status: para`
- `aplicarTransicaoMatricula` transição inválida → `rejects.toBeInstanceOf(TransicaoMatriculaInvalidaError)` (não chama `update`)
- `aplicarTransicaoMatricula` p/ `desistente` com motivo → `update` recebe `motivoSaida`
- `transicionarMatricula` abre `$transaction` 1x e delega (assert `$transaction` chamado)
- `promoverDaListaEspera` sem ninguém em espera (findFirst=null) → `rejects.toBeInstanceOf(ListaEsperaVaziaError)`
- `promoverDaListaEspera` com vaga livre → promove 1ª (findFirst orderBy createdAt asc) p/ `inscrito` (`update` com `status:"inscrito"`)
- `promoverDaListaEspera` sem vaga (count>=capacidade) → `rejects.toBeInstanceOf(TurmaLotadaError)`

**Critério da task:** ambos os arquivos verdes no vitest (sem DB). Atomicidade real (race) NÃO é testada aqui — fica para a integração DB-real (T16/manual, fora do loop).

---

### T4 — `lib/capacitacao/rbac.ts` (capabilities puras) `[ralph-loop]`

**Arquivo de implementação:** `src/lib/capacitacao/rbac.ts`
**Arquivo de teste (VERMELHO primeiro):** `tests/unit/capacitacao-rbac.test.ts` (padrão c — helper `sessionWith(roles, userId)` idêntico ao `medico-rbac.test.ts`).

Espelha `lib/medico/rbac.ts`. Escopo `capacitacao` é garantido pelo gate de rota (`canAccessUnidade(session,"capacitacao")`), então as `pode*` só checam o NOME do role via `hasAnyRole`.

**Imports no topo:**

```ts
import type { Session } from "next-auth";
import type { StatusMatricula } from "@prisma/client";
import { hasAnyRole } from "@/lib/rbac";
```

**Funções com assinatura completa:**

```ts
export function podeGerenciarCurso(session: Session | null): boolean;
//   !session->false; hasAnyRole(session, "super_admin", "gestor_unidade")
export function podeCriarTurma(session: Session | null): boolean;
//   idem podeGerenciarCurso (criar/editar turma = coordenação)
export function podeGerenciarInstrutor(session: Session | null, instrutorUserId?: string): boolean;
//   super_admin/gestor_unidade -> true; profissional só o próprio (id === instrutorUserId)
export function podeMatricular(session: Session | null): boolean;
//   hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao", "social")  (espelha podeMarcarConsulta)
export function podeTransicionarMatricula(
  session: Session | null,
  _de: StatusMatricula,
  para: StatusMatricula,
  matriculaInstrutorUserId?: string,
): boolean;
//   !session->false; super_admin/gestor_unidade -> true;
//   recepcao -> só { confirmado, cancelado };
//   profissional (instrutor logado, F1.A.2) -> próprias turmas (id === matriculaInstrutorUserId)
```

> Nota: NÃO existe role `"instrutor"` nem `"capacitacao"` em `RoleName` (6 valores: super_admin, presidencia, gestor_unidade, social, profissional, recepcao). O "instrutor" do produto = role `profissional` com `unitScope:"capacitacao"`. O bypass de ownership do instrutor é gancho de F1.A.2.

**Testes VERMELHOS a escrever ANTES** (padrão c, `sessionWith`):

- `podeGerenciarCurso(null) === false`
- `podeGerenciarCurso(super_admin) === true`
- `podeGerenciarCurso(gestor_unidade:capacitacao) === true`
- `podeGerenciarCurso(recepcao:capacitacao) === false`
- `podeCriarTurma(recepcao) === false` (recepção não cria turma)
- `podeMatricular(recepcao:capacitacao) === true`
- `podeMatricular(social) === true`
- `podeMatricular(profissional) === false`
- `podeGerenciarInstrutor(profissional, "u1")` com `userId "u1"` → `true` (próprio)
- `podeGerenciarInstrutor(profissional, "outro")` → `false`
- `podeTransicionarMatricula(recepcao, "inscrito","confirmado") === true`
- `podeTransicionarMatricula(recepcao, "cursando","concluido") === false` (recepção não conclui)
- `podeTransicionarMatricula(gestor_unidade, "cursando","concluido") === true`
- `podeTransicionarMatricula(null, ...) === false`

**Critério:** `capacitacao-rbac.test.ts` verde (puro, sem DB).

---

### T5 — `lib/capacitacao/nav.ts` + `lib/capacitacao/ui.ts` `[manual]` (compila com T1; teste opcional)

**Arquivos:** `src/lib/capacitacao/nav.ts`, `src/lib/capacitacao/ui.ts`.

- `nav.ts` espelha `medicoNavItems`: `export function capacitacaoNavItems(session: Session): NavItem[]` com itens "Início" (`/capacitacao`), "Catálogo" (`/capacitacao/cursos`), "Turmas" (`/capacitacao/turmas`), "Instrutores" (`/capacitacao/instrutores`), "Cidadãos" (`/app/cidadaos`); "Catálogo/Turmas" mutáveis só aparecem com `podeCriarTurma`. Import `NavItem` de `@/components/sidebar-nav`.
- `ui.ts` espelha `CONSULTA_VISUAL`: `export const MATRICULA_VISUAL: Record<StatusMatricula, { label: string; variant: ... }>` com label PT-BR + variante de Badge por status (ex.: `inscrito`→neutro, `confirmado`→info, `cursando`→ativo, `concluido`→success, `reprovado`/`desistente`→warning/muted, `lista_espera`→pending, `cancelado`→danger). Também `STATUS_TURMA_VISUAL` para a `StatusTurma`.

> Pode ganhar um `capacitacao-ui.test.ts` puro trivial (todo `StatusMatricula` tem entrada em `MATRICULA_VISUAL`) — opcional no loop, mas se incluído entra como padrão a.

**Critério:** compila com os enums de T1; `MATRICULA_VISUAL` cobre os 8 estados; `STATUS_TURMA_VISUAL` cobre os 5.

---

### T6 — `CapacitacaoShell` + `CapacitacaoHeader` `[frontend-design]`

**Arquivo:** `src/components/capacitacao/capacitacao-shell.tsx` (espelha `src/components/medico/medico-shell.tsx`).

Usa `AppShell` (`src/components/app-shell.tsx`) com `sectionLabel="Capacitação"` e acento laranja da unidade (`#FF772E` / `rgb(var(--ifp-orange-500))`, já em `unidades.ts`); `data-unit="capacitacao"` no body. Consome `capacitacaoNavItems` (T5). Forka o scaffold `docs/design-kit/scaffolds/app-shell.html`.

**Critério:** renderiza com o chrome do kit, acento laranja, nav contextual.

---

### T7 — Home `/capacitacao` `[frontend-design]`

**Arquivo:** `src/app/capacitacao/page.tsx`.
KPIs (turmas em andamento / matrículas ativas / inscrições abertas) + lista de turmas `em_andamento` + atalhos (Novo curso, Nova turma, Catálogo). Forka `docs/design-kit/scaffolds/dashboard-kpi.html`.

---

### T8 — Catálogo `/capacitacao/cursos` + `/novo` + `/[id]` `[frontend-design]`

**Arquivos:** `src/app/capacitacao/cursos/page.tsx`, `cursos/novo/page.tsx`, `cursos/[id]/page.tsx`.
Grade de cards Disco-like (thumb+nome+área+carga+nº turmas ativas), filtro área/modalidade, botão "Novo curso" (gated `podeGerenciarCurso`). Detalhe = ementa + dados + turmas (passadas/futuras) + "Nova turma deste curso". Forka scaffold de cards/grid do kit + `lista-tabela.html`.

---

### T9 — Turmas `/capacitacao/turmas` + `/nova` `[frontend-design]`

**Arquivos:** `src/app/capacitacao/turmas/page.tsx`, `turmas/nova/page.tsx`.
Tabela filtrável (status/curso/período) + badge de ocupação (`12/20`, derivada de `STATUS_OCUPA_VAGA`). "Nova turma" gated `podeCriarTurma`; `capacidade` herda `Curso.capacidadePadrao`. Forka `lista-tabela.html`.

---

### T10 — Detalhe da turma `/capacitacao/turmas/[id]` + transições `[frontend-design]`

**Arquivo:** `src/app/capacitacao/turmas/[id]/page.tsx`.
Cabeçalho (curso/período/instrutor/local/ocupação) + lista de matriculados com `MATRICULA_VISUAL` + ações (confirmar/cursando/concluído/desistente/cancelar + "promover lista de espera") gated por `podeTransicionarMatricula`. Espaço reservado "Presença"(F1.A.2)/"Certificados"(F1.A.3). Forka `lista-tabela.html` + cabeçalho do kit.

---

### T11 — Wizard de matrícula `/capacitacao/turmas/[id]/matricular` `[frontend-design]`

**Arquivo:** `src/app/capacitacao/turmas/[id]/matricular/page.tsx`.
Step 1 busca cidadão (reutiliza componente de busca de `Cidadao`, igual `/medico/consultas/nova`) → Step 2 confirma (turma, vagas restantes, **aviso menor §0.9** se `dataNascimento` < 18) → submit `matricular` action. Forka `docs/design-kit/scaffolds/wizard.html`.

---

### T12 — Instrutores `/capacitacao/instrutores` `[frontend-design]`

**Arquivo:** `src/app/capacitacao/instrutores/page.tsx`.
Lista + criar/editar (nomeExibicao, bio) gated `podeGerenciarInstrutor`; vínculo com `User` (login) = F1.A.2 (não implementar). Forka `lista-tabela.html`.

---

### T13 — Server actions + AuditAction `[manual]`

**Arquivos:** `src/app/capacitacao/actions.ts`; `src/lib/audit.ts` (adicionar literais na union `AuditAction`).

Adicionar à union `AuditAction` (só TS, **sem migration** — coluna `audit_log.action` é string livre), antes do fechamento `;`:

```ts
  // Capacitação (F1.A.1)
  | "curso_criado"
  | "curso_atualizado"
  | "curso_desativado"
  | "turma_criada"
  | "turma_atualizada"
  | "turma_cancelada"
  | "instrutor_criado"
  | "instrutor_atualizado"
  | "matricula_criada"
  | "matricula_confirmada"
  | "matricula_transicionada"
  | "matricula_cancelada"
  | "lista_espera_promovida"
```

Actions seguem o template real de `src/app/medico/consultas/nova/actions.ts`: `"use server"` → `auth()` → guard RBAC (`podeX(session)` lança `Error("Sem permissão")`) → ler `FormData` com `String(formData.get())` (opcionais `String(... ?? "").trim() || undefined`) → fn de domínio de `@/lib/capacitacao/matricula` passando `createdBy: session!.user.id` → `logEvent({ userId, action, rootEntityType: "cidadao", rootEntityId: cidadaoId, entityType: "matricula", entityId, meta })` APÓS sucesso → `redirect(\`/capacitacao/...\` as Route)`. Capturar erros tipados (`TurmaLotadaError`/`MatriculaDuplicadaError`/`TransicaoMatriculaInvalidaError`) no `catch`→`redirect(?erro=...)`; re-lançar o resto. Audit com `rootEntityType:"cidadao"` (LGPD §10 — habilita histórico do cidadão).

Actions: `criarCursoAction`, `atualizarCursoAction`, `desativarCursoAction`, `criarTurmaAction`, `atualizarTurmaAction`, `cancelarTurmaAction`, `criarInstrutorAction`, `atualizarInstrutorAction`, `matricularAction`, `transicionarMatriculaAction`, `promoverListaEsperaAction`.

**Critério:** `pnpm typecheck` verde com as novas actions e a union estendida.

---

### T14 — `getLandingPathFor` → `/capacitacao` + login da unidade `[manual]`

**Arquivo:** `src/lib/rbac-types.ts` (+ rota de login se o padrão `/medico/login` exigir).

Ajustar `getLandingPathFor`: o branch `gestor_unidade`/`profissional`/`recepcao` retorna hoje `/app/${primaryUnitScope}`. Verificar como `/medico` resolveu (rota efetiva `/medico/*` + `/medico/login`) e replicar para `capacitacao` → `/capacitacao`. **Task de alinhamento dos DOIS verticais** (não quebrar o redirect do médico). Atualizar testes existentes de `getLandingPathFor` se houver.

**Critério:** `gestor_unidade:capacitacao` cai em `/capacitacao`; médico continua funcionando; login da unidade replica o padrão do médico.

---

### T15 — Lab de design `[frontend-design]`

4-6 direções de **home + catálogo** em `public/lab/` (ou equivalente do padrão do projeto) pro Erick escolher de manhã, forkando os scaffolds do kit (`dashboard-kpi.html`, grade de cards). Conservar tokens (`--ifp-*`, acento laranja capacitação).

---

### T16 — E2e Playwright + integração DB-real `[manual]`

**Arquivos:** `tests/e2e/capacitacao-*.spec.ts` (+ opcional `tests/unit/capacitacao-matricula-integracao.test.ts` DB-real, fora do loop).

Cenários e2e: (1) cadastrar curso + abrir turma + `inscricoes_abertas`; (2) matricular até lotar → verifica `inscrito` até a capacidade, depois `lista_espera`; (3) promover lista de espera (manual) → vira `inscrito`; (4) transição de matrícula respeita máquina de estados (inválida = erro claro); (5) RBAC — recepção NÃO cria curso.
Integração DB-real (espelha `medico-agenda.test.ts` `reservarSlot (integration)`): `Promise.allSettled` de N `matricular` concorrentes na última vaga → exatamente 1 `inscrito`, resto `lista_espera`; cleanup explícito ao fim de cada `it`. **NÃO entra no loop** (precisa Postgres :5433 + seed).

**Critério:** e2e verdes; `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` verdes antes do push.

---

## Config ralph-loop

**Promise textual:** `CAPACITACAO-CORE-GREEN`
**Critério da promise:** os 3 arquivos de teste do núcleo passam no vitest sem DB —
`tests/unit/capacitacao-matricula-puro.test.ts`, `tests/unit/capacitacao-matricula-mock.test.ts`, `tests/unit/capacitacao-rbac.test.ts` (e `capacitacao-ui.test.ts` se criado) — ou seja, `matricula.ts` (máquina de estados + capacidade/lista de espera + matrícula transacional via mock) e `rbac.ts` implementados e verdes.

**`--max-iterations` sugerido:** `12` (núcleo é ~2 arquivos de impl + 3 de teste; máquina de estados + mock convergem rápido com os contratos exatos já dados).

**Pré-condição (manual, ANTES do loop):** T1 aplicada (`pnpm db:migrate --name f1a1_capacitacao` + `pnpm prisma generate`) — sem os enums `StatusMatricula`/`StatusTurma` em `@prisma/client` os arquivos de impl/teste **não compilam** e o loop falha por infra, não por código. O loop **não** roda migration.

**ALLOWLIST de arquivos que o loop pode editar (só lógica + seus testes):**

```
src/lib/capacitacao/matricula.ts
src/lib/capacitacao/rbac.ts
tests/unit/capacitacao-matricula-puro.test.ts
tests/unit/capacitacao-matricula-mock.test.ts
tests/unit/capacitacao-rbac.test.ts
```

(NÃO permitir: `prisma/schema.prisma`, `prisma/seed.ts`, qualquer `src/app/**`, `src/components/**`, `src/lib/audit.ts`, `src/lib/rbac-types.ts`, e2e.)

**Lembrete — confirmar VERMELHO à mão antes de iniciar o loop:** escrever os 3 arquivos de teste primeiro e rodar o verify uma vez; deve sair `VERIFY=FAIL` (impl ainda vazia). Só então iniciar o loop. (TDD: red → green.)

**Comando de VERIFY (via ARQUIVO `.sh`, nunca `bash -lc` inline — o marshalling PowerShell→wsl mascara exit code como 0):**

Criar `C:/Users/Administrador/ifp-connect/_verify-capacitacao.sh`:

```sh
#!/usr/bin/env bash
cd /mnt/c/Users/Administrador/ifp-connect
pnpm vitest run \
  tests/unit/capacitacao-matricula-puro.test.ts \
  tests/unit/capacitacao-matricula-mock.test.ts \
  tests/unit/capacitacao-rbac.test.ts
echo $? > /tmp/v.exit
if [ "$(cat /tmp/v.exit)" = "0" ]; then echo "VERIFY=PASS"; else echo "VERIFY=FAIL"; fi
```

Rodar: `wsl -d Ubuntu -- bash /mnt/c/Users/Administrador/ifp-connect/_verify-capacitacao.sh`

> Gotcha confirmado (reference_ralph_loop): após a promise, o state file fica `active:true` órfão em `<projeto>/.claude/` → rodar `/cancel-ralph` ao terminar. Lançar o claude de dentro do projeto.

---

## Critérios de sucesso

- [ ] T1 aplicada: migration + `generate`; `StatusTurma`/`StatusMatricula` em `@prisma/client`.
- [ ] `CAPACITACAO-CORE-GREEN`: 3 testes do núcleo verdes (máquina de estados, capacidade/lista de espera, matrícula transacional via mock, RBAC).
- [ ] Matrícula dupla bloqueada (`@@unique` + `MatriculaDuplicadaError`); ao lotar → `lista_espera`.
- [ ] Transições respeitam `TRANSICOES_MATRICULA`; inválidas → `TransicaoMatriculaInvalidaError`.
- [ ] RBAC: recepção não cria curso/turma; instrutor (profissional+capacitacao) = gancho documentado.
- [ ] Integração DB-real: overbooking concorrente tratado (1 vaga → 1 inscrito, resto lista de espera).
- [ ] Audit captura toda mutação com `rootEntityType:"cidadao"`/`rootEntityId:cidadaoId`.
- [ ] `getLandingPathFor` → `/capacitacao`; médico não regride.
- [ ] Aviso de menor §0.9 aparece no wizard e registra audit.
- [ ] E2e Playwright verdes; `pnpm format:check && typecheck && lint && test && build` verdes.
- [ ] Lab `frontend-design` com 4-6 direções (home + catálogo) pro Erick.

---

## O que fica pro frontend-design (UI — depois do núcleo verde)

Todas via skill `frontend-design`, **forkando scaffolds do Design Kit** (`docs/design-kit/scaffolds/`), nunca do zero (regra dura do CLAUDE.md; tokens `--ifp-*` + acento laranja `capacitacao`):

- **T6** `CapacitacaoShell`/`CapacitacaoHeader` ← `app-shell.html`
- **T7** Home `/capacitacao` (KPIs + turmas em andamento) ← `dashboard-kpi.html`
- **T8** Catálogo grade de cards + `/novo` + `/[id]` ← cards/grid + `lista-tabela.html`
- **T9** Turmas lista/filtro + `/nova` ← `lista-tabela.html`
- **T10** Detalhe turma + matriculados + transições ← `lista-tabela.html` + cabeçalho
- **T11** Wizard de matrícula (busca → confirma + aviso menor) ← `wizard.html`
- **T12** Instrutores CRUD (sem login) ← `lista-tabela.html`
- **T15** Lab de 4-6 direções (home + catálogo)

> Pendências a confirmar com Erick mesmo dentro das recomendações: §0.3a (lista de espera já no F1.A.1 — default SIM; promoção manual — default MANUAL); §0.4 (cair p/ Opção B `instrutorNome` texto se quiser velocidade máxima); §0.6 (PDF manual Opção B se Luciana tiver demo iminente); §0.9 (se há curso infantil iminente que force Opção B).
