# Plano de Implementação TDD — F1.B.2 Prontuário Médico (3 colunas, estilo Elation)

> **Projeto:** IFP Connect · **Módulo:** F1.B.2 · **Base:** F1.B.1 (`c86b5a8`)
> **Spec fonte:** `C:/Users/Administrador/ifp-connect/docs/superpowers/specs/2026-05-31-f1b2-prontuario-design.md`
> **Convenção:** cada task marcada `[ralph-loop]`, `[frontend-design]` ou `[manual]`, com justificativa da via.

---

## §0 — Decisões resolvidas (donos aprovou "aceitar minhas recomendações")

- **§0.1 — Formato da nota:** Opção C (híbrido). Campo `texto` livre `@db.Text` + blocos estruturados opcionais (sinais vitais §0.5, CID §0.6) na mesma nota. NÃO SOAP.
- **§0.2 — Granularidade:** Híbrido pragmático. `NotaEvolucao` 1:1 com `Consulta` (`consultaId @unique`), com `cidadaoId`/`profissionalId` desnormalizados; coluna histórico = query longitudinal por `cidadaoId` (cross-profissional). Sem model `Prontuario`; nota avulsa fora de escopo.
- **§0.3 — Edição/assinatura:** Opção B. Só o profissional **dono** edita, e só em `em_atendimento` (rascunho). Marcar `realizada` = assinar → nota `assinada` imutável. Gestor/super_admin só leem+auditam, não editam conteúdo clínico. Recepção/social não veem conteúdo clínico.
- **§0.4 — Versionamento:** Opção B (append-only + `AddendoNota`). Novas `AuditAction`: `prontuario_criado`, `prontuario_assinado`, `prontuario_addendo`. Assinatura é lógica (carimbo userId+timestamp), não ICP-Brasil.
- **§0.5 — Sinais vitais:** Opção A estruturada, todos opcionais (`paSistolica`, `paDiastolica`, `fcBpm`, `frIrpm`, `tempC`, `pesoKg`, `alturaCm`, `spo2`). IMC **derivado** (não persistido). Range só warning, nunca bloqueia.
- **§0.6 — Diagnóstico/CID-10:** Opção A no F1.B.2. Tabela `Cid10` (seed CSV DATASUS), `DiagnosticoNota` por nota com `codigoCid?` + `descricao` + `principal: boolean`, múltiplos por nota, fallback texto livre. Problem list longitudinal (C) ADIADA.
- **§0.7 — Campos de saúde do Cidadão:** Opção B restrita ao profissional. Os 4 campos clínicos (`tipoSanguineo`/`alergias`/`medicamentosEmUso`/`condicoesCronicas`) editáveis inline pelo profissional, gerando `cidadao_saude_atualizada` (`rootEntityType: 'cidadao'`). Mantidos como Text no `Cidadao`, sem migração estrutural.
- **§0.8 — LGPD dado sensível:** `medical_data_accessed` (já tipado, órfão) ganha caller em toda abertura de prontuário. Anonimizar Cidadão (`anonimizadoEm`) **NÃO** apaga `NotaEvolucao` (retenção legal ≥20 anos, CFM 1.821/2007). Base legal: tutela da saúde (art. 11 II "f") + política pública.
- **§0.9 — Fronteira F1.B.3:** Opção A. Coluna direita = placeholder inerte (Prescrição/Encaminhamento/Atestado "chega no F1.B.3"). Memed = Plano 8.

**Decisão menor §3 (gate de conclusão):** `em_atendimento → realizada` exige nota assinada; a UI usa o ato "Assinar e concluir" (assinar = transicionar, atômico). NÃO há "concluir sem nota" — concluir É assinar.

---

## Ordem topológica (NÃO violar)

```
T1  [manual]        Schema Prisma (models+enum+relações) + migration + prisma generate   ← BLOQUEIA tudo que importa StatusNota/NotaEvolucao
T2  [ralph-loop]    lib pura: vitais/IMC/transição StatusNota (NÃO importa Prisma client; usa só type StatusNota gerado por T1)
T3  [ralph-loop]    RBAC: 4 funções pode* em medico/rbac.ts (importa type RoleName/StatusNota; sem DB)
T4  [manual]        Adicionar 4 AuditAction em audit.ts (aditivo, sem migration) — pré-req de T5/T9
T5  [ralph-loop]    lib transacional: salvarRascunho/assinarNota/adicionarAddendo + NotaAssinadaError (lógica via mock $transaction; integração via DB real fora do loop)
T6  [manual]        Seed CID-10 (CSV DATASUS) + 2 notas demo assinadas
─── a partir daqui só UI/wiring/e2e ───
T7  [frontend-design]  sinais-vitais-fields.tsx (IMC client-side, usa helper puro de T2)
T8  [frontend-design]  cid-autocomplete.tsx
T9  [manual]        registrarAcessoProntuario + caller medical_data_accessed no load da page
T10 [frontend-design]  evolucao-coluna.tsx (centro)
T11 [frontend-design]  contexto-coluna.tsx (esquerda) + timeline-atendimentos.tsx
T12 [frontend-design]  acoes-coluna.tsx (placeholders inertes)
T13 [frontend-design]  reescrever page.tsx p/ grid 3-col + montar colunas
T14 [manual]        prontuario-actions.ts (wiring server actions; espelha consultas/[id]/actions.ts)
T15 [manual]        e2e Playwright (5 cenários §7.15)
T16 [manual]        verify final (typecheck+lint+test+build)
```

