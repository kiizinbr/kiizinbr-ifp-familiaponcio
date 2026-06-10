-- CreateEnum
CREATE TYPE "ModalidadeCurso" AS ENUM ('PRATICO', 'TEORICO');

-- CreateEnum
CREATE TYPE "StatusTurma" AS ENUM ('INSCRICOES_ABERTAS', 'EM_ANDAMENTO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusMatricula" AS ENUM ('ATIVA', 'LISTA_ESPERA', 'TRANCADA', 'EVADIDA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "StatusPresenca" AS ENUM ('PRESENTE', 'FALTA', 'JUSTIFICADA');

-- AlterTable
ALTER TABLE "profissionais" ALTER COLUMN "registroConselho" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "modalidade" "ModalidadeCurso" NOT NULL,
    "cargaHorariaTotal" INTEGER NOT NULL,
    "presencaMinimaPct" INTEGER NOT NULL DEFAULT 75,
    "requerModelos" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diasHorario" TEXT NOT NULL,
    "sala" TEXT,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "vagasTotais" INTEGER NOT NULL,
    "status" "StatusTurma" NOT NULL DEFAULT 'INSCRICOES_ABERTAS',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "status" "StatusMatricula" NOT NULL DEFAULT 'ATIVA',
    "posicaoEspera" INTEGER,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT,
    "profissionalId" TEXT NOT NULL,
    "encerradaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "status" "StatusPresenca" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "codigoVerificacao" TEXT NOT NULL,
    "cargaHorariaCumprida" INTEGER NOT NULL,
    "presencaPct" DECIMAL(5,2) NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitidoPor" TEXT,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cursos_unidadeId_idx" ON "cursos"("unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_codigo_key" ON "turmas"("codigo");

-- CreateIndex
CREATE INDEX "turmas_unidadeId_status_idx" ON "turmas"("unidadeId", "status");

-- CreateIndex
CREATE INDEX "matriculas_unidadeId_status_idx" ON "matriculas"("unidadeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_turmaId_fichaId_membroId_key" ON "matriculas"("turmaId", "fichaId", "membroId");

-- CreateIndex
CREATE INDEX "aulas_turmaId_data_idx" ON "aulas"("turmaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_aulaId_matriculaId_key" ON "presencas"("aulaId", "matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_matriculaId_key" ON "certificados"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_codigoVerificacao_key" ON "certificados"("codigoVerificacao");

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
