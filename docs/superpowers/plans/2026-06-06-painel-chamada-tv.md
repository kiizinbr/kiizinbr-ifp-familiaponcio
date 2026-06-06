# Painel de Chamada na TV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel de TV por unidade que toca vídeo do YouTube no ocioso + rodapé de anúncios, e quando a equipe chama um paciente muta o vídeo, mostra o nome em destaque e fala por voz (TTS), atualizando via polling.

**Architecture:** Feature "Painel" isolada. Lógica pura/IO em `src/lib/painel/*` (testável, coberta por coverage). 3 models Prisma novos (`Chamada`/`PainelConfig`/`PainelAnuncio`). A equipe dispara `chamarAction` (server action) das telas que já têm fila; a TV (`/painel/[unidade]`, login de quiosque) faz polling em `GET /api/painel/[unidade]/chamadas` a cada ~2s e anuncia mudanças. Sem realtime/Redis — polling puro. Spec: `docs/superpowers/specs/2026-06-06-painel-chamada-tv-design.md`.

**Tech Stack:** Next.js 16 App Router (typedRoutes — `as Route`), React 19 (server actions + client `useEffect` polling), TS 6 strict, Prisma 6 + Postgres (dev 5433), next-auth v5 JWT, Tailwind 4 + Design Kit (`ifp-tokens.css`), Vitest 4 (node env — só `src/lib/**` testável), YouTube IFrame Player API + Web Speech API (ambos client/browser, sem pacote npm).

**Convenções (CLAUDE.md):** pnpm roda no WSL Ubuntu (`wsl -d Ubuntu -- bash /mnt/c/Users/Administrador/ifp-connect/_verify.sh`). Ritual pré-commit: `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm build` antes de push). Commit SEM aspas duplas e SEM acentos (PowerShell→git). Push pelo git nativo do Windows. `clsx` p/ className condicional. Verify via arquivo `.sh` rodado pelo PowerShell tool, nunca `bash -lc` inline.

---

## File Structure

| Arquivo                                                                                                 | Responsabilidade                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `prisma/schema.prisma`                                                                                  | + models `Chamada`/`PainelConfig`/`PainelAnuncio`              |
| `src/lib/audit.ts`                                                                                      | + ação `paciente_chamado`                                      |
| `src/lib/rbac-types.ts`                                                                                 | + `RoleName` "painel" (4 pontos derivados)                     |
| `src/lib/unidades.ts`                                                                                   | + `painel` em `rolesAceitas` de medico/capacitacao             |
| `src/lib/rbac.ts`                                                                                       | + `podeChamar`, `podeGerirPainel`                              |
| `src/lib/painel/core.ts`                                                                                | helpers puros: `nomeChamado`, `anuncioVigente`, `fraseChamada` |
| `src/lib/painel/chamada.ts`                                                                             | IO: `criarChamada`, `listarChamadas`                           |
| `src/app/painel/chamar-actions.ts`                                                                      | `chamarAction` (server action, gate + criarChamada + audit)    |
| `src/app/api/painel/[unidade]/chamadas/route.ts`                                                        | GET polling (auth propria, force-dynamic)                      |
| `src/app/painel/[unidade]/page.tsx`                                                                     | server: gate + carrega config/anuncios + render                |
| `src/app/painel/[unidade]/painel-tv.tsx`                                                                | client: YT player, polling, overlay, TTS, ticker, gesto        |
| `src/app/painel/[unidade]/config/page.tsx` + `painel-config-actions.ts`                                 | config de video/anuncios (gestor)                              |
| `src/proxy.ts`                                                                                          | + matcher `/painel/:path*` + gate de unidade                   |
| `src/styles/ifp-components.css`                                                                         | + `@keyframes ifp-marquee` + classes do painel                 |
| `scripts/criar-usuario-painel.ts` + `package.json`                                                      | usuario de quiosque por unidade                                |
| `tests/unit/painel-rbac.test.ts`, `tests/unit/painel-core.test.ts`, `tests/unit/painel-chamada.test.ts` | testes                                                         |

**Decisão de modelagem (locked):** model `Chamada` (event log), NÃO um campo `chamadoEm` na `Consulta`. Razão: suporta re-chamada (nova linha), lista de últimos chamados, e chamada da triagem (que não tem `consultaId`). `cidadaoId`/`consultaId` são opcionais na `Chamada`.

---

## Task 1: Models Prisma + ação de audit + migration

**Files:**

- Modify: `prisma/schema.prisma` (após o model `AnexoCidadao`)
- Modify: `src/lib/audit.ts:50` (bloco Centro Medico)

- [ ] **Step 1: Adicionar os 3 models ao schema**

No fim de `prisma/schema.prisma`, adicione:

```prisma
/// Painel de chamada na TV — evento de chamada (event log, suporta re-chamada).
model Chamada {
  id          String   @id @default(cuid())
  unidade     String // slug (medico/capacitacao/...)
  nomeChamado String // snapshot de nomeSocial || nomeCompleto no momento da chamada
  destino     String // "Dr. Fulano" | "Triagem" | "Recepcao"
  chamadoPor  String // userId
  cidadaoId   String? // link opcional p/ auditoria
  consultaId  String? // link opcional
  criadoEm    DateTime @default(now())

  @@index([unidade, criadoEm])
}

/// Config do painel por unidade (link do video do mes).
model PainelConfig {
  id        String   @id @default(cuid())
  unidade   String   @unique
  videoUrl  String?
  updatedAt DateTime @updatedAt
}

/// Anuncio do rodape rolante (por unidade).
model PainelAnuncio {
  id       String    @id @default(cuid())
  unidade  String
  texto    String
  ativoAte DateTime? // null = sem prazo; senao some sozinho depois da data
  criadoEm DateTime  @default(now())

  @@index([unidade])
}
```

- [ ] **Step 2: Adicionar a ação de audit**

Em `src/lib/audit.ts`, na linha após `| "consulta_checkin"` (bloco "Centro Medico (F1.B.1)"), adicione:

```ts
  | "consulta_checkin"
  | "paciente_chamado"
```

- [ ] **Step 3: Criar e aplicar a migration**

