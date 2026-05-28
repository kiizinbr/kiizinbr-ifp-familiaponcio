# Design System v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o "Neve provisório" pela identidade visual oficial do Brandbook IFP — tokens canônicos em CSS variables, componentes universais reutilizáveis (Button/Input/Card/Badge/EmptyState), filtros temáticos canônicos por unidade no login, mascote do leão em momentos cerimoniais.

**Architecture:**
- Tokens canônicos vivem em `src/app/globals.css` como CSS custom properties (formato RGB triplet pra compatibilidade Tailwind 4: `var(--ifp-X)` consumido em utility classes via `[bg-[rgb(var(--ifp-X))]/55]`).
- Componentes universais nascem em `src/components/ui/` — `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `empty-state.tsx`. Cada um com 1 responsabilidade, props tipadas, sem dependências entre eles.
- `lib/unidades.ts` recebe os hex canônicos do brandbook (substituindo os placeholders inventados em T1 da spec anterior). Campos renomeados: `corPrimariaPlaceholder → corFiltroLogin`, `fotoDronePlaceholder → fotoFundoLogin`.
- Telas existentes (landing, login catch-all, home da unidade, /social, /poncio, AppShell) recebem os novos tokens; banners "visual provisório" saem.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4 + Vitest + Playwright. Repo: `C:\Users\Administrador\ifp-connect` (= `/mnt/c/Users/Administrador/ifp-connect` em WSL).

**Spec:** `docs/superpowers/specs/2026-05-28-design-system-v2-design.md`
**Spec irmã (já entregue):** `docs/superpowers/specs/2026-05-28-acesso-multitenant-rbac-v2-design.md`
**HEAD ao começar:** `a5b3216` (commit da spec DS v2)

---

## Convenções deste plano

- Caminhos absolutos quando possível (`C:/Users/Administrador/ifp-connect/...`); relativos no resto.
- pnpm via WSL: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm <cmd>"`
- Git nativo Windows (não WSL — bug wslrelay): `git -C "C:/Users/Administrador/ifp-connect" ...`
- **Não pushe** durante o plano — push consolidado vai na T12.
- Pre-commit ritual após cada task: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`.
- Commit message: `<tipo>(escopo): descrição em pt-BR`. Sufixo "(T<N> DS v2)" pra rastrear.

---

## Task 1: Tokens canônicos em `globals.css`

Substituir o mapeamento provisório "Neve" pelos tokens do brandbook (spec §4). Inclui paleta institucional completa, filtros temáticos por unidade (mapeamento aprovado), spacing/radius/shadows/transitions canônicos. Mantém `@font-face` Garet existente e `.ifp-card` (atualizada).

**Files:**
- Modify: `src/app/globals.css`

### Step 1.1: Substituir o bloco `:root` inteiro

Abrir `src/app/globals.css`. Substituir o bloco `:root { ... }` (linhas 22-39 do arquivo atual) por:

```css
:root {
  /* ---- Brandbook IFP 2026 — paleta canônica ---- */

  /* Laranja institucional (accent principal) */
  --ifp-orange-500: 255 119 46; /* #FF772E primary action */
  --ifp-orange-700: 194 77 15;  /* #C24D0F primary hover/strong */
  --ifp-orange-900: 117 44 5;   /* #752C05 text headlines, mascote */

  /* Teal institucional (success/cuidado/info) */
  --ifp-teal-500: 16 194 187;   /* #10C2BB success state */
  --ifp-teal-700: 0 117 113;    /* #007571 success strong */

  /* Neutros (brandbook + complementos) */
  --ifp-ink: 74 74 73;          /* #4A4A49 body text (cinza institucional) */
  --ifp-canvas: 255 255 255;    /* #FFFFFF surface branco */
  --ifp-muted: 107 107 107;     /* #6B6B6B secondary text */
  --ifp-surface-50: 250 250 249;  /* #FAFAF9 page bg */
  --ifp-surface-100: 244 244 242; /* #F4F4F2 card bg sutil */
  --ifp-surface-200: 229 228 225; /* #E5E4E1 borders/dividers */

  /* Estados especiais (não-brandbook) */
  --ifp-danger: 186 26 26;      /* #BA1A1A erros */
  --ifp-warning: 180 83 9;      /* #B45309 alertas */

  /* ---- Filtros temáticos por unidade (overlay do login) ---- */
  /* Todos derivados do brandbook; mapeamento aprovado em 2026-05-28 */
  --ifp-filter-medico: 0 117 113;       /* #007571 teal escuro — saúde */
  --ifp-filter-capacitacao: 255 119 46; /* #FF772E laranja vibrante — aprendizado */
  --ifp-filter-esportivo: 194 77 15;    /* #C24D0F laranja escuro — movimento */
  --ifp-filter-recreativo: 16 194 187;  /* #10C2BB teal claro — alegria */
  --ifp-filter-poncio: 117 44 5;        /* #752C05 marrom — sobriedade executiva */
  --ifp-filter-social: 74 74 73;        /* #4A4A49 cinza — transversal */

  /* Opacidade do overlay temático sobre a foto */
  --ifp-filter-opacity: 0.55;

  /* ---- Spacing (escala 4px) ---- */
  --ifp-space-1: 0.25rem;
  --ifp-space-2: 0.5rem;
  --ifp-space-3: 0.75rem;
  --ifp-space-4: 1rem;
  --ifp-space-6: 1.5rem;
  --ifp-space-8: 2rem;
  --ifp-space-12: 3rem;
  --ifp-space-16: 4rem;
  --ifp-space-24: 6rem;

  /* ---- Radius ---- */
  --ifp-radius-sm: 6px;
  --ifp-radius-md: 10px;
  --ifp-radius-lg: 16px;
  --ifp-radius-xl: 24px;
  --ifp-radius-full: 999px;

  /* ---- Shadows ---- */
  --ifp-shadow-sm: 0 1px 2px rgb(74 74 73 / 0.04);
  --ifp-shadow-md: 0 4px 12px rgb(74 74 73 / 0.06);
  --ifp-shadow-lg: 0 8px 24px rgb(74 74 73 / 0.08);
  --ifp-shadow-xl: 0 16px 48px rgb(74 74 73 / 0.12);

  /* ---- Transitions ---- */
  --ifp-transition-fast: 120ms ease-out;
  --ifp-transition-base: 200ms ease-out;
  --ifp-transition-slow: 320ms ease-out;
}
```

### Step 1.2: Atualizar a classe `.ifp-card` para usar tokens novos

Substituir o bloco `.ifp-card { ... }` + `.ifp-card-hover:hover { ... }` por:

```css
/* Card canônico: branco, borda fina cinza, sombra suave, levanta no hover */
.ifp-card {
  background: rgb(var(--ifp-canvas));
  border: 1px solid rgb(var(--ifp-surface-200));
  border-radius: var(--ifp-radius-lg);
  box-shadow: var(--ifp-shadow-sm);
  transition:
    transform var(--ifp-transition-base),
    box-shadow var(--ifp-transition-base);
}
.ifp-card-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--ifp-shadow-md);
}
```

### Step 1.3: Verificar typecheck + smoke

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
```

