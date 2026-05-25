-- CreateEnum
CREATE TYPE "StatusCadastro" AS ENUM ('rascunho', 'ativo', 'inativo');

-- CreateEnum
CREATE TYPE "StatusTriagem" AS ENUM ('aberta', 'concluida');

-- CreateEnum
CREATE TYPE "StatusElegibilidade" AS ENUM ('pendente', 'aprovado', 'negado', 'encaminhado');

-- AlterTable
ALTER TABLE "Cidadao" ADD COLUMN     "statusCadastro" "StatusCadastro" NOT NULL DEFAULT 'ativo';

-- CreateTable
CREATE TABLE "Triagem" (
    "id" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "assistenteSocialId" TEXT NOT NULL,
    "dataEntrevista" TIMESTAMP(3),
    "parecer" TEXT,
    "observacoes" TEXT,
    "situacaoSocio" JSONB,
    "status" "StatusTriagem" NOT NULL DEFAULT 'aberta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Triagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElegibilidadeUnidade" (
    "id" TEXT NOT NULL,
    "triagemId" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "status" "StatusElegibilidade" NOT NULL DEFAULT 'pendente',
    "motivo" TEXT,
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),

    CONSTRAINT "ElegibilidadeUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Triagem_cidadaoId_createdAt_idx" ON "Triagem"("cidadaoId", "createdAt");

-- CreateIndex
CREATE INDEX "Triagem_status_createdAt_idx" ON "Triagem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ElegibilidadeUnidade_unidade_status_idx" ON "ElegibilidadeUnidade"("unidade", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ElegibilidadeUnidade_triagemId_unidade_key" ON "ElegibilidadeUnidade"("triagemId", "unidade");

-- CreateIndex
CREATE INDEX "Cidadao_statusCadastro_idx" ON "Cidadao"("statusCadastro");

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_assistenteSocialId_fkey" FOREIGN KEY ("assistenteSocialId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElegibilidadeUnidade" ADD CONSTRAINT "ElegibilidadeUnidade_triagemId_fkey" FOREIGN KEY ("triagemId") REFERENCES "Triagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElegibilidadeUnidade" ADD CONSTRAINT "ElegibilidadeUnidade_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
