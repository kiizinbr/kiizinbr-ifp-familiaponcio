-- CreateEnum
CREATE TYPE "StatusDiario" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "TipoRegistroRotina" AS ENUM ('ALIMENTACAO', 'SONO', 'HIGIENE', 'ATIVIDADE', 'OCORRENCIA');

-- CreateEnum
CREATE TYPE "SentidoCheck" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "EscopoImagem" AS ENUM ('USO_INTERNO', 'REDES_IFP', 'IMPRENSA');

-- AlterEnum
ALTER TYPE "StatusMatricula" ADD VALUE 'CANCELADA';

-- CreateTable
CREATE TABLE "autorizacoes_imagem" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "escopo" "EscopoImagem" NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT false,
    "versaoTermo" TEXT NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "revogadoPor" TEXT,
    "criadoPor" TEXT,

    CONSTRAINT "autorizacoes_imagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas_infantis" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "faixaEtariaMin" INTEGER NOT NULL,
    "faixaEtariaMax" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_infantis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas_infantis" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "consentimentoLgpdEm" TIMESTAMP(3) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matriculas_infantis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsaveis_autorizados" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "restricaoJudicial" BOOLEAN NOT NULL DEFAULT false,
    "vigenteAte" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),
    "revogadoPor" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsaveis_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins_saidas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "sentido" "SentidoCheck" NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorizadoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,

    CONSTRAINT "checkins_saidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diarios_dia" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusDiario" NOT NULL DEFAULT 'ABERTO',
    "fechadoEm" TIMESTAMP(3),
    "profissionalId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diarios_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_rotina" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "tipo" "TipoRegistroRotina" NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profissionalId" TEXT NOT NULL,

    CONSTRAINT "registros_rotina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicados" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "enviadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicados_leituras" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicados_leituras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "autorizacoes_imagem_membroId_idx" ON "autorizacoes_imagem"("membroId");

-- CreateIndex
CREATE UNIQUE INDEX "autorizacoes_imagem_membroId_escopo_versaoTermo_key" ON "autorizacoes_imagem"("membroId", "escopo", "versaoTermo");

-- CreateIndex
CREATE INDEX "turmas_infantis_unidadeId_idx" ON "turmas_infantis"("unidadeId");

-- CreateIndex
CREATE INDEX "matriculas_infantis_unidadeId_idx" ON "matriculas_infantis"("unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_infantis_turmaId_membroId_key" ON "matriculas_infantis"("turmaId", "membroId");

-- CreateIndex
CREATE INDEX "responsaveis_autorizados_membroId_idx" ON "responsaveis_autorizados"("membroId");

-- CreateIndex
CREATE INDEX "checkins_saidas_unidadeId_ocorridoEm_idx" ON "checkins_saidas"("unidadeId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "checkins_saidas_membroId_ocorridoEm_idx" ON "checkins_saidas"("membroId", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "diarios_dia_membroId_data_key" ON "diarios_dia"("membroId", "data");

-- CreateIndex
CREATE INDEX "registros_rotina_diarioId_idx" ON "registros_rotina"("diarioId");

-- CreateIndex
CREATE INDEX "comunicados_unidadeId_idx" ON "comunicados"("unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "comunicados_leituras_comunicadoId_fichaId_key" ON "comunicados_leituras"("comunicadoId", "fichaId");

-- AddForeignKey
ALTER TABLE "autorizacoes_imagem" ADD CONSTRAINT "autorizacoes_imagem_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacoes_imagem" ADD CONSTRAINT "autorizacoes_imagem_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas_infantis" ADD CONSTRAINT "turmas_infantis_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas_infantis" ADD CONSTRAINT "turmas_infantis_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_infantis" ADD CONSTRAINT "matriculas_infantis_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_infantis" ADD CONSTRAINT "matriculas_infantis_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas_infantis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_infantis" ADD CONSTRAINT "matriculas_infantis_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_infantis" ADD CONSTRAINT "matriculas_infantis_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsaveis_autorizados" ADD CONSTRAINT "responsaveis_autorizados_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsaveis_autorizados" ADD CONSTRAINT "responsaveis_autorizados_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_saidas" ADD CONSTRAINT "checkins_saidas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_saidas" ADD CONSTRAINT "checkins_saidas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_saidas" ADD CONSTRAINT "checkins_saidas_autorizadoId_fkey" FOREIGN KEY ("autorizadoId") REFERENCES "responsaveis_autorizados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_saidas" ADD CONSTRAINT "checkins_saidas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diarios_dia" ADD CONSTRAINT "diarios_dia_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diarios_dia" ADD CONSTRAINT "diarios_dia_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diarios_dia" ADD CONSTRAINT "diarios_dia_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_rotina" ADD CONSTRAINT "registros_rotina_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "diarios_dia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_rotina" ADD CONSTRAINT "registros_rotina_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas_infantis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados_leituras" ADD CONSTRAINT "comunicados_leituras_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "comunicados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados_leituras" ADD CONSTRAINT "comunicados_leituras_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