Expected: tudo verde. 70/70 unit tests (não testamos CSS, só Tailwind+TS).

Smoke browser (dev server precisa estar up):
```bash
wsl -d Ubuntu -- bash -c "curl -s http://localhost:3000/ | grep -E '\\bIFP|Família Pôncio' | head -2"
```
Expected: HTML com "Instituto Família Pôncio" — landing renderiza (visual ainda usa hex hardcoded; vai mudar em T10).

### Step 1.4: Commit

```bash
git -C "C:/Users/Administrador/ifp-connect" add src/app/globals.css
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(tokens): paleta brandbook canonica + filtros tematicos + spacing/radius/shadows (T1 DS v2)"
```

---

## Task 2: `lib/unidades.ts` — hex canônicos + renomeio de campos

Substituir os hex placeholders que Claude inventou na T1 da spec anterior pelos canônicos do brandbook. Renomear `corPrimariaPlaceholder → corFiltroLogin` (genérico, sem o sufixo "placeholder") e `fotoDronePlaceholder → fotoFundoLogin` (já que pode ser foto drone OU foto institucional).

**Files:**
- Modify: `src/lib/unidades.ts`
- Modify: `tests/unit/unidades.test.ts`

### Step 2.1: Atualizar os tipos

Em `src/lib/unidades.ts`, substituir o bloco `export interface UnidadeConfig` por:

```ts
export interface UnidadeConfig {
  slug: UnidadeSlug;
  nome: string;
  /** Hex do filtro temático aplicado como overlay sobre a foto de fundo do login. */
  corFiltroLogin: string;
  /** Path em /public da foto de fundo (drone ou institucional). null = usa gradiente. */
  fotoFundoLogin: string | null;
  /** Gradiente CSS fallback quando fotoFundoLogin é null. */
  gradienteFallback: string;
  rolesAceitas: readonly RoleAssignment[];
  cidadaoScope: "self" | "all";
}
```

### Step 2.2: Atualizar o objeto `UNIDADES` com os hex canônicos

Substituir as 6 entradas de `UNIDADES` por (mantendo a ordem):

```ts
export const UNIDADES: Record<UnidadeSlug, UnidadeConfig> = {
  medico: {
    slug: "medico",
    nome: "Centro Médico",
    corFiltroLogin: "#007571", // teal escuro — saúde/cuidado
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #007571, #10C2BB)",
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
    corFiltroLogin: "#FF772E", // laranja vibrante — aprendizado/energia
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #FF772E, #C24D0F)",
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
    corFiltroLogin: "#C24D0F", // laranja escuro — movimento
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #C24D0F, #752C05)",
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
    corFiltroLogin: "#10C2BB", // teal claro — alegria/leveza
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #10C2BB, #007571)",
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
    corFiltroLogin: "#752C05", // marrom — sobriedade
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #752C05, #4A4A49)",
    rolesAceitas: [{ name: "presidencia", unitScope: null }],
    cidadaoScope: "all",
  },
  social: {
    slug: "social",
    nome: "Serviço Social",
    corFiltroLogin: "#4A4A49", // cinza — transversal
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #4A4A49, #6B6B6B)",
    rolesAceitas: [{ name: "social", unitScope: null }],
    cidadaoScope: "all",
  },
};
```

### Step 2.3: Atualizar testes em `tests/unit/unidades.test.ts`

O teste atual valida `corPrimariaPlaceholder` e `gradientePlaceholder`. Atualizar os nomes:

Localizar o bloco:
```ts
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
```

Substituir por:
```ts
it("UNIDADES tem entrada para cada slug com campos obrigatórios", () => {
  for (const slug of UNIDADE_SLUGS) {
    const u = UNIDADES[slug];
    expect(u.slug).toBe(slug);
    expect(u.nome).toBeTruthy();
    expect(u.corFiltroLogin).toMatch(/^#[0-9a-f]{6}$/i);
    expect(u.gradienteFallback).toMatch(/linear-gradient/);
    expect(Array.isArray(u.rolesAceitas)).toBe(true);
  }
});
```

Adicionar 1 teste novo confirmando o mapeamento canônico:
```ts
it("filtros temáticos seguem mapeamento canônico do brandbook", () => {
  expect(UNIDADES.medico.corFiltroLogin).toBe("#007571");
  expect(UNIDADES.capacitacao.corFiltroLogin).toBe("#FF772E");
  expect(UNIDADES.esportivo.corFiltroLogin).toBe("#C24D0F");
  expect(UNIDADES.recreativo.corFiltroLogin).toBe("#10C2BB");
  expect(UNIDADES.poncio.corFiltroLogin).toBe("#752C05");
  expect(UNIDADES.social.corFiltroLogin).toBe("#4A4A49");
});
```

