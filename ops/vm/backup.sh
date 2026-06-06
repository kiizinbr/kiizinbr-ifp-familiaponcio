#!/usr/bin/env bash
# Backup CIFRADO do banco do IFP Connect.
# - pg_dump comprimido (gzip) e cifrado com `age` em streaming (sem plaintext em disco)
# - chave privada gerada na 1a execucao e mantida SO na VM (perms 600, fora do git)
# - rotacao local (mantem os KEEP mais recentes)
# - off-VM: o host Windows puxa o .age mais recente via scp agendado (pull-ifp-backup.ps1)
# Roda como erickramos via `sudo docker` (NOPASSWD). Ao endurecer o sudo,
# migrar erickramos pro grupo `docker` e trocar `sudo docker` por `docker`.
#
# DR: a chave (ops/vm/secrets/age-backup.key) vive SO na VM. Sem ela o .age NAO
# abre. Faca uma copia da chave OUT-OF-BAND (cofre/gestor de senhas) — senao,
# perder a VM = perder o backup. A chave PUBLICA e impressa na 1a geracao.
set -euo pipefail

BACKUP_DIR=/opt/ifp-connect/backups
SECRETS_DIR=/opt/ifp-connect/ops/vm/secrets
KEY_FILE="$SECRETS_DIR/age-backup.key"
KEEP=7
PG_CONTAINER=ifp-prod-postgres-1

command -v age >/dev/null 2>&1 || {
  echo "ERRO: 'age' nao instalado. Rode: sudo apt-get install -y age" >&2
  exit 2
}

# 1a execucao: gera a chave de cifra e imprime a publica pra backup out-of-band
if [ ! -f "$KEY_FILE" ]; then
  mkdir -p "$SECRETS_DIR"
  chmod 700 "$SECRETS_DIR"
  age-keygen -o "$KEY_FILE" 2>/dev/null
  chmod 600 "$KEY_FILE"
  echo "==> chave de backup gerada em $KEY_FILE (perms 600)"
  echo "==> GUARDE A CHAVE PUBLICA (recipient) OUT-OF-BAND:"
  age-keygen -y "$KEY_FILE"
fi

RECIPIENT=$(age-keygen -y "$KEY_FILE")

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/ifp_connect-$TS.sql.gz.age"

# limpa parcial se a pipeline falhar (pipefail propaga falha do pg_dump)
trap 'rm -f "$OUT"' ERR

sudo docker exec "$PG_CONTAINER" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' |
  gzip -9 |
  age -r "$RECIPIENT" -o "$OUT"

# sanity: arquivo cifrado real tem KBs; <200 bytes = dump vazio/erro
if [ ! -s "$OUT" ] || [ "$(stat -c%s "$OUT")" -lt 200 ]; then
  echo "ERRO: backup vazio ou suspeito ($OUT)" >&2
  rm -f "$OUT"
  exit 1
fi

trap - ERR

# rotacao: remove tudo alem dos KEEP mais recentes (so .age)
ls -1t "$BACKUP_DIR"/ifp_connect-*.sql.gz.age 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "OK $OUT $(du -h "$OUT" | cut -f1)"
