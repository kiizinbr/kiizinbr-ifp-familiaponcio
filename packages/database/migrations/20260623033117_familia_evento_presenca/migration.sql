-- CreateEnum
CREATE TYPE "RespostaPresenca" AS ENUM ('SIM', 'NAO');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('AGENDADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "eventos_unidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "local" TEXT,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "pedeConfirmacao" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusEvento" NOT NULL DEFAULT 'AGENDADO',
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmacoes_evento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "resposta" "RespostaPresenca" NOT NULL,
    "observacao" TEXT,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmacoes_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas_creche" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "resposta" "RespostaPresenca" NOT NULL,
    "observacao" TEXT,
    "respondidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencas_creche_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_unidade_unidadeId_inicioEm_idx" ON "eventos_unidade"("unidadeId", "inicioEm");

-- CreateIndex
CREATE INDEX "confirmacoes_evento_fichaId_idx" ON "confirmacoes_evento"("fichaId");

-- CreateIndex
CREATE UNIQUE INDEX "confirmacoes_evento_eventoId_membroId_key" ON "confirmacoes_evento"("eventoId", "membroId");

-- CreateIndex
CREATE INDEX "presencas_creche_fichaId_data_idx" ON "presencas_creche"("fichaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_creche_membroId_data_key" ON "presencas_creche"("membroId", "data");

-- AddForeignKey
ALTER TABLE "eventos_unidade" ADD CONSTRAINT "eventos_unidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_unidade" ADD CONSTRAINT "eventos_unidade_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas_infantis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmacoes_evento" ADD CONSTRAINT "confirmacoes_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos_unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmacoes_evento" ADD CONSTRAINT "confirmacoes_evento_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmacoes_evento" ADD CONSTRAINT "confirmacoes_evento_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas_creche" ADD CONSTRAINT "presencas_creche_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas_creche" ADD CONSTRAINT "presencas_creche_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
