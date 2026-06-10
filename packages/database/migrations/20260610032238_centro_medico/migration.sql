-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGENDADO', 'CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'FALTOU', 'CANCELADO');

-- CreateEnum
CREATE TYPE "GravidadeAlergia" AS ENUM ('LEVE', 'MODERADA', 'GRAVE');

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "registroConselho" TEXT NOT NULL,
    "ufConselho" TEXT NOT NULL DEFAULT 'RJ',
    "especialidade" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGENDADO',
    "motivo" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "agendamentoId" TEXT,
    "subjetivo" TEXT,
    "objetivo" TEXT,
    "avaliacao" TEXT,
    "plano" TEXT,
    "cid10" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinais_vitais" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "registradosPor" TEXT NOT NULL,
    "pressaoSistolica" INTEGER,
    "pressaoDiastolica" INTEGER,
    "frequenciaCardiaca" INTEGER,
    "frequenciaRespiratoria" INTEGER,
    "temperaturaC" DECIMAL(4,1),
    "saturacaoO2" INTEGER,
    "pesoKg" DECIMAL(5,2),
    "alturaCm" DECIMAL(5,1),
    "glicemia" INTEGER,
    "queixaPrincipal" TEXT,
    "registradosEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinais_vitais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alergias" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "descricao" TEXT NOT NULL,
    "gravidade" "GravidadeAlergia",
    "registradaPor" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alergias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condicoes_cronicas" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "descricao" TEXT NOT NULL,
    "cid10" TEXT,
    "diagnosticadaEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condicoes_cronicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_userId_key" ON "profissionais"("userId");

-- CreateIndex
CREATE INDEX "agendamentos_unidadeId_inicioEm_idx" ON "agendamentos"("unidadeId", "inicioEm");

-- CreateIndex
CREATE INDEX "agendamentos_profissionalId_inicioEm_idx" ON "agendamentos"("profissionalId", "inicioEm");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_agendamentoId_key" ON "atendimentos"("agendamentoId");

-- CreateIndex
CREATE INDEX "atendimentos_fichaId_idx" ON "atendimentos"("fichaId");

-- CreateIndex
CREATE INDEX "atendimentos_unidadeId_iniciadoEm_idx" ON "atendimentos"("unidadeId", "iniciadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "sinais_vitais_atendimentoId_key" ON "sinais_vitais"("atendimentoId");

-- CreateIndex
CREATE INDEX "alergias_fichaId_idx" ON "alergias"("fichaId");

-- CreateIndex
CREATE INDEX "condicoes_cronicas_fichaId_idx" ON "condicoes_cronicas"("fichaId");

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alergias" ADD CONSTRAINT "alergias_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alergias" ADD CONSTRAINT "alergias_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicoes_cronicas" ADD CONSTRAINT "condicoes_cronicas_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicoes_cronicas" ADD CONSTRAINT "condicoes_cronicas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;
