-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('aberta', 'pausada', 'encerrada');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');

-- CreateTable
CREATE TABLE "Vaga" (
    "id" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "slotsTotais" INTEGER NOT NULL DEFAULT 0,
    "abreEm" TIMESTAMP(3),
    "fechaEm" TIMESTAMP(3),
    "status" "StatusVaga" NOT NULL DEFAULT 'aberta',
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "nomeInteressado" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "horario" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'agendado',
    "consenteContato" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "cidadaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vaga_unidade_status_idx" ON "Vaga"("unidade", "status");

-- CreateIndex
CREATE INDEX "Agendamento_vagaId_status_idx" ON "Agendamento"("vagaId", "status");

-- CreateIndex
CREATE INDEX "Agendamento_cidadaoId_idx" ON "Agendamento"("cidadaoId");

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "Vaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