Rode no WSL:

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:migrate --name add_painel"`
Expected: `Applying migration ...add_painel` + `migration.sql` criado em `prisma/migrations/`. SQL gerado deve criar 3 tabelas (`Chamada`, `PainelConfig`, `PainelAnuncio`) — aditivo, zero downtime.

> Nota: se o marshalling mascarar o exit code, rode via arquivo `.sh` (ver Task 11). Aqui o output é visível, então inline serve.

- [ ] **Step 4: Verificar typecheck (Prisma Client regenerado)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck"`
Expected: PASS (o `prisma migrate dev` roda `generate`, então `db.chamada`/`db.painelConfig`/`db.painelAnuncio` já existem no client).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add prisma/ src/lib/audit.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): models Chamada/PainelConfig/PainelAnuncio + acao de audit"
```

---

## Task 2: Papel "painel" no RBAC (4 pontos derivados) + rolesAceitas

**Files:**

- Modify: `src/lib/rbac-types.ts` (4 edições)
- Modify: `src/lib/unidades.ts` (medico + capacitacao)

`RoleName` é uma union derivada de `as const` — o `Record<RoleName, ...>` e o `switch` exaustivo quebram o build se você esquecer o papel novo. Por isso são 4 pontos.

- [ ] **Step 1: Adicionar "painel" a `ROLE_NAMES`**

Em `src/lib/rbac-types.ts`, no array `ROLE_NAMES` (após `"recepcao"`):

```ts
export const ROLE_NAMES = [
  "super_admin",
  "presidencia",
  "gestor_unidade",
  "social",
  "profissional",
  "recepcao",
  "painel",
] as const;
```

- [ ] **Step 2: Adicionar a `UNIT_ROLES` (NÃO a `GLOBAL_ROLES`)**

Em `src/lib/rbac-types.ts`, `UNIT_ROLES`:

```ts
export const UNIT_ROLES: readonly RoleName[] = [
  "gestor_unidade",
  "profissional",
  "recepcao",
  "painel",
] as const;
```

Isso faz `seedRoles()` gravar `scope: "unit"` automaticamente.

- [ ] **Step 3: Adicionar a key em `ROLE_DESCRIPTIONS`**

Em `src/lib/rbac-types.ts`, no `Record<RoleName, string>` `ROLE_DESCRIPTIONS`, adicione a entrada:

```ts
  painel: "Quiosque de painel de chamada (TV) — somente exibicao, sem acesso a dados",
```

- [ ] **Step 4: Adicionar o `case "painel"` em `getLandingPathFor`**

Em `src/lib/rbac-types.ts`, dentro do `switch (name)` de `getLandingPathFor`, adicione antes do `default`:

```ts
    case "painel":
      return primaryUnitScope ? `/painel/${primaryUnitScope}` : "/login";
```

(Use o mesmo nome de variável de unitScope que o switch já usa — confira a assinatura real da função ao editar; o parametro é o unitScope do primaryRole.)

- [ ] **Step 5: Adicionar `painel` a `rolesAceitas` de medico e capacitacao**

Em `src/lib/unidades.ts`, no objeto `UNIDADES`, dentro de `medico.rolesAceitas` adicione `{ name: "painel", unitScope: "medico" }`, e dentro de `capacitacao.rolesAceitas` adicione `{ name: "painel", unitScope: "capacitacao" }`. Exemplo para medico:

```ts
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "medico" },
      { name: "profissional", unitScope: "medico" },
      { name: "recepcao", unitScope: "medico" },
      { name: "painel", unitScope: "medico" },
    ],
```

- [ ] **Step 6: Verificar build (guard de exaustividade)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck"`
Expected: PASS. Se faltar algum dos 4 pontos, o `Record`/`switch` falham aqui — é o sinal de que está completo.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add src/lib/rbac-types.ts src/lib/unidades.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): papel minimo painel por unidade (quiosque)"
```

---

## Task 3: Predicados de RBAC `podeChamar` / `podeGerirPainel` (TDD)

**Files:**

- Test: `tests/unit/painel-rbac.test.ts` (criar)
- Modify: `src/lib/rbac.ts` (adicionar 2 funções no fim, junto aos outros predicados)

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/unit/painel-rbac.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import { podeChamar, podeGerirPainel } from "@/lib/rbac";

function sessionWith(
  roles: { name: RoleName; unitScope: UnitScope | null }[],
  userId = "u1",
): Session {
  return {
    user: { id: userId, email: "x@y.z", name: null, roles, primaryRole: roles[0] ?? null },
    expires: "2099-01-01",
  } as Session;
}

describe("podeChamar", () => {
  it("recepcao pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(true);
  });
  it("profissional pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "profissional", unitScope: "medico" }]))).toBe(true);
  });
  it("social (triagem) pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "social", unitScope: null }]))).toBe(true);
  });
  it("painel (quiosque) NAO pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "painel", unitScope: "medico" }]))).toBe(false);
  });
  it("sem sessao NAO pode chamar", () => {
    expect(podeChamar(null)).toBe(false);
  });
});

describe("podeGerirPainel", () => {
  it("gestor_unidade pode gerir", () => {
    expect(podeGerirPainel(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
      true,
    );
  });
  it("recepcao NAO pode gerir", () => {
    expect(podeGerirPainel(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
  it("sem sessao NAO pode gerir", () => {
    expect(podeGerirPainel(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-rbac"`
Expected: FAIL — `podeChamar`/`podeGerirPainel` não existem em `@/lib/rbac`.

- [ ] **Step 3: Implementar os predicados**

Em `src/lib/rbac.ts`, no fim do arquivo (após os predicados existentes), adicione:

```ts
/**
 * Quem pode CHAMAR um paciente no painel (opera a fila da superficie).
 * Inclui social (triagem). NAO inclui "painel" (quiosque so exibe). A unidade
 * e garantida pelo gate de rota da superficie (canAccessUnidade), como no resto do medico.
 */
export function podeChamar(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional", "recepcao", "social");
}

/** Quem pode configurar o painel (video do mes + anuncios). Gestao only. */
export function podeGerirPainel(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-rbac"`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add tests/unit/painel-rbac.test.ts src/lib/rbac.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): podeChamar e podeGerirPainel + testes"
```

---

## Task 4: Helpers puros `src/lib/painel/core.ts` (TDD)

**Files:**

- Test: `tests/unit/painel-core.test.ts` (criar)
- Create: `src/lib/painel/core.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/unit/painel-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anuncioVigente, fraseChamada, nomeChamado } from "@/lib/painel/core";

