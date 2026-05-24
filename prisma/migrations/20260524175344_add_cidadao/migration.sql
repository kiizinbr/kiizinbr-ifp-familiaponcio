-- CreateTable
CREATE TABLE "Familia" (
    "id" TEXT NOT NULL,
    "nomeReferencia" TEXT NOT NULL,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Familia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Familiar" (
    "id" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "dataNascimento" DATE,
    "idadeAprox" INTEGER,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Familiar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cidadao" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "telefonePrincipal" TEXT NOT NULL,
    "nomeSocial" TEXT,
    "rg" TEXT,
    "documentoAlternativo" TEXT,
    "genero" TEXT,
    "corRaca" TEXT,
    "estadoCivil" TEXT,
    "nacionalidade" TEXT,
    "naturalidade" TEXT,
    "nomeMae" TEXT,
    "nomePai" TEXT,
    "escolaAtual" TEXT,
    "telefoneSecundario" TEXT,
    "email" TEXT,
    "whatsappConsente" BOOLEAN NOT NULL DEFAULT false,
    "rendaFamiliar" DECIMAL(10,2),
    "pessoasNaCasa" INTEGER,
    "beneficioSocial" TEXT,
    "escolaridade" TEXT,
    "trabalha" BOOLEAN,
    "trabalhoDescricao" TEXT,
    "tipoSanguineo" TEXT,
    "alergias" TEXT,
    "medicamentosEmUso" TEXT,
    "condicoesCronicas" TEXT,
    "fotoUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "unitIdOrigem" TEXT NOT NULL,
    "familiaId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "anonimizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cidadao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endereco" (
    "id" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "pontoReferencia" TEXT,
    "isPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoCidadao" (
    "id" TEXT NOT NULL,
    "cidadaoId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL DEFAULT 'ifp-cidadao-anexos',
    "storageKey" TEXT NOT NULL,
    "descricao" TEXT,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnexoCidadao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Familiar_familiaId_idx" ON "Familiar"("familiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cidadao_cpf_key" ON "Cidadao"("cpf");

-- CreateIndex
CREATE INDEX "Cidadao_cpf_idx" ON "Cidadao"("cpf");

-- CreateIndex
CREATE INDEX "Cidadao_nomeCompleto_idx" ON "Cidadao"("nomeCompleto");

-- CreateIndex
CREATE INDEX "Cidadao_familiaId_idx" ON "Cidadao"("familiaId");

-- CreateIndex
CREATE INDEX "Cidadao_unitIdOrigem_idx" ON "Cidadao"("unitIdOrigem");

-- CreateIndex
CREATE INDEX "Cidadao_deletedAt_idx" ON "Cidadao"("deletedAt");

-- CreateIndex
CREATE INDEX "Endereco_cidadaoId_idx" ON "Endereco"("cidadaoId");

-- CreateIndex
CREATE INDEX "Endereco_cep_idx" ON "Endereco"("cep");

-- CreateIndex
CREATE INDEX "AnexoCidadao_cidadaoId_idx" ON "AnexoCidadao"("cidadaoId");

-- CreateIndex
CREATE INDEX "AnexoCidadao_hashSha256_idx" ON "AnexoCidadao"("hashSha256");

-- AddForeignKey
ALTER TABLE "Familiar" ADD CONSTRAINT "Familiar_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cidadao" ADD CONSTRAINT "Cidadao_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cidadao" ADD CONSTRAINT "Cidadao_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoCidadao" ADD CONSTRAINT "AnexoCidadao_cidadaoId_fkey" FOREIGN KEY ("cidadaoId") REFERENCES "Cidadao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoCidadao" ADD CONSTRAINT "AnexoCidadao_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
