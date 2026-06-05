-- Recria os índices GIN trigram da Ficha Cidadã que a migration
-- 20260524234544_add_audit_root_entity dropou sem recriar — a busca fuzzy de
-- cidadão (cpf/nome/nomeSocial/telefone) estava degradada para seq-scan ILIKE.
-- Espelha 20260524180000_add_trigram_indexes (CREATE INDEX sem CONCURRENTLY:
-- o Prisma roda migrations em transação e CONCURRENTLY não é permitido nela).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "cidadao_nome_trgm_idx"
  ON "Cidadao" USING gin ("nomeCompleto" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_nome_social_trgm_idx"
  ON "Cidadao" USING gin ("nomeSocial" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_cpf_trgm_idx"
  ON "Cidadao" USING gin ("cpf" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_tel_trgm_idx"
  ON "Cidadao" USING gin ("telefonePrincipal" gin_trgm_ops);
