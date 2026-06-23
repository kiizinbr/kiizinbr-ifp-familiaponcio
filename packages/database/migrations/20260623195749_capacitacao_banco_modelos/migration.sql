-- CreateEnum
CREATE TYPE "StatusSessaoPratica" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusInscricaoModelo" AS ENUM ('INSCRITO', 'VINCULADO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "modelos_voluntarios" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "telefone" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_voluntarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_praticas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "vagasModelos" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusSessaoPratica" NOT NULL DEFAULT 'AGENDADA',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_praticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricoes_modelo" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "matriculaId" TEXT,
    "status" "StatusInscricaoModelo" NOT NULL DEFAULT 'INSCRITO',
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscricoes_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_voluntarios_unidadeId_ativo_idx" ON "modelos_voluntarios"("unidadeId", "ativo");

-- CreateIndex
CREATE INDEX "sessoes_praticas_unidadeId_status_idx" ON "sessoes_praticas"("unidadeId", "status");

-- CreateIndex
CREATE INDEX "sessoes_praticas_turmaId_data_idx" ON "sessoes_praticas"("turmaId", "data");

-- CreateIndex
CREATE INDEX "inscricoes_modelo_sessaoId_status_idx" ON "inscricoes_modelo"("sessaoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_modelo_sessaoId_modeloId_key" ON "inscricoes_modelo"("sessaoId", "modeloId");

-- AddForeignKey
ALTER TABLE "modelos_voluntarios" ADD CONSTRAINT "modelos_voluntarios_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_praticas" ADD CONSTRAINT "sessoes_praticas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_praticas" ADD CONSTRAINT "sessoes_praticas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_praticas" ADD CONSTRAINT "sessoes_praticas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes_modelo" ADD CONSTRAINT "inscricoes_modelo_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessoes_praticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes_modelo" ADD CONSTRAINT "inscricoes_modelo_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos_voluntarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes_modelo" ADD CONSTRAINT "inscricoes_modelo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
