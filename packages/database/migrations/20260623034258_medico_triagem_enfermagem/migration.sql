-- CreateEnum
CREATE TYPE "ClassificacaoRisco" AS ENUM ('AZUL', 'VERDE', 'AMARELO', 'LARANJA', 'VERMELHO');

-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "chegouEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "triagens_enfermagem" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "registradaPor" TEXT NOT NULL,
    "pressaoSistolica" INTEGER,
    "pressaoDiastolica" INTEGER,
    "frequenciaCardiaca" INTEGER,
    "frequenciaRespiratoria" INTEGER,
    "temperaturaC" DECIMAL(4,1),
    "saturacaoO2" INTEGER,
    "pesoKg" DECIMAL(5,2),
    "alturaCm" DECIMAL(5,1),
    "glicemia" INTEGER,
    "dorEscala" INTEGER,
    "queixaPrincipal" TEXT,
    "observacoes" TEXT,
    "classificacaoRisco" "ClassificacaoRisco" NOT NULL DEFAULT 'VERDE',
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triagens_enfermagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "triagens_enfermagem_agendamentoId_key" ON "triagens_enfermagem"("agendamentoId");

-- CreateIndex
CREATE INDEX "triagens_enfermagem_unidadeId_registradaEm_idx" ON "triagens_enfermagem"("unidadeId", "registradaEm");

-- AddForeignKey
ALTER TABLE "triagens_enfermagem" ADD CONSTRAINT "triagens_enfermagem_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
