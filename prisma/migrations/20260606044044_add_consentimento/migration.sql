-- CreateEnum
CREATE TYPE "TipoConsentimento" AS ENUM ('tratamento_dados', 'imagem');

-- CreateTable
CREATE TABLE "Consentimento" (
    "id" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "tipo" "TipoConsentimento" NOT NULL,
    "versao" TEXT NOT NULL,
    "imagemInterno" BOOLEAN NOT NULL DEFAULT false,
    "imagemRedes" BOOLEAN NOT NULL DEFAULT false,
    "imagemImprensa" BOOLEAN NOT NULL DEFAULT false,
    "registradoPor" TEXT NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consentimento_cidadaoId_idx" ON "Consentimento"("cidadaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Consentimento_cidadaoId_tipo_key" ON "Consentimento"("cidadaoId", "tipo");

-- AddForeignKey
ALTER TABLE "Consentimento" ADD CONSTRAINT "Consentimento_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
