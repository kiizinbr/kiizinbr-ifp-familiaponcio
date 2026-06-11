-- CreateTable
CREATE TABLE "modalidades" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "trilhaGraduacoes" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modalidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas_esportivas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diasHorario" TEXT NOT NULL,
    "local" TEXT,
    "faixaEtariaMin" INTEGER,
    "faixaEtariaMax" INTEGER,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "vagasTotais" INTEGER NOT NULL,
    "status" "StatusTurma" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turmas_esportivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas_esportivas" (
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

    CONSTRAINT "matriculas_esportivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graduacoes" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "codigoVerificacao" TEXT NOT NULL,
    "observacao" TEXT,
    "concedidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concedidaPor" TEXT,

    CONSTRAINT "graduacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modalidades_unidadeId_nome_key" ON "modalidades"("unidadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_esportivas_codigo_key" ON "turmas_esportivas"("codigo");

-- CreateIndex
CREATE INDEX "turmas_esportivas_unidadeId_status_idx" ON "turmas_esportivas"("unidadeId", "status");

-- CreateIndex
CREATE INDEX "matriculas_esportivas_unidadeId_status_idx" ON "matriculas_esportivas"("unidadeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_esportivas_turmaId_fichaId_membroId_key" ON "matriculas_esportivas"("turmaId", "fichaId", "membroId");

-- CreateIndex
CREATE UNIQUE INDEX "graduacoes_codigoVerificacao_key" ON "graduacoes"("codigoVerificacao");

-- CreateIndex
CREATE UNIQUE INDEX "graduacoes_matriculaId_nivel_key" ON "graduacoes"("matriculaId", "nivel");

-- AddForeignKey
ALTER TABLE "modalidades" ADD CONSTRAINT "modalidades_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas_esportivas" ADD CONSTRAINT "turmas_esportivas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas_esportivas" ADD CONSTRAINT "turmas_esportivas_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "modalidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas_esportivas" ADD CONSTRAINT "turmas_esportivas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_esportivas" ADD CONSTRAINT "matriculas_esportivas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_esportivas" ADD CONSTRAINT "matriculas_esportivas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas_esportivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_esportivas" ADD CONSTRAINT "matriculas_esportivas_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_esportivas" ADD CONSTRAINT "matriculas_esportivas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros_familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graduacoes" ADD CONSTRAINT "graduacoes_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graduacoes" ADD CONSTRAINT "graduacoes_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas_esportivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
