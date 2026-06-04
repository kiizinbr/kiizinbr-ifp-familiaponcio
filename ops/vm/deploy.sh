#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" # ops/vm
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo "==> git pull (raiz do repo)"
git -C ../.. pull --ff-only

echo "==> build das imagens"
$COMPOSE build

echo "==> sobe Postgres + MinIO"
$COMPOSE up -d postgres minio

echo "==> migrations (prisma migrate deploy)"
$COMPOSE run --rm migrate

echo "==> sobe o app"
$COMPOSE up -d app

echo "==> status"
$COMPOSE ps
echo "OK. Primeira vez? rode o seed: $COMPOSE run --rm migrate pnpm tsx prisma/seed.ts"
