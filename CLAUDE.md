# IFP Connect — instruções do projeto

Plataforma multi-tenant (Next.js App Router + Prisma/Postgres) das unidades do Instituto Família Pôncio: `/medico`, `/capacitacao`, `/esportivo`, `/recreativo`, `/poncio`, `/social`.

## 🎨 Visual / UI — REGRA DURA

**Todo trabalho de UI (telas, componentes, estilos) DERIVA do Design Kit canônico** — direção "Ferramenta Clínica Premium". **Não desenhar do zero, não inventar.**

- **Fonte da verdade:** `src/styles/ifp-tokens.css` + `src/styles/ifp-components.css`.
- **Referência navegável + scaffolds:** `docs/design-kit/` — abra `index.html` (hub) e leia o `HANDOFF.md` primeiro. Toda tela nova/alterada parte de um scaffold de `docs/design-kit/scaffolds/`.
- **3 contratos de atributo:** `data-theme="light|dark"` no `<html>`; `data-unit="medico|capacitacao|esportivo|recreativo|poncio|social"` (+ `data-unit-accent` p/ diferenciação forte) no `<body>` por segmento de unidade.
- **Regra de ouro:** uma marca só — muda só o **acento** por unidade; **nunca** tipografia, layout, densidade ou fundo.
- **Nunca inventar cor:** tudo sai dos tokens (`--ifp-*` / `--unit` / semânticos); tom intermediário via `color-mix(in srgb, var(--unit) X%, …)`.
- **Fontes:** Hanken Grotesk (UI) + IBM Plex Mono (dados/números/labels).
- **Executor:** use o skill `frontend-design` — mas DENTRO do kit (ele recria os scaffolds em React, não improvisa).
- ⚠️ Os tokens **ainda NÃO** estão importados no `globals.css`. O `@import "./styles/ifp-tokens.css"` + `"./styles/ifp-components.css"` é o **passo 1 da migração visual** (muda o fundo das telas atuais) — fazer deliberadamente ao começar a portar, não solto.

## 🛠️ Dev / ambiente (gotchas confirmados)

- **Node/pnpm rodam DENTRO do WSL Ubuntu:** `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm …"`. Postgres dev na porta **5433** (Alterdata ocupa 5432). `pnpm dev:up` sobe os containers.
- **`git push` SEMPRE pelo git nativo do Windows** (`git -C "C:\Users\Administrador\ifp-connect" push origin main`) — o wslrelay trava push/fetch no WSL. Push direto pra `main` é OK neste repo.
- **Ritual pré-commit:** `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm build` antes de push). Migrations via `pnpm db:migrate --name X` (carrega `.env.local`).
- ⚠️ **Verify via ARQUIVO `.sh`** (`wsl -d Ubuntu -- bash caminho.sh`), nunca `bash -lc '…inline…'` — o marshalling PowerShell→wsl mascara o exit code como 0 mesmo com teste falhando.
- Mensagem de commit: **sem aspas duplas** (quebram o arg ao passar pro git.exe via PowerShell).