Regra dura: **T1 (migration + `prisma generate`) ANTES de qualquer código que importe `StatusNota`/`NotaEvolucao`** (T2, T3, T5). T4 (AuditAction) antes de T5/T9/T14. T7/T8 dependem de T2 (helper IMC) mas não bloqueiam o loop. Tudo `[frontend-design]` depois do núcleo lógico verde.

---

## Tasks

### T1 — Schema Prisma + migration + generate `[manual]`

**Via:** manual — migration toca DB (Postgres no WSL Ubuntu, ver memória wslrelay) + `prisma generate` regenera tipos; supervisão obrigatória.
**Arquivo:** `C:/Users/Administrador/ifp-connect/prisma/schema.prisma` (atual 545 linhas, postgresql).
**Mudanças (usar nomes/tipos EXATOS do §2 da spec):**

- Adicionar enum `StatusNota { rascunho assinada }` (snake_case minúsculo, padrão do schema — confirmado pelo contrato `StatusConsulta`).
- Adicionar models `NotaEvolucao`, `AddendoNota`, `DiagnosticoNota`, `Cid10` (sketch §2). Confirmado pelo contrato `models-novos-existem`: NENHUM existe hoje (grep negativo).
- Texto clínico longo = `String? @db.Text` (padrão do projeto, ver `alergias/medicamentosEmUso/condicoesCronicas`).
- FKs com `onDelete: Restrict` (padrão de `Consulta`), exceto `DiagnosticoNota.nota` = `Cascade` (§2).
- **Relações reversas a adicionar nos models existentes** (contrato `schema-prisma` avisa que NÃO existe reversa de notas em Consulta):
  - `Consulta` → `notaEvolucao NotaEvolucao?`
  - `Cidadao` → `notasEvolucao NotaEvolucao[]`
  - `Profissional` → `notasEvolucao NotaEvolucao[]`
- Índices: `NotaEvolucao @@index([cidadaoId, createdAt])` (coluna histórico longitudinal), `@@index([profissionalId])`; `AddendoNota @@index([notaId, createdAt])`; `DiagnosticoNota @@index([notaId])` + `@@index([codigoCid])`; `Cid10 @@index([descricao])`.
  **Comandos (WSL):** `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm prisma migrate dev --name f1b2_prontuario && pnpm prisma generate"`
  **Critério de pronto:** migration aplicada; `pnpm prisma generate` regenera `@prisma/client` com `StatusNota`, `NotaEvolucao`, `AddendoNota`, `DiagnosticoNota`, `Cid10`; `pnpm typecheck` continua verde (nenhum import quebrado).

---

### T2 — lib pura: vitais / IMC / transição StatusNota `[ralph-loop]`

**Via:** ralph-loop — núcleo LÓGICO puro, zero DB, verify por unit test (padrão ideal igual a `gerarSlots`). Confirmado pelo contrato `test-pattern-mock-vs-db` item (a): funções puras → import direto, sem db.
**Arquivo de produção:** `C:/Users/Administrador/ifp-connect/src/lib/medico/prontuario.ts` (NOVO; este task cria só a parte PURA; a transacional vem em T5 no mesmo arquivo).
**Import permitido:** `import type { StatusNota } from "@prisma/client"` (type-only, igual ao padrão `import type { StatusConsulta }` em agenda.ts). NÃO importar `db` aqui.

**Funções (assinaturas completas):**

```ts
export interface SinaisVitaisInput {
  paSistolica?: number | null;
  paDiastolica?: number | null;
  fcBpm?: number | null;
  frIrpm?: number | null;
  tempC?: number | null;
  pesoKg?: number | null;
  alturaCm?: number | null;
  spo2?: number | null;
}

/** IMC derivado (NÃO persistido §0.5). null se peso ou altura ausente/zero. Arredonda 1 casa. */
export function calcularImc(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null;

export interface VitalWarning { campo: keyof SinaisVitaisInput; valor: number; mensagem: string; }

/** Range só WARNING, nunca bloqueia (§0.5). Retorna [] se tudo plausível/ausente. */
export function validarSinaisVitais(v: SinaisVitaisInput): VitalWarning[];

/** Máquina de estados da NOTA, isolada e PURA (recomendação do contrato test-state-machine). */
const TRANSICOES_NOTA: Record<StatusNota, ReadonlySet<StatusNota>>; // rascunho->{assinada}; assinada->{} (terminal)
export function podeTransicionarNota(de: StatusNota, para: StatusNota): boolean;

export class TransicaoNotaInvalidaError extends Error {
  constructor(public readonly de: StatusNota, public readonly para: StatusNota);
}
```

**Notas de implementação (pegadinhas reais do repo):**

