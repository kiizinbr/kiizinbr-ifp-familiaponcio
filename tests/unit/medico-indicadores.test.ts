import { describe, it, expect } from "vitest";
import { calcularIndicadores, taxaOcupacao, contagemDeGroupBy } from "@/lib/medico/indicadores";

const vazio = {
  agendada: 0,
  confirmada: 0,
  em_atendimento: 0,
  realizada: 0,
  faltou: 0,
  cancelada: 0,
};

describe("calcularIndicadores", () => {
  it("vazio → tudo zero", () => {
    const r = calcularIndicadores(vazio);
    expect(r.total).toBe(0);
    expect(r.taxaComparecimento).toBe(0);
    expect(r.taxaCancelamento).toBe(0);
  });

  it("calcula taxas sobre a base certa (realizada+faltou)", () => {
    const r = calcularIndicadores({ ...vazio, agendada: 4, realizada: 8, faltou: 2, cancelada: 1 });
    expect(r.total).toBe(15);
    expect(r.taxaComparecimento).toBe(80); // 8/(8+2)
    expect(r.taxaFalta).toBe(20);
    expect(r.taxaCancelamento).toBe(7); // 1/15 arredondado
    expect(r.ativas).toBe(4);
  });
});

describe("taxaOcupacao", () => {
  it("ocupados / (ocupados + disponíveis)", () => {
    expect(taxaOcupacao({ disponivel: 6, reservado: 3, realizado: 1, faltou: 0 })).toBe(40); // 4/10
  });
  it("sem slots → 0", () => {
    expect(taxaOcupacao({ disponivel: 0, reservado: 0, realizado: 0, faltou: 0 })).toBe(0);
  });
});

describe("contagemDeGroupBy", () => {
  it("preenche zeros e mapeia _count", () => {
    const r = contagemDeGroupBy(
      [
        { status: "realizada", _count: 5 },
        { status: "faltou", _count: 2 },
      ],
      ["realizada", "faltou", "cancelada"] as const,
    );
    expect(r.realizada).toBe(5);
    expect(r.faltou).toBe(2);
    expect(r.cancelada).toBe(0);
  });
});
