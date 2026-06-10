> Gerado por workflow multi-agente em 2026-06-10. Plano de levar o design CASA + E2E + dashboards PARA a main (Estrategia A).
> Base: ESTUDO-MAIN.md · seguranca: CHECKLIST-SEGURANCA-RECONCILIACAO.md

# DOCUMENTO B — PLANO DE PORTABILIDADE CASA → MAIN

> **Objetivo:** trazer da branch CASA para a `main` apenas três coisas: **(a)** tokens/tema CASA, **(b)** os 2 specs E2E Playwright, **(c)** hub por perfil + dashboards com KPIs.
> **Restrição de ouro:** ordem do **menos** para o **mais** arriscado, e **NADA** pode tocar `src/lib/agenda/*`, `src/lib/medico/agenda*`, `prisma/schema.prisma` ou `scripts/migracao-amplimed/*` — o motor de agenda e a migração Amplimed são intocáveis (cutover em HOLD).
> **Validação universal:** todo passo termina com o ritual pré-commit da main: `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test`. Passos visuais adicionam `pnpm build`; passos E2E adicionam `pnpm test:e2e`.

---

## Princípios da estratégia

1. **Branch dedicada** a partir de `main`, nunca commitar direto. (CLAUDE.md: criar branch para trabalho novo na principal.)
2. **Aditivo antes de substitutivo:** introduzir o tema CASA como **camada opcional** (novos `data-theme`), não reescrever os tokens da main. Reverter = remover um import.
3. **Backend é referência, não código:** os caminhos da CASA (`*.service.ts`) **não vêm**. Só vêm CSS, specs Playwright e componentes React de apresentação.
4. **Cada fatia é um commit pequeno e focado** (CLAUDE.md: não misturar refactor com feature).

---

## FASE 1 — Tokens / Tema CASA (RISCO: BAIXO)

A main hoje usa direção "Clínica Premium" (Hanken Grotesk + IBM Plex Mono, fundo `#e7eaea` frio, mecanismo `data-unit-accent`). A CASA é direção "Editorial quente" (Garet/Jost, papel `#FAF7F2`, tinta marrom `#752C05`, dourado `#C9962F`, mecanismo `[data-theme]`). São **duas direções de arte** que compartilham só a paleta canônica do brandbook — então o port é **re-skin**, e a forma segura é torná-lo **opt-in**.

### Passo 1.1 — Trazer os tokens CASA como folha paralela
- **Arquivos-alvo (main):** criar `src/styles/ifp-tokens-casa.css` (novo). **Fonte:** `kiizinbr-ifp-familiaponcio/packages/design-tokens/tokens.css`.
- **O que muda:** copia as `--ifp-*` da CASA (papel, tinta, dourado, sombras quentes) **sob um seletor de escopo** (`.ifp-kit[data-skin="casa"]` ou `:root[data-skin="casa"]`), para NÃO sobrescrever os tokens frios da main por padrão. Não tocar `ifp-tokens.css` existente.
- **Risco:** BAIXO — arquivo novo, não importado ainda; zero efeito até o passo 1.3.
- **Como validar:** `pnpm typecheck && pnpm lint` (CSS não quebra TS, mas garante que nada mais regrediu). Visual: ainda idêntico à main.

### Passo 1.2 — Auto-hospedar as fontes CASA (Garet/Jost)
- **Arquivos-alvo:** `src/app/globals.css` (adicionar `@font-face` para Garet com fallback Jost), e copiar os `.woff2` para `public/fonts/`. A main **já self-hospeda** fontes via `@font-face` (`globals.css:9-40`) — seguir esse padrão exato (sem `@import` remoto do Google).
- **O que muda:** só adiciona faces novas; não troca a fonte default.
- **Risco:** BAIXO — fontes carregadas mas não aplicadas até o tema ser ativado.
- **Como validar:** `pnpm build` (garante que o bundler resolve os assets de `public/fonts/`), abrir DevTools → Network e confirmar 200 nos `.woff2`.

### Passo 1.3 — Converter o mecanismo `data-unit-accent` → `data-theme` (opt-in)
- **Arquivos-alvo:** `src/components/app-shell.tsx:71` (hoje `className="shell ifp-kit" data-unit={unit} data-unit-accent`) e `src/app/layout.tsx:14` (`data-theme="light"`).
- **O que muda:** adicionar **condicionalmente** `data-skin="casa"` quando uma flag estiver ligada (env `NEXT_PUBLIC_SKIN=casa` ou toggle de usuário). Mantém `data-unit` (o acento por unidade continua válido). A CASA usa `[data-theme="medico|capacitacao|…"]` com trio `--unidade/-escuro/-suave` — mapear esse trio dentro do escopo `[data-skin="casa"]` para não colidir com o `data-unit-accent` da main.
- **Risco:** BAIXO→MÉDIO — toca 2 arquivos de layout, mas a mudança é **aditiva e atrás de flag**. Default (flag off) = main intacta.
- **Como validar:** ritual pré-commit completo + `pnpm build`. Subir `pnpm dev` com `NEXT_PUBLIC_SKIN=casa` e sem; confirmar que **sem a flag o visual é byte-a-byte o atual**. Spot-check nas ~40 telas que consomem `.card/.btn/.badge`.

