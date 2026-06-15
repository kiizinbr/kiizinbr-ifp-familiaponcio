import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

/**
 * B2/A4 — LGPD: a anonimizacao de cidadao tambem reescreve o snapshot de nome
 * (nomeChamado) das chamadas ligadas a ele, sem tocar chamadas de terceiros nem
 * chamadas manuais (sem cidadaoId). Integration direto na query equivalente da
 * transacao (tx.chamada.updateMany por cidadaoId).
 */
describe("anonimizacao inclui Chamada (integration)", () => {
  it("reescreve nomeChamado das chamadas do cidadao e preserva as de terceiros", async () => {
    const idAlvo = `anon-alvo-${Date.now()}`;
    const idOutro = `anon-outro-${Date.now()}`;

    const cAlvo1 = await db.chamada.create({
      data: {
        unidade: "medico",
        nomeChamado: "Maria da Silva",
        destino: "Triagem",
        chamadoPor: "test-user",
        cidadaoId: idAlvo,
      },
      select: { id: true },
    });
    const cAlvo2 = await db.chamada.create({
      data: {
        unidade: "medico",
        nomeChamado: "Maria da Silva",
        destino: "Recepcao",
        chamadoPor: "test-user",
        cidadaoId: idAlvo,
      },
      select: { id: true },
    });
    const cOutro = await db.chamada.create({
      data: {
        unidade: "medico",
        nomeChamado: "Joao Terceiro",
        destino: "Triagem",
        chamadoPor: "test-user",
        cidadaoId: idOutro,
      },
      select: { id: true },
    });
    const cManual = await db.chamada.create({
      data: {
        unidade: "medico",
        nomeChamado: "Chamada Manual",
        destino: "Recepcao",
        chamadoPor: "test-user",
        cidadaoId: null,
      },
      select: { id: true },
    });

    try {
      // equivalente a parte da transacao de anonimizarCidadaoAction
      await db.chamada.updateMany({
        where: { cidadaoId: idAlvo },
        data: { nomeChamado: "[anonimizado]" },
      });

      const a1 = await db.chamada.findUnique({ where: { id: cAlvo1.id } });
      const a2 = await db.chamada.findUnique({ where: { id: cAlvo2.id } });
      const outro = await db.chamada.findUnique({ where: { id: cOutro.id } });
      const manual = await db.chamada.findUnique({ where: { id: cManual.id } });

      expect(a1?.nomeChamado).toBe("[anonimizado]");
      expect(a2?.nomeChamado).toBe("[anonimizado]");
      // nao toca terceiros nem chamada manual sem cidadaoId
      expect(outro?.nomeChamado).toBe("Joao Terceiro");
      expect(manual?.nomeChamado).toBe("Chamada Manual");
    } finally {
      await db.chamada.deleteMany({
        where: { id: { in: [cAlvo1.id, cAlvo2.id, cOutro.id, cManual.id] } },
      });
    }
  });
});