### Step 2.4: Verificar consumidores quebrados

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rn 'corPrimariaPlaceholder\\|fotoDronePlaceholder\\|gradientePlaceholder' src/ tests/ 2>/dev/null | grep -v node_modules | grep -v '.next'"
```

Esperado: ocorrências em `src/components/unidade-login-shell.tsx`, `src/app/page.tsx`, `src/app/[unidade]/page.tsx`, `src/app/poncio/page.tsx`. Atualizar cada uma:

- `corPrimariaPlaceholder` → `corFiltroLogin`
- `fotoDronePlaceholder` → `fotoFundoLogin`
- `gradientePlaceholder` → `gradienteFallback`

### Step 2.5: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
```

Expected: 71/71 (era 70 + 1 novo teste).

```bash
git -C "C:/Users/Administrador/ifp-connect" add src/lib/unidades.ts tests/unit/unidades.test.ts src/components/unidade-login-shell.tsx src/app/page.tsx "src/app/[unidade]/page.tsx" src/app/poncio/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(unidades): hex canonicos do brandbook + corFiltroLogin/fotoFundoLogin (T2 DS v2)"
```

---

## Task 3: `UnidadeLoginShell` — filtros canônicos + tokens

Atualizar o shell de login pra usar:
- Overlay com `corFiltroLogin` da unidade @ 55% opacidade
- Card central com tokens (`--ifp-radius-xl`, `--ifp-shadow-xl`)
- Nome da unidade em `Garet Bold` cor `--ifp-orange-900`
- Mascote já está usando `/logo/ifp-symbol.png` (mantém)

**Files:**
- Modify: `src/components/unidade-login-shell.tsx`

### Step 3.1: Reescrever o componente

Substituir o conteúdo de `src/components/unidade-login-shell.tsx` por:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Route } from "next";
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

  const background = unidade.fotoFundoLogin
    ? `url(${unidade.fotoFundoLogin})`
    : unidade.gradienteFallback;

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
          background: unidade.corFiltroLogin,
          opacity: "var(--ifp-filter-opacity)",
        }}
        aria-hidden
      />

      <div
        className="relative z-10 w-full max-w-sm bg-white/95 p-8 backdrop-blur"
        style={{
          borderRadius: "var(--ifp-radius-xl)",
          boxShadow: "var(--ifp-shadow-xl)",
        }}
      >
        <div className="flex flex-col items-center">
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={56} height={56} priority />
          <h1
            className="mt-4 text-lg font-bold"
            style={{ color: "rgb(var(--ifp-orange-900))" }}
          >
            {unidade.nome}
          </h1>
          <p
            className="mt-1 text-xs uppercase tracking-wider"
            style={{ color: "rgb(var(--ifp-muted))" }}
          >
            Instituto Família Pôncio
          </p>
        </div>

        <form action={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              E-mail
            </span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "rgb(var(--ifp-canvas))",
                border: "1px solid rgb(var(--ifp-surface-200))",
                borderRadius: "var(--ifp-radius-sm)",
                color: "rgb(var(--ifp-ink))",
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              Senha
            </span>
            <input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "rgb(var(--ifp-canvas))",
                border: "1px solid rgb(var(--ifp-surface-200))",
                borderRadius: "var(--ifp-radius-sm)",
                color: "rgb(var(--ifp-ink))",
              }}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="px-3 py-2 text-sm"
              style={{
                backgroundColor: "rgb(var(--ifp-danger) / 0.08)",
                color: "rgb(var(--ifp-danger))",
                borderRadius: "var(--ifp-radius-sm)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "rgb(var(--ifp-orange-500))",
              borderRadius: "var(--ifp-radius-md)",
            }}
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div
          className="mt-6 flex items-center justify-between text-xs"
          style={{ color: "rgb(var(--ifp-muted))" }}
        >
          <Link
            href={"/reset" as Route}
            className="hover:text-stone-900"
            style={{ transition: "color var(--ifp-transition-fast)" }}
          >
            Esqueci a senha
          </Link>
          <Link
            href={"/" as Route}
            className="hover:text-stone-900"
            style={{ transition: "color var(--ifp-transition-fast)" }}
          >
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
```

### Step 3.2: Smoke browser

Dev server up:
```bash
wsl -d Ubuntu -- bash -c "ss -tlnp 2>/dev/null | grep -E ':300[0-9]' || (cd /mnt/c/Users/Administrador/ifp-connect && nohup pnpm dev > /tmp/next-dev.log 2>&1 &)"
sleep 30
wsl -d Ubuntu -- bash -c "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/medico/login"
```

Expected: 200.

```bash
wsl -d Ubuntu -- bash -c "curl -s http://localhost:3000/medico/login | grep -E 'rgb\\(var\\(--ifp|#007571' | head -3"
```

Expected: ocorrências usando os tokens canônicos / hex correto.

### Step 3.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/unidade-login-shell.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(login-shell): tokens canonicos + filtros tematicos via CSS vars (T3 DS v2)"
```

---

## Task 4: Button universal `src/components/ui/button.tsx`

Componente Button reutilizável com 4 variants (primary/secondary/ghost/danger) e 3 sizes (sm/md/lg).

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `tests/unit/button.test.tsx`

### Step 4.1: Write failing test

