-- DropIndex
DROP INDEX "cidadao_cpf_trgm_idx";

-- DropIndex
DROP INDEX "cidadao_nome_social_trgm_idx";

-- DropIndex
DROP INDEX "cidadao_nome_trgm_idx";

-- DropIndex
DROP INDEX "cidadao_tel_trgm_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "rootEntityId" TEXT,
ADD COLUMN     "rootEntityType" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_rootEntityType_rootEntityId_createdAt_idx" ON "AuditLog"("rootEntityType", "rootEntityId", "createdAt");
