# Acesso multi-tenant + RBAC v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o IFP Connect para acesso multi-tenant por path de unidade (`/medico`, `/capacitacao`, `/esportivo`, `/recreativo`, `/poncio`, `/social`), com login catch-all `/[unidade]/login` (drone+filtro de cor), landing pública institucional em `/`, e RBAC v2 (rebaixar Raquel, remover `gestor_geral`).

**Architecture:**

- Roteamento path-based: 6 paths de unidade no `src/app/[unidade]/`, login catch-all sob `[unidade]/login`, landing pública em `src/app/page.tsx`, gates no `src/proxy.ts` via lookup em `lib/unidades.ts`.
- RBAC: tabela `Role` perde `gestor_geral` (atribuição da Raquel removida); demais roles preservadas; novo helper `canAccessUnidade(role, slug)` que aproveita o `canAccessUnit` existente; identidade humana "gestor:medico" mapeia pra `(Role.name='gestor_unidade', UserRole.unitScope='medico')` no banco.
- Sub-rotas internas existentes (`/app/cidadaos`, `/app/vagas`) ficam intactas nesta entrega; aliases `/app/*` continuam respondendo. Migração de sub-rotas pra `/<unidade>/cidadaos` fica pra spec futura de verticalização.

**Tech Stack:** Next.js 16 (proxy.ts convention) + React 19 + Prisma 6 + Auth.js v5 beta + Vitest + Playwright + Tailwind 4. Repo: `C:\Users\Administrador\ifp-connect`. Sempre rodar via `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm ..."`. Push de git via Windows nativo (`git -C "C:\Users\Administrador\ifp-connect" push ...`) — pushar do WSL trava (bug wslrelay).

**Spec base:** `docs/superpowers/specs/2026-05-28-acesso-multitenant-rbac-v2-design.md`
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md`

---

## Convenções deste plano

- **Caminhos** sempre relativos ao repo (ex: `src/lib/unidades.ts` = `C:\Users\Administrador\ifp-connect\src\lib\unidades.ts`).
- **Testes unit** vivem em `tests/unit/<arquivo>.test.ts`; usar Vitest.
- **Testes e2e** em `tests/e2e/<arquivo>.spec.ts`; usar Playwright. Antes de rodar e2e: `pnpm build` (Playwright usa `pnpm start` em prod build).
- **Commit message style** do projeto: `<tipo>(escopo): descrição` em pt-BR. Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`. Exemplos no `git log`.
- **Cada task termina com commit local** (não push). Push acontece no fim de todas as tasks via Windows nativo.
- **Pre-commit ritual** depois de cada task: `pnpm format && pnpm typecheck && pnpm lint && pnpm test` (não pular — CI sempre roda esses).
- **Identidade humana das roles**: a spec usa "gestor:medico" como abreviação. No banco e código TS isso É `(name='gestor_unidade', unitScope='medico')`. NÃO crie nome composto novo.

---

## Task 1: Config canônica das unidades — `lib/unidades.ts`

**Files:**

- Create: `src/lib/unidades.ts`
- Create: `tests/unit/unidades.test.ts`

### Step 1.1: Write the failing tests

Create `tests/unit/unidades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  UNIDADES,
  UNIDADE_SLUGS,
  unidadeFromSlug,
  unidadesAcessiveis,
  type UnidadeSlug,
} from "@/lib/unidades";

describe("unidades — config canônica", () => {
  it("expõe 6 slugs em UNIDADE_SLUGS", () => {
    expect(UNIDADE_SLUGS).toEqual([
      "medico",
      "capacitacao",
      "esportivo",
      "recreativo",
      "poncio",
      "social",
    ]);
  });

  it("UNIDADES tem entrada para cada slug com campos obrigatórios", () => {
    for (const slug of UNIDADE_SLUGS) {
      const u = UNIDADES[slug];
      expect(u.slug).toBe(slug);
      expect(u.nome).toBeTruthy();
      expect(u.corPrimariaPlaceholder).toMatch(/^#[0-9a-f]{6}$/i);
      expect(u.gradientePlaceholder).toMatch(/linear-gradient/);
      expect(Array.isArray(u.rolesAceitas)).toBe(true);
    }
  });

  it("rolesAceitas reflete a matriz da spec", () => {
    // medico → gestor_unidade (com unitScope medico), recepcao (com unitScope medico)
    expect(UNIDADES.medico.rolesAceitas).toContainEqual({
      name: "gestor_unidade",
      unitScope: "medico",
    });
    expect(UNIDADES.medico.rolesAceitas).toContainEqual({
      name: "recepcao",
      unitScope: "medico",
    });
    expect(UNIDADES.poncio.rolesAceitas).toContainEqual({
      name: "presidencia",
      unitScope: null,
    });
    expect(UNIDADES.social.rolesAceitas).toContainEqual({
      name: "social",
      unitScope: null,
    });
  });
});

describe("unidadeFromSlug", () => {
  it("retorna config para slug válido", () => {
    expect(unidadeFromSlug("medico")?.nome).toBe("Centro Médico");
    expect(unidadeFromSlug("poncio")?.nome).toBe("Pôncio Executivo");
  });

  it("retorna null para slug inválido", () => {
    expect(unidadeFromSlug("xyz")).toBeNull();
    expect(unidadeFromSlug("")).toBeNull();
    expect(unidadeFromSlug("MEDICO")).toBeNull(); // case-sensitive
  });
});

describe("unidadesAcessiveis", () => {
  const erickRoles = [{ name: "super_admin" as const, unitScope: null }];
  const raquelRoles = [{ name: "gestor_unidade" as const, unitScope: "medico" as const }];
  const sauloRoles = [{ name: "presidencia" as const, unitScope: null }];
  const reginaRoles = [{ name: "social" as const, unitScope: null }];

  it("super_admin acessa todas as 6", () => {
    expect(unidadesAcessiveis(erickRoles).sort()).toEqual([...UNIDADE_SLUGS].sort());
  });

  it("gestor_unidade:medico acessa só /medico", () => {
    expect(unidadesAcessiveis(raquelRoles)).toEqual(["medico"]);
  });

  it("presidencia acessa só /poncio", () => {
    expect(unidadesAcessiveis(sauloRoles)).toEqual(["poncio"]);
  });

  it("social acessa só /social", () => {
    expect(unidadesAcessiveis(reginaRoles)).toEqual(["social"]);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- unidades"
```

Expected: FAIL with "Cannot find module '@/lib/unidades'".

### Step 1.3: Write the implementation

Create `src/lib/unidades.ts`:

