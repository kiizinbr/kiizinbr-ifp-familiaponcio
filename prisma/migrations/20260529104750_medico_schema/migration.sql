-- CreateEnum
CREATE TYPE "StatusSlot" AS ENUM ('disponivel', 'reservado', 'bloqueado', 'realizado', 'faltou', 'cancelado');

-- CreateEnum
CREATE TYPE "StatusConsulta" AS ENUM ('agendada', 'confirmada', 'em_atendimento', 'realizada', 'faltou', 'cancelada');

-- CreateTable
CREATE TABLE "Especialidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "duracaoPadraoMin" INTEGER NOT NULL,
    "corDestaque" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Especialidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profissional" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "conselho" TEXT NOT NULL,
    "nroConselho" TEXT NOT NULL,
    "bio" TEXT,
    "fotoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfissionalEspecialidade" (
    "profissionalId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfissionalEspecialidade_pkey" PRIMARY KEY ("profissionalId","especialidadeId")
);

-- CreateTable
CREATE TABLE "AgendaTemplate" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,
    "diasSemana" INTEGER[],
    "faixaInicio" TEXT NOT NULL,
    "faixaFim" TEXT NOT NULL,
    "duracaoSlotMin" INTEGER NOT NULL,
    "validoDe" TIMESTAMP(3) NOT NULL,
    "validoAte" TIMESTAMP(3),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,
    "templateId" TEXT,
    "dataHoraInicio" TIMESTAMP(3) NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "status" "StatusSlot" NOT NULL DEFAULT 'disponivel',
    "motivoBloqueio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consulta" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,
    "status" "StatusConsulta" NOT NULL DEFAULT 'agendada',
    "observacoesAgendamento" TEXT,
    "origemTriagemId" TEXT,
    "cancelMotivo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consulta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Especialidade_nome_key" ON "Especialidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Profissional_userId_key" ON "Profissional"("userId");

-- CreateIndex
CREATE INDEX "AgendaTemplate_profissionalId_ativo_idx" ON "AgendaTemplate"("profissionalId", "ativo");

-- CreateIndex
CREATE INDEX "Slot_status_dataHoraInicio_idx" ON "Slot"("status", "dataHoraInicio");

-- CreateIndex
CREATE INDEX "Slot_especialidadeId_status_dataHoraInicio_idx" ON "Slot"("especialidadeId", "status", "dataHoraInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_profissionalId_dataHoraInicio_key" ON "Slot"("profissionalId", "dataHoraInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Consulta_slotId_key" ON "Consulta"("slotId");

-- CreateIndex
CREATE INDEX "Consulta_profissionalId_status_idx" ON "Consulta"("profissionalId", "status");

-- CreateIndex
CREATE INDEX "Consulta_cidadaoId_idx" ON "Consulta"("cidadaoId");

-- CreateIndex
CREATE INDEX "Consulta_status_createdAt_idx" ON "Consulta"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfissionalEspecialidade" ADD CONSTRAINT "ProfissionalEspecialidade_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfissionalEspecialidade" ADD CONSTRAINT "ProfissionalEspecialidade_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "Especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaTemplate" ADD CONSTRAINT "AgendaTemplate_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "Especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgendaTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "Especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
