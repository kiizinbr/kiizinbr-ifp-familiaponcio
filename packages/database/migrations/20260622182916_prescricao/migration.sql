-- CreateTable
CREATE TABLE "prescricoes" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "observacoes" TEXT,
    "alergiaOverride" BOOLEAN NOT NULL DEFAULT false,
    "alergiaOverrideMotivo" TEXT,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescricao_itens" (
    "id" TEXT NOT NULL,
    "prescricaoId" TEXT NOT NULL,
    "medicamento" TEXT NOT NULL,
    "posologia" TEXT NOT NULL,
    "conflitoAlergia" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescricao_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescricoes_atendimentoId_idx" ON "prescricoes"("atendimentoId");

-- CreateIndex
CREATE INDEX "prescricoes_fichaId_idx" ON "prescricoes"("fichaId");

-- CreateIndex
CREATE INDEX "prescricao_itens_prescricaoId_idx" ON "prescricao_itens"("prescricaoId");

-- AddForeignKey
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricao_itens" ADD CONSTRAINT "prescricao_itens_prescricaoId_fkey" FOREIGN KEY ("prescricaoId") REFERENCES "prescricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
