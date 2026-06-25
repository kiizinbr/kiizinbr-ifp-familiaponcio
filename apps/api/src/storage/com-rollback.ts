import type { StorageService } from "./storage.service";

/**
 * Executa a persistência (geralmente o `prisma.create`) que referencia um
 * objeto JÁ enviado ao storage; se ela LANÇAR, remove o objeto órfão antes de
 * relançar (P1.3).
 *
 * Por que: o fluxo de upload sobe o arquivo ao MinIO e DEPOIS grava a linha que
 * o referencia. Se o INSERT falhar (constraint, banco fora, etc.), sem isto o
 * objeto ficaria no bucket sem nenhuma linha apontando para ele — lixo que
 * acumula e, pior, dado pessoal/imagem de menor solto e sem trilha. A remoção é
 * best-effort (`.catch`): mesmo que o MinIO esteja indisponível na limpeza, o
 * erro ORIGINAL do INSERT é o que sobe (não mascaramos a causa real).
 */
export async function persistirComRollbackDeObjeto<T>(
  storage: StorageService,
  objectName: string,
  persistir: () => Promise<T>,
): Promise<T> {
  try {
    return await persistir();
  } catch (err) {
    await storage.removeObject(objectName).catch(() => undefined);
    throw err;
  }
}