> **Por que primeiro:** não toca lógica, é reversível removendo um import/flag, e destrava a avaliação visual sem nenhum risco a produção.

---

## FASE 2 — Specs E2E Playwright (RISCO: BAIXO-MÉDIO)

A main tem Playwright configurado (`playwright.config.ts`, roda contra `pnpm start`/build prod, só chromium) e 11 specs, incluindo `rbac` e `rbac-v2-multitenant`. A lacuna é teste de UI. Trazer os 2 specs da CASA **adiciona rede de segurança** — e ainda ajuda a verificar os achados de segurança do DOC-A §6.

### Passo 2.1 — Portar o 1º spec E2E (o de menor acoplamento)
- **Arquivos-alvo:** criar `tests/e2e/<nome-do-spec-1>.spec.ts` na main. **Fonte:** os 2 specs E2E da branch CASA citados na decisão.
- **O que muda:** adaptar seletores/rotas ao roteamento da main (`/<unidade>/login`, hub `inicio/`). **Reusar os helpers de auth já existentes** dos specs `rbac`/`login` da main em vez de trazer os da CASA. Usar os usuários do `pnpm db:seed` (`ifp-demo-2026`).
- **Risco:** BAIXO-MÉDIO — código de teste isolado; o risco é flakiness por seletor desalinhado, não regressão de produto.
- **Como validar:** `pnpm test:e2e` (sobe build prod). O spec novo passa verde isoladamente e a suíte E2E inteira continua verde.

### Passo 2.2 — Portar o 2º spec E2E
- **Arquivos-alvo:** `tests/e2e/<nome-do-spec-2>.spec.ts`. Mesmo procedimento.
- **Direcionar a cobertura para os achados do DOC-A §6:** se um dos specs cobre tenant/unidade, usar para **verificar o critério #1** (profissional de Capacitação NÃO entra em `/medico/*`) — transforma o port em prova viva de um achado 🔴.
- **Risco:** BAIXO-MÉDIO.
- **Como validar:** `pnpm test:e2e` completo + confirmar no relatório do Playwright que ambos os specs novos rodaram.

> **Por que antes dos dashboards:** ter E2E verde dá rede de segurança ANTES de mexer no hub/navegação, que é onde mais cresce a chance de regressão.

---

## FASE 3 — Hub por perfil + Dashboards com KPIs (RISCO: MÉDIO)

Mais arriscado porque toca **navegação real** (`inicio/`, proxy/RBAC) e **lê dados**. Aqui mora o risco de violar os "padrões a garantir" do DOC-A §6 (audit READ, select mínimo, timezone). Fatiar em leitura-zero antes de leitura-de-dados.

### Passo 3.1 — Hub por perfil (apresentação pura, leitura zero)
- **Arquivos-alvo:** `src/app/inicio/` (hub pós-login que hoje mostra ladrilhos de unidade). Criar componentes em `src/components/` (ex.: `hub/role-hub.tsx`).
- **O que muda:** renderizar os ladrilhos/atalhos **filtrados pelo perfil da sessão** (`session.user.roles`/`primaryRole`, já disponíveis no JWT — DOC-A §3). **Não** adicionar novo gate de segurança aqui; reusar `canAccessUnidade`/`hasAnyRole` existentes para decidir o que exibir. Aplicar as classes do kit (`.card`, `.shell`).
- **Risco:** MÉDIO — toca a tela pós-login de todo usuário, mas é **só apresentação** (decide o que mostrar a partir de dados já no token, sem query nova).
- **Como validar:** ritual completo + `pnpm build`. Logar com 3+ usuários demo de papéis diferentes (super_admin, profissional médico, instrutor capacitação) e confirmar que cada um vê só os ladrilhos do seu escopo — **e que ninguém vê atalho de unidade que `canAccessUnidade` negaria**.