Create `tests/unit/button.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renderiza children", () => {
    render(<Button>Clique</Button>);
    expect(screen.getByRole("button", { name: "Clique" })).toBeInTheDocument();
  });

  it("aplica variant primary por padrão (background laranja)", () => {
    render(<Button>Ok</Button>);
    const btn = screen.getByRole("button");
    expect(btn.style.backgroundColor).toContain("var(--ifp-orange-500)");
  });

  it("variant secondary tem borda no orange-900", () => {
    render(<Button variant="secondary">Ok</Button>);
    const btn = screen.getByRole("button");
    expect(btn.style.borderColor).toContain("var(--ifp-orange-900)");
  });

  it("variant danger tem background ifp-danger", () => {
    render(<Button variant="danger">Excluir</Button>);
    const btn = screen.getByRole("button");
    expect(btn.style.backgroundColor).toContain("var(--ifp-danger)");
  });

  it("disabled aplica aria-disabled e classe", () => {
    render(<Button disabled>Ok</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("aceita ref forwarded", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ok</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

> **Atenção:** se `@testing-library/react` não estiver instalado, instalar agora antes de continuar:
> ```bash
> wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm add -D @testing-library/react @testing-library/jest-dom jsdom"
> ```
> Adicionar `test: { environment: 'jsdom' }` em `vitest.config.ts` se ainda não tiver. Se a stack atual usar outro driver de teste de componente (ou nenhum), reportar `NEEDS_CONTEXT` em vez de instalar (controller decide).

### Step 4.2: Verify it fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- button"
```

Expected: FAIL (módulo não existe).

### Step 4.3: Implementação

Create `src/components/ui/button.tsx`:

```tsx
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary: {
    backgroundColor: "rgb(var(--ifp-orange-500))",
    color: "rgb(var(--ifp-canvas))",
  },
  secondary: {
    backgroundColor: "transparent",
    color: "rgb(var(--ifp-orange-900))",
    border: "1.5px solid rgb(var(--ifp-orange-900))",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "rgb(var(--ifp-ink))",
  },
  danger: {
    backgroundColor: "rgb(var(--ifp-danger))",
    color: "rgb(var(--ifp-canvas))",
  },
};

const SIZE_STYLES: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: "13px" },
  md: { padding: "10px 16px", fontSize: "14px" },
  lg: { padding: "12px 20px", fontSize: "16px" },
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", style, className = "", children, ...rest },
  ref,
) {
  const composedStyle: CSSProperties = {
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    fontWeight: 700,
    borderRadius: "var(--ifp-radius-md)",
    transition: "opacity var(--ifp-transition-fast)",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <button
      ref={ref}
      style={composedStyle}
      className={`font-bold ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
```

### Step 4.4: Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- button"
```

Expected: 6/6 testes verdes.

### Step 4.5: Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/ui/button.tsx tests/unit/button.test.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(ui): Button universal com 4 variants e 3 sizes (T4 DS v2)"
```

---

## Task 5: Input universal `src/components/ui/input.tsx`

Componente Input com label opcional, error state, useId pra acessibilidade.

**Files:**
- Create: `src/components/ui/input.tsx`
- Create: `tests/unit/input.test.tsx`

### Step 5.1: Write failing test

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renderiza input padrão sem label", () => {
    render(<Input placeholder="ex" />);
    expect(screen.getByPlaceholderText("ex")).toBeInTheDocument();
  });

  it("renderiza label + input associados via id", () => {
    render(<Input label="E-mail" />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toBeInTheDocument();
    expect(input.id).toBeTruthy();
  });

  it("renderiza mensagem de erro quando error é fornecido", () => {
    render(<Input label="E-mail" error="Inválido" />);
    expect(screen.getByText("Inválido")).toBeInTheDocument();
  });

  it("input com error tem borda ifp-danger", () => {
    render(<Input label="X" error="ruim" />);
    const input = screen.getByLabelText("X") as HTMLInputElement;
    expect(input.style.borderColor).toContain("var(--ifp-danger)");
  });

  it("aceita type=password", () => {
    render(<Input label="Senha" type="password" />);
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });
});
```

### Step 5.2: Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- input"
```

Expected: FAIL.

### Step 5.3: Implementação

Create `src/components/ui/input.tsx`:

```tsx
import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, CSSProperties } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id: providedId, style, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    color: "rgb(var(--ifp-ink))",
    backgroundColor: "rgb(var(--ifp-canvas))",
    border: error
      ? "1px solid rgb(var(--ifp-danger))"
      : "1px solid rgb(var(--ifp-surface-200))",
    borderRadius: "var(--ifp-radius-sm)",
    outline: "none",
    transition: "border-color var(--ifp-transition-fast)",
    ...style,
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-sm"
          style={{ color: "rgb(var(--ifp-muted))" }}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        style={inputStyle}
        className={className}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      />
      {error && (
        <span
          role="alert"
          className="text-xs"
          style={{ color: "rgb(var(--ifp-danger))" }}
        >
          {error}
        </span>
      )}
    </div>
  );
});
```

### Step 5.4: Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- input"
```

Expected: 5/5.

### Step 5.5: Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/ui/input.tsx tests/unit/input.test.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(ui): Input universal com label + error + useId (T5 DS v2)"
```

---

## Task 6: Card universal `src/components/ui/card.tsx`

Card reutilizável com variant default e outline-accent (border-top colorida).

**Files:**
- Create: `src/components/ui/card.tsx`
- Create: `tests/unit/card.test.tsx`

### Step 6.1: Failing test

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/card";

describe("Card", () => {
  it("renderiza children", () => {
    render(<Card>Conteúdo</Card>);
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });

  it("default tem background canvas + radius lg", () => {
    render(<Card>x</Card>);
    const card = screen.getByText("x").parentElement!;
    expect(card.style.backgroundColor).toContain("var(--ifp-canvas)");
    expect(card.style.borderRadius).toContain("var(--ifp-radius-lg)");
  });

  it("accent='medico' aplica border-top com cor do filtro medico", () => {
    render(<Card accent="medico">x</Card>);
    const card = screen.getByText("x").parentElement!;
    expect(card.style.borderTop).toContain("var(--ifp-filter-medico)");
  });

  it("hoverable adiciona transição de shadow", () => {
    render(<Card hoverable>x</Card>);
    const card = screen.getByText("x").parentElement!;
    expect(card.className).toContain("hover:");
  });
});
```

