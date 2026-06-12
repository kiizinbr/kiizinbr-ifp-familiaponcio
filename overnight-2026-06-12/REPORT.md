# Relatorio noturno — 2026-06-12 (reconciliação IFP estratégia A — slice 1: skin CASA na main)

Branch: `overnight/2026-06-12` — worktree `C:/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612`.
Entrega LOCAL (sem push, sem deploy, sem docker, sem migrate, sem ação outward — conforme trilhos). O repo do dono (`C:/Users/Administrador/ifp-connect`) não foi tocado: `.env.local` com mtime intacto (May 24 15:50), WIP dele preservado.

## ✅ Executado e verificado

### `e5dbcb2` — `feat(design): tokens CASA + temas por unidade (base da reconciliacao estrategia A)`

10 arquivos, +360/−1 (`git show --stat e5dbcb2` confere).

**O quê:**

- `src/styles/casa-tokens.css` (NOVO, 146 linhas) — paleta CASA do brandbook (`--ifp-papel/tinta/dourado/linha/erro-bg/ambar(-bg)`, degradês, `--ifp-shadow-casa(-sm)`); trio `--unidade/--unidade-escuro/--unidade-suave`; blocos `[data-theme="<slug>"]` para os 6 slugs canônicos da main.
- `src/app/globals.css` — `@import` da camada + ponte Tailwind v4 `@theme inline` (`bg-primary`, `hover:bg-primary-hover`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-unidade-suave`, `bg-papel`, `text-tinta`, `shadow-casa(-sm)`, `shadow-ifp-sm/md/lg`, `font-display`).
- `src/app/layout.tsx` — Jost via `next/font/google` (`variable: "--font-jost"`) no `<html>`; corpo segue Hanken Grotesk.
- `src/lib/tema-casa.ts` (NOVO) — `TEMAS_CASA`/`TemaCasa`/`ehTemaCasa()`/`temaCasaDoSlug()` derivados de `UNIDADE_SLUGS`.
- `src/components/tema-unidade.tsx` (NOVO) — `<TemaUnidade tema=…>` server component que aplica `data-theme` num subtree.
- `tests/unit/tema-casa.test.ts` (NOVO) — 6 testes puros (helper + contrato do CSS).
- `docs/design-kit/HANDOFF.md` — 4º contrato de atributo documentado.
- `overnight-2026-06-12/checks/02-tokens.sh`, `02a-prisma-generate.sh`, `02b-baseline-build.sh`.

**Decisões-chave:**

1. Estratégia A literal: temas = slugs canônicos da main (`medico|capacitacao|esportivo|recreativo|poncio|social`); cores derivadas dos pares `--u-*` existentes — NÃO os nomes/cores do protótipo CASA (educacional/presidencia → recreativo/poncio; medico fica teal-700 da main).
2. Sem colisão com `data-theme="light|dark"`: todos os seletores claro/escuro do kit são `html[data-theme=…]` (verificado por grep); o tema CASA vive em containers.
3. Ponte com o kit: bloco combinado re-resolve `--casa-*` E remapeia `--unit/--unit-2/--accent(-soft/-line)` (mesma fórmula 11%/32% do `[data-unit-accent]`); ordem de cascata corrigida (bloco genérico ANTES dos por-unidade).
4. Cores derivadas, nunca inventadas: escuro/suave via `color-mix(in srgb, var(--unidade) 80%/12%, black/white)`; pares brandbook usados onde são mais escuros.
5. WIP do dono intocado (`page.tsx`, `inicio/**`, `login/actions.ts`, `site.js`).

**Evidência (saídas reais de `checks/02-tokens.sh`, 3ª rodada):**

```
prettier : All matched files use Prettier code style!
typecheck: OK (tsc --noEmit)
lint     : OK (eslint)
vitest   : Test Files 1 passed (1) / Tests 6 passed (6)
build    : ✓ Compiled successfully in 13.4s + Finished TypeScript in 24.6s
```

**Veredito do revisor: MANTER** ("tentei refutar por 8 ângulos; nenhum derrubou o item" — tudo re-executado por ele, não confiou no relato):

- Escopo limpo: `git show e5dbcb2 --name-only` = exatamente os 10 arquivos; `git diff origin/main..HEAD` nos arquivos protegidos do dono = **vazio**.
- Sem segredos: grep do diff completo por `password|secret|postgres|api[_-]?key|Bearer|BEGIN RSA/OPENSSH` → zero hits; checks só fazem `source` do `.env.local` (leitura) e `prisma generate` (não toca banco).
- Checks re-rodados (`checks/90-revisor-tokens.sh`): prettier/typecheck/eslint OK; vitest 6/6; `REVISOR_TOKENS_OK`, `EXIT=0` — COM o WIP acesso na árvore (superset).
- Build: pré-existência confirmada por A/B próprio (`91-revisor-build.sh`) — HEAD e baseline (origin/main pura) falham IDÊNTICO no prerender (logs `checks/91-build-head.log` / `92-build-baseline.log`); árvore restaurada e provada.
- Smoke runtime (`93-revisor-smoke.sh`, `next dev -p 3007`): `<html lang="pt-BR" data-theme="light" class="jost_…__variable">` (Jost ativa, contrato light/dark preservado); `/login` HTTP 200; servidor morto ao final (`pgrep` → `SEM_PROCESSO_ORFAO`).
- Sem efeitos colaterais fora do git (sem listeners novos, zero node órfão no WSL, repo do dono intocado).
- Revisão técnica do CSS bateu com todas as alegações (tokens existem, fórmulas idênticas, cascata correta, camada 100% aditiva — nenhum uso das classes da ponte na main).

**Rebaixamentos registrados (não bloqueiam):**

- Build de produção falha no prerender de `/_global-error`/`/_not-found` (`TypeError: Cannot read properties of null (reading 'useContext')` no chunk `112n_next_dist_0_9f5za._.js`) — **PRÉ-EXISTENTE**, provado por A/B duplo (meu `02b` + o do revisor): erro idêntico com as mudanças stashed/revertidas pra origin/main. Ambiental do worktree (Next 16.2.6 + Turbopack em /mnt/c), não é do commit.
- Suíte vitest completa NÃO rodada (escreve no PG dev persistente 5433); rodado só o teste unitário puro novo.
- Fix de ambiente: `prisma generate` local (`02a`) é pré-requisito do typecheck no worktree (tipos `@prisma/client` ausentes sem ele).

**Como reverter:** `git revert e5dbcb2` na branch da noite (ou na main, se já mergeado). Camada 100% aditiva — nenhuma classe da ponte é usada pela main hoje; o revert não quebra nada.

## 🟡 Pronto pra 1 clique

### (a) DEPLOY STAGING — NÃO executado (documentado)

Somente APÓS o merge na main, decisão do dono:

```
ssh erickramos@192.168.1.162
cd /opt/ifp-connect/ops/vm && bash deploy.sh
```

Gotchas: o deploy pode deixar arquivos com **chown root** — conferir ownership depois. O **Postgres da VM tem PII — NUNCA `down`** / nunca derrubar volume.

### (b) MERGE na main — decisão do dono

```
git checkout main
git merge overnight/2026-06-12
```

Há WIP do dono em `page.tsx`/`inicio` que **combina com esta base** (os temas `data-theme="<unidade>"` ficam disponíveis pro hub dele consumir). O commit da noite não toca nenhum arquivo do WIP (diff vazio nos protegidos — verificado pelo revisor), então não há conflito de arquivo esperado.

### (c) Próximos slices da estratégia A

1. **Hub por perfil** — porta de entrada pós-login consumindo `<TemaUnidade>` + tokens.
2. **Port das verticais** — Educacional / Esportivo / chat 1:1, referência no worktree `casa-sprint`.
3. **E2E** — login → hub → vertical nos 6 temas (Playwright).

## ⏸️ Tentado e revertido

- **Nada foi derrubado pelo revisor nem revertido nesta noite.**
- **Em andamento (não commitado, não revertido) — item "acesso":** `src/app/(auth)/login/login-form.tsx` e `login/page.tsx` modificados + `src/app/acesso/` e `checks/03-acesso.sh` untracked. O prettier do check já formatou os arquivos (reordenação de classes), mas a verificação completa (typecheck+lint+build+smoke) ficou em background e **não concluiu dentro da janela** — sem veredito, sem commit. Fica como WIP na árvore do worktree da noite pra decisão de manhã (ver "Como aceitar / descartar").

## 📊 Achados / 💡 Sugestões (ranqueados por ROI)

1. ⚠️ **Overlap com o WIP do dono** (atenção nº 1 de manhã): o repo principal tem WIP não commitado em `src/app/page.tsx`, `src/app/inicio/**`, `src/app/(auth)/login/actions.ts`, `public/site.js` (+agenda). O commit da noite NÃO toca nenhum desses. Reconciliação sugerida: (1) dono commita ou stasheia o WIP dele; (2) merge da branch da noite; (3) o hub WIP dele passa a poder usar `data-theme="<unidade>"`/`<TemaUnidade>`. Risco semântico só se o WIP dele mexer em `globals.css`/`layout.tsx` (hoje não mexe).
2. **Build de produção quebrado PRÉ-EXISTENTE no worktree** — falha no prerender até para origin/main pura (A/B duplo; logs em `overnight-2026-06-12/checks/91-build-head.log` e `92-build-baseline.log`). Hipótese: Next 16.2.6 + Turbopack rodando em `/mnt/c` (DrvFS). Sugestão: reproduzir build no repo nativo ou em path ext4 do WSL ANTES de qualquer gate que dependa de build verde. Não é causado pelos commits da noite.
3. **`prisma generate` é pré-requisito de typecheck em worktree novo** — sem ele o tsc do worktree inteiro falha (tipos `@prisma/client` ausentes). `checks/02a-prisma-generate.sh` resolve sem tocar banco. Sugestão: documentar no setup de dev/CI.
4. **Suíte vitest escreve no PG dev persistente (5433)** — por isso a noite rodou só unitários puros. Sugestão: separar `projects` no vitest (unit puro × integração com banco) pra ter gate rápido e seguro.
5. **Evidências do revisor estão untracked** em `overnight-2026-06-12/checks/9*` (scripts + logs do A/B e smoke) — manter como evidência local ou commitar se quiser trilha completa.

## Como aceitar / descartar

**Aceitar o slice 1 (merge na main):**

```
cd C:/Users/Administrador/ifp-connect
git checkout main
git merge overnight/2026-06-12
```

**Deploy staging (só após o merge — não foi executado):**

```
ssh erickramos@192.168.1.162
cd /opt/ifp-connect/ops/vm && bash deploy.sh   # conferir chown root depois; NUNCA down no Postgres (PII)
```

**Descartar só o item tokens (mantendo a branch):**

```
cd C:/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
git revert e5dbcb2
```

**Concluir o item acesso (WIP na árvore do worktree da noite):**

```
cd C:/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
wsl -d Ubuntu -- bash overnight-2026-06-12/checks/03-acesso.sh   # se verde → git add + commit
```

**Descartar o item acesso:**

```
cd C:/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
git checkout -- "src/app/(auth)/login/login-form.tsx" "src/app/(auth)/login/page.tsx"
rm -rf src/app/acesso overnight-2026-06-12/checks/03-acesso.sh
```

**Descartar a noite inteira:**

```
cd C:/Users/Administrador/ifp-connect
git worktree remove C:/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612 --force
git branch -D overnight/2026-06-12
```
