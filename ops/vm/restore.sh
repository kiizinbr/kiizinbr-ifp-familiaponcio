#!/usr/bin/env bash
# Restore de um backup CIFRADO (.sql.gz.age) do IFP Connect num banco-alvo.
# Uso: ./restore.sh <arquivo.sql.gz.age> <banco_alvo>
#   - decifra com a chave da VM (age) -> gunzip -> psql no container postgres
#   - banco_alvo DEVE existir (crie antes: ifp_restore_drill p/ ensaio)
#   - trava: se banco_alvo == banco VIVO, exige CONFIRM=yes (evita clobber acidental)
set -euo pipefail

KEY_FILE=/opt/ifp-connect/ops/vm/secrets/age-backup.key
PG_CONTAINER=ifp-prod-postgres-1

BACKUP="${1:-}"
TARGET_DB="${2:-}"

if [ -z "$BACKUP" ] || [ -z "$TARGET_DB" ]; then
  echo "Uso: $0 <arquivo.sql.gz.age> <banco_alvo>" >&2
  exit 2
fi
[ -f "$BACKUP" ] || {
  echo "ERRO: backup nao encontrado: $BACKUP" >&2
  exit 2
}
[ -f "$KEY_FILE" ] || {
  echo "ERRO: chave de cifra ausente: $KEY_FILE" >&2
  exit 2
}
command -v age >/dev/null 2>&1 || {
  echo "ERRO: 'age' nao instalado" >&2
  exit 2
}

# trava anti-clobber do banco vivo
LIVE_DB=$(sudo docker exec "$PG_CONTAINER" sh -c 'echo "$POSTGRES_DB"')
if [ "$TARGET_DB" = "$LIVE_DB" ] && [ "${CONFIRM:-}" != "yes" ]; then
  echo "RECUSADO: '$TARGET_DB' e o banco VIVO. Pra sobrescrever: CONFIRM=yes $0 ..." >&2
  exit 3
fi

echo "==> restaurando $BACKUP -> banco '$TARGET_DB'"
age -d -i "$KEY_FILE" "$BACKUP" |
  gunzip |
  sudo docker exec -i "$PG_CONTAINER" sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "'"$TARGET_DB"'"' \
    >/dev/null

echo "OK restore concluido em '$TARGET_DB'"
