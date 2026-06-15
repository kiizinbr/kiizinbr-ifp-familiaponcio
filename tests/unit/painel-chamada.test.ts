import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { criarChamada, JANELA_CHAMADA_MS, listarChamadas } from "@/lib/painel/chamada";

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

  it("janela de retencao: esconde chamada > 24h e mostra a recente (defesa LGPD de exibicao)", async () => {
    // Cria duas chamadas e força o criadoEm: uma 1h ATRAS (dentro da janela) e
    // outra 25h ATRAS (fora). A janela em listarChamadas (criadoEm gte agora-24h)
    // deve EXCLUIR a antiga e INCLUIR a recente — fronteira da regra de retencao.
    const agora = Date.now();
    const recente = await criarChamada({
      unidade: "esportivo",
      nomeChamado: "Recente Visivel",
      destino: "Triagem",
      chamadoPor: "test-user",
    });
    const antiga = await criarChamada({
      unidade: "esportivo",
      nomeChamado: "Antiga Oculta",
      destino: "Triagem",
      chamadoPor: "test-user",
    });
    await db.chamada.update({
      where: { id: recente.id },
      data: { criadoEm: new Date(agora - 60 * 60 * 1000) }, // -1h: dentro
    });
    await db.chamada.update({
      where: { id: antiga.id },
      data: { criadoEm: new Date(agora - JANELA_CHAMADA_MS - 60 * 60 * 1000) }, // -25h: fora
    });
    try {
      const { atual, recentes } = await listarChamadas("esportivo", 5);
      const nomes = [atual, ...recentes].map((c) => c?.nomeChamado);
      expect(nomes).toContain("Recente Visivel");
      expect(nomes).not.toContain("Antiga Oculta");
    } finally {
      await db.chamada.deleteMany({ where: { id: { in: [recente.id, antiga.id] } } });
    }
  });
});