### Step 6.2: Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- card"
```

Expected: FAIL.

### Step 6.3: Implementação

```tsx
import type { CSSProperties, HTMLAttributes } from "react";
import type { UnidadeSlug } from "@/lib/unidades";

interface Props extends HTMLAttributes<HTMLDivElement> {
  accent?: UnidadeSlug;
  hoverable?: boolean;
}

export function Card({ accent, hoverable, style, className = "", children, ...rest }: Props) {
  const baseStyle: CSSProperties = {
    backgroundColor: "rgb(var(--ifp-canvas))",
    border: "1px solid rgb(var(--ifp-surface-200))",
    borderRadius: "var(--ifp-radius-lg)",
    boxShadow: "var(--ifp-shadow-sm)",
    padding: "var(--ifp-space-6)",
    transition: "box-shadow var(--ifp-transition-base), transform var(--ifp-transition-base)",
    ...(accent
      ? { borderTop: `4px solid rgb(var(--ifp-filter-${accent}))` }
      : {}),
    ...style,
  };

  const hoverClass = hoverable ? "hover:-translate-y-0.5 hover:shadow-md" : "";

  return (
    <div style={baseStyle} className={`${hoverClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

### Step 6.4: Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- card"
```

Expected: 4/4.

### Step 6.5: Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/ui/card.tsx tests/unit/card.test.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(ui): Card universal com accent por unidade (T6 DS v2)"
```

---

## Task 7: Badge universal `src/components/ui/badge.tsx`

Badge com 5 variants (default/success/warning/danger/info).

**Files:**
- Create: `src/components/ui/badge.tsx`
- Create: `tests/unit/badge.test.tsx`

### Step 7.1: Failing test

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renderiza children em maiúsculo", () => {
    render(<Badge>ativo</Badge>);
    const el = screen.getByText("ativo");
    expect(el.style.textTransform).toBe("uppercase");
  });

  it("default usa surface-100 + muted", () => {
    render(<Badge>x</Badge>);
    const el = screen.getByText("x");
    expect(el.style.backgroundColor).toContain("var(--ifp-surface-100)");
    expect(el.style.color).toContain("var(--ifp-muted)");
  });

  it("success usa teal", () => {
    render(<Badge variant="success">x</Badge>);
    const el = screen.getByText("x");
    expect(el.style.color).toContain("var(--ifp-teal-700)");
  });

  it("danger usa ifp-danger", () => {
    render(<Badge variant="danger">x</Badge>);
    const el = screen.getByText("x");
    expect(el.style.color).toContain("var(--ifp-danger)");
  });
});
```

### Step 7.2: Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- badge"
```

### Step 7.3: Implementação

```tsx
import type { CSSProperties, HTMLAttributes } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, CSSProperties> = {
  default: {
    backgroundColor: "rgb(var(--ifp-surface-100))",
    color: "rgb(var(--ifp-muted))",
  },
  success: {
    backgroundColor: "rgb(var(--ifp-teal-500) / 0.15)",
    color: "rgb(var(--ifp-teal-700))",
  },
  warning: {
    backgroundColor: "rgb(var(--ifp-orange-500) / 0.15)",
    color: "rgb(var(--ifp-warning))",
  },
  danger: {
    backgroundColor: "rgb(var(--ifp-danger) / 0.12)",
    color: "rgb(var(--ifp-danger))",
  },
  info: {
    backgroundColor: "rgb(var(--ifp-orange-900) / 0.10)",
    color: "rgb(var(--ifp-orange-900))",
  },
};

export function Badge({ variant = "default", style, className = "", children, ...rest }: Props) {
  const composedStyle: CSSProperties = {
    ...VARIANTS[variant],
    padding: "2px 8px",
    borderRadius: "var(--ifp-radius-full)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    display: "inline-block",
    ...style,
  };

  return (
    <span style={composedStyle} className={className} {...rest}>
      {children}
    </span>
  );
}
```

### Step 7.4: Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- badge"
```

Expected: 4/4.

### Step 7.5: Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/ui/badge.tsx tests/unit/badge.test.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(ui): Badge universal com 5 variants (T7 DS v2)"
```

---

## Task 8: EmptyState universal `src/components/ui/empty-state.tsx`

EmptyState com mascote, título, descrição, CTA opcional.

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Create: `tests/unit/empty-state.test.tsx`

### Step 8.1: Failing test

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renderiza título e descrição", () => {
    render(<EmptyState titulo="Sem cidadãos" descricao="Cadastre o primeiro" />);
    expect(screen.getByText("Sem cidadãos")).toBeInTheDocument();
    expect(screen.getByText("Cadastre o primeiro")).toBeInTheDocument();
  });

  it("inclui mascote por padrão (img alt=IFP)", () => {
    render(<EmptyState titulo="x" descricao="y" />);
    expect(screen.getByAltText("IFP")).toBeInTheDocument();
  });

  it("renderiza CTA quando fornecido", () => {
    render(
      <EmptyState
        titulo="x"
        descricao="y"
        cta={<button type="button">Ação</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument();
  });
});
```

### Step 8.2: Verify fails

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- empty-state"
```

### Step 8.3: Implementação

```tsx
import Image from "next/image";
import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descricao: string;
  cta?: ReactNode;
}

export function EmptyState({ titulo, descricao, cta }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "var(--ifp-space-12) var(--ifp-space-4)" }}
    >
      <Image
        src="/logo/ifp-symbol.png"
        alt="IFP"
        width={96}
        height={96}
        style={{ opacity: 0.3 }}
      />
      <h3
        className="mt-6 text-lg font-bold"
        style={{ color: "rgb(var(--ifp-ink))" }}
      >
        {titulo}
      </h3>
      <p
        className="mt-2 max-w-xs text-sm"
        style={{ color: "rgb(var(--ifp-muted))" }}
      >
        {descricao}
      </p>
      {cta && <div style={{ marginTop: "var(--ifp-space-6)" }}>{cta}</div>}
    </div>
  );
}
```

### Step 8.4: Verify passes

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm test -- empty-state"
```

