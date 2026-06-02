-- CreateEnum
CREATE TYPE "StatusNota" AS ENUM ('rascunho', 'assinada');

-- CreateTable
CREATE TABLE "NotaEvolucao" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "texto" TEXT,
    "paSistolica" INTEGER,
    "paDiastolica" INTEGER,
    "fcBpm" INTEGER,
    "frIrpm" INTEGER,
    "tempC" DECIMAL(4,1),
    "pesoKg" DECIMAL(5,2),
    "alturaCm" INTEGER,
    "spo2" INTEGER,
    "status" "StatusNota" NOT NULL DEFAULT 'rascunho',
    "assinadaEm" TIMESTAMP(3),
    "assinadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaEvolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddendoNota" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddendoNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticoNota" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "codigoCid" TEXT,
    "descricao" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticoNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cid10" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "capitulo" TEXT,

    CONSTRAINT "Cid10_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaEvolucao_consultaId_key" ON "NotaEvolucao"("consultaId");

-- CreateIndex
CREATE INDEX "NotaEvolucao_cidadaoId_createdAt_idx" ON "NotaEvolucao"("cidadaoId", "createdAt");

-- CreateIndex
CREATE INDEX "NotaEvolucao_profissionalId_idx" ON "NotaEvolucao"("profissionalId");

-- CreateIndex
CREATE INDEX "AddendoNota_notaId_createdAt_idx" ON "AddendoNota"("notaId", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticoNota_notaId_idx" ON "DiagnosticoNota"("notaId");

-- CreateIndex
CREATE INDEX "DiagnosticoNota_codigoCid_idx" ON "DiagnosticoNota"("codigoCid");

-- CreateIndex
CREATE INDEX "Cid10_descricao_idx" ON "Cid10"("descricao");

-- AddForeignKey
ALTER TABLE "NotaEvolucao" ADD CONSTRAINT "NotaEvolucao_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "Consulta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaEvolucao" ADD CONSTRAINT "NotaEvolucao_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaEvolucao" ADD CONSTRAINT "NotaEvolucao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddendoNota" ADD CONSTRAINT "AddendoNota_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaEvolucao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticoNota" ADD CONSTRAINT "DiagnosticoNota_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaEvolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