describe("nomeChamado", () => {
  it("usa nomeSocial quando preenchido", () => {
    expect(nomeChamado({ nomeSocial: "Maria", nomeCompleto: "Maria da Silva" })).toBe("Maria");
  });
  it("cai no nomeCompleto quando nomeSocial e null", () => {
    expect(nomeChamado({ nomeSocial: null, nomeCompleto: "Maria da Silva" })).toBe(
      "Maria da Silva",
    );
  });
  it("cai no nomeCompleto quando nomeSocial e so espacos", () => {
    expect(nomeChamado({ nomeSocial: "  ", nomeCompleto: "Maria da Silva" })).toBe(
      "Maria da Silva",
    );
  });
});

describe("anuncioVigente", () => {
  const agora = new Date("2026-06-06T12:00:00Z");
  it("sem prazo (ativoAte null) -> vigente", () => {
    expect(anuncioVigente({ ativoAte: null }, agora)).toBe(true);
  });
  it("prazo no futuro -> vigente", () => {
    expect(anuncioVigente({ ativoAte: new Date("2026-06-07T00:00:00Z") }, agora)).toBe(true);
  });
  it("prazo no passado -> nao vigente", () => {
    expect(anuncioVigente({ ativoAte: new Date("2026-06-05T00:00:00Z") }, agora)).toBe(false);
  });
});

