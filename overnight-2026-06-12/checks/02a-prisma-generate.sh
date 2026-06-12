#!/usr/bin/env bash
# Gera o Prisma Client local do worktree (NÃO toca banco — não é migrate/seed/push).
# Necessário porque o install não roda generate e o typecheck depende dos tipos gerados.
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
pnpm exec prisma generate
echo "GENERATE_OK"
