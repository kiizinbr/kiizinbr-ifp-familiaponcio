import { describe, it, expect } from "vitest";
import {
  frequenciaMediaTurma,
  percentualPresenca,
  resumoFrequencia,
} from "@/lib/capacitacao/presenca";

/** Frequência da Capacitação — pura (base da regra de 80% do certificado). */

describe("percentualPresenca", () => {
  it("calcula e arredonda", () => {
    expect(percentualPresenca(8, 10)).toBe(80);
    expect(percentualPresenca(1, 3)).toBe(33);
    expect(percentualPresenca(10, 10)).toBe(100);
  });
  it("0 quando não há aulas (evita divisão por zero)", () => {
    expect(percentualPresenca(0, 0)).toBe(0);
    expect(percentualPresenca(5, 0)).toBe(0);
  });
});

describe("resumoFrequencia", () => {
  it("conta presentes/faltas e o percentual", () => {
    const r = resumoFrequencia([
      { presente: true },
      { presente: true },
      { presente: false },
      { presente: true },
    ]);
    expect(r.total).toBe(4);
    expect(r.presentes).toBe(3);
    expect(r.faltas).toBe(1);
    expect(r.percentual).toBe(75);
  });
  it("lista vazia → tudo zero", () => {
    expect(resumoFrequencia([])).toEqual({ total: 0, presentes: 0, faltas: 0, percentual: 0 });
  });
});

describe("frequenciaMediaTurma (B8 — média das %/aluno, não soma de linhas)", () => {
  it("média das %/aluno, não ponderada por nº de chamadas", () => {
    // aluno A: 1/1 = 100% ; aluno B: 1/10 = 10% → média 55% (soma-de-linhas daria 18%)
    const matriculas = [
      { presencas: [{ presente: true }] },
      {
        presencas: [
          { presente: true },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
          { presente: false },
        ],
      },
    ];
    expect(frequenciaMediaTurma(matriculas)).toBe(55);
  });

  it("exclui matrículas com 0 chamadas (não inventa 0%)", () => {
    // A: 100% ; B: sem chamada (excluído) → média = 100, não 50
    const matriculas = [{ presencas: [{ presente: true }] }, { presencas: [] }];
    expect(frequenciaMediaTurma(matriculas)).toBe(100);
  });

  it("turma sem ninguém / sem chamadas → 0", () => {
    expect(frequenciaMediaTurma([])).toBe(0);
    expect(frequenciaMediaTurma([{ presencas: [] }])).toBe(0);
  });
});
