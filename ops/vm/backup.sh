#!/usr/bin/env bash
# Backup do banco do IFP Connect (staging).
# - pg_dump comprimido com as credenciais do proprio container postgres
# - rotacao local (mantem os KEEP mais recentes)
# - off-VM: o host Windows puxa o mais recente via scp agendado (ver runbook)
# Roda como erickramos via `sudo docker` (NOPASSWD). Ao endurecer o sudo,
# migrar erickramos pro grupo `docker` e trocar `sudo docker` por `docker`.
set -euo pipefail

BACKUP_DIR=/opt/ifp-connect/backups
KEEP=7
PG_CONTAINER=ifp-prod-postgres-1

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/ifp_connect-$TS.sql.gz"

sudo docker exec "$PG_CONTAINER" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$OUT"

if [ ! -s "$OUT" ]; then
  echo "ERRO: dump vazio" >&2
  rm -f "$OUT"
  exit 1
fi

# rotacao: remove tudo alem dos KEEP mais recentes
ls -1t "$BACKUP_DIR"/ifp_connect-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "OK $OUT $(du -h "$OUT" | cut -f1)"
