-- CreateEnum
CREATE TYPE "AnexoCategoria" AS ENUM ('saude', 'socioeconomico', 'geral');

-- AlterTable
ALTER TABLE "AnexoCidadao" ADD COLUMN     "categoria" "AnexoCategoria" NOT NULL DEFAULT 'geral';
