# IFP Connect — Navegação & IA: o "rebote da Visão geral" + blueprint de redesenho

**Data:** 2026-06-08
**Método:** workflow ECC multi-agente (`wf_92cd0c4d-e94`) — 5 mapeadores paralelos (roteamento, shells/nav, inventário de rotas/órfãs, papéis/homes, chrome do kit) → 14 verificadores adversariais → síntese. 20 agentes, ~2,47M tokens. Toda alegação ancorada em `arquivo:linha` sob a raiz do repo.

> ## Nota de reconciliação (LER PRIMEIRO)
>
> Um verificador adversarial **refutou** a premissa "`proxy.ts` é middleware ativo" via leitura estática (`.next/server/middleware-manifest.json` vazio; sem `middleware.ts`). **Essa refutação é um falso-negativo:**
>
> - **Observação de runtime** (Playwright, `pnpm dev`): navegar a `/app` **redireciona para `/poncio`** — o redirect de `proxy.ts:54-56` _dispara_. Runtime > estático.
> - **Next.js 16 renomeou `middleware.ts` → `proxy.ts`.** O arquivo tem a forma de middleware (`export default auth(...)` + `export const config.matcher`) e o projeto é Next **16.2.6** (`package.json`). O verificador checou o manifesto pelo nome **antigo**.
> - **Conclusão:** `proxy.ts` É o middleware ativo. O diagnóstico D1-D8 abaixo se mantém.
>
> **Risco residual a confirmar (prioridade-1, grau de segurança):** se o `next build` de produção não registrar `proxy.ts`, o middleware não roda em prod → proteção de rota bypassada em produção (sobram só os `auth()` por página). **Verificar antes de qualquer release.**
>
> O aviso de custo do hook (`$286.34`) é **legítimo** — vive em `~/.claude` (fora do escopo que o verificador buscou), não é injeção.

---

## 1. Diagnóstico confirmado

### 1.1 Defeitos confirmados (`arquivo:linha`)

- **D1 — Cadeia do "rebote da Visão geral" (bug raiz).** `"Visão geral" → /app` (`src/components/app-shell.tsx:34`) é **alias morto**: o middleware reescreve `/app` e `/app/` → `/poncio` (`src/proxy.ts:54-56`) para qualquer sessão autenticada, **sem checar role de unidade antes**. Quem não tem acesso a `poncio` é então rebatido para `/` na passada seguinte (`src/proxy.ts:82-89`) — capturado em `tests/e2e/rbac-v2-multitenant.spec.ts:96-104`. Clicar "Visão geral" leva a um painel de escopo diferente ou à landing pública, sem feedback.

- **D2 — Dashboards mock alcançáveis, sem feedback de carregamento.** `GlobalDashboard` (`src/app/app/page.tsx:139`) linka 4 ladrilhos → `/app/${u}` (`:219-222`) para `UnitDashboard` (`src/app/app/[unit]/page.tsx:128`), com `Record<UnitScope,UnitData>` **inteiramente hardcoded** (`:18-126`). Banner de "dados de exemplo" (`:156-159`) + um painel real (`listEncaminhamentosUnidade`, `:137`), mas **sem `Suspense`/skeleton** → reforça o "caiu sem feedback".

- **D3 — Duas gerações de rota de unidade vivas e divergentes.** Antiga `/app/[unit]` valida contra `UNIT_SCOPES` (4 slugs, `src/lib/rbac-types.ts:18`); nova `/<unidade>` valida via `unidadeFromSlug` (6 slugs, `src/lib/unidades.ts:3-10,116`). O pós-login aponta à nova, o `app-shell` empurra à antiga (exceto "Serviço Social" → `/social`, `:40-41`).

- **D4 — Fallback-landing em negação de autorização (4 ramos, sem feedback).** Logado-sem-permissão → landing pública `/` em: `/admin/audit` (`src/proxy.ts:38-40`), `/admin` (`:46-48`), `/painel/<slug>` (`:72-77`), `/<slug>` (`:82-87`). Nenhum carrega flag de "acesso negado". É o anti-pattern que `src/lib/login-redirect.ts:6-7` declara evitar — corrigido só pro caso **deslogado**, não pro logado-sem-permissão.

