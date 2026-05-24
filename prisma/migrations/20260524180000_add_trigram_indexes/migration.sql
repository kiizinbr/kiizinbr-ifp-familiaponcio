-- Plano 3 §0.6: busca fuzzy via trigram em campos textuais da Ficha Cidadã

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "cidadao_nome_trgm_idx"
  ON "Cidadao" USING gin ("nomeCompleto" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_nome_social_trgm_idx"
  ON "Cidadao" USING gin ("nomeSocial" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_cpf_trgm_idx"
  ON "Cidadao" USING gin ("cpf" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "cidadao_tel_trgm_idx"
  ON "Cidadao" USING gin ("telefonePrincipal" gin_trgm_ops);