- `noUncheckedIndexedAccess` ligado: `TRANSICOES_NOTA[de]` é seguro porque a chave é `StatusNota` e o Record é exaustivo (mesma garantia que `TRANSICOES[c.status]` em agenda.ts).
- Espelhar o estilo de `TransicaoInvalidaError` (campos públicos readonly `de`/`para`).
- IMC = `peso / (altura_m)^2`; tratar altura 0 → null (evitar divisão por zero).
- Ranges de warning sugeridos (não bloqueantes): PA sist 70–250, diast 40–150, FC 30–220, FR 8–60, temp 30–43, SpO2 50–100, peso 0.5–400, altura 30–250. Valores fora → warning, nunca throw.

**Testes VERMELHOS a escrever ANTES** — `C:/Users/Administrador/ifp-connect/tests/unit/medico-prontuario-puro.test.ts` (padrão: import direto, sem db; igual a `medico-rbac.test.ts`):

- `calcularImc(70, 175)` retorna ~22.9 (1 casa).
- `calcularImc(null, 175)` retorna null.
- `calcularImc(70, null)` retorna null.
- `calcularImc(70, 0)` retorna null (sem divisão por zero).
- `validarSinaisVitais({})` retorna [] (tudo ausente, sem warning).
- `validarSinaisVitais({ paSistolica: 120, fcBpm: 72 })` retorna [] (plausível).
- `validarSinaisVitais({ fcBpm: 320 })` retorna 1 warning com `campo: "fcBpm"`.
- `validarSinaisVitais({ spo2: 30, tempC: 50 })` retorna 2 warnings (nunca lança).
- `podeTransicionarNota("rascunho","assinada")` é true.
- `podeTransicionarNota("assinada","rascunho")` é false (assinada é terminal/imutável §0.4).
- `podeTransicionarNota("assinada","assinada")` é false (não re-assina).
  **Critério de pronto:** `medico-prontuario-puro.test.ts` 100% verde via vitest; `prontuario.ts` exporta as 4 funções/classe puras; nenhum import de `db`.

---

### T3 — RBAC: 4 funções `pode*` do prontuário `[ralph-loop]`

**Via:** ralph-loop — funções puras de RBAC, 100% testáveis sem DB (contrato `test-pattern-mock-vs-db` item (a) + `medico-rbac.test.ts` já é o precedente com `sessionWith` helper).
**Arquivo de produção:** `C:/Users/Administrador/ifp-connect/src/lib/medico/rbac.ts` (EDITA; adicionar 4 funções espelhando `podeTransicionarConsulta`).
**Imports:** reusar `hasAnyRole` de `@/lib/rbac` (contrato `hasAnyRole`), `Session` (mesmo import já usado no arquivo), `import type { StatusNota } from "@prisma/client"`. Para `podeAtualizarSaudeCidadao` reusar `can(session,'edit','ficha_cidada',{unitScope:'medico'})` de `@/lib/rbac` (recomendação do contrato rbac, mais limpo que reimplementar).

**Funções (assinaturas — seguem o template `podeTransicionarConsulta`):**

```ts
/** Leitura ampla cross-profissional (§4): super_admin, gestor_unidade, profissional. NÃO filtra por dono. */
export function podeVerProntuario(session: Session | null): boolean;

/** Só rascunho e só do dono (§0.3). Recebe status como arg extra (à la podeTransicionarConsulta). */
export function podeEditarNota(
  session: Session | null,
  notaProfissionalUserId: string,
  status: StatusNota,
): boolean;

/** A mais restrita: SÓ o profissional dono assina. SEM bypass de admin (assinatura é ato pessoal/legal §0.4). */
export function podeAssinarNota(session: Session | null, notaProfissionalUserId: string): boolean;

/** Edição de saúde do cidadão = escopo de unidade, não dono de consulta (§0.7). */
export function podeAtualizarSaudeCidadao(session: Session | null): boolean;
```

**Lógica EXATA (do contrato rbac `notes`):**

- `podeVerProntuario`: `if (!session) return false; return hasAnyRole(session,'super_admin','gestor_unidade','profissional')` (espelha `verSaude` de cidadao-history.ts:254; recepcao/social NÃO veem clínico).
- `podeEditarNota`: `if (!session) return false; if (status !== 'rascunho') return false;` depois `return hasAnyRole(session,'super_admin','gestor_unidade') || (hasAnyRole(session,'profissional') && session.user.id === notaProfissionalUserId)`. **Atenção §0.3:** gestor/super_admin NÃO editam conteúdo clínico — então o admin-bypass aqui deve ser **removido**; manter só `hasAnyRole(session,'profissional') && session.user.id === notaProfissionalUserId && status === 'rascunho'`. (Confirmar: a tabela §4 marca "Criar/editar nota" só pro dono.)
- `podeAssinarNota`: `return hasAnyRole(session,'profissional') && session.user.id === notaProfissionalUserId` (sem admin bypass — recomendação explícita do contrato).
- `podeAtualizarSaudeCidadao`: `if (!session) return false; return hasAnyRole(session,'super_admin','gestor_unidade','profissional')` (recepcao/social não editam §0.7); ou delegar a `can(session,'edit','ficha_cidada',{unitScope:'medico'})`.
- `session.user.id` é `token.sub` (contrato `session-shape`); NÃO existe `profissionalId` na sessão — comparar userIds, igual a `consultaProfissionalUserId`.

