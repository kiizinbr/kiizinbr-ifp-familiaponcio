#!/usr/bin/env bash
# Inspeção READ-ONLY da origem Amplimed (MariaDB descartável, porta 3399).
# Fixa as decisões do checkpoint: §0.E mapa especialidade int->nome,
# conselho sujo, codus referenciados por consulta, contas admin a excluir.
# Uso: wsl -d Ubuntu -- bash /mnt/c/Users/Administrador/ifp-connect/scripts/migracao-amplimed/05-inspecionar-origem.sh
set -uo pipefail

# WSL2 hiberna e derruba o container → start idempotente + espera readiness.
docker start amplimed-src >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 && break
  sleep 1
done

DC() { docker exec amplimed-src mariadb -uroot -psrc -N -e "$1" amplimed; }   # sem cabeçalho
DCH() { docker exec amplimed-src mariadb -uroot -psrc -e "$1" amplimed; }     # com cabeçalho

echo "=== SANITY ==="
DC "SELECT 'pacientes', COUNT(*) FROM pacientes UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios UNION ALL SELECT 'consulta', COUNT(*) FROM consulta;"

echo ""
echo "=== TABELAS com 'espec' no nome ==="
DC "SELECT table_name FROM information_schema.tables WHERE table_schema='amplimed' AND table_name LIKE '%espec%';"

echo ""
echo "=== especialidades (dump, se a tabela existir) ==="
DCH "SELECT * FROM especialidades LIMIT 80;" 2>/dev/null || echo "(sem tabela 'especialidades')"

echo ""
echo "=== codus DISTINCT referenciados por consulta ==="
DC "SELECT COUNT(DISTINCT codu) FROM consulta;"

echo ""
echo "=== usuarios REFERENCIADOS por consulta (codu|nome|usuario|conselho|registroprof|registrouf|especialidade|userstatus|n_consultas) ==="
DCH "SELECT u.codu, u.nome, u.usuario, u.conselho, u.registroprof, u.registrouf, u.especialidade, u.userstatus, c.n AS n_consultas
     FROM usuarios u
     JOIN (SELECT codu, COUNT(*) n FROM consulta GROUP BY codu) c ON c.codu = u.codu
     ORDER BY c.n DESC;"

echo ""
echo "=== distinct 'especialidade' (int) entre os referenciados ==="
DCH "SELECT u.especialidade, COUNT(*) AS n_profs
     FROM usuarios u
     JOIN (SELECT DISTINCT codu FROM consulta) c ON c.codu = u.codu
     GROUP BY u.especialidade ORDER BY n_profs DESC;"

echo ""
echo "=== possíveis contas ADMIN (excluir) ==="
DCH "SELECT codu, nome, usuario, userstatus FROM usuarios
     WHERE usuario LIKE '%erick%' OR usuario LIKE '%suporte%'
        OR nome LIKE '%suporte%' OR nome LIKE '%amplimed%';"

echo ""
echo "=== amostra dtconsulta (formato) ==="
DC "SELECT dtconsulta FROM consulta WHERE dtconsulta IS NOT NULL AND dtconsulta<>'' ORDER BY codcon DESC LIMIT 5;"

echo ""
echo "=== consultas com dtconsulta NULL/vazio ==="
DC "SELECT COUNT(*) FROM consulta WHERE dtconsulta IS NULL OR dtconsulta='';"

echo ""
echo "=== consultas órfãs (codp sem paciente) ==="
DC "SELECT COUNT(*) FROM consulta c LEFT JOIN pacientes p ON p.codp=c.codp WHERE p.codp IS NULL;"

echo ""
echo "=== consultas cujo codu é admin (911943/911944) — serão puladas ==="
DC "SELECT COUNT(*) FROM consulta WHERE codu IN (911943, 911944);"

echo ""
echo "=== amostra paciente (nome|dtnasc|celular|cpf|nTemCpf) ==="
DCH "SELECT nome, dtnasc, celular, cpf, nTemCpf FROM pacientes ORDER BY codp DESC LIMIT 6;"

echo ""
echo "=== pacientes sem nome ==="
DC "SELECT COUNT(*) FROM pacientes WHERE nome IS NULL OR TRIM(nome)='';"