- **D5 — "Home por papel" é código morto.** `getLandingPathFor` (`src/lib/rbac-types.ts:55-76`) e `getLandingPath` (`src/lib/rbac.ts:163-167`) **nunca são chamados em runtime**. Login canônico usa `redirectTo: "/"` fixo (`src/app/(auth)/login/actions.ts:29`); login por unidade usa `redirectTo: /${slug}` fixo (`src/app/[unidade]/login/login-action.ts:93`). E `/` é landing **pública** (`PATHS_PUBLICOS`, `src/proxy.ts:7,16`) que retorna cedo → **logado que cai em `/` fica preso na home institucional**.

- **D6 — Três autoridades de "home", três destinos.** super_admin/presidência: `getLandingPathFor → /app` (`src/lib/rbac-types.ts:62-64`); middleware `/app → /poncio` (`src/proxy.ts:54-56`); menu "Visão geral" → `/app` (`src/components/app-shell.tsx:34`). 2 saltos via rota cuja page ainda existe — remover o alias sem religar a home derruba super_admin/presidência no `GlobalDashboard` mock.

- **D7 — Dois predicados de unidade do RBAC divergem.** `getUserUnits` trata `presidencia/social/super_admin` como `"all"` (`src/lib/rbac.ts:25-28`), mas `canAccessUnidade` usa `rolesAceitas` (`:184-190`), onde `presidencia` só consta em `poncio` (`src/lib/unidades.ts:101`) e `social` só em `social` (`:111`). **Presidência NÃO passa o gate de `/medico`** apesar de `getUserUnits` dizer "all". O proxy usa `canAccessUnidade`; `canAccessUnit` (`:44-47`) usa `getUserUnits` — gates diferentes, predicados diferentes.

- **D8 — Assimetria de navegação entre unidades.** Só `medico-shell.tsx` e `capacitacao-shell.tsx` existem. `/esportivo` e `/recreativo` **não têm `page.tsx` próprio** — caem no catch-all `src/app/[unidade]/page.tsx:20-46` (`<main>` cru, sem sidebar). `/poncio/page.tsx` idem. Entrar nelas via `UnitSwitcher` = **perda total de menu lateral**.

### 1.2 Ressalvas (não refutam os defeitos)

- **R1 (D4):** o caminho **deslogado** está correto — vai a LOGIN preservando unidade (`src/lib/login-redirect.ts:13-21`). Defeito é só do logado-sem-permissão.
- **R2 (D1):** `mustChangePassword=true` é interceptado antes (`src/proxy.ts:33-35`).
- **R3 (D3):** `/app/cidadaos` e `/app/vagas` seguem **vivos** (`src/proxy.ts:65-69`), reusados por todos os navs. **Preservar** ao remover `/app/*`.
- **R4 (D2):** 4 ladrilhos é coerente com as 4 unidades-escopo; o mock é o problema, não a contagem.

### 1.3 Sobre as refutações

- A refutação "`proxy.ts` é middleware morto" é **falso-negativo** (ver Nota de reconciliação). Diagnóstico mantido.
- A refutação do hook de custo é **incorreta** — o hook vive em `~/.claude` (fora do escopo buscado).

---

## 2. Kill-list de telas órfãs / mortas

