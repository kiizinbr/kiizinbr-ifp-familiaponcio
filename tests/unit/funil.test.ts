import { describe, expect, it } from "vitest";
import { slotsDisponiveis, vagaAceitaAgendamento } from "@/lib/funil";

describe("slotsDisponiveis", () => {
  it("desconta só agendamentos ativos (agendado/confirmado/realizado)", () => {
    const ag = [
      { status: "agendado" },
      { status: "confirmado" },
      { status: "realizado" },
      { status: "cancelado" },
      { status: "faltou" },
    ];
    expect(slotsDisponiveis(10, ag)).toBe(7);
  });

  it("cancelado e faltou não ocupam slot", () => {
    expect(slotsDisponiveis(2, [{ status: "cancelado" }, { status: "faltou" }])).toBe(2);
  });

  it("nunca fica negativo", () => {
    expect(slotsDisponiveis(1, [{ status: "agendado" }, { status: "confirmado" }])).toBe(0);
  });
});

describe("vagaAceitaAgendamento", () => {
  const base = { status: "aberta", slotsTotais: 5, fechaEm: null as Date | null };

  it("aceita quando aberta, dentro da janela e com slot livre", () => {
    expect(vagaAceitaAgendamento(base, 2)).toBe(true);
  });

  it("recusa quando lotada", () => {
    expect(vagaAceitaAgendamento({ ...base, slotsTotais: 2 }, 2)).toBe(false);
  });

  it("recusa quando não está aberta", () => {
    expect(vagaAceitaAgendamento({ ...base, status: "encerrada" }, 0)).toBe(false);
  });

  it("recusa quando fechaEm já passou", () => {
    expect(vagaAceitaAgendamento({ ...base, fechaEm: new Date("2020-01-01") }, 0)).toBe(false);
  });
});
