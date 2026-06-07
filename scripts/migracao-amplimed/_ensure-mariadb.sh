#!/usr/bin/env bash
# Garante o MariaDB descartável de pé (WSL2 hiberna e derruba o container).
# Idempotente: no-op se já rodando. Use ANTES de qualquer comando que toque a origem.
set -uo pipefail
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && exit 0
  sleep 1
done
echo "ERRO: MariaDB amplimed-src nao respondeu em 30s" >&2
exit 1