**Testes VERMELHOS a escrever ANTES** — `C:/Users/Administrador/ifp-connect/tests/unit/medico-rbac.test.ts` (EDITA — adicionar `describe`s; reusar helper `sessionWith`):

- `podeVerProntuario` com role `profissional` → true.
- `podeVerProntuario` com role `recepcao` → false.
- `podeVerProntuario` com role `social` → false.
- `podeVerProntuario(null)` → false.
- `podeEditarNota` profissional dono + status `rascunho` → true.
- `podeEditarNota` profissional dono + status `assinada` → false (imutável).
- `podeEditarNota` profissional NÃO-dono + `rascunho` → false (ownership).
- `podeEditarNota` gestor_unidade + `rascunho` → false (gestor não edita clínico §0.3).
- `podeAssinarNota` profissional dono → true.
- `podeAssinarNota` profissional NÃO-dono → false.
- `podeAssinarNota` super_admin (não-dono) → false (sem bypass).
- `podeAtualizarSaudeCidadao` profissional → true; recepcao → false; null → false.
  **Critério de pronto:** novos casos verdes em `medico-rbac.test.ts`; 4 funções exportadas em `medico/rbac.ts`; sem regressão nos testes existentes do arquivo.

---

### T4 — Novas AuditAction `[manual]`

**Via:** manual — edição mecânica de tipo + verify de compilação (sem DB, mas é pré-req de T5/T9/T14 e o contrato `audit` dá instrução cirúrgica de edição). Aditivo, **sem migration** (campo `action` no DB é string).
**Arquivo:** `C:/Users/Administrador/ifp-connect/src/lib/audit.ts` (union `AuditAction`, linhas 4-42).
**Edição EXATA (do contrato `audit` notes):** o último membro hoje é `| "consulta_cancelada";` (com `;`). Trocar para `| "consulta_cancelada"` e anexar bloco:

```ts
  // Prontuario (F1.B.2)
  | "prontuario_criado"
  | "prontuario_assinado"
  | "prontuario_addendo"
  | "cidadao_saude_atualizada";
```

(seguir o padrão de comentário de bloco `// Centro Medico (F1.B.1)` da linha 25.)
**Notas:** `medical_data_accessed` JÁ existe (linha 11, órfão) — só ganha caller em T9; NÃO precisa adicionar. NENHUMA mudança em `logEvent` (o `action: AuditAction` aceita os novos literais automaticamente).
**Critério de pronto:** `pnpm typecheck` verde; `audit.test.ts` continua verde (mock parcial não quebra).

---

### T5 — lib transacional: salvarRascunho / assinarNota / adicionarAddendo `[ralph-loop]` (lógica) + `[manual]` (integração DB)

**Via:** **ralph-loop para a LÓGICA de orquestração via mock de `db.$transaction`** (precedente real: `audit.test.ts` usa `vi.hoisted` + `vi.mock("@/lib/db")`); **e `[manual]` para a suíte de integração DB-real** (anti-overbooking/atomicidade/derivação pós-update são DB-real, impossíveis no loop sem Postgres — contrato `test-transacional`). O loop NÃO roda integração; valida só `count===0→throw`, sequência de chamadas e máquina de estados.
**Arquivo de produção:** `C:/Users/Administrador/ifp-connect/src/lib/medico/prontuario.ts` (EDITA — adiciona a parte transacional ao arquivo de T2).
**Imports:** `import { db } from "@/lib/db"` (igual agenda.ts; NÃO de @prisma/client), `import { transicionarConsulta } from "@/lib/medico/agenda"` (assinarNota amarra a transição §3), `import type { StatusNota } from "@prisma/client"`.

**Funções (assinaturas — espelham agenda.ts padrão transaction-pattern):**

```ts
export interface SalvarRascunhoInput {
  consultaId: string;
  cidadaoId: string;
  profissionalId: string;        // id do MODEL Profissional (autor)
  texto?: string | null;
  vitais?: SinaisVitaisInput;
  diagnosticos?: { codigoCid?: string | null; descricao: string; principal?: boolean }[];
}

/** Upsert da nota enquanto em_atendimento (§0.3). Rejeita se já assinada -> NotaAssinadaError. */
export async function salvarRascunho(input: SalvarRascunhoInput): Promise<...>; // db.$transaction, retorna NotaEvolucao

/** Transação (§5 fluxo A passo 5): valida status==rascunho, seta assinada+assinadaEm+assinadaPor,
 *  depois transicionarConsulta(consultaId-> 'realizada'). Atômico. */
export async function assinarNota(notaId: string, userId: string): Promise<...>; // retorna NotaEvolucao assinada

/** Só em nota assinada (§0.4 append-only). Cria AddendoNota; nunca toca o original. */
export async function adicionarAddendo(notaId: string, autorId: string, texto: string): Promise<...>; // retorna AddendoNota

export class NotaAssinadaError extends Error {
  constructor(public readonly notaId: string); // "Nota {notaId} já está assinada; use addendo"
}
export class NotaNaoAssinadaError extends Error {  // addendo só em nota assinada
  constructor(public readonly notaId: string);
}
```

