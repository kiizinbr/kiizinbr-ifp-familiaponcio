#!/usr/bin/env bash
# Teste A/B: build SEM as mudanças do item 1 (layout/globals stashed) pra
# determinar se a falha de prerender do /_global-error é pré-existente.
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
pnpm build
echo "BASELINE_BUILD_OK"
