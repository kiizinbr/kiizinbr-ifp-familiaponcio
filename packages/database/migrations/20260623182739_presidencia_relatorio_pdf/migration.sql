-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('PRESTACAO_CONTAS', 'IMPACTO');

-- CreateTable
CREATE TABLE "relatorios_pdf" (
    "id" TEXT NOT NULL,
    "tipo" "TipoRelatorio" NOT NULL,
    "periodo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "geradoPorId" TEXT,
    "geradoPorNome" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "relatorios_pdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_pdf_codigo_key" ON "relatorios_pdf"("codigo");

-- CreateIndex
CREATE INDEX "relatorios_pdf_tipo_idx" ON "relatorios_pdf"("tipo");

-- CreateIndex
CREATE INDEX "relatorios_pdf_geradoEm_idx" ON "relatorios_pdf"("geradoEm");

-- AddForeignKey
ALTER TABLE "relatorios_pdf" ADD CONSTRAINT "relatorios_pdf_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
