import { describe, it, expect } from "vitest";
import { podeTransicionarTurma, proximosStatusTurma } from "@/lib/capacitacao/turma";

/** Máquina de estados da Turma (Capacitação) — pura. */

describe("podeTransicionarTurma", () => {
  it("planejada → inscricoes_abertas ou cancelada", () => {
    expect(podeTransicionarTurma("planejada", "inscricoes_abertas")).toBe(true);
    expect(podeTransicionarTurma("planejada", "cancelada")).toBe(true);
    expect(podeTransicionarTurma("planejada", "concluida")).toBe(false);
  });

  it("fluxo feliz: inscricoes_abertas → em_andamento → concluida", () => {
    expect(podeTransicionarTurma("inscricoes_abertas", "em_andamento")).toBe(true);
    expect(podeTransicionarTurma("em_andamento", "concluida")).toBe(true);
  });

  it("não pula etapas (planejada → em_andamento é inválido)", () => {
    expect(podeTransicionarTurma("planejada", "em_andamento")).toBe(false);
  });

  it("concluida e cancelada são terminais", () => {
    expect(proximosStatusTurma("concluida")).toEqual([]);
    expect(proximosStatusTurma("cancelada")).toEqual([]);
    expect(podeTransicionarTurma("cancelada", "em_andamento")).toBe(false);
  });
});