### Passo 3.2 — Dashboards com KPIs (leitura de dados — ponto sensível)
- **Arquivos-alvo:** novas rotas por unidade (ex.: `src/app/medico/indicadores/` já existe na main — **estender, não recriar**; `src/app/capacitacao/`...). Server actions/queries em `src/lib/<modulo>/` seguindo o padrão `page.tsx` (RSC) + `actions.ts`.
- **O que muda:** agregações de KPI (consultas/dia, presença%, fila de encaminhamento, matrículas). **Reusar os agregadores existentes** (`lib/medico/indicadores`, `lib/capacitacao`) — não escrever SQL novo se já houver função.
- **Risco:** MÉDIO — lê dado sensível. **Obrigatório aplicar os 4 padrões do DOC-A §6:**
  1. Toda query filtra por unidade via `canAccessUnidade` (não vazar KPI cross-tenant).
  2. **Audit READ** em leitura de dado clínico/sensível (`logEvent` com `entityType` apropriado) — espelhar o `medical_data_accessed` já existente.
  3. **Select mínimo:** KPI são contagens/agregados — **nunca** retornar PII na resposta do dashboard (o achado 🔴/🟠 da CASA era justamente prancha retornando CPF/renda).
  4. **Timezone explícito** `America/Sao_Paulo` em qualquer corte por "dia" (achado 🔴 da CASA) — não confiar no TZ do processo Docker (UTC).
- **Como validar:** ritual completo + `pnpm test:e2e`. Adicionar **teste unit** dos agregadores (a main já tem padrão em `tests/unit/**-indicadores*`). Logar como `presidencia` (read-only global) e confirmar que vê agregados mas **não** edita; logar como recepção e confirmar escopo restrito. Conferir no `AuditLog` (Prisma Studio, `pnpm db:studio`) que cada abertura de dashboard sensível gerou READ.

> **Por último, e fatiado:** 3.1 (zero leitura) separado de 3.2 (leitura sensível) para que, se um KPI vazar escopo, o blast radius seja uma rota, não o hub inteiro.

---

## Matriz-resumo (ordem ↑ risco)

| # | Fatia | Toca lógica? | Toca agenda/Amplimed? | Risco | Validação-chave |
|---|---|---|---|---|---|
| 1.1 | Tokens CASA (folha paralela) | não | não | BAIXO | typecheck/lint |
| 1.2 | Fontes Garet/Jost | não | não | BAIXO | `pnpm build` + Network 200 |
| 1.3 | `data-skin=casa` opt-in | layout só | não | BAIXO-MÉDIO | ritual + build, flag off = idêntico |
| 2.1 | 1º spec E2E | teste | não | BAIXO-MÉDIO | `pnpm test:e2e` |
| 2.2 | 2º spec E2E (cobre tenant) | teste | não | BAIXO-MÉDIO | `pnpm test:e2e` |
| 3.1 | Hub por perfil (apresentação) | navegação | não | MÉDIO | login multi-perfil |
| 3.2 | Dashboards KPI (leitura) | sim, leitura | não | MÉDIO | 4 padrões §6 + audit READ |

---

## Os 3 primeiros comandos concretos para começar

```powershell
# 1. Branch dedicada a partir da main (nunca commitar na principal)
git -C C:\Users\Erick\Documents\GitHub\ifp-main-study checkout -b feat/port-casa-design

# 2. Subir a infra dev e garantir baseline VERDE antes de qualquer mudança
#    (rodar dentro do WSL conforme README: pnpm dev:up && pnpm install)
pnpm dev:up

# 3. Capturar o baseline de testes/qualidade ANTES do port (linha de comparação)
pnpm typecheck; if ($?) { pnpm lint }; if ($?) { pnpm test }
```

Em seguida, iniciar o **Passo 1.1**: criar `src/styles/ifp-tokens-casa.css` copiando as `--ifp-*` de `kiizinbr-ifp-familiaponcio/packages/design-tokens/tokens.css` sob o escopo `[data-skin="casa"]`, sem tocar `ifp-tokens.css`.

---

**Arquivos-âncora do plano (todos absolutos):**
- Tokens main (não tocar): `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/styles/ifp-tokens.css`
- Entrada CSS / `@font-face`: `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/app/globals.css`
- Shell (mecanismo de tema): `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/components/app-shell.tsx:71`
- Root layout: `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/app/layout.tsx:14`
- Hub por perfil: `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/app/inicio/`
- Indicadores médicos (estender): `C:/Users/Erick/Documents/GitHub/ifp-main-study/src/app/medico/indicadores/`
- Specs E2E (destino): `C:/Users/Erick/Documents/GitHub/ifp-main-study/tests/e2e/`
- Config E2E: `C:/Users/Erick/Documents/GitHub/ifp-main-study/playwright.config.ts`
- Tokens CASA (fonte do port): `C:/Users/Erick/Documents/GitHub/kiizinbr-ifp-familiaponcio/packages/design-tokens/tokens.css`
- Checklist de segurança (critérios de aceitação): `C:/Users/Erick/Documents/GitHub/kiizinbr-ifp-familiaponcio/docs/CHECKLIST-SEGURANCA-RECONCILIACAO.md`
- **NÃO TOCAR:** `src/lib/agenda/core.ts`, `src/lib/medico/agenda.ts`, `prisma/schema.prisma`, `scripts/migracao-amplimed/*`
