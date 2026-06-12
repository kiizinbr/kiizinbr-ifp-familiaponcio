#!/usr/bin/env bash
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612

echo "=== typecheck ==="
pnpm typecheck

echo "=== lint ==="
pnpm lint

echo "=== build (env via source do .env.local do repo principal — só leitura) ==="
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
pnpm build

echo "BASELINE_OK"
