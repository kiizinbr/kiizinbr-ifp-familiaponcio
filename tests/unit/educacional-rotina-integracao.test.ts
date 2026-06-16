import { beforeAll, describe, expect, it, vi } from "vitest";

// logEvent usa headers() do Next, que só existe num request scope. Fora dele o
// logEvent engole o erro (catch silencioso) e NÃO grava — então o audit nunca
// quebra o fluxo de negócio. Aqui mockamos headers() (igual ao audit.test.ts) só
// para PROVAR que a tentativa bloqueada É auditada quando há contexto de request.
vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({ get: () => null } as unknown as Awaited<
      ReturnType<typeof import("next/headers").headers>
    >),
}));

import { db } from "@/lib/db";
import { checkout, CheckBloqueadoError } from "@/lib/educacional/rotina";

/**
 * TESTE DE OURO (DB-real) — usa o seed do Slice 1: a criança Ana (seed-edu-crianca)
 * e o ex-padrasto Marcos Tavares (seed-edu-aut-revogado), REVOGADO. Tentar fazer o
 * check-out por ele deve falhar (CheckBloqueadoError) E registrar a tentativa no
 * audit log (entityType "CheckInOut.tentativaBloqueada") — evidência de disputa de guarda.
 *
 * Requer o seed aplicado (`pnpm db:seed`). Se o seed não estiver no banco, pula.
 */

const CRIANCA_ID = "seed-edu-crianca";
const AUT_REVOGADO_ID = "seed-edu-aut-revogado";

describe("checkout DB-real — ex-padrasto revogado (teste de ouro)", () => {
  let temSeed = false;
  let profissionalId = "";
  let userId = "";

  beforeAll(async () => {
    const crianca = await db.familiar.findUnique({ where: { id: CRIANCA_ID } });
    const aut = await db.responsavelAutorizado.findUnique({ where: { id: AUT_REVOGADO_ID } });
    const educadora = await db.profissional.findFirst({
      where: { user: { email: "tia.beatriz@familiaponcio.org.br" } },
      include: { user: true },
    });
    if (crianca && aut && aut.revogadoEm && educadora) {
      temSeed = true;
      profissionalId = educadora.id;
      userId = educadora.userId;
    }
  });

  it("Marcos Tavares (revogado) tenta retirar Ana → bloqueado + tentativa auditada", async () => {
    if (!temSeed) {
      console.warn("[skip] seed educacional ausente — rode `pnpm db:seed`");
      return;
    }

    const antes = await db.auditLog.count({
      where: { entityType: "CheckInOut.tentativaBloqueada", entityId: AUT_REVOGADO_ID },
    });

    await expect(
      checkout({
        criancaId: CRIANCA_ID,
        autorizadoId: AUT_REVOGADO_ID,
        profissionalId,
        userId,
      }),
    ).rejects.toBeInstanceOf(CheckBloqueadoError);

    const depois = await db.auditLog.count({
      where: { entityType: "CheckInOut.tentativaBloqueada", entityId: AUT_REVOGADO_ID },
    });
    expect(depois).toBe(antes + 1);
  });
});
