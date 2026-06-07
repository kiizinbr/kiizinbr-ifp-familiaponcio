#!/usr/bin/env bash
# T15 — descobre os VALORES de vínculo mídia↔registro p/ montar o JOIN.
# Confere se o que está em pacientes.fotopac / consulta.anxfoto* casa com o
# nome-hash das entradas dos ZIPs (ex.: 0832f4d...png).
set -uo pipefail
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && break
  sleep 1
done
DCH() { docker exec amplimed-src mariadb -uroot -psrc -e "$1" amplimed; }

echo "=== pacientes.fotopac — amostra + cobertura ==="
DCH "SELECT codp, fotopac FROM pacientes WHERE fotopac IS NOT NULL AND fotopac<>'' LIMIT 6;"
DCH "SELECT COUNT(*) AS com_fotopac FROM pacientes WHERE fotopac IS NOT NULL AND fotopac<>'';"

echo ""
echo "=== consulta.anxfoto1/2/3 + legfotos — amostra ==="
DCH "SELECT codcon, codp, anxfoto1, anxfoto2, anxfoto3, legfotos FROM consulta
     WHERE (anxfoto1 IS NOT NULL AND anxfoto1<>'') LIMIT 6;"
DCH "SELECT
       SUM(anxfoto1 IS NOT NULL AND anxfoto1<>'') AS c1,
       SUM(anxfoto2 IS NOT NULL AND anxfoto2<>'') AS c2,
       SUM(anxfoto3 IS NOT NULL AND anxfoto3<>'') AS c3
     FROM consulta;"

echo ""
echo "=== pacsimg — estrutura + amostra + cobertura ==="
DCH "DESCRIBE pacsimg;"
DCH "SELECT * FROM pacsimg LIMIT 5;"
DCH "SELECT COUNT(*) AS total_pacsimg FROM pacsimg;"

echo ""
echo "=== usuarios.img + pacientes.imgCarteiraConv — cobertura ==="
DCH "SELECT COUNT(*) AS usuarios_com_img FROM usuarios WHERE img IS NOT NULL AND img<>'';"
DCH "SELECT COUNT(*) AS pac_com_carteira FROM pacientes WHERE imgCarteiraConv IS NOT NULL AND imgCarteiraConv<>'';"
