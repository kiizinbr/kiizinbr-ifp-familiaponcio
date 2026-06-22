-- CreateEnum
CREATE TYPE "StatusTriagem" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "PrioridadeTriagem" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "triagens" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "status" "StatusTriagem" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" "PrioridadeTriagem" NOT NULL DEFAULT 'MEDIA',
    "motivoSolicitacao" TEXT,
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "triagens_status_prioridade_idx" ON "triagens"("status", "prioridade");

-- CreateIndex
CREATE INDEX "triagens_fichaId_idx" ON "triagens"("fichaId");

-- AddForeignKey
ALTER TABLE "triagens" ADD CONSTRAINT "triagens_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