Expected: 3/3.

### Step 8.5: Commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/ui/empty-state.tsx tests/unit/empty-state.test.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "feat(ui): EmptyState universal com mascote (T8 DS v2)"
```

---

## Task 9: AppShell usa tokens canônicos

Atualizar `src/components/app-shell.tsx` pra usar os novos tokens (paleta brandbook + radius + shadow + Garet pesos). Substituir cores hex hardcoded.

**Files:**
- Modify: `src/components/app-shell.tsx`

### Step 9.1: Localizar usos de hex hardcoded

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -nE '#[0-9a-fA-F]{6}|rgb\\(' src/components/app-shell.tsx"
```

Pontos a trocar:
- `#b0a99c` (label "Unidades") → `var(--ifp-muted)`
- `--ifp-ink` direto via Tailwind arbitrary → manter ✓
- Sidebar bg `bg-white/70` → `bg-white/85` + `backdrop-blur-xl` (manter pattern, fica)
- Header avatar bg `bg-[rgb(var(--ifp-ink))]` → mantém (já usa token)
- Border `border-r border-black/[0.07]` → manter (sutil)

### Step 9.2: Editar trechos

Abrir `src/components/app-shell.tsx`. Localizar e substituir:

```tsx
// ANTES:
<p className="mt-6 mb-2 px-3 text-[11px] font-bold text-[#b0a99c]">Unidades</p>

// DEPOIS:
<p
  className="mt-6 mb-2 px-3 text-[11px] font-bold uppercase tracking-wider"
  style={{ color: "rgb(var(--ifp-muted))" }}
>
  Unidades
</p>
```

Localizar a área `<aside>` e atualizar `bg-white/70` → `bg-white/85`. Substituir `border-black/[0.07]` por `border-[rgb(var(--ifp-surface-200))]`.

```tsx
// ANTES (linha ~40):
<aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-black/[0.07] bg-white/70 px-4 py-7 backdrop-blur-xl">

// DEPOIS:
<aside
  className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-white/85 px-4 py-7 backdrop-blur-xl"
  style={{ borderRight: "1px solid rgb(var(--ifp-surface-200))" }}
>
```

Localizar o nome "IFP Connect" do header e aplicar Garet Heavy via `font-bold` (já está). Confirmar visualmente.

### Step 9.3: Smoke

Dev server up. Logar via UI manual (ou usar curl autenticado), verificar visual do sidebar via screenshot ou inspecionando HTML:

```bash
wsl -d Ubuntu -- bash -c "curl -s http://localhost:3000/medico/login | grep -E 'rgb\\(var\\(--ifp-surface-200\\)\\)' | head -1"
```

Expected: encontra a referência ao token.

### Step 9.4: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/components/app-shell.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "refactor(app-shell): usar tokens canonicos brandbook (T9 DS v2)"
```

---

## Task 10: Landing `/` usa tokens + mascote 48×48

Atualizar `src/app/page.tsx` pra consumir tokens canônicos. Mascote 48×48 já está; manter. Substituir cores Tailwind genéricas (`text-stone-900`, `border-stone-200`) por tokens onde fizer sentido pro brand.

**Files:**
- Modify: `src/app/page.tsx`

### Step 10.1: Reescrever os pontos visuais

Abrir `src/app/page.tsx`. Manter estrutura e substituir os elementos visuais:

```tsx
// Substituir o header inteiro:
<header
  className="mx-auto flex max-w-5xl items-center justify-between px-6"
  style={{ padding: "var(--ifp-space-8) var(--ifp-space-6)" }}
>
  <div className="flex items-center gap-3">
    <Image src="/logo/ifp-symbol.png" alt="IFP" width={48} height={48} priority />
    <span
      className="text-lg font-bold tracking-tight"
      style={{ color: "rgb(var(--ifp-ink))" }}
    >
      Instituto Família Pôncio
    </span>
  </div>
  <Link
    href={"/poncio/login" as Route}
    className="text-sm transition-colors hover:opacity-70"
    style={{ color: "rgb(var(--ifp-muted))" }}
  >
    Acesso executivo
  </Link>
</header>

// Substituir o hero (section com "Quatro unidades. Um propósito."):
<section
  className="mx-auto max-w-5xl"
  style={{ padding: "var(--ifp-space-12) var(--ifp-space-6)" }}
>
  <h1
    className="text-4xl font-bold tracking-tight"
    style={{ color: "rgb(var(--ifp-orange-900))" }}
  >
    Quatro unidades. Um propósito.
  </h1>
  <p
    className="mt-4 max-w-2xl text-lg"
    style={{ color: "rgb(var(--ifp-ink))" }}
  >
    O Instituto Família Pôncio atende moradores de Duque de Caxias através de
    quatro frentes: saúde, educação, esporte e recreação infantil.
  </p>
</section>

// Substituir os cards das unidades:
{UNIDADES_PUBLICAS.map((slug) => {
  const u = UNIDADES[slug];
  return (
    <Link
      key={slug}
      href={`/${slug}/login` as Route}
      className="group transition-all hover:-translate-y-0.5"
      style={{
        padding: "var(--ifp-space-6)",
        backgroundColor: "rgb(var(--ifp-canvas))",
        border: "1px solid rgb(var(--ifp-surface-200))",
        borderTop: `4px solid ${u.corFiltroLogin}`,
        borderRadius: "var(--ifp-radius-lg)",
        boxShadow: "var(--ifp-shadow-sm)",
        transition: "box-shadow var(--ifp-transition-base), transform var(--ifp-transition-base)",
      }}
    >
      <h2
        className="text-xl font-bold"
        style={{ color: "rgb(var(--ifp-ink))" }}
      >
        {u.nome}
      </h2>
      <p
        className="mt-2 text-sm"
        style={{ color: "rgb(var(--ifp-muted))" }}
      >
        Acesso da equipe da unidade
      </p>
      <span
        className="mt-4 inline-block text-sm font-bold transition-colors"
        style={{ color: "rgb(var(--ifp-orange-700))" }}
      >
        Entrar →
      </span>
    </Link>
  );
})}

