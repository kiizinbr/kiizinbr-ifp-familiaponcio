#!/usr/bin/env bash
# Deploy do main (437e627) no prod VIA TARBALL (contorna o git tree sujo da VM).
# Extrai sobre /opt/ifp-connect (preserva .env.prod gitignored), build, migrate, up.
set -euo pipefail
TGZ="${1:?uso: _deploy-from-tarball.sh <tgz>}"
cd /opt/ifp-connect
echo "==> extraindo $TGZ sobre /opt/ifp-connect (preserva .env.prod)"
tar xzf "$TGZ" -C /opt/ifp-connect
cd /opt/ifp-connect/ops/vm
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
echo "==> build"; $COMPOSE build
echo "==> up postgres+minio"; $COMPOSE up -d postgres minio
echo "==> migrate deploy (aplica 20260607160940_migracao_amplimed)"; $COMPOSE run --rm migrate
echo "==> up app"; $COMPOSE up -d app
echo "==> status"; $COMPOSE ps
echo "DEPLOY-OK"