```ts
import type { RoleName, UnitScope } from "@/lib/rbac-types";

export const UNIDADE_SLUGS = [
  "medico",
  "capacitacao",
  "esportivo",
  "recreativo",
  "poncio",
  "social",
] as const;

export type UnidadeSlug = (typeof UNIDADE_SLUGS)[number];

export interface RoleAceita {
  name: RoleName;
  unitScope: UnitScope | null;
}

export interface UnidadeConfig {
  slug: UnidadeSlug;
  nome: string;
  corPrimariaPlaceholder: string;
  fotoDronePlaceholder: string | null;
  gradientePlaceholder: string;
  rolesAceitas: readonly RoleAceita[];
  cidadaoScope: "self" | "all";
}

/**
 * Config canônica das unidades. Cores/fotos são placeholders — DS v2 substitui.
 * `rolesAceitas` espelha a matriz role × path da spec (§4.2). super_admin é
 * tratado fora dessa lista (bypassa em unidadesAcessiveis e canAccessUnidade).
 */
export const UNIDADES: Record<UnidadeSlug, UnidadeConfig> = {
  medico: {
    slug: "medico",
    nome: "Centro Médico",
    corPrimariaPlaceholder: "#1e3a8a",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #1e3a8a, #0f766e)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "medico" },
      { name: "profissional", unitScope: "medico" },
      { name: "recepcao", unitScope: "medico" },
    ],
    cidadaoScope: "self",
  },
  capacitacao: {
    slug: "capacitacao",
    nome: "Capacitação",
    corPrimariaPlaceholder: "#7c2d12",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #7c2d12, #a16207)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "capacitacao" },
      { name: "profissional", unitScope: "capacitacao" },
      { name: "recepcao", unitScope: "capacitacao" },
    ],
    cidadaoScope: "self",
  },
  esportivo: {
    slug: "esportivo",
    nome: "Esportivo",
    corPrimariaPlaceholder: "#14532d",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #14532d, #b45309)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "esportivo" },
      { name: "profissional", unitScope: "esportivo" },
      { name: "recepcao", unitScope: "esportivo" },
    ],
    cidadaoScope: "self",
  },
  recreativo: {
    slug: "recreativo",
    nome: "Recreativo",
    corPrimariaPlaceholder: "#5b21b6",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #5b21b6, #c2410c)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "recreativo" },
      { name: "profissional", unitScope: "recreativo" },
      { name: "recepcao", unitScope: "recreativo" },
    ],
    cidadaoScope: "self",
  },
  poncio: {
    slug: "poncio",
    nome: "Pôncio Executivo",
    corPrimariaPlaceholder: "#3f1d0a",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #3f1d0a, #92400e)",
    rolesAceitas: [{ name: "presidencia", unitScope: null }],
    cidadaoScope: "all",
  },
  social: {
    slug: "social",
    nome: "Serviço Social",
    corPrimariaPlaceholder: "#6d28d9",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #6d28d9, #db2777)",
    rolesAceitas: [{ name: "social", unitScope: null }],
    cidadaoScope: "all",
  },
};

export function unidadeFromSlug(slug: string): UnidadeConfig | null {
  return (UNIDADES as Record<string, UnidadeConfig>)[slug] ?? null;
}

/**
 * Slugs de unidades em que essas roles conseguem entrar.
 * super_admin → todas.
 */
export function unidadesAcessiveis(
  roles: readonly { name: RoleName; unitScope: UnitScope | null }[],
): UnidadeSlug[] {
  if (roles.some((r) => r.name === "super_admin")) {
    return [...UNIDADE_SLUGS];
  }
  const acessiveis: UnidadeSlug[] = [];
  for (const slug of UNIDADE_SLUGS) {
    const aceitas = UNIDADES[slug].rolesAceitas;
    const match = roles.some((userRole) =>
      aceitas.some(
        (aceita) => aceita.name === userRole.name && aceita.unitScope === userRole.unitScope,
      ),
    );
    if (match) acessiveis.push(slug);
  }
  return acessiveis;
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- unidades"
```

Expected: 3 describe blocks, all green.

- [ ] **Step 1.5: Pre-commit ritual + commit**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/unidades.ts tests/unit/unidades.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(unidades): config canonica + unidadesAcessiveis (T1 multi-tenant)"
```

---

## Task 2: `canAccessUnidade` em `lib/rbac.ts`

Approach: reusar `canAccessUnit` que já existe — adicionar uma versão path-based que recebe slug em vez de UnitScope, suportando os slugs novos (`poncio`, `social`) que não são UnitScope.

**Files:**

- Modify: `src/lib/rbac.ts` (adicionar função)
- Create/extend: `tests/unit/rbac.test.ts` (criar se não existir; se existir, adicionar describe)

### Step 2.1: Write the failing test

Create `tests/unit/rbac.test.ts` (ou append se já existir):

```ts
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { canAccessUnidade } from "@/lib/rbac";

function sessionWith(roles: { name: string; unitScope: string | null }[]): Session {
  return {
    user: {
      id: "u1",
      email: "x@y.z",
      name: null,
      roles: roles as Session["user"]["roles"],
      primaryRole: roles[0] as Session["user"]["primaryRole"],
    },
    expires: "2099-01-01",
  } as Session;
}

