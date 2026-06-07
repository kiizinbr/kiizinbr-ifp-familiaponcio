#!/usr/bin/env bash
# Inspeção READ-ONLY das consultas Amplimed: densidade por dia (p/ dimensionar o
# slot sintético sem colidir @@unique[profissionalId,dataHoraInicio]), cobertura
# da narrativa clínica (queixa/conduta/cid10) e impacto dos codu sem usuario.
set -uo pipefail
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && break
  sleep 1
done
DCH() { docker exec amplimed-src mariadb -uroot -psrc -e "$1" amplimed; }

echo "=== max/avg consultas por (codu, dia) ==="
DCH "SELECT MAX(n) AS max_dia, ROUND(AVG(n),1) AS avg_dia FROM (SELECT codu, dtconsulta, COUNT(*) n FROM consulta WHERE dtconsulta IS NOT NULL AND dtconsulta<>'' GROUP BY codu, dtconsulta) t;"

echo ""
echo "=== top 5 dias mais densos (codu|dia|n) ==="
DCH "SELECT codu, dtconsulta, COUNT(*) n FROM consulta WHERE dtconsulta IS NOT NULL AND dtconsulta<>'' GROUP BY codu, dtconsulta ORDER BY n DESC LIMIT 5;"

echo ""
echo "=== cobertura da narrativa clínica (de 94469) ==="
DCH "SELECT
       SUM(queixa   IS NOT NULL AND queixa<>'')   AS com_queixa,
       SUM(conduta  IS NOT NULL AND conduta<>'')  AS com_conduta,
       SUM(descfis  IS NOT NULL AND descfis<>'')  AS com_examefisico,
       SUM(cid10    IS NOT NULL AND cid10<>'')    AS com_cid10,
       SUM(meds     IS NOT NULL AND meds<>'')     AS com_meds
     FROM consulta;"

echo ""
echo "=== consultas de codu SEM linha em usuarios (serão puladas) ==="
DCH "SELECT c.codu, COUNT(*) n FROM consulta c LEFT JOIN usuarios u ON u.codu=c.codu WHERE u.codu IS NULL GROUP BY c.codu ORDER BY n DESC;"
