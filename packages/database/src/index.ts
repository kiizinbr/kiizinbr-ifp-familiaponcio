import { PrismaClient } from "@prisma/client";

// Singleton para evitar múltiplas instâncias do PrismaClient em dev (HMR).
// Em produção cada processo (web/api) cria sua própria instância.

declare global {
  // eslint-disable-next-line no-var
  var __ifpPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__ifpPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__ifpPrisma = prisma;
}

export * from "@prisma/client";