describe("canAccessUnidade", () => {
  it("super_admin passa em qualquer slug (inclusive poncio e social)", () => {
    const erick = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(canAccessUnidade(erick, "medico")).toBe(true);
    expect(canAccessUnidade(erick, "poncio")).toBe(true);
    expect(canAccessUnidade(erick, "social")).toBe(true);
  });

  it("presidencia só em poncio", () => {
    const saulo = sessionWith([{ name: "presidencia", unitScope: null }]);
    expect(canAccessUnidade(saulo, "poncio")).toBe(true);
    expect(canAccessUnidade(saulo, "medico")).toBe(false);
    expect(canAccessUnidade(saulo, "social")).toBe(false);
  });

  it("social só em /social", () => {
    const regina = sessionWith([{ name: "social", unitScope: null }]);
    expect(canAccessUnidade(regina, "social")).toBe(true);
    expect(canAccessUnidade(regina, "medico")).toBe(false);
    expect(canAccessUnidade(regina, "poncio")).toBe(false);
  });

  it("gestor_unidade:medico só em /medico", () => {
    const raquel = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]);
    expect(canAccessUnidade(raquel, "medico")).toBe(true);
    expect(canAccessUnidade(raquel, "capacitacao")).toBe(false);
    expect(canAccessUnidade(raquel, "poncio")).toBe(false);
  });

  it("recepcao:medico só em /medico", () => {
    const maria = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(canAccessUnidade(maria, "medico")).toBe(true);
    expect(canAccessUnidade(maria, "social")).toBe(false);
  });

  it("sem sessão → falso pra qualquer slug", () => {
    expect(canAccessUnidade(null, "medico")).toBe(false);
    expect(canAccessUnidade(null, "poncio")).toBe(false);
  });

  it("slug inexistente → falso", () => {
    const erick = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(canAccessUnidade(erick, "xyz")).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- rbac"
```

Expected: FAIL with "canAccessUnidade is not exported from '@/lib/rbac'".

### Step 2.3: Implement `canAccessUnidade`

Edit `src/lib/rbac.ts`. Add at the top of the imports section:

```ts
import { unidadeFromSlug } from "@/lib/unidades";
```

Then append at the bottom of the file, before the closing of the module:

```ts
/**
 * Path-based access check para a arquitetura multi-tenant (spec 2026-05-28).
 * Aceita os 6 slugs (medico/capacitacao/esportivo/recreativo/poncio/social).
 * super_admin bypassa. Demais roles precisam estar em UNIDADES[slug].rolesAceitas.
 */
export function canAccessUnidade(session: Session | null, slug: string): boolean {
  if (!session?.user.roles?.length) return false;
  if (session.user.roles.some((r) => r.name === "super_admin")) return true;

  const unidade = unidadeFromSlug(slug);
  if (!unidade) return false;

  return unidade.rolesAceitas.some((aceita) =>
    session.user.roles.some(
      (userRole) => userRole.name === aceita.name && userRole.unitScope === aceita.unitScope,
    ),
  );
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- rbac"
```

Expected: PASS (7 testes).

- [ ] **Step 2.5: Pre-commit + commit**

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/lib/rbac.ts tests/unit/rbac.test.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(rbac): canAccessUnidade path-based aceitando poncio+social (T2 multi-tenant)"
```

---

## Task 3: Migration Prisma — drop `gestor_geral`

Drop a role `gestor_geral` da tabela `Role` E todas as suas atribuições (que hoje só vai existir a da Raquel). Idempotente: se ninguém tiver, ainda funciona.

**Files:**

- Create: `prisma/migrations/<timestamp>_drop_gestor_geral_role/migration.sql` (gerado pelo Prisma)

### Step 3.1: Verificar atribuições atuais

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:studio &"
```

Abre Prisma Studio em http://localhost:5555. Confirmar visualmente que Role `gestor_geral` existe e tem 1 UserRole (Raquel). Fechar Studio (Ctrl+C no terminal WSL) antes de prosseguir — Prisma migrate não roda com Studio aberto.

Alternativa via SQL direto:

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT u.email, r.name, ur.\"unitScope\" FROM \"UserRole\" ur JOIN \"User\" u ON u.id = ur.\"userId\" JOIN \"Role\" r ON r.id = ur.\"roleId\" WHERE r.name = '\''gestor_geral'\'';"'
```

Expected: 1 row — `raquel.barros@familiaponcio.org.br | gestor_geral | NULL`.

### Step 3.2: Criar migration SQL custom

Em vez de `pnpm db:migrate --name X` (que gera a partir do diff do schema), vamos criar manualmente — porque a mudança não é estrutural (não muda schema), é só de dados. Mas é importante migrar pra garantir reprodutibilidade no CI.

```bash
mkdir -p "C:/Users/Administrador/ifp-connect/prisma/migrations/20260528120000_drop_gestor_geral_role"
```

Criar `prisma/migrations/20260528120000_drop_gestor_geral_role/migration.sql`:

```sql
-- Remove a role gestor_geral e suas atribuições.
-- Spec 2026-05-28: presidencia passa a usar /poncio direto; Raquel rebaixada a só gestor_unidade:medico.
-- Idempotente — se a role não existir, não faz nada.

DELETE FROM "UserRole" WHERE "roleId" IN (SELECT id FROM "Role" WHERE name = 'gestor_geral');
DELETE FROM "Role" WHERE name = 'gestor_geral';
```

### Step 3.3: Aplicar migration

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:deploy"
```

Expected: `Applied migration(s): 20260528120000_drop_gestor_geral_role`.

### Step 3.4: Verificar resultado

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT name FROM \"Role\" ORDER BY name;"'
```

Expected: 6 roles — `gestor_unidade, presidencia, profissional, recepcao, social, super_admin` (sem `gestor_geral`).

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT u.email FROM \"User\" u WHERE u.email = '\''raquel.barros@familiaponcio.org.br'\'';"'
```

Confirmar que Raquel ainda existe (não deletada — só perdeu uma atribuição):

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT r.name, ur.\"unitScope\" FROM \"UserRole\" ur JOIN \"Role\" r ON r.id = ur.\"roleId\" JOIN \"User\" u ON u.id = ur.\"userId\" WHERE u.email = '\''raquel.barros@familiaponcio.org.br'\'';"'
```

Expected: 1 row — `gestor_unidade | medico`.

### Step 3.5: Commit

```bash
git -C "C:/Users/Administrador/ifp-connect" add prisma/migrations/20260528120000_drop_gestor_geral_role/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(db): drop role gestor_geral + atribuicoes (T3 multi-tenant)"
```

---

## Task 4 (AMPLIADA): Limpeza completa de `gestor_geral` + capabilities pós-rebaixamento

**AMPLIAÇÃO 2026-05-28:** Durante execução, descoberta de gap: `gestor_geral` aparecia em ~15 arquivos cobrindo capabilities além de identidade. 4 decisões de produto foram fechadas (ver spec §4.3) — gestor_unidade vê Saúde da própria unidade SIM, vê Socio NÃO, gestão de users só super_admin, presidência vê /poncio agregado-only. T4 agora limpa todos os arquivos + aplica capabilities + atualiza testes e2e.

**Files (~13 arquivos):**

- Modify: `src/lib/rbac-types.ts` (4 lugares: ROLE_NAMES, GLOBAL_ROLES, ROLE_DESCRIPTIONS, getLandingPathFor)
- Modify: `src/lib/rbac.ts` (3 lugares em `getUserUnits`, `can()` ficha_cidada branch, `can()` user|role branch)
- Modify: `src/lib/triagem.ts` (1 lugar: `podeFazerTriagem`)
- Modify: `src/lib/funil.ts` (2 lugares: `podeGerenciarVaga` + `podeAgendar`)
- Modify: `src/lib/cidadao-history.ts` (2 lugares: `verSaude` + `verSocio`)
- Modify: `src/lib/cidadao.ts` (1 comentário)
- Modify: `src/components/app-shell.tsx` (2 lugares)
- Modify: `src/components/unit-switcher.tsx` (1 lugar)
- Modify: `src/app/admin/users/page.tsx` (2 lugares: gate + filtro)
- Modify: `src/app/app/cidadaos/[id]/page.tsx` (4 lugares: 3 booleans + lista)
- Modify: `src/app/app/cidadaos/[id]/anexo-actions.ts` (1 lugar)
- Modify: `src/app/app/cidadaos/novo/page.tsx` (3 lugares incluindo comentário)
- Modify: `src/app/app/cidadaos/novo/actions.ts` (2 lugares)
- Modify: `prisma/seed.ts` (Raquel + remover Role row + comentário Sarah)
- Modify: `prisma/schema.prisma` (4 comentários cosméticos — lines 22, 80, 86, 94)
- Modify: `tests/e2e/cidadao-edit.spec.ts` (cabeçalho + 3 describes/tests)
- Modify: `tests/e2e/cidadao-crud.spec.ts` (1 test name + body)
- Modify: `tests/e2e/rbac.spec.ts` (1 test name + body)

**NÃO TOCAR nesta task:** `src/proxy.ts` (gates antigas referenciam gestor_geral; T10 reescreve o arquivo inteiro).

### Decisões de capability aplicadas

| Função / capability                             | Antes                                                          | Depois                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `getUserUnits` "global access"                  | `super_admin, presidencia, gestor_geral, social` → "all"       | `super_admin, presidencia, social` → "all"                                   |
| `can(ficha_cidada)` branch gestor_geral         | retorna `true` pra qualquer action                             | branch removida                                                              |
| `can(user                                       | role)`                                                         | `hasAnyRole(session, "gestor_geral")`                                        | branch removida (só super_admin via earlier check) |
| `podeFazerTriagem`                              | `social/super_admin/gestor_geral`                              | `social/super_admin`                                                         |
| `podeGerenciarVaga`                             | `super_admin/gestor_geral/gestor_unidade`                      | `super_admin/gestor_unidade`                                                 |
| `podeAgendar`                                   | `super_admin/gestor_geral/gestor_unidade/social/recepcao`      | `super_admin/gestor_unidade/social/recepcao`                                 |
| `verSaude`                                      | `super_admin/gestor_geral/profissional`                        | `super_admin/gestor_unidade/profissional` (Saúde sim para gestor da unidade) |
| `verSocio`                                      | `super_admin/gestor_geral/presidencia/social`                  | `super_admin/presidencia/social` (Socio NÃO para gestor de unidade)          |
| `podeTriagem` em detalhe de cidadão             | `super_admin/gestor_geral/social`                              | `super_admin/social`                                                         |
| `app-shell` branches "global"                   | `super_admin/gestor_geral/social` e `super_admin/gestor_geral` | `super_admin/social` e `super_admin`                                         |
| `unit-switcher` visibilidade                    | `super_admin/presidencia/gestor_geral`                         | `super_admin/presidencia` (T11 vai apertar mais — só super_admin)            |
| `/admin/users` gate                             | `super_admin/gestor_geral`                                     | `super_admin`                                                                |
| `/admin/users` filtro de "global roles" exibido | inclui gestor_geral                                            | sem gestor_geral                                                             |
| `cidadaos/novo canChooseUnit`                   | `super_admin/gestor_geral`                                     | `super_admin`                                                                |
| `cidadaos/novo` lista de roles que podem criar  | inclui gestor_geral                                            | sem gestor_geral                                                             |
| `anexo-actions.allowedRoles`                    | `super_admin/gestor_geral/gestor_unidade`                      | `super_admin/gestor_unidade`                                                 |

### Estratégia para testes e2e que usavam Raquel como gestor_geral

| Test                                                              | Antes                       | Depois                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `cidadao-edit.spec.ts` — "gestor_geral edita telefone"            | login Raquel (gestor_geral) | login Erick (super_admin) — mantém intent "alguém autorizado edita"                                                         |
| `cidadao-edit.spec.ts` — "gestor_geral edita Saúde"               | login Raquel                | login Erick (super_admin)                                                                                                   |
| `cidadao-edit.spec.ts` — "histórico: gestor_geral VÊ campo Saúde" | login Raquel                | login Erick (super_admin) — quem vê Saúde redação ON é super_admin/gestor_unidade da unidade/profissional                   |
| `cidadao-crud.spec.ts` — "gestor_geral VÊ seções Saúde+Socio"     | login Raquel                | dividir em 2 testes: (a) "Erick (super_admin) vê Saúde+Socio" e (b) "Raquel (gestor_unidade:medico) vê Saúde mas NÃO Socio" |
| `rbac.spec.ts` — "Raquel (gestor_geral) cai em /app Global"       | login Raquel                | Renomear pra "Raquel cai em /app/medico" (landing dela mudou)                                                               |

### Steps

> Esta task é grande mas **estritamente mecânica** depois das decisões fechadas. Recomendação: 1 subagent só, instruções claras, commit único.

### Step 4.1 — Smoke pré: confirma gap

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rln 'gestor_geral' src/ prisma/seed.ts tests/e2e/ 2>/dev/null | sort"
```

Expected: ~13 arquivos listados (os mesmos do `Files` acima).

### Step 4.2 — Aplicar todas as edições do "Decisões de capability aplicadas"

Para cada arquivo da tabela:

1. Abrir arquivo
2. Localizar a linha com `gestor_geral`
3. Aplicar a mudança da tabela (remoção pura OU substituição)
4. Verificar imports e tipos ainda compilam

**`src/lib/rbac-types.ts` — atenção especial:**

- Remover `"gestor_geral"` do array `ROLE_NAMES` (linha 9)
- Remover de `GLOBAL_ROLES` (linha 26)
- Remover a key `gestor_geral: "..."` do `ROLE_DESCRIPTIONS` (linha 47-48)
- Remover o `case "gestor_geral":` do switch em `getLandingPathFor` (linha 68 — bloco inteiro do case)

Após isso, `RoleName` deixa de incluir `"gestor_geral"`. TypeScript vai apontar todos os lugares restantes que referenciam o literal — use isso como guia (rodar `pnpm typecheck` ao longo do caminho).

**`prisma/seed.ts`:**

- Localizar bloco da Raquel: trocar roles array + primaryRoleName + adicionar primaryUnitScope
- Localizar bloco que cria Role `gestor_geral` na lista de roles seedadas → remover essa entry
- Adicionar no topo (após JSDoc): `// TODO operacional pós-deploy: criar user real para Sarah Pôncio com role presidencia. Spec 2026-05-28 §7.`

**`prisma/schema.prisma`:**

- Linha 22: comentário com lista de roles → remover `gestor_geral` da lista
- Linha 80: comentário com lista de chaves → remover `gestor_geral`
- Linha 86: comentário com lista de globais → remover `gestor_geral`
- Linha 94: comentário com exemplo da Raquel → atualizar pra refletir nova Raquel (só (gestor_unidade, medico))

**Testes e2e** — aplicar a "Estratégia para testes e2e" acima. Verificar com `pnpm test:e2e -- <arquivo>` se você quiser smoke por arquivo, mas suite completa só ao final.

### Step 4.3 — Re-seed e validar SQL

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:seed"
```

Expected: seed completa sem erros. 9 users, 6 roles (sem gestor_geral).

Verifica Raquel:

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT u.email, u.\"primaryRoleName\", u.\"primaryUnitScope\", COUNT(ur.id) AS roles FROM \"User\" u LEFT JOIN \"UserRole\" ur ON ur.\"userId\" = u.id WHERE u.email = '\''raquel.barros@familiaponcio.org.br'\'' GROUP BY u.id;"'
```

Expected: `raquel.barros@... | gestor_unidade | medico | 1`.

### Step 4.4 — Pre-commit ritual

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
```

Esperado: format/typecheck/lint verde. **Unit tests:** 70/70 (provavelmente — algum pode quebrar se mocka `gestor_geral`; ajustar). **E2e** roda separadamente em Step 4.5.

### Step 4.5 — E2e dos testes ajustados

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build && pnpm test:e2e -- cidadao-edit cidadao-crud rbac"
```

Esperado: testes ajustados verdes. Se algum falha, ajustar e re-rodar.

### Step 4.6 — Final grep + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rn 'gestor_geral' src/ prisma/ tests/ 2>/dev/null | grep -v node_modules | grep -v '.next' | grep -v 'migrations/2026052812'"
```

Esperado: vazio (proxy.ts é exceção legítima — será reescrito em T10).

> Aliás, se `proxy.ts` ainda aparecer: ok. Documentar no commit message.

Commit:

```bash
git -C "C:/Users/Administrador/ifp-connect" add -A
git -C "C:/Users/Administrador/ifp-connect" commit -m "refactor(rbac): cleanup gestor_geral em 13 arquivos + capabilities pos-rebaixamento (T4 ampliada)"
```

---

## Task 5: Landing pública em `src/app/page.tsx`

Substituir o redirect atual (que joga pra `/login` ou `/app`) por uma landing pública institucional. Sem auth check. Tom institucional, sem CTA comercial.

**Files:**

- Modify: `src/app/page.tsx`

### Step 5.1: Reescrever `src/app/page.tsx`

Backup do conteúdo atual (referência: era um `redirect(getLandingPath(session))`). Substituir totalmente por:

```tsx
import Link from "next/link";
import Image from "next/image";
import { UNIDADES, UNIDADE_SLUGS } from "@/lib/unidades";

const UNIDADES_PUBLICAS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo/leao.png"
            alt="Instituto Família Pôncio"
            width={48}
            height={48}
            priority
          />
          <span className="text-lg font-semibold tracking-tight">Instituto Família Pôncio</span>
        </div>
        <Link href="/poncio/login" className="text-sm text-stone-500 hover:text-stone-900">
          Acesso executivo
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
          Quatro unidades. Um propósito.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          O Instituto Família Pôncio atende moradores de Duque de Caxias através de quatro frentes:
          saúde, educação, esporte e recreação infantil.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UNIDADES_PUBLICAS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <Link
                key={slug}
                href={`/${slug}/login`}
                className="group rounded-2xl border border-stone-200 p-6 transition-all hover:border-stone-400 hover:shadow-sm"
                style={{ borderTop: `4px solid ${u.corPrimariaPlaceholder}` }}
              >
                <h2 className="text-xl font-semibold text-stone-900">{u.nome}</h2>
                <p className="mt-2 text-sm text-stone-500">Acesso da equipe da unidade</p>
                <span className="mt-4 inline-block text-sm font-medium text-stone-700 group-hover:text-stone-900">
                  Entrar →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-stone-100 py-8 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Instituto Família Pôncio · Duque de Caxias, RJ
      </footer>
    </main>
  );
}
```

### Step 5.2: Smoke verificar no browser

Garantir que o dev server tá vivo:

```bash
wsl -d Ubuntu -- bash -c "ss -tlnp 2>/dev/null | grep -E ':300[0-9]'"
```

Se não tiver `next-server` em 3000, subir conforme `reference_ifp_dev_commands`. Se tiver, abrir http://localhost:3000/ no browser e confirmar:

- Logo do leão aparece
- 4 cards (Centro Médico / Capacitação / Esportivo / Recreativo)
- Cada card linka pra `/<slug>/login` (verificar com hover/inspect)
- Link "Acesso executivo" no topo direito linka pra `/poncio/login`

⚠️ Links vão dar 404 por ora — as rotas `/<slug>/login` ainda não existem. Isso é esperado nesta task.

### Step 5.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(landing): landing publica institucional na raiz / (T5 multi-tenant)"
```

---

## Task 6: Home da unidade — `src/app/[unidade]/page.tsx`

Cria a tela home pra cada unidade pelo catch-all. Placeholder funcional — só prova que o roteamento + gate funciona. Visual real fica pra DS v2 / verticalização.

**Files:**

- Create: `src/app/[unidade]/page.tsx`

### Step 6.1: Criar a página

```tsx
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";

export default async function UnidadeHomePage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade: slug } = await params;
  const unidade = unidadeFromSlug(slug);
  if (!unidade) notFound();

  const session = await auth();
  if (!session) redirect(`/${slug}/login` as Route);
  if (!canAccessUnidade(session, slug)) redirect("/" as Route);

  return (
    <main className="min-h-screen bg-white p-12">
      <div
        className="mx-auto max-w-3xl rounded-2xl border border-stone-200 p-8"
        style={{ borderLeft: `6px solid ${unidade.corPrimariaPlaceholder}` }}
      >
        <p className="text-xs uppercase tracking-wider text-stone-500">Unidade</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">{unidade.nome}</h1>
        <p className="mt-4 text-stone-600">Bem-vindo, {session.user.name ?? session.user.email}.</p>
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visual provisório — aguardando Design System v2 e verticalização da unidade.
        </p>
      </div>
    </main>
  );
}
```

### Step 6.2: Smoke browser

Abrir http://localhost:3000/medico — esperado redirect para `/medico/login` (que ainda não existe, vai 404). Esse é o comportamento certo: a página existe, gate sem sessão redireciona. 404 do login será resolvido na T7.

Login direto via browser não dá pra testar ainda (não tem login multi-tenant). Continuar.

### Step 6.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/\[unidade\]/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(unidade): home placeholder por unidade com gate path-based (T6 multi-tenant)"
```

---

## Task 7: Login catch-all `/[unidade]/login` + shell visual

Login catch-all com background drone+filtro de cor, login action que valida `canAccessUnidade` pós-autenticação.

**Files:**

- Create: `src/app/[unidade]/login/page.tsx`
- Create: `src/app/[unidade]/login/login-action.ts`
- Create: `src/components/unidade-login-shell.tsx`

### Step 7.1: Criar o shell visual

`src/components/unidade-login-shell.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { UnidadeConfig } from "@/lib/unidades";

interface Props {
  unidade: UnidadeConfig;
  loginAction: (formData: FormData) => Promise<{ error?: string } | void>;
}

export function UnidadeLoginShell({ unidade, loginAction }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  const background = unidade.fotoDronePlaceholder
    ? `url(${unidade.fotoDronePlaceholder})`
    : unidade.gradientePlaceholder;

  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <div
        className="absolute inset-0"
        style={{
          background,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background: unidade.corPrimariaPlaceholder,
          opacity: 0.55,
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center">
          <Image src="/logo/leao.png" alt="IFP" width={56} height={56} priority />
          <h1 className="mt-4 text-lg font-semibold text-stone-900">{unidade.nome}</h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-stone-500">
            Instituto Família Pôncio
          </p>
        </div>

        <form action={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs text-stone-600">E-mail</span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">Senha</span>
            <input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
          <Link href="/reset" className="hover:text-stone-900">
            Esqueci a senha
          </Link>
          <Link href="/" className="hover:text-stone-900">
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
```

### Step 7.2: Criar a server action

`src/app/[unidade]/login/login-action.ts`:

```ts
"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { logEvent } from "@/lib/audit";
import type { Route } from "next";

export async function unidadeLoginAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const unidade = unidadeFromSlug(slug);
  if (!unidade) return { error: "Unidade desconhecida." };

  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await logEvent({
        action: "signin_failed",
        meta: {
          email: typeof email === "string" ? email : null,
          unidade: slug,
        },
      });
      return { error: "E-mail ou senha incorretos." };
    }
    throw error;
  }

  const session = await auth();
  if (!session) {
    return { error: "E-mail ou senha incorretos." };
  }

  if (!canAccessUnidade(session, slug)) {
    await logEvent({
      action: "signin_denied_unit",
      meta: { email: session.user.email, unidade: slug },
    });
    return {
      error: "Não foi possível acessar essa unidade. Verifique se você está no link correto.",
    };
  }

  redirect(`/${slug}` as Route);
}
```

> NOTE: `logEvent({ action: "signin_denied_unit" })` usa uma nova ação. Se `lib/audit.ts` ou `lib/audit-types.ts` exige adicionar a string em uma union/enum, adicione lá: action `"signin_denied_unit"` ao lado de `"signin_failed"`.

### Step 7.3: Criar a página

`src/app/[unidade]/login/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { UnidadeLoginShell } from "@/components/unidade-login-shell";
import { unidadeLoginAction } from "./login-action";
import { unidadeFromSlug } from "@/lib/unidades";

export default async function UnidadeLoginPage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade: slug } = await params;
  const unidade = unidadeFromSlug(slug);
  if (!unidade) notFound();

  const boundAction = unidadeLoginAction.bind(null, slug);

  return <UnidadeLoginShell unidade={unidade} loginAction={boundAction} />;
}
```

### Step 7.4: Smoke browser

Abrir http://localhost:3000/medico/login — esperado:

- Background com cor azul-marinho (gradiente placeholder)
- Card branco no centro com logo do leão, "Centro Médico", form de email+senha
- Link "Esqueci a senha" e "Voltar"

Testar login OK:

- Email: `raquel.barros@familiaponcio.org.br` / senha: `ifp-demo-2026`
- Esperado: redirect para `/medico` (que mostra a home da T6)

Testar login negado por unidade:

- Acessar http://localhost:3000/capacitacao/login
- Email: `raquel.barros@familiaponcio.org.br` / senha: `ifp-demo-2026`
- Esperado: mensagem "Não foi possível acessar essa unidade..." no card

Testar login inválido:

- `wrong@email.com` / qualquer senha
- Esperado: "E-mail ou senha incorretos."

### Step 7.5: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/\[unidade\]/login/ src/components/unidade-login-shell.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(login): catch-all /[unidade]/login com drone+filtro e gate por unidade (T7)"
```

