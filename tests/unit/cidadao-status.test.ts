import { describe, expect, it } from "vitest";
import { statusDisplay } from "@/lib/cidadao-status";

describe("statusDisplay", () => {
  it("deletado tem precedência sobre tudo", () => {
    expect(
      statusDisplay({ deletedAt: new Date(), anonimizadoEm: new Date(), statusCadastro: "ativo" })
        .label,
    ).toBe("Excluído");
  });

  it("anonimizado vem antes do ciclo de vida", () => {
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: new Date(), statusCadastro: "ativo" }).label,
    ).toBe("Anonimizado");
  });

  it("sem flags, mostra o ciclo de vida", () => {
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "rascunho" }).label,
    ).toBe("Rascunho");
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "ativo" }).label,
    ).toBe("Ativo");
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "inativo" }).label,
    ).toBe("Inativo");
  });

  it("expõe um tone pra estilização", () => {
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "ativo" }).tone,
    ).toBe("emerald");
    expect(
      statusDisplay({ deletedAt: new Date(), anonimizadoEm: null, statusCadastro: "ativo" }).tone,
    ).toBe("red");
  });
});
