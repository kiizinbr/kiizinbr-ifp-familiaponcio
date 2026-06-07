-- AlterTable
ALTER TABLE "Cidadao" ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "dataNascimento" DROP NOT NULL,
ALTER COLUMN "telefonePrincipal" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MigracaoAmplimedMap" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "idOrigem" TEXT NOT NULL,
    "idDestino" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigracaoAmplimedMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigracaoAmplimedMap_idDestino_idx" ON "MigracaoAmplimedMap"("idDestino");

-- CreateIndex
CREATE UNIQUE INDEX "MigracaoAmplimedMap_entidade_idOrigem_key" ON "MigracaoAmplimedMap"("entidade", "idOrigem");