describe("fraseChamada", () => {
  it("monta nome + destino", () => {
    expect(fraseChamada("Maria", "Triagem")).toBe("Maria, Triagem");
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-core"`
Expected: FAIL — módulo `@/lib/painel/core` não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/painel/core.ts`:

```ts
/** Nome a anunciar: nomeSocial quando preenchido (dignidade), senao nomeCompleto. */
export function nomeChamado(cidadao: { nomeSocial: string | null; nomeCompleto: string }): string {
  const social = cidadao.nomeSocial?.trim();
  return social ? social : cidadao.nomeCompleto;
}

/** Anuncio do rodape esta vigente? Sem prazo (null) = sempre; senao ativoAte no futuro. */
export function anuncioVigente(anuncio: { ativoAte: Date | null }, agora: Date): boolean {
  return anuncio.ativoAte === null || anuncio.ativoAte.getTime() > agora.getTime();
}

/** Frase falada pelo TTS: "{nome}, {destino}". */
export function fraseChamada(nome: string, destino: string): string {
  return `${nome}, ${destino}`;
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-core"`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add tests/unit/painel-core.test.ts src/lib/painel/core.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): helpers puros core + testes"
```

---

## Task 5: IO de chamada `src/lib/painel/chamada.ts` (TDD DB-real)

**Files:**

- Test: `tests/unit/painel-chamada.test.ts` (criar)
- Create: `src/lib/painel/chamada.ts`

`criarChamada` grava a `Chamada`; `listarChamadas` é a query do polling (mais recente = `atual`, próximas = `recentes`).

- [ ] **Step 1: Escrever o teste de integracao (deve falhar)**

Crie `tests/unit/painel-chamada.test.ts` (estilo DB-real: cria a própria fixture e limpa no fim — `Chamada` é model novo, sem seed):

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { criarChamada, listarChamadas } from "@/lib/painel/chamada";

describe("criarChamada + listarChamadas (integration)", () => {
  it("cria uma chamada e a retorna como atual", async () => {
    const c = await criarChamada({
      unidade: "medico",
      nomeChamado: "Teste Painel",
      destino: "Triagem",
      chamadoPor: "test-user",
    });
    try {
      const { atual, recentes } = await listarChamadas("medico", 4);
      expect(atual?.id).toBe(c.id);
      expect(atual?.nomeChamado).toBe("Teste Painel");
      expect(atual?.destino).toBe("Triagem");
      expect(Array.isArray(recentes)).toBe(true);
    } finally {
      await db.chamada.delete({ where: { id: c.id } });
    }
  });

  it("re-chamar gera nova linha e vira a atual", async () => {
    const c1 = await criarChamada({
      unidade: "medico",
      nomeChamado: "Re Chamado",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    const c2 = await criarChamada({
      unidade: "medico",
      nomeChamado: "Re Chamado",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    try {
      const { atual } = await listarChamadas("medico", 4);
      expect(atual?.id).toBe(c2.id);
      expect(c2.id).not.toBe(c1.id);
    } finally {
      await db.chamada.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
    }
  });

  it("isola por unidade", async () => {
    const c = await criarChamada({
      unidade: "capacitacao",
      nomeChamado: "So Capacitacao",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    try {
      const { atual } = await listarChamadas("medico", 4);
      expect(atual?.nomeChamado).not.toBe("So Capacitacao");
    } finally {
      await db.chamada.delete({ where: { id: c.id } });
    }
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-chamada"`
Expected: FAIL — módulo `@/lib/painel/chamada` não existe. (Precisa do Postgres dev no ar: `pnpm dev:up`.)

- [ ] **Step 3: Implementar**

Crie `src/lib/painel/chamada.ts`:

```ts
import { db } from "@/lib/db";

export interface CriarChamadaInput {
  unidade: string;
  nomeChamado: string;
  destino: string;
  chamadoPor: string;
  cidadaoId?: string | null;
  consultaId?: string | null;
}

export interface ChamadaResumo {
  id: string;
  nomeChamado: string;
  destino: string;
  criadoEm: Date;
}

/** Grava o evento de chamada (event log; re-chamar = nova linha). */
export async function criarChamada(input: CriarChamadaInput): Promise<ChamadaResumo> {
  return db.chamada.create({
    data: {
      unidade: input.unidade,
      nomeChamado: input.nomeChamado,
      destino: input.destino,
      chamadoPor: input.chamadoPor,
      cidadaoId: input.cidadaoId ?? null,
      consultaId: input.consultaId ?? null,
    },
    select: { id: true, nomeChamado: true, destino: true, criadoEm: true },
  });
}

/**
 * Query do polling: a mais recente = `atual`, as proximas = `recentes` (lista de
 * "ultimos chamados", sem repetir a atual). `limite` = total buscado (atual + recentes).
 */
export async function listarChamadas(
  unidade: string,
  limite = 5,
): Promise<{ atual: ChamadaResumo | null; recentes: ChamadaResumo[] }> {
  const linhas = await db.chamada.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { id: true, nomeChamado: true, destino: true, criadoEm: true },
  });
  const [atual, ...recentes] = linhas;
  return { atual: atual ?? null, recentes };
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test painel-chamada"`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add tests/unit/painel-chamada.test.ts src/lib/painel/chamada.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): criarChamada e listarChamadas + testes DB-real"
```

---

## Task 6: Server action `chamarAction`

**Files:**

- Create: `src/app/painel/chamar-actions.ts`

Espelha `checkin-action.ts` (gate → muta → audit → revalidate). É o que os botões "Chamar" disparam.

- [ ] **Step 1: Implementar a action**

Crie `src/app/painel/chamar-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeChamar } from "@/lib/rbac";
import { logEvent } from "@/lib/audit";
import { criarChamada } from "@/lib/painel/chamada";

/**
 * Chama um paciente no painel da TV. Disparada por <form action> nas telas de fila
 * (minha-fila, recepcao, triagem) com hidden inputs. Re-chamavel (nova linha por clique).
 */
export async function chamarAction(formData: FormData): Promise<void> {
  const session = await auth();
  const unidade = String(formData.get("unidade"));
  if (!session) throw new Error("Sem sessao");
  if (!canAccessUnidade(session, unidade)) throw new Error("Sem permissao");
  if (!podeChamar(session)) throw new Error("Sem permissao");

  const nomeChamado = String(formData.get("nomeChamado")).trim();
  const destino = String(formData.get("destino")).trim();
  if (!nomeChamado || !destino) throw new Error("Dados invalidos");

  const cidadaoId = formData.get("cidadaoId") ? String(formData.get("cidadaoId")) : null;
  const consultaId = formData.get("consultaId") ? String(formData.get("consultaId")) : null;

  const chamada = await criarChamada({
    unidade,
    nomeChamado,
    destino,
    chamadoPor: session.user.id,
    cidadaoId,
    consultaId,
  });

  await logEvent({
    userId: session.user.id,
    action: "paciente_chamado",
    entityType: "chamada",
    entityId: chamada.id,
    rootEntityType: cidadaoId ? "cidadao" : undefined,
    rootEntityId: cidadaoId ?? undefined,
    meta: { unidade, destino },
  });

  // a TV pega via polling; revalida as telas de origem pra refletir feedback
  revalidatePath("/medico/minha-fila");
  revalidatePath("/medico/recepcao");
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck"`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add src/app/painel/chamar-actions.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): server action chamarAction (gate + criarChamada + audit)"
```

---

## Task 7: Endpoint de polling `GET /api/painel/[unidade]/chamadas`

**Files:**

- Create: `src/app/api/painel/[unidade]/chamadas/route.ts`

Auth própria (não passa pelo proxy, como as outras `/api/*`). `force-dynamic`. Retorna 401 sem sessão (a TV trata), 403 sem acesso à unidade, 404 se slug inválido.

- [ ] **Step 1: Implementar o route handler**

Crie `src/app/api/painel/[unidade]/chamadas/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { listarChamadas } from "@/lib/painel/chamada";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ unidade: string }> }) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) {
    return new NextResponse("Unidade invalida", { status: 404 });
  }
  const session = await auth();
  if (!session) return new NextResponse("Nao autenticado", { status: 401 });
  if (!canAccessUnidade(session, unidade)) {
    return new NextResponse("Sem permissao", { status: 403 });
  }

  const { atual, recentes } = await listarChamadas(unidade, 5);
  return NextResponse.json({ atual, recentes });
}
```

- [ ] **Step 2: Verificar typecheck + build (regenera o validator de typedRoutes)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build"`
Expected: `Compiled successfully` e a rota `ƒ /api/painel/[unidade]/chamadas` listada.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add "src/app/api/painel/[unidade]/chamadas/route.ts"
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): endpoint de polling de chamadas (auth propria)"
```

---

## Task 8: Proxy — gate de `/painel/[unidade]`

**Files:**

- Modify: `src/proxy.ts` (bloco de lógica + `matcher`)

`/painel/[unidade]` tem o slug no 2º segmento, então precisa de bloco próprio (o loop existente trata `/<slug>`). O quiosque (papel painel) passa em `canAccessUnidade`. A subrota `/config` é re-checada na page (gestor).

- [ ] **Step 1: Adicionar o bloco de gate**

Em `src/proxy.ts`, dentro do `export default auth((req) => {...})`, ANTES do loop `for (const slug of UNIDADE_SLUGS)`, adicione:

```ts
// Painel da TV: /painel/[unidade] — exige acesso a unidade (quiosque passa).
const painelMatch = path.match(/^\/painel\/([a-z]+)/);
if (painelMatch) {
  const slug = painelMatch[1]!;
  if (!canAccessUnidade(session, slug)) {
    return Response.redirect(new URL("/", origin));
  }
  return;
}
```

(O `session` e `origin` já estão no escopo do handler; veja o uso existente em `proxy.ts`.)

- [ ] **Step 2: Adicionar `/painel/:path*` ao matcher**

Em `src/proxy.ts`, no array `config.matcher`, adicione a entrada:

```ts
    "/painel/:path*",
```

- [ ] **Step 3: Verificar build**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build"`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add src/proxy.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): gate de /painel/[unidade] no proxy"
```

---

## Task 9: CSS do painel — marquee + estilos

**Files:**

- Modify: `src/styles/ifp-components.css` (fim do arquivo)

O kit não tem marquee. Animação via `transform` (compositor-friendly). Exceção de reduced-motion escopada (o kit mata animações globalmente — espelhe a exceção do leão).

- [ ] **Step 1: Adicionar keyframes + classes**

No fim de `src/styles/ifp-components.css`, adicione:

```css
/* ===== Painel de chamada na TV ===== */
@keyframes ifp-marquee {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(-100%);
  }
}
.painel-marquee {
  white-space: nowrap;
  will-change: transform;
  animation: ifp-marquee 22s linear infinite;
}
/* Excecao de reduced-motion: o rodape precisa rolar pra cumprir a funcao (anuncio). */
@media (prefers-reduced-motion: reduce) {
  .painel-marquee {
    animation: ifp-marquee 22s linear infinite !important;
  }
}
```

- [ ] **Step 2: Verificar format (prettier formata CSS)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm format:check"`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add src/styles/ifp-components.css
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): keyframes do rodape rolante (marquee)"
```

---

## Task 10: Tela da TV — page (server) + PainelTV (client)

**Files:**

- Create: `src/app/painel/[unidade]/page.tsx`
- Create: `src/app/painel/[unidade]/painel-tv.tsx`

Sem AppShell (full-screen). A page carrega config + anúncios e passa pro client. O client faz: gesto inicial, YT IFrame player (mute/unmute), polling 2s, overlay de chamada, TTS, ticker, fallbacks.

- [ ] **Step 1: Implementar a page (server)**

Crie `src/app/painel/[unidade]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { db } from "@/lib/db";
import { anuncioVigente } from "@/lib/painel/core";
import { PainelTV } from "./painel-tv";

export const dynamic = "force-dynamic";

export default async function PainelPage({ params }: { params: Promise<{ unidade: string }> }) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) redirect("/" as Route);

  const session = await auth();
  if (!session) redirect(`/${unidade}/login` as Route);
  if (!canAccessUnidade(session, unidade)) redirect("/" as Route);

  const config = await db.painelConfig.findUnique({ where: { unidade } });
  const anunciosRaw = await db.painelAnuncio.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
  });
  const agora = new Date();
  const anuncios = anunciosRaw.filter((a) => anuncioVigente(a, agora)).map((a) => a.texto);

  return (
    <div className="ifp-kit" data-unit={unidade} data-unit-accent="" style={{ minHeight: "100vh" }}>
      <PainelTV unidade={unidade} videoUrl={config?.videoUrl ?? null} anuncios={anuncios} />
    </div>
  );
}
```

- [ ] **Step 2: Implementar o client PainelTV**

Crie `src/app/painel/[unidade]/painel-tv.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { fraseChamada } from "@/lib/painel/core";

