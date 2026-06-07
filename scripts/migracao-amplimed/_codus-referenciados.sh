#!/usr/bin/env bash
# Helper: lista AUTORITATIVA dos codu referenciados por consulta que têm usuario.
# Usado p/ conferir cobertura da curadoria (profissionais-curados.ts).
set -uo pipefail
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && break
  sleep 1
done
docker exec amplimed-src mariadb -uroot -psrc -e \
  "SELECT u.codu, u.nome, COUNT(*) n FROM consulta c JOIN usuarios u ON u.codu=c.codu GROUP BY u.codu, u.nome ORDER BY u.codu;" amplimed