---

## Task 8: Mover `/app/social` → `/social`

A página da Regina hoje vive em `src/app/app/social/page.tsx` e responde em `/app/social`. Spec quer ela em `/social`.

**Files:**

- Create: `src/app/social/page.tsx`
- Delete: `src/app/app/social/page.tsx`

### Step 8.1: Copiar conteúdo

```bash
cp "C:/Users/Administrador/ifp-connect/src/app/app/social/page.tsx" "C:/Users/Administrador/ifp-connect/src/app/social/page.tsx"
```

(Cria diretório `src/app/social` automaticamente via Bash.)

### Step 8.2: Adicionar gate no topo da nova página

Abrir `src/app/social/page.tsx` e adicionar no topo do componente default (antes do return):

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";

export default async function SocialPage(/* args existentes */) {
  const session = await auth();
  if (!session) redirect("/social/login" as Route);
  if (!canAccessUnidade(session, "social")) redirect("/" as Route);

  // ...resto do código existente (que assume sessão válida)
}
```

> Verificar com `git diff src/app/app/social/page.tsx` vs novo arquivo — adaptar imports relativos se houver.

### Step 8.3: Adicionar banner "visual provisório"

No JSX, logo abaixo do header principal da página:

```tsx
<div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
  Visual provisório — aguardando Design System v2.