| Tela                                                                            | Por que morta/órfã                                                                  | Recomendação                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GlobalDashboard` — `src/app/app/page.tsx:139`                                  | `/app` é reescrito → `/poncio` antes de renderizar                                  | **Religar como "Início" canônica** (já tem dados reais: stats, triagens, audit) **ou apagar** — decisão Q1. Não apagar sem antes religar D5/D6. |
| `UnitDashboard` — `src/app/app/[unit]/page.tsx:128`                             | Único inbound vivo está atrás de `/app` morto; KPIs 100% mock                       | **Apagar.** Migrar o pedaço real (`listEncaminhamentosUnidade`) pra home da unidade nova.                                                       |
| Catch-all `src/app/[unidade]/page.tsx:7-46`                                     | Serve só `esportivo`/`recreativo`; stub sem nav                                     | **Promover** a template real de home de unidade (shell + abas) OU criar pastas dedicadas — Q3.                                                  |
| `"Visão geral" → /app` — `src/components/app-shell.tsx:34`                      | Href é alias morto (`sidebar-nav.tsx:20` já tem caso especial `it.href !== "/app"`) | **Substituir** por `"Início" → homeParaSessao(session)`.                                                                                        |
| `getLandingPathFor`/`getLandingPath` — `rbac-types.ts:55-76`, `rbac.ts:163-167` | Definidos, nunca chamados                                                           | **Religar** como base de `homeParaSessao` — não apagar.                                                                                         |

---

## 3. Modelo de IA proposto (conceito ECC) — 3 zonas

Tudo deriva do Design Kit (`src/styles/ifp-tokens.css` + `ifp-components.css`; `CLAUDE.md`) — muda só o acento por unidade (`data-unit`/`data-unit-accent`, já em `app-shell.tsx:71`).

### Zona A — Institucional / Início

- `/` público permanece pra deslogados.
- **Início autenticada** = destino de `homeParaSessao(session)`. Papéis globais → home cross-unidade real (o `GlobalDashboard` religado). Unit-roles → home da sua unidade. Substitui o ambíguo "Visão geral → /app".

### Zona B — Workspace da Unidade (3 planos de navegação, hoje colapsados num `SidebarNav` plano)

- **B.1 ABAS** — navegação _dentro_ da unidade, sem trocar de contexto. É o que está em `medicoNavItems` (`src/lib/medico/nav.ts:16-40`) e `capacitacaoNavItems` (`src/lib/capacitacao/nav.ts:11-27`). Tablist horizontal (compound `Tabs`, `rules/web/patterns.md`), `aria-current`, ativo = acento da unidade, já filtradas por papel.
- **B.2 MENU** — chassi persistente: marca, tema, perfil/sair (`app-shell.tsx:73-135`), `UnitSwitcher` (super_admin, `:83-88`), e transversais (Cidadãos/Vagas/Configurações). Hoje o menu mistura abas + transversais num nível só — **separar**. Mobile = drawer (resolve o crítico "<880px sem menu" da auditoria 2026-06-07); desktop = colapsável.
- **B.3 BARRA DE AÇÃO** — faixa no topo do `<main>`/`.content` (`app-shell.tsx:138-140`) com 1-3 CTAs da tela atual. **É onde `SubmitButton`/`ConfirmDialog` passam a morar** (primitivas já existem). Slot canônico, sticky, 1 primário sólido + secundários ghost.

### Zona C — Registros transversais

Cidadãos (`/app/cidadaos`) e Vagas (`/app/vagas`) — vivos, cross-unidade. Acessíveis de qualquer workspace via menu. **Não migrar agora** (R3).

### Primitivas — existentes vs novas

**Existentes:** `app-shell.tsx` (`.shell`/`.sidebar`/`.content`), `sidebar-nav.tsx`, `data-unit`, `ui/card.tsx`, `kpi-card.tsx`, `ui/badge.tsx`, `ui/button.tsx`, `ui/submit-button.tsx`, `ui/confirm-dialog.tsx`, `unit-switcher.tsx`, `ui/empty-state.tsx`.
**Novas:** `UnitTabs` (tablist da unidade), `ActionBar` (slot sticky de ações), `UnitShell` genérico (generaliza medico/capacitacao p/ as 6 unidades — mata D8), `AccessDenied` (403 com link pra home — mata D4), `loading.tsx` por segmento (Suspense — mata parte do D2).

---

## 4. Fonte única de verdade — "home por papel"

Promover `getLandingPathFor` (`src/lib/rbac-types.ts:55-76`) a autoridade única, corrigindo o destino `/app` (alias morto) → home canônica.

```ts
// src/lib/home.ts (novo) — única autoridade. Pura, testável.
export function homeParaSessao(session: Session | null): string;
// delega a getLandingPathFor(primaryRole.name, primaryRole.unitScope), com /app → "/inicio".
```

| `primaryRole`                              | Home hoje            | Home proposta               |
| ------------------------------------------ | -------------------- | --------------------------- |
| `super_admin`                              | `/app` (morto)       | `/inicio`                   |
| `presidencia`                              | `/app` (morto)       | `/inicio` ou `/poncio` (Q2) |
| `social`                                   | `/social`            | `/social`                   |
| `gestor_unidade`/`profissional`/`recepcao` | `/<scope>` ou `/app` | `/<scope>` ou `/inicio`     |
| `painel`                                   | `/painel/<scope>`    | igual                       |
| sem role                                   | `/login`             | `/login`                    |

**3 pontos que devem consumir `homeParaSessao`:** (1) pós-login (`src/app/(auth)/login/actions.ts:29`, `src/app/[unidade]/login/login-action.ts:93`); (2) middleware fallback (`src/proxy.ts:40,48,76,86` → `AccessDenied` ou home, **toca middleware**); (3) item "Início" do menu (`src/components/app-shell.tsx:34`; remover o caso especial `sidebar-nav.tsx:20` depois). Resultado: `/app` deixa de existir como conceito de navegação; mata D5 e D6.

---

## 5. Plano de remediação faseado

### Camada 0 — Estancar o rebote (mínimo, reversível)

| Mudança                                                                                   | Arquivo:linha                                         | Risco                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `"Visão geral" → /app` vira `"Início"` → rota estável `/inicio`                           | `src/components/app-shell.tsx:34`                     | Baixo                                                |
| Criar `/inicio` (server: `auth()` + `redirect(homeParaSessao(session))`) + add ao matcher | novo `src/app/inicio/page.tsx`, `src/proxy.ts:93-107` | **Toca middleware** (rota nova herda gate de sessão) |
| Plugar `homeParaSessao` no pós-login                                                      | `src/app/(auth)/login/actions.ts:29`                  | Baixo                                                |

Sem migration. Decisão Q1.

### Camada 1 — Matar a classe do bug

| Mudança                                                                 | Arquivo:linha                                                | Risco                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Criar `homeParaSessao` + corrigir `/app→/inicio` em `getLandingPathFor` | `src/lib/rbac-types.ts:62-64` + novo `src/lib/home.ts`       | Baixo; testar (padrão `login-redirect.test.ts`)            |
| Trocar os 4 `redirect("/")` de negação por `AccessDenied`/home          | `src/proxy.ts:40,48,76,86`                                   | **ALTO/SEGURANÇA** — mudar _destino_, não _predicado_; e2e |
| Unificar `canAccessUnit` × `canAccessUnidade`                           | `src/lib/rbac.ts:25-28` vs `:184-190`; `unidades.ts:101,111` | **ALTO/SEGURANÇA** — política RBAC, decisão Q4             |
| Remover alias `/app→/poncio` **após** `/inicio` existir                 | `src/proxy.ts:54-56`                                         | Médio — **preservar** `/app/cidadaos` e `/app/vagas` (R3)  |
| `loading.tsx` (Suspense) por segmento                                   | novos                                                        | Baixo (mata D2)                                            |

Sem migration de schema. 2 itens tocam middleware/RBAC → code-review de segurança + e2e antes de merge.

### Camada 2 — Redesenho de workspace (abas/menu/barra de ação)

| Mudança                                                                       | Arquivo:linha                                           | Risco                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Criar `UnitTabs`, `ActionBar`, `UnitShell` genérico                           | novos `src/components/unit/`                            | Médio                        |
| Migrar `medico-shell`/`capacitacao-shell` → `UnitShell`                       | `src/components/{medico,capacitacao}/*-shell.tsx`       | Médio                        |
| Home+shell p/ `esportivo`/`recreativo`/`poncio` (mata D8)                     | novos + `src/app/poncio/page.tsx`, `[unidade]/page.tsx` | Médio — Q3                   |
| Apagar `UnitDashboard` mock; migrar painel real                               | `src/app/app/[unit]/page.tsx`                           | Baixo                        |
| Mover CTAs das pages → `ActionBar`; padronizar `SubmitButton`/`ConfirmDialog` | pages `medico/*`, `capacitacao/*`                       | Médio (UI, sem mudar lógica) |

Sem migration. Não-sensível a segurança (gates seguem no middleware + `auth()` por page). Decisões Q1/Q2/Q3.

---

## 6. Decisões abertas para o usuário

1. **`GlobalDashboard` (`src/app/app/page.tsx`): apagar ou virar a "Início" canônica?** _Recomendado:_ virar `/inicio` (já tem dados reais).
2. **`/poncio` é unidade ou home executiva?** Define a home de `presidencia` (`/poncio` executivo vs `/inicio` cross-unidade).
3. **`/esportivo` e `/recreativo`: catch-all vira template ou pastas dedicadas?** _Recomendado:_ catch-all → `UnitShell` genérico.
4. **RBAC (D7): presidência acessa `/medico` etc.?** `getUserUnits` diz "all"; `canAccessUnidade` diz não. Os dois precisam concordar — **única decisão que toca autorização**, deve sair antes da Camada 1. Presidência = read-only global (adicionar às `rolesAceitas` de todas) ou restrita a `/poncio` (corrigir `getUserUnits`)?
5. **Negação (D4): 403 dedicado ou redirect silencioso?** _Recomendado:_ 403 com link pra home.

## 0. Prioridade-1 (segurança, antes de qualquer release)

Confirmar se o `proxy.ts` é registrado como middleware no **build de produção** (`next build`). Se não for, a proteção de rota não roda em prod. Ver Nota de reconciliação.
