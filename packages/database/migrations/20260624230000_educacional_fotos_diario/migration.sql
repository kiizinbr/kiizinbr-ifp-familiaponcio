-- CreateTable
CREATE TABLE "fotos_diario" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "legenda" TEXT,
    "profissionalId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fotos_diario_diarioId_idx" ON "fotos_diario"("diarioId");

-- AddForeignKey
ALTER TABLE "fotos_diario" ADD CONSTRAINT "fotos_diario_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "diarios_dia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_diario" ADD CONSTRAINT "fotos_diario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
