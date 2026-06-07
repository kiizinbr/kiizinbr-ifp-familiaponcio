#!/usr/bin/env bash
# Inspeção READ-ONLY p/ T15 (mídia). Os ZIPs têm nomes-HASH opacos (ex.:
# 0832f4d...png) — o vínculo arquivo↔paciente/consulta NÃO está no nome, está
# numa COLUNA do banco. Esta sonda acha essas colunas (refuta o "regex nome→codp"
# do plano original). fotospac→Cidadao.fotoUrl ; fotospron/filespron→AnexoCidadao.
set -uo pipefail
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && break
  sleep 1
done
DCH() { docker exec amplimed-src mariadb -uroot -psrc -e "$1" amplimed; }

echo "=== colunas que podem referenciar mídia (hash) ==="
DCH "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.columns
     WHERE table_schema='amplimed' AND (
       COLUMN_NAME LIKE '%foto%' OR COLUMN_NAME LIKE '%imagem%' OR COLUMN_NAME LIKE '%img%'
       OR COLUMN_NAME LIKE '%arquivo%' OR COLUMN_NAME LIKE '%file%' OR COLUMN_NAME LIKE '%anexo%'
       OR COLUMN_NAME LIKE '%path%' OR COLUMN_NAME LIKE '%hash%')
     ORDER BY TABLE_NAME, COLUMN_NAME;"
