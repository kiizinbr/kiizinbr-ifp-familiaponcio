#!/usr/bin/env bash
# Item 1 do port CASA — tokens/tema: verificação completa.
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612

ARQUIVOS_ITEM=(
  src/styles/casa-tokens.css
  src/app/globals.css
  src/app/layout.tsx
  src/lib/tema-casa.ts
  src/components/tema-unidade.tsx
  tests/unit/tema-casa.test.ts
  docs/design-kit/HANDOFF.md
)

echo "=== format (só os arquivos do item — não tocar no resto do repo) ==="
pnpm prettier --write "${ARQUIVOS_ITEM[@]}"
pnpm prettier --check "${ARQUIVOS_ITEM[@]}"

echo "=== typecheck ==="
pnpm typecheck

echo "=== lint ==="
pnpm lint

echo "=== teste unitário PURO (só o arquivo novo; a suíte cheia toca o PG dev 5433 — rebaixamento registrado) ==="
pnpm vitest run tests/unit/tema-casa.test.ts

echo "=== build (env via source do .env.local do repo principal — só leitura) ==="
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
pnpm build

echo "TOKENS_OK"
