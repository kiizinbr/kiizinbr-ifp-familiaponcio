#!/usr/bin/env bash
# REVISOR (barreira b) — re-verificação independente do item tokens (e5dbcb2).
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

echo "=== REVISOR: prettier --check (sem write) ==="
pnpm prettier --check "${ARQUIVOS_ITEM[@]}"

echo "=== REVISOR: typecheck ==="
pnpm typecheck

echo "=== REVISOR: lint ==="
pnpm lint

echo "=== REVISOR: vitest unitário puro do item ==="
pnpm vitest run tests/unit/tema-casa.test.ts

echo "REVISOR_TOKENS_OK"