</div>
```

### Step 8.4: Deletar a página antiga

```bash
rm "C:/Users/Administrador/ifp-connect/src/app/app/social/page.tsx"
```

### Step 8.5: Verificar que não há referências

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rn '/app/social' src/ tests/ 2>/dev/null | grep -v '.next' | grep -v 'node_modules'"
```

Expected: as referências que aparecerem devem ser todas em arquivos que serão atualizados nas próximas tasks (proxy.ts, navegação). Anotar e atualizar caso o grep retorne arquivos não previstos.

Atualizar `src/lib/rbac-types.ts` — função `getLandingPathFor`:

```ts
// ANTES:
case "social":
  return "/app/social";

// DEPOIS:
case "social":
  return "/social";
```

### Step 8.6: Smoke browser

Abrir http://localhost:3000/social — sem sessão deve redirecionar para `/social/login` (404 por enquanto — corrigido em T7 já se feito; se T7 ainda não, vai 404).

Logar como Regina (`regina@familiaponcio.org.br` / `ifp-demo-2026`) em `/social/login`. Esperado: redirect para `/social` e a página renderiza com banner provisório.

### Step 8.7: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/social/ src/app/app/social/ src/lib/rbac-types.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "refactor(social): move /app/social para /social com gate path-based (T8)"
```

---

## Task 9: Dashboard placeholder em `/poncio`

`src/app/poncio/page.tsx` — placeholder funcional do dashboard executivo da presidência. Apenas prova o gate. KPIs reais e drill-down ficam pra spec dedicada.

**Files:**

- Create: `src/app/poncio/page.tsx`

### Step 9.1: Criar a página

```tsx
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { UNIDADES } from "@/lib/unidades";

