-- CreateTable
CREATE TABLE "Receita" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "nomePaciente" TEXT NOT NULL,
    "nomeProfissional" TEXT NOT NULL,
    "conselho" TEXT NOT NULL,
    "nroConselho" TEXT NOT NULL,
    "observacoes" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceitaItem" (
    "id" TEXT NOT NULL,
    "receitaId" TEXT NOT NULL,
    "medicamento" TEXT NOT NULL,
    "posologia" TEXT NOT NULL,
    "quantidade" TEXT,
    "via" TEXT,

    CONSTRAINT "ReceitaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atestado" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "nomePaciente" TEXT NOT NULL,
    "nomeProfissional" TEXT NOT NULL,
    "conselho" TEXT NOT NULL,
    "nroConselho" TEXT NOT NULL,
    "diasAfastamento" INTEGER,
    "cid" TEXT,
    "observacao" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atestado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Receita_consultaId_idx" ON "Receita"("consultaId");

-- CreateIndex
CREATE INDEX "ReceitaItem_receitaId_idx" ON "ReceitaItem"("receitaId");

-- CreateIndex
CREATE INDEX "Atestado_consultaId_idx" ON "Atestado"("consultaId");

-- AddForeignKey
ALTER TABLE "ReceitaItem" ADD CONSTRAINT "ReceitaItem_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "Receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
