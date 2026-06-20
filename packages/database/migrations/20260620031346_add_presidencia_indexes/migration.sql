-- CreateIndex
CREATE INDEX "atendimentos_encerradoEm_idx" ON "atendimentos"("encerradoEm");

-- CreateIndex
CREATE INDEX "elegibilidades_status_idx" ON "elegibilidades"("status");

-- CreateIndex
CREATE INDEX "elegibilidades_status_unidadeId_idx" ON "elegibilidades"("status", "unidadeId");

-- CreateIndex
CREATE INDEX "elegibilidades_criadoEm_idx" ON "elegibilidades"("criadoEm");

-- CreateIndex
CREATE INDEX "fichas_cidadas_ativa_idx" ON "fichas_cidadas"("ativa");

-- CreateIndex
CREATE INDEX "fichas_cidadas_criadoEm_idx" ON "fichas_cidadas"("criadoEm");
