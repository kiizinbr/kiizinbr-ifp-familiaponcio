#!/usr/bin/env bash
# READ-ONLY: estado do Postgres prod antes do cutover (demo + currency do schema).
set -uo pipefail
docker exec -i ifp-prod-postgres-1 bash -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
\echo == contagens (dados demo atuais) ==
SELECT 'users' t, count(*) n FROM "User"
UNION ALL SELECT 'cidadaos', count(*) FROM "Cidadao"
UNION ALL SELECT 'consultas', count(*) FROM "Consulta"
UNION ALL SELECT 'especialidades', count(*) FROM "Especialidade"
UNION ALL SELECT 'profissionais', count(*) FROM "Profissional"
ORDER BY 1;
\echo == schema currency ==
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='MigracaoAmplimedMap') AS tem_migracao_map;
SELECT column_name, is_nullable FROM information_schema.columns
  WHERE table_name='Cidadao' AND column_name IN ('cpf','telefonePrincipal','dataNascimento') ORDER BY 1;
\echo == ultimas migrations aplicadas ==
SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 4;
SQL
