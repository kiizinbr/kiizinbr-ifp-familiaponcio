#!/usr/bin/env bash
# Monitor de progresso do --commit: conta a proveniência no Postgres dev.
# Usa as credenciais do PRÓPRIO container (não expõe segredo).
docker exec ifp_postgres_dev bash -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -F"|" -c "SELECT entidade, count(*) FROM \"MigracaoAmplimedMap\" GROUP BY entidade ORDER BY 1;"' 2>&1
