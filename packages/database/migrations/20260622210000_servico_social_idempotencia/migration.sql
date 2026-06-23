-- Idempotência da fila do Serviço Social (achado #7).
-- Bloqueia duplicata por duplo-clique/retry de rede com índices únicos PARCIAIS
-- (só sobre os registros PENDENTE). Prisma não expressa partial unique no schema,
-- por isso a migração é SQL cru. IF NOT EXISTS torna a aplicação idempotente.

-- Triagem: no máximo 1 triagem PENDENTE por ficha.
CREATE UNIQUE INDEX IF NOT EXISTS "triagens_ficha_pendente_uniq"
  ON "triagens" ("fichaId")
  WHERE "status" = 'PENDENTE'::"StatusTriagem";

-- Encaminhamento: no máximo 1 PENDENTE por (ficha, origem, destino).
CREATE UNIQUE INDEX IF NOT EXISTS "encaminhamentos_ficha_rota_pendente_uniq"
  ON "encaminhamentos" ("fichaId", "unidadeOrigemId", "unidadeDestinoId")
  WHERE "status" = 'PENDENTE'::"StatusEncaminhamento";

-- Ponte: no máximo 1 sinalização PENDENTE por (ficha, origem, tipo).
CREATE UNIQUE INDEX IF NOT EXISTS "sinalizacoes_ponte_ficha_origem_tipo_pendente_uniq"
  ON "sinalizacoes_ponte" ("fichaId", "unidadeOrigemId", "tipo")
  WHERE "status" = 'PENDENTE'::"StatusSinalizacao";