**Padrão transacional (do contrato `transaction-pattern`):**

- `salvarRascunho`: `db.$transaction(async (tx) => { ... })`. Compare-and-swap: ler nota por `consultaId @unique`; se existe e `status==='assinada'` → `throw new NotaAssinadaError`. Senão `tx.notaEvolucao.upsert(...)`; recriar diagnósticos (deleteMany por notaId + createMany) dentro da tx.
- `assinarNota`: `db.$transaction(async (tx) => { ... })`: `tx.notaEvolucao.findUniqueOrThrow`; validar `podeTransicionarNota(nota.status,'assinada')` → senão `TransicaoNotaInvalidaError`; `tx.notaEvolucao.update` (status='assinada', assinadaEm=now, assinadaPor=userId); depois transicionar consulta — **reusar a lógica de `transicionarConsulta`** mas DENTRO da mesma tx (atenção: `transicionarConsulta` abre seu próprio `$transaction`; ver pegadinha abaixo).
- `adicionarAddendo`: `tx.notaEvolucao.findUniqueOrThrow`; se `status!=='assinada'` → `NotaNaoAssinadaError`; `tx.addendoNota.create`.

**Pegadinha crítica (transação aninhada):** `transicionarConsulta` em agenda.ts já abre `db.$transaction`. Postgres/Prisma NÃO suporta `$transaction` aninhado de forma transparente. **Decisão de implementação:** em `assinarNota` NÃO chamar `transicionarConsulta` (que abre tx própria); em vez disso, dentro da tx do `assinarNota`, replicar o efeito de transição usando `tx` (update consulta status='realizada' + derivar slot 'realizado' via lógica equivalente a `STATUS_SLOT_DERIVADO`). Como `STATUS_SLOT_DERIVADO` e `TRANSICOES` NÃO são exportados (contrato agenda-state-machine pegadinha 1), e a transição `em_atendimento→realizada` é válida e fixa, hardcodar o efeito é aceitável aqui — OU refatorar agenda.ts para extrair um helper `aplicarTransicaoTx(tx, consultaId, para)` reutilizável (preferível; **se refatorar agenda.ts, adicionar à allowlist e cobrir com os testes existentes de medico-agenda**). Recomendação: hardcodar dentro de assinarNota (mais simples, menos blast radius) e documentar; validar a transição com `transicionarConsulta` no teste de integração DB-real.

**Testes VERMELHOS — LÓGICA (loop)** `C:/Users/Administrador/ifp-connect/tests/unit/medico-prontuario-mock.test.ts` (padrão `audit.test.ts`: `vi.hoisted` + `vi.mock("@/lib/db")` com `$transaction` que invoca o callback com um `tx` falso de `vi.fn()`s):

- `salvarRascunho` numa nota inexistente → chama `notaEvolucao.upsert` 1x.
- `salvarRascunho` com nota `status:'assinada'` (mock retorna assinada) → rejeita com `NotaAssinadaError`.
- `salvarRascunho` recria diagnósticos: chama `deleteMany` antes de `createMany`.
- `assinarNota` de nota `rascunho` → chama `update` com `status:'assinada'` e `assinadaPor` = userId passado.
- `assinarNota` de nota já `assinada` → rejeita com `TransicaoNotaInvalidaError`.
- `assinarNota` deriva consulta `realizada` (update consulta status='realizada' chamado na mesma tx).
- `adicionarAddendo` em nota `assinada` → chama `addendoNota.create` com `texto`/`autorId`.
- `adicionarAddendo` em nota `rascunho` → rejeita com `NotaNaoAssinadaError`.
- `adicionarAddendo` NUNCA chama `notaEvolucao.update` (original imutável).

**Testes VERMELHOS — INTEGRAÇÃO DB-real (manual, FORA do loop)** `C:/Users/Administrador/ifp-connect/tests/unit/medico-prontuario-integration.test.ts` (padrão `medico-agenda.test.ts`: `import { db }` real, fixtures seedadas Dr. João Silva / Clínico Geral / erick.ramos, cleanup manual):

- Cria consulta `em_atendimento`, `salvarRascunho` persiste nota `rascunho` no Postgres.
- `assinarNota` real → nota `assinada` + consulta `realizada` + slot derivado `realizado` (verifica integração com state machine de agenda).
- `salvarRascunho` numa nota assinada rejeita (DB real).
- `adicionarAddendo` cria AddendoNota e a nota original permanece byte-idêntica (append-only verificado no banco).
  **Critério de pronto:** mock-test 100% verde no loop; integration-test verde manualmente com DB up; `prontuario.ts` exporta as 3 funções transacionais + 2 erros.

---

