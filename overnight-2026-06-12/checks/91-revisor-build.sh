#!/usr/bin/env bash
# REVISOR — build de produção no estado atual da árvore (HEAD + WIP acesso).
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
pnpm build
echo "REVISOR_BUILD_OK"
