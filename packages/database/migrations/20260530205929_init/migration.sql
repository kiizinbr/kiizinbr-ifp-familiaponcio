-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('MEDICO', 'CAPACITACAO', 'ESPORTIVO', 'EDUCACIONAL');

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('SUPER_ADMIN', 'PRESIDENCIA', 'SERVICO_SOCIAL', 'GESTOR_UNIDADE', 'PROFISSIONAL', 'RECEPCAO', 'RESPONSAVEL_FAMILIAR');

-- CreateEnum
CREATE TYPE "EstadoCivil" AS ENUM ('SOLTEIRO', 'CASADO', 'UNIAO_ESTAVEL', 'DIVORCIADO', 'VIUVO');

-- CreateEnum
CREATE TYPE "SituacaoMoradia" AS ENUM ('PROPRIA', 'ALUGADA', 'CEDIDA', 'FINANCIADA', 'OCUPACAO', 'OUTRA');

-- CreateEnum
CREATE TYPE "Escolaridade" AS ENUM ('SEM_ESCOLARIDADE', 'FUND_INCOMPLETO', 'FUND_COMPLETO', 'MEDIO_INCOMPLETO', 'MEDIO_COMPLETO', 'SUPERIOR_INCOMPLETO', 'SUPERIOR_COMPLETO', 'POS_GRADUACAO');

-- CreateEnum
CREATE TYPE "Parentesco" AS ENUM ('CONJUGE', 'FILHO', 'FILHA', 'ENTEADO', 'PAI', 'MAE', 'IRMAO', 'IRMA', 'AVO', 'AVOH', 'NETO', 'NETA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'COMPROVANTE_RENDA', 'CADUNICO', 'CARTEIRA_TRABALHO', 'CERTIDAO_NASCIMENTO', 'LAUDO_MEDICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusElegibilidade" AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO', 'SUSPENSO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "TipoConsentimento" AS ENUM ('USO_DADOS_LGPD', 'USO_IMAGEM', 'COMUNICACAO_WHATSAPP', 'COMUNICACAO_EMAIL', 'COMPARTILHAMENTO_PARCEIROS');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "tipo" "TipoUnidade" NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "endereco" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "fichaCidadaId" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_perfis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,

    CONSTRAINT "usuarios_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_unidades" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,

    CONSTRAINT "usuarios_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_cidadas" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "estadoCivil" "EstadoCivil",
    "escolaridade" "Escolaridade",
    "fotoUrl" TEXT,
    "telefone" TEXT NOT NULL,
    "telefoneAlt" TEXT,
    "email" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL DEFAULT 'Duque de Caxias',
    "uf" TEXT NOT NULL DEFAULT 'RJ',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_cidadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_familiares" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "parentesco" "Parentesco" NOT NULL,
    "ocupacao" TEXT,
    "escolaridade" "Escolaridade",
    "rendaMensal" DECIMAL(10,2),
    "observacoes" TEXT,

    CONSTRAINT "membros_familiares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_socioeconomicos" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "rendaFamiliarTotal" DECIMAL(10,2) NOT NULL,
    "rendaPerCapita" DECIMAL(10,2) NOT NULL,
    "recebeBolsaFamilia" BOOLEAN NOT NULL DEFAULT false,
    "recebeBPC" BOOLEAN NOT NULL DEFAULT false,
    "recebeAuxilioGas" BOOLEAN NOT NULL DEFAULT false,
    "outrosBeneficios" TEXT,
    "situacaoMoradia" "SituacaoMoradia" NOT NULL,
    "numeroPessoasMoradia" INTEGER NOT NULL,
    "numeroComodos" INTEGER,
    "temAguaEncanada" BOOLEAN NOT NULL DEFAULT true,
    "temEsgoto" BOOLEAN NOT NULL DEFAULT true,
    "temEnergiaEletrica" BOOLEAN NOT NULL DEFAULT true,
    "vulnerabilidades" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dados_socioeconomicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrevistas" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "realizadaPor" TEXT NOT NULL,
    "realizadaEm" TIMESTAMP(3) NOT NULL,
    "resumo" TEXT NOT NULL,
    "proximaEm" TIMESTAMP(3),

    CONSTRAINT "entrevistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elegibilidades" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "status" "StatusElegibilidade" NOT NULL DEFAULT 'PENDENTE',
    "avaliadoPor" TEXT,
    "avaliadoEm" TIMESTAMP(3),
    "motivo" TEXT,
    "reavaliarEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elegibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "tipo" "TipoConsentimento" NOT NULL,
    "concedido" BOOLEAN NOT NULL,
    "versaoTermo" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_tipo_key" ON "unidades"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_slug_key" ON "unidades"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_fichaCidadaId_key" ON "usuarios"("fichaCidadaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_perfis_userId_perfil_key" ON "usuarios_perfis"("userId", "perfil");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_unidades_userId_unidadeId_key" ON "usuarios_unidades"("userId", "unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_cidadas_protocolo_key" ON "fichas_cidadas"("protocolo");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_cidadas_cpf_key" ON "fichas_cidadas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "dados_socioeconomicos_fichaId_key" ON "dados_socioeconomicos"("fichaId");

-- CreateIndex
CREATE UNIQUE INDEX "elegibilidades_fichaId_unidadeId_key" ON "elegibilidades"("fichaId", "unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "consentimentos_fichaId_tipo_versaoTermo_key" ON "consentimentos"("fichaId", "tipo", "versaoTermo");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entidade_entidadeId_idx" ON "audit_logs"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "audit_logs_criadoEm_idx" ON "audit_logs"("criadoEm");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_fichaCidadaId_fkey" FOREIGN KEY ("fichaCidadaId") REFERENCES "fichas_cidadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_unidades" ADD CONSTRAINT "usuarios_unidades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_unidades" ADD CONSTRAINT "usuarios_unidades_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_familiares" ADD CONSTRAINT "membros_familiares_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_socioeconomicos" ADD CONSTRAINT "dados_socioeconomicos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elegibilidades" ADD CONSTRAINT "elegibilidades_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elegibilidades" ADD CONSTRAINT "elegibilidades_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "fichas_cidadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
