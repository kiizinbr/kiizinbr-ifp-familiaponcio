import { describe, it, expect } from "vitest";
import { aulasRegistradas, deriveTrilha } from "@/lib/capacitacao/trilha";

/** Trilha derivada da Capacitação (F2) — pura, sem schema novo. */

describe("aulasRegistradas", () => {
  it("conta datas distintas (várias matrículas no mesmo dia = 1 aula)", () => {
    // Arrange: 3 presenças, mas só 2 dias distintos
    const datas = [new Date("2026-03-02"), new Date("2026-03-02"), new Date("2026-03-09")];

    // Act
    const total = aulasRegistradas(datas);

    // Assert
    expect(total).toBe(2);
  });

  it("retorna 0 quando não há presenças", () => {
    expect(aulasRegistradas([])).toBe(0);
  });

  it("dedup ignora a hora do dia (mesma data civil = 1 aula)", () => {
    // Arrange: datas @db.Date chegam como meia-noite, mas garantimos robustez
    const datas = [new Date("2026-03-02T00:00:00.000Z"), new Date("2026-03-02T23:59:59.000Z")];

    // Act + Assert
    expect(aulasRegistradas(datas)).toBe(1);
  });

  it("conta cada dia distinto uma vez, fora de ordem", () => {
    const datas = [
      new Date("2026-03-16"),
      new Date("2026-03-02"),
      new Date("2026-03-09"),
      new Date("2026-03-02"),
    ];
    expect(aulasRegistradas(datas)).toBe(3);
  });
});

describe("deriveTrilha", () => {
  it("formatura é a dataFim da turma", () => {
    // Arrange
    const dataFim = new Date("2026-06-20");
    const datasPresenca = [new Date("2026-03-02"), new Date("2026-03-09")];

    // Act
    const trilha = deriveTrilha({ datasPresenca, dataFim });

    // Assert
    expect(trilha.formatura).toEqual(dataFim);
    expect(trilha.aulasRegistradas).toBe(2);
  });

  it("turma sem presenças não quebra: Aula 0 · formatura = dataFim", () => {
    // Arrange: turma recém-criada, ninguém matriculado/sem chamada
    const dataFim = new Date("2026-06-20");

    // Act
    const trilha = deriveTrilha({ datasPresenca: [], dataFim });

    // Assert
    expect(trilha.aulasRegistradas).toBe(0);
    expect(trilha.formatura).toEqual(dataFim);
  });

  it("deduplica datas repetidas vindas de matrículas diferentes", () => {
    // Arrange: 2 alunos × 2 aulas = 4 entradas, 2 dias distintos
    const dataFim = new Date("2026-06-20");
    const datasPresenca = [
      new Date("2026-03-02"),
      new Date("2026-03-02"),
      new Date("2026-03-09"),
      new Date("2026-03-09"),
    ];

    // Act
    const trilha = deriveTrilha({ datasPresenca, dataFim });

    // Assert
    expect(trilha.aulasRegistradas).toBe(2);
  });
});