### T6 — Seed CID-10 + notas demo `[manual]`

**Via:** manual — escreve ~14k linhas no Postgres + cria fixtures demo; precisa DB e CSV DATASUS.
**Arquivos:** `C:/Users/Administrador/ifp-connect/prisma/seed.ts` (EDITA — adicionar bloco Cid10 + 2 NotaEvolucao demo assinadas pro cidadão demo); CSV em `C:/Users/Administrador/ifp-connect/prisma/data/cid10.csv` (`[SUPOSIÇÃO]` baixar do DATASUS; colunas `codigo,descricao,capitulo`).
**Critério de pronto:** `pnpm prisma db seed` popula `Cid10` (>10k linhas) e 2 notas demo `assinada`; busca `db.cid10.findMany({ where: { descricao: { contains: ... } } })` retorna resultados; demo aparece na timeline do cidadão demo.

---

### T7 — `sinais-vitais-fields.tsx` `[frontend-design]`

**Via:** frontend-design — componente visual (bloco numérico + IMC derivado client-side). Humano no loop.
**Arquivo:** `C:/Users/Administrador/ifp-connect/src/components/medico/prontuario/sinais-vitais-fields.tsx` (NOVO).
**Reusa:** `calcularImc` + `validarSinaisVitais` (helpers PUROS de T2 — IMC client-side, warnings inline não-bloqueantes). 8 campos numéricos opcionais (§0.5).
**Critério de pronto:** revisão visual aprovada pelo Erick (preview de manhã, padrão `feedback_design_frontend_skill`).

### T8 — `cid-autocomplete.tsx` `[frontend-design]`

**Via:** frontend-design — UI de busca/autocomplete.
**Arquivo:** `C:/Users/Administrador/ifp-connect/src/components/medico/prontuario/cid-autocomplete.tsx` (NOVO).
**Comportamento:** busca em `Cid10` (server action de leitura), múltiplos por nota, `principal: boolean`, fallback texto livre (§0.6).
**Critério de pronto:** revisão visual aprovada.

### T9 — `registrarAcessoProntuario` + caller `medical_data_accessed` `[manual]`

**Via:** manual — wiring de auditoria no load da página (Server Component) + decisão de produto §0.8; toca o ponto sensível LGPD.
**Arquivos:** `src/lib/medico/prontuario.ts` (EDITA — wrapper) + `src/app/medico/consultas/[id]/page.tsx` (chamar no load).

```ts
export async function registrarAcessoProntuario(
  userId: string,
  cidadaoId: string,
  consultaId: string,
): Promise<void>;
// chama logEvent({ userId, action: "medical_data_accessed", entityType:"prontuario", entityId: consultaId,
//   rootEntityType:"cidadao", rootEntityId: cidadaoId, meta:{ consultaId } })
```

**Nota:** `medical_data_accessed` já é membro do union (não precisa T4 pra ele). `rootEntityType:"cidadao"` p/ aparecer na timeline (contrato `rootEntityType` + cidadao-history.ts:259). Atenção §0.3: `ficha_read` NÃO é logado por custo; aqui é decisão explícita de logar abertura de prontuário.
**Critério de pronto:** abrir `/medico/consultas/[id]` grava 1 `medical_data_accessed` no auditLog (verificável no e2e T15).

### T10 — `evolucao-coluna.tsx` (centro) `[frontend-design]`

**Via:** frontend-design — coração visual "Elation" (densidade do prontuário).
**Arquivo:** `src/components/medico/prontuario/evolucao-coluna.tsx` (NOVO).
**Comportamento:** em `em_atendimento` = form editável (textarea + `sinais-vitais-fields` + `cid-autocomplete` + botão "Assinar e concluir"); em `realizada` = read-only assinada + lista de addendos + "Adicionar addendo" (§3/§5).
**Critério de pronto:** revisão visual aprovada.

### T11 — `contexto-coluna.tsx` + `timeline-atendimentos.tsx` (esquerda) `[frontend-design]`

**Via:** frontend-design — UI da coluna esquerda + timeline.
**Arquivos:** `src/components/medico/prontuario/contexto-coluna.tsx` + `.../timeline-atendimentos.tsx` (NOVOS).
**Comportamento:** Card saúde (4 campos editáveis inline se profissional §0.7) + timeline longitudinal `db.notaEvolucao.findMany({ where:{ cidadaoId }, orderBy:{ createdAt:'desc' } })` (usa índice `@@index([cidadaoId, createdAt])`), cross-profissional.
**Critério de pronto:** revisão visual aprovada.

### T12 — `acoes-coluna.tsx` (direita, placeholders inertes) `[frontend-design]`

**Via:** frontend-design — UI estática.
**Arquivo:** `src/components/medico/prontuario/acoes-coluna.tsx` (NOVO).
**Comportamento:** Cards desabilitados "Prescrição / Encaminhamento / Atestado — chega no F1.B.3" (§0.9).
**Critério de pronto:** revisão visual aprovada.

### T13 — Reescrever `page.tsx` p/ grid 3-col `[frontend-design]`

