-- CreateTable
CREATE TABLE "Chamada" (
    "id" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "nomeChamado" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "chamadoPor" TEXT NOT NULL,
    "cidadaoId" TEXT,
    "consultaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PainelConfig" (
    "id" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "videoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PainelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PainelAnuncio" (
    "id" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativoAte" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PainelAnuncio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chamada_unidade_criadoEm_idx" ON "Chamada"("unidade", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PainelConfig_unidade_key" ON "PainelConfig"("unidade");

-- CreateIndex
CREATE INDEX "PainelAnuncio_unidade_idx" ON "PainelAnuncio"("unidade");
