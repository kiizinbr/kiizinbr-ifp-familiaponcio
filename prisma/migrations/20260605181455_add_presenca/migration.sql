-- CreateTable
CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "registradoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presenca_matriculaId_idx" ON "Presenca"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_matriculaId_data_key" ON "Presenca"("matriculaId", "data");

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
