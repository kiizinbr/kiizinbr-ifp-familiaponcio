-- CreateEnum
CREATE TYPE "StatusEncaminhamento" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "StatusSinalizacao" AS ENUM ('PENDENTE', 'ATENDIDA');

-- CreateEnum
CREATE TYPE "TipoSinalizacao" AS ENUM ('ENCAMINHAMENTO', 'OBSERVACAO', 'ALERTA');

-- CreateEnum
CREATE TYPE "PrioridadeSinal" AS ENUM ('NORMAL', 'URGENTE');

-- CreateTable
CREATE TABLE "encaminhamentos" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "unidadeOrigemId" TEXT NOT NULL,
    "unidadeDestinoId" TEXT NOT NULL,
    "status" "StatusEncaminhamento" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" "PrioridadeSinal" NOT NULL DEFAULT 'NORMAL',
    "motivo" TEXT NOT NULL,
    "justificativaResposta" TEXT,
    "respondidoPor" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encaminhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinalizacoes_ponte" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "unidadeOrigemId" TEXT NOT NULL,
    "tipo" "TipoSinalizacao" NOT NULL DEFAULT 'ENCAMINHAMENTO',
    "prioridade" "PrioridadeSinal" NOT NULL DEFAULT 'NORMAL',
    "descricao" TEXT NOT NULL,
    "status" "StatusSinalizacao" NOT NULL DEFAULT 'PENDENTE',
    "respondidoPor" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinalizacoes_ponte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "encaminhamentos_unidadeOrigemId_status_idx" ON "encaminhamentos"("unidadeOrigemId", "status");

-- CreateIndex
CREATE INDEX "encaminhamentos_unidadeDestinoId_status_idx" ON "encaminhamentos"("unidadeDestinoId", "status");

-- CreateIndex
CREATE INDEX "encaminhamentos_fichaId_idx" ON "encaminhamentos"("fichaId");

-- CreateIndex
CREATE INDEX "sinalizacoes_ponte_unidadeOrigemId_status_idx" ON "sinalizacoes_ponte"("unidadeOrigemId", "status");

-- CreateIndex
CREATE INDEX "sinalizacoes_ponte_status_criadoEm_idx" ON "sinalizacoes_ponte"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "sinalizacoes_ponte_fichaId_idx" ON "sinalizacoes_ponte"("fichaId");

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_unidadeOrigemId_fkey" FOREIGN KEY ("unidadeOrigemId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamentos" ADD CONSTRAINT "encaminhamentos_unidadeDestinoId_fkey" FOREIGN KEY ("unidadeDestinoId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_ponte" ADD CONSTRAINT "sinalizacoes_ponte_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_ponte" ADD CONSTRAINT "sinalizacoes_ponte_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_ponte" ADD CONSTRAINT "sinalizacoes_ponte_unidadeOrigemId_fkey" FOREIGN KEY ("unidadeOrigemId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
