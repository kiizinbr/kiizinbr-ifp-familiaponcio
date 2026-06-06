import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { criarChamada, listarChamadas } from "@/lib/painel/chamada";

describe("criarChamada + listarChamadas (integration)", () => {
  it("cria uma chamada e a retorna como atual", async () => {
    const c = await criarChamada({
      unidade: "medico",
      nomeChamado: "Teste Painel",
      destino: "Triagem",
      chamadoPor: "test-user",
    });
    try {
      const { atual, recentes } = await listarChamadas("medico", 4);
      expect(atual?.id).toBe(c.id);
      expect(atual?.nomeChamado).toBe("Teste Painel");
      expect(atual?.destino).toBe("Triagem");
      expect(Array.isArray(recentes)).toBe(true);
    } finally {
      await db.chamada.delete({ where: { id: c.id } });
    }
  });

  it("re-chamar gera nova linha e vira a atual", async () => {
    const c1 = await criarChamada({
      unidade: "medico",
      nomeChamado: "Re Chamado",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    const c2 = await criarChamada({
      unidade: "medico",
      nomeChamado: "Re Chamado",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    try {
      const { atual } = await listarChamadas("medico", 4);
      expect(atual?.id).toBe(c2.id);
      expect(c2.id).not.toBe(c1.id);
    } finally {
      await db.chamada.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
    }
  });

  it("isola por unidade", async () => {
    const c = await criarChamada({
      unidade: "capacitacao",
      nomeChamado: "So Capacitacao",
      destino: "Recepcao",
      chamadoPor: "test-user",
    });
    try {
      const { atual } = await listarChamadas("medico", 4);
      expect(atual?.nomeChamado).not.toBe("So Capacitacao");
    } finally {
      await db.chamada.delete({ where: { id: c.id } });
    }
  });
});
