import type { PrismaClient, Prisma } from "@prisma/client";

/** Cliente Prisma OU client transacional (tx) — registrarMapa precisa rodar dentro da tx. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Retorna idDestino existente se (entidade, idOrigem) já migrado; senão null. */
export async function jaMigrado(
  db: Db,
  entidade: string,
  idOrigem: string | number,
): Promise<string | null> {
  const r = await db.migracaoAmplimedMap.findUnique({
    where: { entidade_idOrigem: { entidade, idOrigem: String(idOrigem) } },
  });
  return r?.idDestino ?? null;
}

/** Registra o vínculo de proveniência (idempotência + auditoria LGPD). */
export async function registrarMapa(
  db: Db,
  entidade: string,
  idOrigem: string | number,
  idDestino: string,
): Promise<void> {
  await db.migracaoAmplimedMap.create({
    data: { entidade, idOrigem: String(idOrigem), idDestino },
  });
}