interface ChamadaResumo {
  id: string;
  nomeChamado: string;
  destino: string;
  criadoEm: string;
}

const POLL_MS = 2000;
const OVERLAY_MS = 8000;

// extrai o videoId de varias formas de URL do YouTube
function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1]! : null;
}

function falar(texto: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  // repete uma vez apos uma pausa curta
  const u2 = new SpeechSynthesisUtterance(texto);
  u2.lang = "pt-BR";
  u2.rate = 0.95;
  window.setTimeout(() => window.speechSynthesis.speak(u2), 1800);
}

export function PainelTV({
  unidade,
  videoUrl,
  anuncios,
}: {
  unidade: string;
  videoUrl: string | null;
  anuncios: string[];
}) {
  const [iniciado, setIniciado] = useState(false);
  const [chamada, setChamada] = useState<ChamadaResumo | null>(null);
  const [recentes, setRecentes] = useState<ChamadaResumo[]>([]);
  const [overlay, setOverlay] = useState(false);
  const [erroConexao, setErroConexao] = useState(false);
  const ultimoIdRef = useRef<string | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const videoId = youtubeId(videoUrl);

  // tema escuro estavel pra TV
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // YouTube IFrame Player API (so apos o gesto, com som liberado)
  useEffect(() => {
    if (!iniciado || !videoId) return;
    function criarPlayer() {
      playerRef.current = new window.YT.Player("painel-yt", {
        videoId: videoId!,
        playerVars: {
          autoplay: 1,
          controls: 0,
          loop: 1,
          playlist: videoId!,
          rel: 0,
          modestbranding: 1,
        },
        host: "https://www.youtube-nocookie.com",
      });
    }
    if (window.YT && window.YT.Player) {
      criarPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = criarPlayer;
    }
  }, [iniciado, videoId]);

  // polling das chamadas
  useEffect(() => {
    if (!iniciado) return;
    let timer: number;
    async function tick() {
      try {
        const r = await fetch(`/api/painel/${unidade}/chamadas`, { cache: "no-store" });
        if (!r.ok) {
          setErroConexao(true);
          return;
        }
        setErroConexao(false);
        const data: { atual: ChamadaResumo | null; recentes: ChamadaResumo[] } = await r.json();
        setRecentes(data.recentes ?? []);
        const atual = data.atual;
        if (atual && atual.id !== ultimoIdRef.current) {
          ultimoIdRef.current = atual.id;
          setChamada(atual);
          setOverlay(true);
          try {
            playerRef.current?.mute?.();
          } catch {
            /* player ainda nao pronto */
          }
          falar(fraseChamada(atual.nomeChamado, atual.destino));
          window.setTimeout(() => {
            setOverlay(false);
            try {
              playerRef.current?.unMute?.();
            } catch {
              /* ignore */
            }
          }, OVERLAY_MS);
        }
      } catch {
        setErroConexao(true);
      } finally {
        timer = window.setTimeout(tick, POLL_MS);
      }
    }
    tick();
    return () => window.clearTimeout(timer);
  }, [iniciado, unidade]);

  // gesto inicial: libera audio/autoplay
  if (!iniciado) {
    return (
      <div style={center}>
        <button className="btn btn-primary btn-lg" onClick={() => setIniciado(true)}>
          ▶ Iniciar painel
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      {/* video ou fallback institucional */}
      {videoId ? (
        <div
          id="painel-yt"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : (
        <div style={{ ...center, color: "var(--text-3)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, color: "var(--accent)" }}>IFP</div>
            <div>Instituto Familia Poncio</div>
          </div>
        </div>
      )}

      {/* overlay de chamada */}
      {overlay && chamada ? (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center", padding: "0 6%" }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: ".2em",
                color: "var(--live)",
                marginBottom: 16,
              }}
            >
              CHAMANDO
            </div>
            <div
              style={{
                fontSize: "clamp(48px, 9vw, 140px)",
                fontWeight: 800,
                color: "var(--text)",
                lineHeight: 1.02,
              }}
            >
              {chamada.nomeChamado.toUpperCase()}
            </div>
            <div
              style={{ marginTop: 20, fontSize: "clamp(20px, 3vw, 44px)", color: "var(--text-2)" }}
            >
              → {chamada.destino}
            </div>
          </div>
        </div>
      ) : null}

      {/* lista de ultimos chamados (canto) */}
      {recentes.length > 0 ? (
        <div style={recentesStyle}>
          <div className="micro" style={{ marginBottom: 6 }}>
            ULTIMOS CHAMADOS
          </div>
          {recentes.map((c) => (
            <div key={c.id} style={{ fontSize: 14, color: "var(--text-2)" }}>
              {c.nomeChamado} · {c.destino}
            </div>
          ))}
        </div>
      ) : null}

      {/* rodape rolante */}
      {anuncios.length > 0 ? (
        <div style={tickerStyle}>
          <div className="painel-marquee">{anuncios.join("      •      ")}</div>
        </div>
      ) : null}

      {erroConexao ? <div style={reconStyle}>reconectando…</div> : null}
    </div>
  );
}

const center: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
};
const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(8,10,11,0.86)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
};
const recentesStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 14px",
  zIndex: 5,
};
const tickerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  background: "rgba(8,10,11,0.7)",
  color: "var(--text)",
  padding: "10px 0",
  fontSize: 22,
  zIndex: 6,
  overflow: "hidden",
};
const reconStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 60,
  right: 20,
  fontSize: 12,
  color: "var(--text-3)",
  zIndex: 7,
};
```

- [ ] **Step 3: Adicionar os tipos do YouTube IFrame API**

O `window.YT` / `YT.Player` / `window.onYouTubeIframeAPIReady` precisam de tipos. Instale os types:

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm add -D @types/youtube"`
Expected: adiciona `@types/youtube` ao devDependencies.