// Substituir footer:
<footer
  className="border-t py-8 text-center text-xs"
  style={{
    borderColor: "rgb(var(--ifp-surface-200))",
    color: "rgb(var(--ifp-muted))",
  }}
>
  © {new Date().getFullYear()} Instituto Família Pôncio · Duque de Caxias, RJ
</footer>
```

> Observação: a importação `Route` continua necessária. A variável `UNIDADES_PUBLICAS` continua igual. O field `u.corFiltroLogin` substitui o antigo `u.corPrimariaPlaceholder` (já tratado em T2).

### Step 10.2: Smoke

```bash
wsl -d Ubuntu -- bash -c "curl -s http://localhost:3000/ | grep -E '(rgb\\(var\\(--ifp|#FF772E|#007571)' | head -3"
```

Expected: ocorrências dos tokens.

### Step 10.3: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add src/app/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "refactor(landing): aplicar tokens canonicos do brandbook (T10 DS v2)"
```

---

## Task 11: Páginas placeholder (`/[unidade]`, `/social`, `/poncio`) — tokens + remover banner provisório

Aplicar tokens nas 3 telas-placeholder e **remover o banner amarelo "visual provisório"** de todas.

**Files:**
- Modify: `src/app/[unidade]/page.tsx`
- Modify: `src/app/social/page.tsx`
- Modify: `src/app/poncio/page.tsx`

### Step 11.1: `/[unidade]/page.tsx`

Abrir o arquivo. Localizar e substituir o componente render:

```tsx
return (
  <main
    className="min-h-screen"
    style={{
      backgroundColor: "rgb(var(--ifp-surface-50))",
      padding: "var(--ifp-space-12)",
    }}
  >
    <div
      className="mx-auto max-w-3xl"
      style={{
        backgroundColor: "rgb(var(--ifp-canvas))",
        border: "1px solid rgb(var(--ifp-surface-200))",
        borderLeft: `6px solid ${unidade.corFiltroLogin}`,
        borderRadius: "var(--ifp-radius-lg)",
        boxShadow: "var(--ifp-shadow-sm)",
        padding: "var(--ifp-space-8)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider"
        style={{ color: "rgb(var(--ifp-muted))" }}
      >
        Unidade
      </p>
      <h1
        className="mt-2 text-3xl font-bold"
        style={{ color: "rgb(var(--ifp-orange-900))" }}
      >
        {unidade.nome}
      </h1>
      <p className="mt-4" style={{ color: "rgb(var(--ifp-ink))" }}>
        Bem-vindo, {session.user.name ?? session.user.email}.
      </p>
    </div>
  </main>
);
```

(O banner amarelo "Visual provisório — aguardando Design System v2..." sai.)

### Step 11.2: `/social/page.tsx`

Abrir. **Remover** o bloco do banner amarelo:
```tsx
// REMOVER:
<div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
  Visual provisório — aguardando Design System v2.
</div>
```

Atualizar o resto do JSX pra consumir tokens canônicos do mesmo estilo da `[unidade]/page.tsx` acima. Se o arquivo tiver muito conteúdo legado (vagas, triagem, etc.), focar apenas no shell visual (cores de header/cards) — não refatorar lógica.

### Step 11.3: `/poncio/page.tsx`

Abrir. Remover banner. Substituir cores hardcoded:

```tsx
return (
  <main
    className="min-h-screen"
    style={{
      backgroundColor: "rgb(var(--ifp-surface-50))",
      padding: "var(--ifp-space-12)",
    }}
  >
    <div className="mx-auto max-w-5xl">
      <p
        className="text-xs uppercase tracking-wider"
        style={{ color: "rgb(var(--ifp-muted))" }}
      >
        Pôncio Executivo
      </p>
      <h1
        className="mt-2 text-3xl font-bold"
        style={{ color: "rgb(var(--ifp-orange-900))" }}
      >
        Visão geral das unidades
      </h1>
      <p className="mt-2" style={{ color: "rgb(var(--ifp-ink))" }}>
        Bem-vindo, {session.user.name ?? session.user.email}.
      </p>

      <div
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {UNIDADES_OPERACIONAIS.map((slug) => {
          const u = UNIDADES[slug];
          return (
            <div
              key={slug}
              style={{
                backgroundColor: "rgb(var(--ifp-canvas))",
                border: "1px solid rgb(var(--ifp-surface-200))",
                borderTop: `4px solid ${u.corFiltroLogin}`,
                borderRadius: "var(--ifp-radius-md)",
                boxShadow: "var(--ifp-shadow-sm)",
                padding: "var(--ifp-space-6)",
              }}
            >
              <h2 className="font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
                {u.nome}
              </h2>
              <p
                className="mt-2 text-sm"
                style={{ color: "rgb(var(--ifp-muted))" }}
              >
                Indicadores serão exibidos aqui.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  </main>
);
```

### Step 11.4: Smoke das 3 páginas

```bash
wsl -d Ubuntu -- bash -c "
  for path in /medico /capacitacao /poncio /social; do
    curl -s -o /dev/null -w \"\$path=%{http_code}\\n\" http://localhost:3000\$path
  done
"
```

Expected: todos 307 sem sessão (gates redirecionam pra login). Smoke do banner removido: depois de logar manualmente, confirmar visualmente que o banner amarelo não aparece mais.