**Via:** frontend-design — reescrita de layout (substitui placeholder linhas 143-158 e troca o grid mestre).
**Arquivo:** `C:/Users/Administrador/ifp-connect/src/app/medico/consultas/[id]/page.tsx` (EDITA).
**Comportamento:** trocar grid mestre `lg:grid-cols-[1.5fr_1fr]` (linha 60) por `lg:grid-cols-[1fr_1.6fr_1fr]` montando `contexto-coluna` · `evolucao-coluna` · `acoes-coluna`; remover Card placeholder "Em breve" (contrato `placeholder-prontuario`). Atenção layout: 3 sub-colunas em 1.5fr ficava apertado — o prontuário sai do grid de 2-col e ganha largura full (contrato `grid-atual-pagina`). Mobile empilha; tablet recepção esconde coluna clínica (RBAC). Chamar `registrarAcessoProntuario` no load (T9).
**Critério de pronto:** revisão visual aprovada; mobile/tablet OK.

### T14 — `prontuario-actions.ts` (wiring server actions) `[manual]`

**Via:** manual — wiring que amarra UI↔lib↔audit; precisa DB pra validar e segue padrão de erro por throw/redirect.
**Arquivo:** `C:/Users/Administrador/ifp-connect/src/app/medico/consultas/[id]/prontuario-actions.ts` (NOVO).
**Padrão (contrato `use-server-pattern` / `action-exemplo`):** abre `"use server";`; cada `export async function xAction(formData: FormData): Promise<void>`; sequência canônica = `auth()` → extrai FormData (`String(formData.get(...))`) → guarda (`db.<model>.findUniqueOrThrow({ include:{ profissional:true } })` + `pode*` de rbac comparando `profissional.userId`) → lib de efeito (`salvarRascunho`/`assinarNota`/`adicionarAddendo`) → `logEvent({ userId: session.user.id, action: "prontuario_..." as never, meta:{...} })` → `revalidatePath(\`/medico/consultas/${id}\`)`. Erro = throw/redirect (NUNCA `{ok,error}`); `NotaAssinadaError`/`NotaNaoAssinadaError`capturados com`instanceof`p/ redirect amigável quando aplicável.
**Actions:**`salvarRascunhoAction`(audit`prontuario_criado`), `assinarNotaAction`(audit`prontuario_assinado`), `adicionarAddendoAction`(audit`prontuario_addendo`), `atualizarSaudeCidadaoAction`(audit`cidadao_saude_atualizada`, `rootEntityType:"cidadao"`).
**Critério de pronto:** fluxos A/B/D do §5 funcionam ponta-a-ponta no app (verificado no e2e T15).

### T15 — E2e Playwright `[manual]`

**Via:** manual — e2e nunca entra no loop; precisa app+DB de pé.
**Arquivo:** `C:/Users/Administrador/ifp-connect/tests/e2e/medico-prontuario.spec.ts` (NOVO; fora do vitest, padrão `tests/e2e/medico-agenda.spec.ts`).
**Cenários (§7.15):** escrever+assinar evolução → nota imutável; addendo append-only (original intacto); histórico longitudinal cross-profissional aparece; recepção NÃO vê conteúdo clínico; `medical_data_accessed` logado na abertura.
**Critério de pronto:** 5 cenários verdes.

### T16 — Verify final `[manual]`

**Via:** manual — gate de CI.
**Comando (WSL):** `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm build"`
**Critério de pronto:** typecheck + lint + vitest + build prod todos verdes; e2e verdes.

---

## Config ralph-loop

> Roda APENAS o núcleo lógico: **T2, T3, T5 (lógica/mock)**. T1 (migration+generate) e T4 (AuditAction) feitos MANUALMENTE ANTES de iniciar o loop, senão os imports de `StatusNota`/tipos não compilam.

**`<promise>` textual exata:** `PRONTUARIO-CORE-GREEN`
**Critério que a torna verdadeira:** os 3 arquivos de teste do loop passam (exit 0) numa única rodada vitest, sem nenhum teste pendente/skip:

- `tests/unit/medico-prontuario-puro.test.ts` (T2)
- `tests/unit/medico-rbac.test.ts` (T3 — casos novos + existentes)
- `tests/unit/medico-prontuario-mock.test.ts` (T5 lógica via mock)

**`--max-iterations` sugerido:** `12` (3 funções puras + 4 RBAC + 9 casos de mock; espaço pra ajustar ranges de warning e shape do tx falso).

**COMANDO DE VERIFY (Windows+WSL):**

```
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm exec vitest run tests/unit/medico-prontuario-puro.test.ts tests/unit/medico-rbac.test.ts tests/unit/medico-prontuario-mock.test.ts >/tmp/v.log 2>&1; echo \$? >/tmp/v.exit"
```

Depois **LER o exit code via tool Read** no caminho UNC `\\wsl$\Ubuntu\tmp\v.exit` (NUNCA confiar em silêncio=verde — só `0` lido nesse arquivo conta como verde; qualquer outro valor ou ausência = vermelho). Ler `\\wsl$\Ubuntu\tmp\v.log` p/ diagnosticar.
**NÃO incluir** `medico-prontuario-integration.test.ts` no comando do loop (DB-real; roda no T16 manual). Matar processo travado com bracket-trick: `wsl -d Ubuntu -- bash -lc "pkill -f '[v]itest'"`.

