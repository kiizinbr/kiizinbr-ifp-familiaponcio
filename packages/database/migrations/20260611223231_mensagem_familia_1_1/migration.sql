-- CreateTable
CREATE TABLE "conversas_familia" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_familia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_familia" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "ladoEquipe" BOOLEAN NOT NULL,
    "corpo" TEXT NOT NULL,
    "lidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_familia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversas_familia_membroId_key" ON "conversas_familia"("membroId");

-- CreateIndex
CREATE INDEX "conversas_familia_unidadeId_idx" ON "conversas_familia"("unidadeId");

-- CreateIndex
CREATE INDEX "mensagens_familia_conversaId_criadoEm_idx" ON "mensagens_familia"("conversaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "conversas_familia" ADD CONSTRAINT "conversas_familia_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas_familia" ADD CONSTRAINT "conversas_familia_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas_familia" ADD CONSTRAINT "conversas_familia_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_familia" ADD CONSTRAINT "mensagens_familia_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_familia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_familia" ADD CONSTRAINT "mensagens_familia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
