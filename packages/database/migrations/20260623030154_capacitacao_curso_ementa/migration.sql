-- CreateTable
CREATE TABLE "modulos_curso" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cargaHoraria" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modulos_curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ementa_itens" (
    "id" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ementa_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modulos_curso_cursoId_idx" ON "modulos_curso"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_curso_cursoId_ordem_key" ON "modulos_curso"("cursoId", "ordem");

-- CreateIndex
CREATE INDEX "ementa_itens_moduloId_idx" ON "ementa_itens"("moduloId");

-- CreateIndex
CREATE UNIQUE INDEX "ementa_itens_moduloId_ordem_key" ON "ementa_itens"("moduloId", "ordem");

-- AddForeignKey
ALTER TABLE "modulos_curso" ADD CONSTRAINT "modulos_curso_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ementa_itens" ADD CONSTRAINT "ementa_itens_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "modulos_curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
