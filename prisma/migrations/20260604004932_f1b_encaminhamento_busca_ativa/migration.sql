-- CreateEnum
CREATE TYPE "StatusEncaminhamento" AS ENUM ('aguardando_agendamento', 'agendado', 'cancelado');

-- AlterTable
ALTER TABLE "Consulta" ADD COLUMN     "origemEncaminhamentoId" TEXT;

-- CreateTable
CREATE TABLE "Encaminhamento" (
    "id" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "consultaOrigemId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,
    "motivo" TEXT,
    "status" "StatusEncaminhamento" NOT NULL DEFAULT 'aguardando_agendamento',
    "createdBy" TEXT NOT NULL,
    "canceladoMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encaminhamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Encaminhamento_status_createdAt_idx" ON "Encaminhamento"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Encaminhamento_cidadaoId_idx" ON "Encaminhamento"("cidadaoId");

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_origemEncaminhamentoId_fkey" FOREIGN KEY ("origemEncaminhamentoId") REFERENCES "Encaminhamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encaminhamento" ADD CONSTRAINT "Encaminhamento_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encaminhamento" ADD CONSTRAINT "Encaminhamento_consultaOrigemId_fkey" FOREIGN KEY ("consultaOrigemId") REFERENCES "Consulta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encaminhamento" ADD CONSTRAINT "Encaminhamento_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "Especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
