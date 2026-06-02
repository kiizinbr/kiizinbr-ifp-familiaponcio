-- CreateEnum
CREATE TYPE "StatusTurma" AS ENUM ('planejada', 'inscricoes_abertas', 'em_andamento', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "StatusMatricula" AS ENUM ('inscrito', 'confirmado', 'cursando', 'concluido', 'reprovado', 'desistente', 'lista_espera', 'cancelado');

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "area" TEXT NOT NULL,
    "cargaHorariaTotal" INTEGER NOT NULL,
    "modalidade" TEXT NOT NULL DEFAULT 'presencial',
    "capacidadePadrao" INTEGER NOT NULL DEFAULT 20,
    "thumbUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrutor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "nomeExibicao" TEXT NOT NULL,
    "bio" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "instrutorId" TEXT,
    "codigo" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "local" TEXT,
    "capacidade" INTEGER NOT NULL,
    "status" "StatusTurma" NOT NULL DEFAULT 'planejada',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "status" "StatusMatricula" NOT NULL DEFAULT 'inscrito',
    "origemTriagemId" TEXT,
    "observacoes" TEXT,
    "motivoSaida" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Curso_ativo_area_idx" ON "Curso"("ativo", "area");

-- CreateIndex
CREATE UNIQUE INDEX "Instrutor_userId_key" ON "Instrutor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_codigo_key" ON "Turma"("codigo");

-- CreateIndex
CREATE INDEX "Turma_cursoId_status_idx" ON "Turma"("cursoId", "status");

-- CreateIndex
CREATE INDEX "Turma_status_dataInicio_idx" ON "Turma"("status", "dataInicio");

-- CreateIndex
CREATE INDEX "Matricula_turmaId_status_idx" ON "Matricula"("turmaId", "status");

-- CreateIndex
CREATE INDEX "Matricula_cidadaoId_idx" ON "Matricula"("cidadaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Matricula_turmaId_cidadaoId_key" ON "Matricula"("turmaId", "cidadaoId");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrutor" ADD CONSTRAINT "Instrutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "Instrutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