Depois crie `src/types/youtube-iframe.d.ts` para declarar o global `onYouTubeIframeAPIReady` (o `@types/youtube` cobre `YT.*` mas não o callback global):

```ts
export {};
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}
```

- [ ] **Step 4: Verificar build**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build"`
Expected: `Compiled successfully` e rotas `ƒ /painel/[unidade]` listadas. Se `YT` reclamar de tipo, confira o passo 3.

- [ ] **Step 5: Teste manual no browser**

Run: `pnpm dev` (no WSL) e abra `http://localhost:3000/painel/medico` logado. Clique "Iniciar painel" → o vídeo deve tocar (se houver `videoUrl` na config; senão fallback IFP). Em outra aba, dispare uma chamada (Task 11) e veja o overlay + voz em ~2s.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add "src/app/painel/[unidade]/page.tsx" "src/app/painel/[unidade]/painel-tv.tsx" src/types/youtube-iframe.d.ts package.json pnpm-lock.yaml
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): tela da TV (video YT + overlay de chamada + TTS + rodape)"
```

---

## Task 11: Botões "Chamar" nas telas de fila

**Files:**

- Modify: `src/app/medico/minha-fila/page.tsx` (query + botão)
- Modify: `src/app/medico/recepcao/page.tsx` (query + botão)
- Discovery + Modify: a page que renderiza `listTriagensPendentes` (triagem)

- [ ] **Step 1: minha-fila — incluir `profissional.nomeExibicao` e `cidadao.id` na query**

Em `src/app/medico/minha-fila/page.tsx`, no `include` da query `db.consulta.findMany`, ajuste para incluir o id do cidadão e o nome do profissional:

```tsx
  include: {
    slot: { select: { dataHoraInicio: true } },
    cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
    especialidade: { select: { nome: true } },
    profissional: { select: { nomeExibicao: true } },
  },
```

- [ ] **Step 2: minha-fila — adicionar o botão "Chamar"**

No `<div>` de ações de cada item (ao lado do `<Badge>`/`<form action={transitionAction}>`), adicione o form de chamar. Importe a action no topo: `import { chamarAction } from "@/app/painel/chamar-actions";`

```tsx
<form action={chamarAction}>
  <input type="hidden" name="unidade" value="medico" />
  <input type="hidden" name="nomeChamado" value={c.cidadao.nomeSocial || c.cidadao.nomeCompleto} />
  <input type="hidden" name="destino" value={c.profissional.nomeExibicao} />
  <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
  <input type="hidden" name="consultaId" value={c.id} />
  <button type="submit" className="btn btn-secondary">
    Chamar
  </button>
</form>
```

- [ ] **Step 3: recepcao — incluir `cidadao.id` na query**

Em `src/app/medico/recepcao/page.tsx`, no `include`, troque o select do cidadão para incluir `id` (o `profissional.nomeExibicao` já está incluído):

```tsx
    cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
```

- [ ] **Step 4: recepcao — adicionar o botão "Chamar" (destino fixo "Recepcao")**

No `<div>` de ações de cada item, adicione (importe `chamarAction` no topo):

```tsx
<form action={chamarAction}>
  <input type="hidden" name="unidade" value="medico" />
  <input type="hidden" name="nomeChamado" value={c.cidadao.nomeSocial || c.cidadao.nomeCompleto} />
  <input type="hidden" name="destino" value="Recepcao" />
  <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
  <input type="hidden" name="consultaId" value={c.id} />
  <button type="submit" className="btn btn-secondary">
    Chamar
  </button>
</form>
```

- [ ] **Step 5: triagem — localizar a fila e adicionar o botão**

A fila do social vem de `listTriagensPendentes` (`src/lib/triagem.ts`). Ache a page que a renderiza:

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && grep -rl listTriagensPendentes src/app"`

Na page encontrada: (a) garanta que o select do cidadão em `listTriagensPendentes` inclua `nomeSocial` — em `src/lib/triagem.ts`, mude para `cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true, unitIdOrigem: true } }`; (b) adicione por item o form de chamar (destino fixo "Triagem", unidade "medico", sem `consultaId`):

```tsx
<form action={chamarAction}>
  <input type="hidden" name="unidade" value="medico" />
  <input type="hidden" name="nomeChamado" value={t.cidadao.nomeSocial || t.cidadao.nomeCompleto} />
  <input type="hidden" name="destino" value="Triagem" />
  <input type="hidden" name="cidadaoId" value={t.cidadao.id} />
  <button type="submit" className="btn btn-secondary">
    Chamar
  </button>
</form>
```

> Se `grep` não achar consumidor (a fila de triagem ainda não tem UI), pule este passo: o botão da triagem fica fora do v1 (registre no relatório final). Minha-fila e recepção cobrem o fluxo médico principal.

