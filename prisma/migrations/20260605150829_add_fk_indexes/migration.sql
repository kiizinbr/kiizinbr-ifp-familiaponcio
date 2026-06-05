-- CreateIndex
CREATE INDEX "AgendaTemplate_especialidadeId_idx" ON "AgendaTemplate"("especialidadeId");

-- CreateIndex
CREATE INDEX "Consulta_createdBy_idx" ON "Consulta"("createdBy");

-- CreateIndex
CREATE INDEX "Consulta_origemTriagemId_idx" ON "Consulta"("origemTriagemId");

-- CreateIndex
CREATE INDEX "Consulta_origemEncaminhamentoId_idx" ON "Consulta"("origemEncaminhamentoId");

-- CreateIndex
CREATE INDEX "Encaminhamento_createdBy_idx" ON "Encaminhamento"("createdBy");

-- CreateIndex
CREATE INDEX "Encaminhamento_consultaOrigemId_idx" ON "Encaminhamento"("consultaOrigemId");

-- CreateIndex
CREATE INDEX "Matricula_createdBy_idx" ON "Matricula"("createdBy");

-- CreateIndex
CREATE INDEX "Matricula_origemTriagemId_idx" ON "Matricula"("origemTriagemId");

-- CreateIndex
CREATE INDEX "ProfissionalEspecialidade_especialidadeId_idx" ON "ProfissionalEspecialidade"("especialidadeId");
