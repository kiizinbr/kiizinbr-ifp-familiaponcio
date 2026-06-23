-- CreateEnum
CREATE TYPE "TipoDocumentoMedico" AS ENUM ('ATESTADO', 'RECEITA', 'DECLARACAO');

-- CreateEnum
CREATE TYPE "EstadoDente" AS ENUM ('HIGIDO', 'CARIE', 'RESTAURADO', 'AUSENTE', 'EXTRACAO_INDICADA', 'TRATAMENTO_CANAL', 'IMPLANTE', 'PROTESE', 'FRATURADO');

-- CreateTable
CREATE TABLE "documentos_medicos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "tipo" "TipoDocumentoMedico" NOT NULL,
    "codigoVerificacao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "cid10" TEXT,
    "diasAfastamento" INTEGER,
    "revogadoEm" TIMESTAMP(3),
    "revogadoMotivo" TEXT,
    "emitidoPor" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odontogramas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "membroId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odontogramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dente_estados" (
    "id" TEXT NOT NULL,
    "odontogramaId" TEXT NOT NULL,
    "numeroFdi" INTEGER NOT NULL,
    "estado" "EstadoDente" NOT NULL DEFAULT 'HIGIDO',
    "procedimento" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dente_estados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_medicos_codigoVerificacao_key" ON "documentos_medicos"("codigoVerificacao");

-- CreateIndex
CREATE INDEX "documentos_medicos_atendimentoId_idx" ON "documentos_medicos"("atendimentoId");

-- CreateIndex
CREATE INDEX "documentos_medicos_fichaId_idx" ON "documentos_medicos"("fichaId");

-- CreateIndex
CREATE UNIQUE INDEX "odontogramas_atendimentoId_key" ON "odontogramas"("atendimentoId");

-- CreateIndex
CREATE INDEX "odontogramas_fichaId_idx" ON "odontogramas"("fichaId");

-- CreateIndex
CREATE INDEX "dente_estados_odontogramaId_idx" ON "dente_estados"("odontogramaId");

-- CreateIndex
CREATE UNIQUE INDEX "dente_estados_odontogramaId_numeroFdi_key" ON "dente_estados"("odontogramaId", "numeroFdi");

-- AddForeignKey
ALTER TABLE "documentos_medicos" ADD CONSTRAINT "documentos_medicos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_medicos" ADD CONSTRAINT "documentos_medicos_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_medicos" ADD CONSTRAINT "documentos_medicos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_medicos" ADD CONSTRAINT "documentos_medicos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_medicos" ADD CONSTRAINT "documentos_medicos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dente_estados" ADD CONSTRAINT "dente_estados_odontogramaId_fkey" FOREIGN KEY ("odontogramaId") REFERENCES "odontogramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
