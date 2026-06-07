#!/usr/bin/env bash
# Restaura o dump de tabelas da Amplimed num MariaDB Docker DESCARTÁVEL (local).
# Uso: bash scripts/migracao-amplimed/00-restore-mariadb.sh <caminho-do-zip-tables>
# Origem fica em 127.0.0.1:3399/amplimed (root/src). Derrubar pós: docker rm -f amplimed-src
set -euo pipefail

ZIP="${1:?uso: 00-restore-mariadb.sh <caminho-do-zip-tables>}"
TMP="$(mktemp -d)"
echo "Extraindo em $TMP ..."
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$ZIP" -d "$TMP"
else
  python3 -c 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$ZIP" "$TMP"
fi

docker rm -f amplimed-src >/dev/null 2>&1 || true
echo "Subindo MariaDB descartável ..."
docker run -d --name amplimed-src \
  -e MARIADB_ROOT_PASSWORD=src -e MARIADB_DATABASE=amplimed \
  -p 3399:3306 mariadb:11 >/dev/null

echo "Aguardando o MariaDB aceitar conexões ..."
until docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "Carregando 118 tabelas (consulta_configuracao=773MB demora) ..."
n=0
for f in "$TMP"/amplimed33643/*.sql; do
  n=$((n + 1))
  docker exec -i amplimed-src mariadb -uroot -psrc amplimed <"$f"
done

echo "OK: $n arquivos carregados. Origem em 127.0.0.1:3399/amplimed (root/src)."
rm -rf "$TMP"
