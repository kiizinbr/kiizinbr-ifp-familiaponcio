-- CreateTable
CREATE TABLE "treinos_esportivos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT,
    "profissionalId" TEXT NOT NULL,
    "encerradoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinos_esportivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas_treino" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "status" "StatusPresenca" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencas_treino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treinos_esportivos_turmaId_data_idx" ON "treinos_esportivos"("turmaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_treino_treinoId_matriculaId_key" ON "presencas_treino"("treinoId", "matriculaId");

-- AddForeignKey
ALTER TABLE "treinos_esportivos" ADD CONSTRAINT "treinos_esportivos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos_esportivos" ADD CONSTRAINT "treinos_esportivos_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "turmas_esportivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos_esportivos" ADD CONSTRAINT "treinos_esportivos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas_treino" ADD CONSTRAINT "presencas_treino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "treinos_esportivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas_treino" ADD CONSTRAINT "presencas_treino_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas_esportivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
