#!/usr/bin/env bash
# DRILL de restore: prova que o backup CIFRADO mais recente volta de verdade.
# - cria um banco DESCARTAVEL (ifp_restore_drill), restaura o .age mais recente nele,
#   verifica (n de tabelas + linhas em _prisma_migrations), e DERRUBA o banco.
# - NAO toca no banco vivo. Pensado pra rodar agendado (ex.: semanal) ou sob demanda.
set -euo pipefail

BACKUP_DIR=/opt/ifp-connect/backups
PG_CONTAINER=ifp-prod-postgres-1
DRILL_DB=ifp_restore_drill
HERE="$(dirname "$0")"

psql_admin() {
  sudo docker exec "$PG_CONTAINER" sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -tAq -U "$POSTGRES_USER" -d postgres -c "'"$1"'"'
}
psql_drill() {
  sudo docker exec "$PG_CONTAINER" sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -tAq -U "$POSTGRES_USER" -d "'"$DRILL_DB"'" -c "'"$1"'"'
}

LATEST=$(ls -1t "$BACKUP_DIR"/ifp_connect-*.sql.gz.age 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "FALHA: nenhum backup .age encontrado em $BACKUP_DIR" >&2
  exit 1
fi
echo "==> backup alvo do drill: $LATEST"

# limpa drill anterior (se sobrou) e cria banco descartavel
psql_admin "DROP DATABASE IF EXISTS \"$DRILL_DB\""
psql_admin "CREATE DATABASE \"$DRILL_DB\""
trap 'psql_admin "DROP DATABASE IF EXISTS \"'"$DRILL_DB"'\"" >/dev/null 2>&1 || true' EXIT

# restaura nele
bash "$HERE/restore.sh" "$LATEST" "$DRILL_DB"

# verificacao
TABLES=$(psql_drill "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
MIGRATIONS=$(psql_drill "SELECT count(*) FROM \"_prisma_migrations\"" 2>/dev/null || echo 0)
echo "==> verificacao: $TABLES tabelas, $MIGRATIONS migrations aplicadas no restore"

if [ "${TABLES:-0}" -ge 10 ] && [ "${MIGRATIONS:-0}" -ge 1 ]; then
  echo "DRILL PASS: backup restauravel ($TABLES tabelas / $MIGRATIONS migrations)"
else
  echo "DRILL FAIL: restore incompleto ($TABLES tabelas / $MIGRATIONS migrations)" >&2
  exit 1
fi
# banco descartavel cai no trap EXIT