const UNIDADES_OPERACIONAIS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default async function PoncioDashboardPage() {
  const session = await auth();
  if (!session) redirect("/poncio/login" as Route);
  if (!canAccessUnidade(session, "poncio")) redirect("/" as Route);

  return (
    <main className="min-h-screen bg-stone-50 p-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-wider text-stone-500">Pôncio Executivo</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">Visão geral das unidades</h1>
        <p className="mt-2 text-stone-600">Bem-vindo, {session.user.name ?? session.user.email}.</p>

        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visual provisório — aguardando Design System v2 e KPIs reais.
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {UNIDADES_OPERACIONAIS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <div
                key={slug}
                className="rounded-xl border border-stone-200 bg-white p-6"
                style={{ borderTop: `4px solid ${u.corPrimariaPlaceholder}` }}
              >
                <h2 className="font-semibold text-stone-900">{u.nome}</h2>
                <p className="mt-2 text-sm text-stone-500">Indicadores serão exibidos aqui.</p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

### Step 9.2: Smoke browser

Logar como Saulo (`saulo@familiaponcio.org.br` / `ifp-demo-2026`) em `/poncio/login`. Esperado: redirect para `/poncio` e a página renderiza com 4 cards das unidades operacionais + banner provisório.

Testar gate: tentar `/poncio` logado como Raquel — esperado: redirect para `/`.

### Step 9.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/poncio/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(poncio): placeholder dashboard executivo gated em presidencia (T9)"
```

---

## Task 10: Reescrever `proxy.ts` — gates path-based

Reescrever `src/proxy.ts` pra usar `canAccessUnidade` + path-based. Manter aliases `/app/*` por compatibilidade temporária (sub-rotas /cidadaos/vagas continuam ali).

**Files:**

- Modify: `src/proxy.ts`

### Step 10.1: Reescrever o arquivo

Substituir o conteúdo de `src/proxy.ts` por:

```ts
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { hasAnyRole } from "@/lib/rbac";
import { UNIDADE_SLUGS, unidadeFromSlug } from "@/lib/unidades";

const PATHS_PUBLICOS = ["/", "/reset"];

export default auth((req) => {
  const session = req.auth as Session | null;
  const path = req.nextUrl.pathname;
  const origin = req.nextUrl.origin;

  // Públicos (landing + reset)
  if (
    PATHS_PUBLICOS.includes(path) ||
    path.startsWith("/reset/") ||
    UNIDADE_SLUGS.some((s) => path === `/${s}/login`)
  ) {
    return;
  }

  // Sessão obrigatória para qualquer outro path coberto pelo matcher
  if (!session) {
    const slugMatch = path.match(/^\/([a-z]+)/);
    const slug = slugMatch?.[1];
    if (slug && unidadeFromSlug(slug)) {
      return Response.redirect(new URL(`/${slug}/login`, origin));
    }
    return Response.redirect(new URL("/", origin));
  }

  // /admin/audit → só super_admin (existente)
  if (path.startsWith("/admin/audit")) {
    if (!hasAnyRole(session, "super_admin")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /admin/* (users etc) → super_admin (gestor_geral foi removida na T3)
  if (path.startsWith("/admin")) {
    if (!hasAnyRole(session, "super_admin", "presidencia")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // Aliases temporários do roteamento antigo (sub-rotas internas seguem ativas)
  if (path === "/app" || path === "/app/") {
    return Response.redirect(new URL("/poncio", origin));
  }
  if (path === "/app/social" || path.startsWith("/app/social/")) {
    return Response.redirect(new URL("/social", origin));
  }
  const oldUnitMatch = path.match(/^\/app\/(medico|capacitacao|esportivo|recreativo)$/);
  if (oldUnitMatch) {
    return Response.redirect(new URL(`/${oldUnitMatch[1]}`, origin));
  }

  // Demais sub-rotas /app/cidadaos, /app/vagas — escopo unitário existente
  // (mantém as gates antigas até a spec de verticalização migrar elas)
  if (path.startsWith("/app/")) {
    // /app/medico/algo, /app/cidadaos/..., etc. — exige role com acesso à unidade do user
    return;
  }

  // /[unidade] → canAccessUnidade
  for (const slug of UNIDADE_SLUGS) {
    if (path === `/${slug}` || path.startsWith(`/${slug}/`)) {
      // /<slug>/login já tratado acima
      if (!canAccessUnidade(session, slug)) {
        return Response.redirect(new URL("/", origin));
      }
      return;
    }
  }
});

export const config = {
  matcher: [
    "/",
    "/app/:path*",
    "/admin/:path*",
    "/medico/:path*",
    "/capacitacao/:path*",
    "/esportivo/:path*",
    "/recreativo/:path*",
    "/poncio/:path*",
    "/social/:path*",
    "/reset/:path*",
  ],
};
```

### Step 10.2: Restart dev server

Mudanças em `proxy.ts` exigem restart do Next:

```bash
wsl -d Ubuntu -- bash -c "pkill -f 'next dev' 2>/dev/null; pkill -f 'next-server' 2>/dev/null; sleep 2"
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm dev &"
```

Aguardar ~30s pra Turbopack compilar.

### Step 10.3: Smoke browser de cenários

| URL             | Logado como | Esperado                                                  |
| --------------- | ----------- | --------------------------------------------------------- |
| `/`             | —           | landing pública renderiza                                 |
| `/medico`       | sem sessão  | redirect `/medico/login`                                  |
| `/medico`       | Raquel      | renderiza home Médico                                     |
| `/medico`       | Saulo       | redirect `/`                                              |
| `/poncio`       | Saulo       | renderiza dashboard exec                                  |
| `/poncio`       | Raquel      | redirect `/`                                              |
| `/social`       | Regina      | renderiza social                                          |
| `/social`       | Maria       | redirect `/`                                              |
| `/app`          | Raquel      | redirect `/poncio` → Raquel não tem acesso → redirect `/` |
| `/app/medico`   | Raquel      | redirect `/medico` → renderiza                            |
| `/app/cidadaos` | Raquel      | renderiza (sub-rota antiga preservada)                    |
| `/admin/users`  | Erick       | renderiza                                                 |
| `/admin/users`  | Raquel      | redirect `/` (perdeu gestor_geral)                        |

Validar manualmente cada um.

### Step 10.4: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/proxy.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(proxy): gates path-based + aliases /app/* para compat (T10 multi-tenant)"
```

---

## Task 11: Atualizar `unit-switcher.tsx` — visível só super_admin

Hoje o switcher aparece pra quem tem múltiplas roles com unitScope OU gestor_geral. Com gestor_geral removida, só super_admin precisa de switcher.

**Files:**

- Modify: `src/components/unit-switcher.tsx`

### Step 11.1: Localizar a lógica de visibilidade

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && cat src/components/unit-switcher.tsx"
```

Identificar onde decide se renderiza ou não — provavelmente baseado em `getUserUnits(session)` ou `roles.length > 1`.

### Step 11.2: Substituir lógica de visibilidade

Encontrar a condição que decide renderizar e substituir por:

```tsx
const isSuperAdmin = session.user.roles.some((r) => r.name === "super_admin");
if (!isSuperAdmin) return null;
```

Substituir as opções do dropdown pelas 6 unidades de `UNIDADE_SLUGS` (em vez do conjunto atual baseado em UnitScope):

```tsx
import { UNIDADE_SLUGS, UNIDADES } from "@/lib/unidades";

// dentro do componente:
{
  UNIDADE_SLUGS.map((slug) => (
    <Link key={slug} href={`/${slug}` as Route}>
      {UNIDADES[slug].nome}
    </Link>
  ));
}
```

Adicionar item "Início" no fim do dropdown apontando pra `/`.

### Step 11.3: Smoke browser

Logar como Erick em http://localhost:3000/medico → avatar/sidebar → ver switcher com 6 unidades + Início → clicar `/capacitacao` → vai direto sem login.

Logar como Raquel em `/medico` → switcher NÃO aparece.

### Step 11.4: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/unit-switcher.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(switcher): visivel so super_admin + 6 unidades (T11 multi-tenant)"
```

---

## Task 12: Esqueleto de reset de senha — `/reset`

Esqueleto funcional sem envio de email real. Quando o user submete email, mostra mensagem "Se o e-mail estiver cadastrado, você receberá um link" — não revela se existe. Provedor SMTP fica pro Plano 8.

**Files:**

- Create: `src/app/reset/page.tsx`

### Step 12.1: Criar a página

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ResetPage() {
  const [sent, setSent] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center">
          <Image src="/logo/leao.png" alt="IFP" width={56} height={56} priority />
          <h1 className="mt-4 text-lg font-semibold text-stone-900">Recuperar senha</h1>
        </div>

        {sent ? (
          <p className="mt-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.
          </p>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <label className="block">
              <span className="text-xs text-stone-600">E-mail</span>
              <input
                required
                type="email"
                name="email"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Enviar link
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-stone-500">
          <Link href="/" className="hover:text-stone-900">
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
```

> A spec menciona `/reset/[token]` pra confirmar reset com token. Como o envio de email não existe ainda (Plano 8), o esqueleto não inclui a página de token nesta entrega. Adicionar comentário JSDoc no topo: `// TODO Plano 8: integrar provedor SMTP + criar /reset/[token]/page.tsx`.

### Step 12.2: Smoke browser

Abrir http://localhost:3000/reset — vê form. Submeter qualquer email — vê mensagem genérica de confirmação. Botão "Voltar" leva pra `/`.

### Step 12.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/reset/
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(reset): esqueleto de reset de senha em /reset (T12 multi-tenant)"
```

---

## Task 13: Testes e2e da matriz role × path

Cobertura dos 10 cenários funcionais da spec §8.

**Files:**

- Create: `tests/e2e/rbac-v2-multitenant.spec.ts`

### Step 13.1: Build de prod (Playwright usa)

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pkill -f 'next dev' 2>/dev/null; pkill -f 'next-server' 2>/dev/null; pnpm build"
```

Aguardar build terminar.

### Step 13.2: Criar arquivo de testes

`tests/e2e/rbac-v2-multitenant.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const SENHA = "ifp-demo-2026";

async function login(page: import("@playwright/test").Page, slug: string, email: string) {
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Multi-tenant RBAC v2", () => {
  test("landing pública / renderiza sem auth", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /quatro unidades/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /centro médico/i })).toBeVisible();
  });

  test("não autenticado em /medico → redirect /medico/login", async ({ page }) => {
    await page.goto("/medico");
    await expect(page).toHaveURL(/\/medico\/login$/);
  });

  test("Raquel (gestor:medico) loga em /medico/login → entra /medico", async ({ page }) => {
    await login(page, "medico", "raquel.barros@familiaponcio.org.br");
    await expect(page).toHaveURL(/\/medico$/);
    await expect(page.getByText("Centro Médico")).toBeVisible();
  });

  test("Raquel em /capacitacao/login → erro genérico", async ({ page }) => {
    await login(page, "capacitacao", "raquel.barros@familiaponcio.org.br");
    await expect(page.getByRole("alert")).toContainText(/não foi possível acessar/i);
  });

  test("Saulo (presidencia) em /poncio/login → entra /poncio", async ({ page }) => {
    await login(page, "poncio", "saulo@familiaponcio.org.br");
    await expect(page).toHaveURL(/\/poncio$/);
    await expect(page.getByText(/visão geral/i)).toBeVisible();
  });

  test("Saulo em /medico/login → erro genérico", async ({ page }) => {
    await login(page, "medico", "saulo@familiaponcio.org.br");
    await expect(page.getByRole("alert")).toContainText(/não foi possível acessar/i);
  });

  test("Regina (social) em /social/login → entra /social", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br");
    await expect(page).toHaveURL(/\/social$/);
  });

  test("Maria (recepcao:medico) em /social/login → erro genérico", async ({ page }) => {
    await login(page, "social", "maria.callcenter@familiaponcio.org.br");
    await expect(page.getByRole("alert")).toContainText(/não foi possível acessar/i);
  });

  test("Erick (super_admin) loga em qualquer login e acessa todas as 6 unidades", async ({
    page,
  }) => {
    await login(page, "medico", "erick.ramos@familiaponcio.org.br");
    await expect(page).toHaveURL(/\/medico$/);

    for (const slug of ["capacitacao", "esportivo", "recreativo", "poncio", "social"]) {
      await page.goto(`/${slug}`);
      await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    }
  });

  test("alias /app → redireciona pra /poncio (Erick) ou rejeita (Raquel)", async ({ page }) => {
    await login(page, "medico", "raquel.barros@familiaponcio.org.br");
    await page.goto("/app");
    await expect(page).toHaveURL("/"); // /app → /poncio → /poncio nega Raquel → /
  });
});
```

### Step 13.3: Rodar Playwright

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test:e2e -- rbac-v2-multitenant"
```

Expected: 10 testes verdes. Se falhar, abrir relatório:

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm exec playwright show-report"
```

### Step 13.4: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add tests/e2e/rbac-v2-multitenant.spec.ts
git -C "C:/Users/Administrador/ifp-connect" commit -m "test(e2e): cobertura da matriz RBAC v2 multi-tenant (T13)"
```

---

## Task 14: Cleanup final + push

### Step 14.1: Verificar que nenhum `gestor_geral` sobreviveu

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rn 'gestor_geral' src/ tests/ prisma/ 2>/dev/null | grep -v node_modules | grep -v '.next' | grep -v 'migrations/2026052812'"
```

Expected: vazio (ignorando a própria migration que dropa). Se aparecer alguma string em `seed.ts`, `rbac.ts`, `proxy.ts`, ou outro componente — esqueceu de atualizar. Corrigir e commit.

### Step 14.2: Verificar contagem de users + roles consistente

```bash
wsl -d Ubuntu -- bash -c 'docker exec ifp_postgres_dev psql -U ifp -d ifp_connect -c "SELECT (SELECT COUNT(*) FROM \"User\") AS users, (SELECT COUNT(*) FROM \"Role\") AS roles, (SELECT COUNT(*) FROM \"UserRole\") AS atribuicoes;"'
```

Expected: `9 users | 6 roles | <N atribuicoes> ` (Raquel agora tem 1 em vez de 2; resto igual).

### Step 14.3: Rodar suite completa

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e"
```

Expected: tudo verde.

### Step 14.4: Push via git nativo Windows

```bash
git -C "C:/Users/Administrador/ifp-connect" log --oneline -20
```

Confirmar os ~13 commits desta entrega + os commits da spec/research da sessão anterior.

```bash
git -C "C:/Users/Administrador/ifp-connect" push origin main
```

> Memória `feedback_wslrelay_postgres`: pushar de DENTRO do WSL trava por causa do wslrelay. Pushar do git nativo Windows resolve.

### Step 14.5: Smoke final manual

Abrir http://localhost:3000/ no browser e percorrer:

- Landing → clica "Centro Médico" → vai pra `/medico/login` com fundo azul-marinho
- Loga como Raquel → vai pra `/medico`
- Volta pra `/` → clica "Capacitação" → vai pra `/capacitacao/login` com fundo marrom-âmbar
- Loga como Luciana (`luciana@familiaponcio.org.br`) → vai pra `/capacitacao`
- Loga como Saulo em `/poncio/login` → vê dashboard executivo com 4 cards

---

## Self-Review

**1. Spec coverage:**

| Seção da spec                   | Task que cobre                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Motivação                    | (documentado no header)                                                                                                                                                                                                                                                                                                                                                                         |
| §2 Decisões fechadas            | Implícita em todas as tasks                                                                                                                                                                                                                                                                                                                                                                     |
| §3.1 Mapa de rotas              | T5 (raiz), T6 (`/[unidade]`), T7 (`/[unidade]/login`), T8 (`/social`), T9 (`/poncio`), T12 (`/reset`)                                                                                                                                                                                                                                                                                           |
| §3.2 Config `lib/unidades.ts`   | T1                                                                                                                                                                                                                                                                                                                                                                                              |
| §3.3 Gates `proxy.ts`           | T10                                                                                                                                                                                                                                                                                                                                                                                             |
| §3.4 Login                      | T7                                                                                                                                                                                                                                                                                                                                                                                              |
| §3.5 Switcher                   | T11                                                                                                                                                                                                                                                                                                                                                                                             |
| §3.6 Landing                    | T5                                                                                                                                                                                                                                                                                                                                                                                              |
| §4.1 Roles antes→depois         | T3 + T4                                                                                                                                                                                                                                                                                                                                                                                         |
| §4.2 Matriz role × path         | T1 (config), T2 (`canAccessUnidade`), T13 (e2e)                                                                                                                                                                                                                                                                                                                                                 |
| §4.3 Migração                   | T3 (Prisma) + T4 (seed)                                                                                                                                                                                                                                                                                                                                                                         |
| §5.1 Login OK                   | T7 (Step 7.4) + T13                                                                                                                                                                                                                                                                                                                                                                             |
| §5.2 Login negado outra unidade | T7 (Step 7.4) + T13                                                                                                                                                                                                                                                                                                                                                                             |
| §5.3 Login inválido             | T7 (Step 7.4)                                                                                                                                                                                                                                                                                                                                                                                   |
| §5.4 Esqueci senha              | T12 (esqueleto)                                                                                                                                                                                                                                                                                                                                                                                 |
| §5.5 Logout                     | NÃO COBERTO — depende do AppShell existente que mantém o botão. Adicionei nota: se Step 10.3 smoke falha em "logout volta pra `/<unidade>/login`", abrir sub-task.                                                                                                                                                                                                                              |
| §5.6 Switcher super_admin       | T11 + T13 (smoke)                                                                                                                                                                                                                                                                                                                                                                               |
| §6 Refactor arquivos            | T1-T12 distribuídos                                                                                                                                                                                                                                                                                                                                                                             |
| §8 Critérios de sucesso         | T13 (e2e) cobre os 10 cenários                                                                                                                                                                                                                                                                                                                                                                  |
| §10 Riscos                      | Riscos 1 (migration prod) → mitigado por T3 idempotente. Risco 2 (collision `[unidade]`) → confirmado que `[unit]` antigo em `src/app/app/[unit]/` é endereço diferente; SEM colisão. Risco 3 (placeholder confunde) → banner adicionado em T6, T8, T9. Risco 4 (vazamento super_admin) → testado em T13. Risco 5 (sessão pré-migration) → migration roda em dev DB, restart sessão necessário. |

**Logout (§5.5)** — adicionar verificação extra:

#### Step 14.6 (cleanup logout) — verificar comportamento

Logado como Raquel em `/medico`, clicar Logout. Esperado: redirect pra `/medico/login` (ideal) ou `/` (aceitável). Se vai pra `/login` antigo (rota desligada) — abrir sub-task no plano da próxima sessão.

**2. Placeholder scan:** zero "TBD"/"TODO" não-explicado. Os `TODO operacional: criar Sarah Pôncio` e `TODO Plano 8: SMTP` são pontos legitimamente deferidos com responsável e momento — não são placeholders.

**3. Type consistency:**

- `unidadeFromSlug` definida em T1, usada em T2, T6, T7, T10 ✓
- `canAccessUnidade` definida em T2, usada em T6, T7, T8, T9, T10 ✓
- `UNIDADE_SLUGS` em T1, usado em T5, T11, T13 ✓
- `RoleAceita` e `UnidadeConfig` em T1, usados em T2, T7 ✓
- Nomes de roles consistentes — `gestor_unidade` (não `gestor:medico`) em todo código que toca banco ✓

---

## Estimativa de tempo

- T1-T2: ~30 min (TDD puro, código curto)
- T3-T4: ~25 min (migration + seed + verificações SQL)
- T5: ~15 min (uma página, sem teste unitário)
- T6: ~10 min (placeholder curto)
- T7: ~45 min (maior task — shell + action + page + smoke)
- T8: ~20 min (move + gate + banner)
- T9: ~10 min (placeholder)
- T10: ~30 min (proxy + smoke matriz)
- T11: ~15 min (1 arquivo)
- T12: ~10 min (1 arquivo)
- T13: ~30 min (10 e2e tests + 1ª rodada falhando)
- T14: ~15 min (verificações + push)

**Total: ~4h30 contínuas.** Provavelmente 1 dia útil considerando interrupções e ajustes de implementação que aparecem durante TDD.