**ALLOWLIST (arquivos que o loop pode editar — só lógica + seus testes):**

```
src/lib/medico/prontuario.ts            # T2 puro + T5 transacional (lógica)
src/lib/medico/rbac.ts                  # T3 (só ADICIONAR as 4 funções; não mexer nas de F1.B.1)
tests/unit/medico-prontuario-puro.test.ts
tests/unit/medico-prontuario-mock.test.ts
tests/unit/medico-rbac.test.ts          # só ADICIONAR describes do prontuário
```

**FORA da allowlist (o loop NÃO pode tocar):** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/audit.ts`, `src/lib/medico/agenda.ts` (se T5 refatorar p/ extrair `aplicarTransicaoTx`, isso é decisão manual ANTES do loop — não delegar ao loop), qualquer `.tsx`, qualquer `tests/e2e/**`, `tests/unit/medico-prontuario-integration.test.ts`.

**LEMBRETE TDD (pré-requisito obrigatório):** ANTES de iniciar o loop, escrever os 3 arquivos de teste e rodar o comando de verify À MÃO, confirmando **VERMELHO** (exit ≠ 0 em `\\wsl$\Ubuntu\tmp\v.exit`, porque `prontuario.ts` ainda não exporta as funções e `rbac.ts` ainda não tem os 4 `pode*`). Só começar o loop depois de ver o vermelho — teste que nasce verde não prova nada.

---

## Critérios de sucesso (do §10 da spec, mapeados a tasks)

- [ ] Profissional escreve evolução em `em_atendimento` e assina → nota imutável. (T5, T10, T14, T15)
- [ ] Após assinar, só addendo append-only; original nunca muda. (T5, T15)
- [ ] Coluna esquerda mostra histórico longitudinal cross-profissional. (T11, índice T1)
- [ ] Sinais vitais numéricos + IMC derivado; CID autocomplete com fallback texto. (T2, T7, T8)
- [ ] Profissional atualiza alergia inline → audit `cidadao_saude_atualizada`. (T4, T11, T14)
- [ ] `medical_data_accessed` logado em toda abertura. (T9, T15)
- [ ] Recepção/social NÃO veem conteúdo clínico. (T3, T13, T15)
- [ ] Coluna direita placeholder inerte. (T12)
- [ ] `pnpm typecheck && lint && test` + build prod verdes; e2e verdes. (T16)

---

## O que fica pro frontend-design / F1.B.3

**frontend-design (este módulo):** T7, T8, T10, T11, T12, T13 — todas as 3 colunas, sinais-vitais-fields, cid-autocomplete, timeline, e a reescrita do page.tsx p/ grid 3-col. Densidade visual estilo Elation é o coração da sensação; preview de manhã pro Erick escolher direção (padrão `feedback_design_frontend_skill`).

**F1.B.3 (fora deste módulo):** prescrição (PDF), encaminhamento, atestado (a coluna direita inerte vira funcional). **Plano 8:** integração Memed. **Futuros:** assinatura digital qualificada ICP-Brasil/A3; problem list longitudinal (§0.6 C); curva de crescimento pediátrica OMS (§0.5); estruturar alergias/medicamentos em tabela própria; versionamento com diff; nota avulsa sem consulta; templates de evolução por especialidade; LGPD operacional completo/ROPA (F3.A).

---

**Arquivos-chave (paths absolutos):**

- Spec: `C:/Users/Administrador/ifp-connect/docs/superpowers/specs/2026-05-31-f1b2-prontuario-design.md`
- Schema: `C:/Users/Administrador/ifp-connect/prisma/schema.prisma`
- Lib nova: `C:/Users/Administrador/ifp-connect/src/lib/medico/prontuario.ts`
- RBAC: `C:/Users/Administrador/ifp-connect/src/lib/medico/rbac.ts`
- Audit: `C:/Users/Administrador/ifp-connect/src/lib/audit.ts`
- Agenda (referência/possível refactor T5): `C:/Users/Administrador/ifp-connect/src/lib/medico/agenda.ts`
- Page: `C:/Users/Administrador/ifp-connect/src/app/medico/consultas/[id]/page.tsx`
- Actions nova: `C:/Users/Administrador/ifp-connect/src/app/medico/consultas/[id]/prontuario-actions.ts`
- Componentes: `C:/Users/Administrador/ifp-connect/src/components/medico/prontuario/*.tsx`
- Testes loop: `C:/Users/Administrador/ifp-connect/tests/unit/medico-prontuario-puro.test.ts`, `.../medico-prontuario-mock.test.ts`, `.../medico-rbac.test.ts`
- Teste integração (manual): `C:/Users/Administrador/ifp-connect/tests/unit/medico-prontuario-integration.test.ts`
- E2e: `C:/Users/Administrador/ifp-connect/tests/e2e/medico-prontuario.spec.ts`
