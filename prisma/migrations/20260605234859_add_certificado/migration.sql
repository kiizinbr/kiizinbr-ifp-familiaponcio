-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nomeAluno" TEXT NOT NULL,
    "nomeCurso" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "percentualFrequencia" INTEGER NOT NULL,
    "emitidoPor" TEXT NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_matriculaId_key" ON "Certificado"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_codigo_key" ON "Certificado"("codigo");

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