- [ ] **Step 6: Verificar build**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build"`
Expected: `Compiled successfully`.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add src/app/medico/minha-fila/page.tsx src/app/medico/recepcao/page.tsx src/lib/triagem.ts
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): botao Chamar em minha-fila, recepcao e triagem"
```

---

## Task 12: Config do painel (vídeo + anúncios)

**Files:**

- Create: `src/app/painel/[unidade]/config/painel-config-actions.ts`
- Create: `src/app/painel/[unidade]/config/page.tsx`

Gestor/super_admin definem o link do vídeo e gerenciam anúncios. O quiosque (papel painel) é redirecionado (não tem `podeGerirPainel`).

- [ ] **Step 1: Actions de config**

Crie `src/app/painel/[unidade]/config/painel-config-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeGerirPainel } from "@/lib/rbac";
import { db } from "@/lib/db";

async function gate(unidade: string) {
  const session = await auth();
  if (!session || !canAccessUnidade(session, unidade) || !podeGerirPainel(session)) {
    throw new Error("Sem permissao");
  }
  return session;
}

export async function salvarVideoAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  await db.painelConfig.upsert({
    where: { unidade },
    create: { unidade, videoUrl },
    update: { videoUrl },
  });
  revalidatePath(`/painel/${unidade}/config`);
}

export async function adicionarAnuncioAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const texto = String(formData.get("texto") || "").trim();
  if (!texto) return;
  const ativoAteRaw = String(formData.get("ativoAte") || "").trim();
  await db.painelAnuncio.create({
    data: { unidade, texto, ativoAte: ativoAteRaw ? new Date(ativoAteRaw) : null },
  });
  revalidatePath(`/painel/${unidade}/config`);
}

export async function removerAnuncioAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const id = String(formData.get("id"));
  await db.painelAnuncio.deleteMany({ where: { id, unidade } });
  revalidatePath(`/painel/${unidade}/config`);
}
```

- [ ] **Step 2: Page de config**

Crie `src/app/painel/[unidade]/config/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeGerirPainel } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { db } from "@/lib/db";
import {
  adicionarAnuncioAction,
  removerAnuncioAction,
  salvarVideoAction,
} from "./painel-config-actions";

export const dynamic = "force-dynamic";

