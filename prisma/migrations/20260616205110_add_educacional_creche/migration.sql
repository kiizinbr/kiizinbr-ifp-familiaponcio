-- CreateEnum
CREATE TYPE "StatusDiario" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "TipoRegistroRotina" AS ENUM ('ALIMENTACAO', 'SONO', 'HIGIENE', 'ATIVIDADE', 'OCORRENCIA');

-- CreateEnum
CREATE TYPE "SentidoCheck" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "EscopoImagem" AS ENUM ('USO_INTERNO', 'REDES_IFP', 'IMPRENSA');

-- CreateTable
CREATE TABLE "TurmaInfantil" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "faixaEtariaMin" INTEGER NOT NULL,
    "faixaEtariaMax" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "educadorId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurmaInfantil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatriculaInfantil" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "consentimentoLgpdEm" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatriculaInfantil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsavelAutorizado" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "restricaoJudicial" BOOLEAN NOT NULL DEFAULT false,
    "vigenteAte" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),
    "revogadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponsavelAutorizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInOut" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "sentido" "SentidoCheck" NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorizadoId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioDia" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusDiario" NOT NULL DEFAULT 'ABERTO',
    "fechadoEm" TIMESTAMP(3),
    "profissionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiarioDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroRotina" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "tipo" "TipoRegistroRotina" NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profissionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroRotina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutorizacaoImagem" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "escopo" "EscopoImagem" NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT false,
    "versaoTermo" TEXT NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "revogadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutorizacaoImagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "enviadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicadoLeitura" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComunicadoLeitura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaInfantil_educadorId_idx" ON "TurmaInfantil"("educadorId");

-- CreateIndex
CREATE INDEX "TurmaInfantil_ativa_idx" ON "TurmaInfantil"("ativa");

-- CreateIndex
CREATE INDEX "MatriculaInfantil_turmaId_ativa_idx" ON "MatriculaInfantil"("turmaId", "ativa");

-- CreateIndex
CREATE INDEX "MatriculaInfantil_responsavelId_idx" ON "MatriculaInfantil"("responsavelId");

-- CreateIndex
CREATE INDEX "MatriculaInfantil_criancaId_idx" ON "MatriculaInfantil"("criancaId");

-- CreateIndex
CREATE UNIQUE INDEX "MatriculaInfantil_turmaId_criancaId_key" ON "MatriculaInfantil"("turmaId", "criancaId");

-- CreateIndex
CREATE INDEX "ResponsavelAutorizado_criancaId_idx" ON "ResponsavelAutorizado"("criancaId");

-- CreateIndex
CREATE INDEX "CheckInOut_criancaId_ocorridoEm_idx" ON "CheckInOut"("criancaId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "CheckInOut_profissionalId_idx" ON "CheckInOut"("profissionalId");

-- CreateIndex
CREATE INDEX "CheckInOut_autorizadoId_idx" ON "CheckInOut"("autorizadoId");

-- CreateIndex
CREATE INDEX "DiarioDia_criancaId_data_idx" ON "DiarioDia"("criancaId", "data");

-- CreateIndex
CREATE INDEX "DiarioDia_status_idx" ON "DiarioDia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DiarioDia_criancaId_data_key" ON "DiarioDia"("criancaId", "data");

-- CreateIndex
CREATE INDEX "RegistroRotina_diarioId_idx" ON "RegistroRotina"("diarioId");

-- CreateIndex
CREATE INDEX "RegistroRotina_profissionalId_idx" ON "RegistroRotina"("profissionalId");

-- CreateIndex
CREATE INDEX "AutorizacaoImagem_criancaId_idx" ON "AutorizacaoImagem"("criancaId");

-- CreateIndex
CREATE UNIQUE INDEX "AutorizacaoImagem_criancaId_escopo_versaoTermo_key" ON "AutorizacaoImagem"("criancaId", "escopo", "versaoTermo");

-- CreateIndex
CREATE INDEX "Comunicado_turmaId_createdAt_idx" ON "Comunicado"("turmaId", "createdAt");

-- CreateIndex
CREATE INDEX "Comunicado_critico_createdAt_idx" ON "Comunicado"("critico", "createdAt");

-- CreateIndex
CREATE INDEX "ComunicadoLeitura_responsavelId_idx" ON "ComunicadoLeitura"("responsavelId");

-- CreateIndex
CREATE UNIQUE INDEX "ComunicadoLeitura_comunicadoId_responsavelId_key" ON "ComunicadoLeitura"("comunicadoId", "responsavelId");

-- AddForeignKey
ALTER TABLE "TurmaInfantil" ADD CONSTRAINT "TurmaInfantil_educadorId_fkey" FOREIGN KEY ("educadorId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatriculaInfantil" ADD CONSTRAINT "MatriculaInfantil_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "TurmaInfantil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatriculaInfantil" ADD CONSTRAINT "MatriculaInfantil_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Cidadao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatriculaInfantil" ADD CONSTRAINT "MatriculaInfantil_criancaId_fkey" FOREIGN KEY ("criancaId") REFERENCES "Familiar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsavelAutorizado" ADD CONSTRAINT "ResponsavelAutorizado_criancaId_fkey" FOREIGN KEY ("criancaId") REFERENCES "Familiar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInOut" ADD CONSTRAINT "CheckInOut_criancaId_fkey" FOREIGN KEY ("criancaId") REFERENCES "Familiar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInOut" ADD CONSTRAINT "CheckInOut_autorizadoId_fkey" FOREIGN KEY ("autorizadoId") REFERENCES "ResponsavelAutorizado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInOut" ADD CONSTRAINT "CheckInOut_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioDia" ADD CONSTRAINT "DiarioDia_criancaId_fkey" FOREIGN KEY ("criancaId") REFERENCES "Familiar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioDia" ADD CONSTRAINT "DiarioDia_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroRotina" ADD CONSTRAINT "RegistroRotina_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroRotina" ADD CONSTRAINT "RegistroRotina_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacaoImagem" ADD CONSTRAINT "AutorizacaoImagem_criancaId_fkey" FOREIGN KEY ("criancaId") REFERENCES "Familiar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "TurmaInfantil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Cidadao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