### Step 11.5: Pre-commit + commit

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm typecheck && pnpm lint && pnpm test"
git -C "C:/Users/Administrador/ifp-connect" add "src/app/[unidade]/page.tsx" src/app/social/page.tsx src/app/poncio/page.tsx
git -C "C:/Users/Administrador/ifp-connect" commit -m "refactor(placeholders): tokens canonicos + remove banner provisorio (T11 DS v2)"
```

---

## Task 12: Cleanup + push final

Verificação final e push consolidado.

### Step 12.1: Grep de hex hardcoded antigos que sobreviveram

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rnE '#1e3a8a|#7c2d12|#14532d|#5b21b6|#3f1d0a|#6d28d9' src/ 2>/dev/null | grep -v node_modules | grep -v '.next'"
```

Os 6 hex acima eram os PLACEHOLDERS inventados pelo Claude em T1 da spec anterior. Se ainda aparecerem em `src/`, são vestígios — remover/substituir pelo token correto.

Expected: vazio.

### Step 12.2: Verificar todos os "corPrimariaPlaceholder", "fotoDronePlaceholder", "gradientePlaceholder" sumiram

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rnE 'corPrimariaPlaceholder|fotoDronePlaceholder|gradientePlaceholder' src/ tests/ 2>/dev/null | grep -v node_modules | grep -v '.next'"
```

Expected: vazio.

### Step 12.3: Verificar banner provisório sumiu

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && grep -rn 'Visual provisório' src/ 2>/dev/null | grep -v node_modules"
```

Expected: vazio.

### Step 12.4: Suite completa

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test"
```

Expected: tudo verde. ~80+ unit tests (era 70; T2 adicionou 1; T4-T8 adicionaram ~22 testes de componentes).

E2e:
```bash
wsl -d Ubuntu -- bash -c "pkill -f 'next dev' 2>/dev/null; pkill -f 'next-server' 2>/dev/null; sleep 2"
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm build && pnpm test:e2e -- rbac-v2-multitenant"
```

Expected: 11/11 e2e da spec anterior continuam verdes (DS v2 não muda comportamento funcional).

### Step 12.5: Push

```bash
git -C "C:/Users/Administrador/ifp-connect" log --oneline a5b3216..HEAD
```

Expected: ~12 commits T1-T12.

```bash
git -C "C:/Users/Administrador/ifp-connect" push origin main
```

### Step 12.6: Confirmar

```bash
git -C "C:/Users/Administrador/ifp-connect" status
```

Expected: working tree clean, branch in sync com origin/main.

---

## Self-Review

**1. Spec coverage:**

| Seção da spec | Task que cobre |
|---|---|
| §1 Motivação | (header do plano) |
| §2 Decisões fechadas | implícito em todas |
| §3 Mapeamento filtros | T2 (lib/unidades.ts) + T1 (globals filter vars) |
| §4.1 Paleta institucional | T1 |
| §4.2 Filtros temáticos | T1 + T2 |
| §4.3 Tipografia Garet | T1 (font-face existente) + Step 9.2 (Garet Heavy no AppShell) |
| §4.4 Spacing | T1 |
| §4.5 Radius | T1 |
| §4.6 Shadows | T1 |
| §4.7 Transitions | T1 |
| §5.1 Botão variants | T4 |
| §5.2 Input/Select/Textarea | T5 (Input). Select/Textarea ficam de fora desta entrega — adicionar no roadmap futuro. |
| §5.3 Card | T6 |
| §5.4 Badge | T7 |
| §5.5 AppShell | T9 |
| §5.6 UnidadeLoginShell | T3 |
| §5.7 EmptyState | T8 |
| §6 Mascote (usos permitidos) | T8 (EmptyState), Step 10.1 (landing), T3 (login). Telas 404/500 + certificado ficam pra spec futura — listadas em §9 deferidas. |
| §7 Verticalização | Esta spec NÃO entrega (§7 explícito). Sem task. |
| §8 Telas que migram | T1, T2, T3, T9, T10, T11 |
| §10 Critérios sucesso | T12 final + cada task individual |

**Gaps assumidos como aceitáveis:**
- Select/Textarea components não criados (Input cobre 80% dos casos)
- Página 404/500 com mascote — fora desta entrega
- Certificado cerimonial com mascote — fora desta entrega (depende de Plano Capacitação)

**2. Placeholder scan:** Não há "TBD", "TODO", "implementar depois". Os comentários `// TODO operacional` na spec/seed são pra Erick (pegar fontes Garet, fotos drone) — operacionais, não plan failures.

**3. Type consistency:**
- `corFiltroLogin` consistente em T2, T3, T10, T11 ✓
- `fotoFundoLogin` consistente em T2, T3 ✓
- `gradienteFallback` consistente em T2, T3 ✓
- `UnidadeSlug` consistente em T1, T6, T11 ✓
- Tokens CSS `--ifp-orange-500`, `--ifp-filter-medico` etc. consistentes em todas as tasks ✓

---

## Estimativa

- T1: ~15 min (mecânico)
- T2: ~20 min (3 testes + 4 arquivos consumidores)
- T3: ~25 min (reescrita do shell)
- T4-T8: ~25 min cada (5 × 25 = ~2h)
- T9: ~20 min
- T10: ~20 min
- T11: ~30 min (3 arquivos)
- T12: ~15 min

**Total ~4h30 contínuas.** ~1 dia útil considerando interrupções.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-28-design-system-v2.md`. Two execution options:**

**1. Subagent-Driven (recomendado)** — Dispatch um subagent fresh por task, review entre tasks, iteração rápida. Plano com 12 tasks bem isoladas é caso ideal.

**2. Inline Execution** — Executo task-a-task aqui na mesma sessão. Mais simples auditar passo-a-passo mas custo maior.

**Qual abordagem?**