export default async function PainelConfigPage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) redirect("/" as Route);
  const session = await auth();
  if (!session) redirect(`/${unidade}/login` as Route);
  if (!canAccessUnidade(session, unidade) || !podeGerirPainel(session)) redirect("/" as Route);

  const config = await db.painelConfig.findUnique({ where: { unidade } });
  const anuncios = await db.painelAnuncio.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div
      className="ifp-kit"
      data-unit={unidade}
      data-unit-accent=""
      style={{ minHeight: "100vh", padding: 24, maxWidth: 720, margin: "0 auto" }}
    >
      <h1 style={{ color: "var(--text)", marginBottom: 16 }}>Painel — Configuracao ({unidade})</h1>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ color: "var(--text)", fontSize: 16 }}>Video do mes (YouTube)</h2>
        <form action={salvarVideoAction} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input type="hidden" name="unidade" value={unidade} />
          <input
            name="videoUrl"
            defaultValue={config?.videoUrl ?? ""}
            placeholder="https://youtu.be/..."
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ color: "var(--text)", fontSize: 16 }}>Anuncios do rodape</h2>
        <form action={adicionarAnuncioAction} style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <input type="hidden" name="unidade" value={unidade} />
          <input
            name="texto"
            placeholder="Ex.: DIA 20 TEM WORKSHOP COM O CABELEREIRO LOTUFU"
            className="input"
            required
          />
          <label style={{ fontSize: 13, color: "var(--text-2)" }}>
            Ativo ate (opcional):{" "}
            <input type="date" name="ativoAte" className="input" style={{ width: "auto" }} />
          </label>
          <button type="submit" className="btn btn-secondary" style={{ justifySelf: "start" }}>
            Adicionar anuncio
          </button>
        </form>

        <ul style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {anuncios.map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text)" }}>
                {a.texto}
                {a.ativoAte ? (
                  <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                    {" "}
                    · ate {a.ativoAte.toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </span>
              <form action={removerAnuncioAction}>
                <input type="hidden" name="unidade" value={unidade} />
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="btn btn-danger btn-sm">
                  Remover
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

> Nota: confira se existe a classe `.input` no kit; se não, use as classes de input já usadas em formulários do projeto (ex.: as da ficha do cidadão) ou estilo inline com `var(--surface)`/`var(--line)`.

- [ ] **Step 3: Verificar build**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build"`
Expected: `Compiled successfully` + rota `ƒ /painel/[unidade]/config`.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add "src/app/painel/[unidade]/config"
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): config de video e anuncios (gestor)"
```

---

## Task 13: Usuário de quiosque (script) + npm script

**Files:**

- Create: `scripts/criar-usuario-painel.ts`
- Modify: `package.json` (scripts)

Espelha `scripts/forcar-troca-senha.ts` (autocontido) + a lógica de seed (roles/userRole/user com bcrypt).

- [ ] **Step 1: Implementar o script**

Crie `scripts/criar-usuario-painel.ts`:

```ts
/**
 * Cria/atualiza o usuario de quiosque do painel de uma unidade.
 * Uso: pnpm painel:criar-usuario medico "Senha123!"
 * (a senha precisa ter >= 8 chars; mustChangePassword fica false p/ o quiosque ficar logado)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const unidade = process.argv[2];
  const senha = process.argv[3];
  if (!unidade || !senha || senha.length < 8) {
    console.error("Uso: pnpm painel:criar-usuario <unidade> <senha (>=8 chars)>");
    process.exitCode = 1;
    return;
  }

  // garante o role 'painel' (scope unit)
  const role = await db.role.upsert({
    where: { name: "painel" },
    update: {},
    create: { name: "painel", description: "Quiosque de painel de chamada (TV)", scope: "unit" },
  });

  const email = `painel.${unidade}@familiaponcio.org.br`;
  const hashedPassword = await bcrypt.hash(senha, 12);
  const user = await db.user.upsert({
    where: { email },
    update: { mustChangePassword: false, primaryRoleName: "painel", primaryUnitScope: unidade },
    create: {
      email,
      name: `Painel ${unidade}`,
      hashedPassword,
      mustChangePassword: false,
      primaryRoleName: "painel",
      primaryUnitScope: unidade,
    },
  });

  const jaTem = await db.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, unitScope: unidade },
  });
  if (!jaTem) {
    await db.userRole.create({ data: { userId: user.id, roleId: role.id, unitScope: unidade } });
  }

  console.log(`Quiosque pronto: ${email} (papel painel/${unidade}). Logue a TV com essa senha.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

> Confirme o import do bcrypt usado no projeto: o seed usa `bcrypt` — cheque `prisma/seed.ts` (pode ser `bcryptjs` ou `bcrypt`). Use o MESMO pacote/import que o seed usa.

- [ ] **Step 2: Adicionar o npm script**

Em `package.json`, no bloco `scripts` (junto aos outros), adicione:

```json
    "painel:criar-usuario": "dotenv -e .env.local -- tsx scripts/criar-usuario-painel.ts",
```

- [ ] **Step 3: Rodar o script (cria o quiosque do médico)**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm painel:criar-usuario medico SenhaPainel2026"`
Expected: `Quiosque pronto: painel.medico@familiaponcio.org.br ...`

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Administrador\ifp-connect" add scripts/criar-usuario-painel.ts package.json
git -C "C:\Users\Administrador\ifp-connect" commit -m "feat(painel): script de usuario de quiosque por unidade"
```

> ⚠️ Go-live: `pnpm seguranca:forcar-troca` seta `mustChangePassword=true` em massa — o usuário de quiosque precisa ser re-setado pra `false` depois (ou excluído desse updateMany). Anotar no runbook de produção.

---

## Task 14: Gate completo + ROPA + push + deploy

**Files:**

- Modify: `docs/seguranca/2026-06-06-ropa.md` (nova operação de tratamento)

- [ ] **Step 1: Atualizar a ROPA**

Em `docs/seguranca/2026-06-06-ropa.md`, adicione uma operação de tratamento: exibição/locução de nome de paciente no painel de TV (base legal: acessibilidade/execução do atendimento; mitigações: TV exige sessão de quiosque unit-scoped, usa nome social quando houver, chamada auditada `paciente_chamado`).

- [ ] **Step 2: Gate completo via arquivo .sh**

Crie `_painel_gate.sh` (gitignored por `/_*.sh`) com migrate-deploy-noop + format/typecheck/lint/test:cov/build (espelhe `_cons.sh`/`_anx.sh` dos commits anteriores) e rode:

Run: `wsl -d Ubuntu -- bash /mnt/c/Users/Administrador/ifp-connect/_painel_gate.sh`
Expected: `FAIL=0`, migration já aplicada, todos os steps rc=0, testes verdes (incl. os 3 novos arquivos painel-\*).

- [ ] **Step 3: Commit do ROPA**

```
git -C "C:\Users\Administrador\ifp-connect" add docs/seguranca/2026-06-06-ropa.md
git -C "C:\Users\Administrador\ifp-connect" commit -m "docs(seguranca): ROPA - operacao de painel (exibicao/locucao de nome)"
```

- [ ] **Step 4: Push**

Run: `git -C "C:\Users\Administrador\ifp-connect" push origin main`
Expected: refs atualizados em origin/main.

- [ ] **Step 5: Deploy pra staging**

Run (PowerShell): `ssh -i C:\Users\Administrador\.ssh\ifp_app erickramos@192.168.1.162 --% "cd /opt/ifp-connect/ops/vm && bash deploy.sh"`
Expected: build + `Applying migration ...add_painel` no prod + app `Started`. Depois: `Invoke-RestMethod https://ifp-app.taile04c66.ts.net/api/health` → `{status:ok}`.

- [ ] **Step 6: Criar o quiosque no PROD + teste manual**

Run (na VM, via docker): `ssh ... "cd /opt/ifp-connect/ops/vm && docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate pnpm painel:criar-usuario medico <senha-forte>"` (ajuste ao entrypoint do container). Depois abra `https://ifp-app.taile04c66.ts.net/painel/medico` logado como o quiosque, clique "Iniciar painel", e dispare uma chamada de outra sessão (recepção) → confirme overlay + voz.

---

## Self-Review (preenchido pelo autor do plano)

**1. Cobertura do spec:**

- Tela da TV (vídeo + overlay + TTS + rodapé + últimos chamados + gesto) → Task 10. ✓
- Botão "Chamar" (minha-fila/recepção/triagem, destino por contexto, re-chamável) → Task 11 + action Task 6. ✓
- Config (vídeo + anúncios, gestor) → Task 12. ✓
- Polling ~2s `/api/painel/[unidade]/chamadas` (auth própria) → Task 7 + cliente Task 10. ✓
- Login de quiosque (papel painel + usuário) → Tasks 2 + 13; gate proxy Task 8. ✓
- Models Chamada/PainelConfig/PainelAnuncio + audit → Task 1. ✓
- Capacitação só vídeo+rodapé → coberto (painel é genérico; chamada só ligada no médico via botões). ✓
- Fallbacks (vídeo/voz/conexão/401) → Task 10. ✓
- Testes (pure + DB-real) → Tasks 3/4/5. ✓
- Nota LGPD / ROPA → Task 14. ✓

**2. Placeholders:** o único ponto com descoberta é a page-consumidora da fila de triagem (Task 11 Step 5) — tratado com `grep` + fallback explícito (fora do v1 se não existir), não é placeholder vago.

**3. Consistência de tipos:** `CriarChamadaInput`/`ChamadaResumo` (Task 5) usados em `chamarAction` (Task 6), no route (Task 7) e no cliente como `ChamadaResumo`/JSON (Task 10) — nomes batem. `podeChamar(session)`/`podeGerirPainel(session)` (Task 3) usados consistentemente em actions/pages/route. `nomeChamado`/`anuncioVigente`/`fraseChamada` (Task 4) usados na page e no cliente. `criarChamada`/`listarChamadas` (Task 5) usados em action e route.

**Gap conhecido (aceito):** teste de UI do PainelTV não roda em Vitest (env node, sem RTL) — validação fica manual/Playwright (Task 10 Step 5, Task 14 Step 6), como o resto da UI do projeto.
