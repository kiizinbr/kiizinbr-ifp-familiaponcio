import { describe, it, expect } from "vitest";
import { mapCpf, mapGenero, mapCorRaca, slugEmail } from "../../src/lib/migracao-amplimed/pessoa";

describe("mapCpf", () => {
  it("normaliza e aceita CPF válido", () => {
    expect(mapCpf("529.982.247-25", "false")).toEqual({ cpf: "52998224725", problema: null });
  });
  it("retorna null sem problema quando nTemCpf=true", () => {
    expect(mapCpf("", "true")).toEqual({ cpf: null, problema: null });
  });
  it("retorna null com problema quando CPF inválido", () => {
    const r = mapCpf("111.111.111-11", "false");
    expect(r.cpf).toBeNull();
    expect(r.problema).toMatch(/cpf/i);
  });
});

describe("mapGenero", () => {
  it("mapeia variações", () => {
    expect(mapGenero("Masculino")).toBe("masculino");
    expect(mapGenero("F")).toBe("feminino");
    expect(mapGenero("")).toBeNull();
  });
});

describe("mapCorRaca", () => {
  it("mapeia pro vocabulário IBGE", () => {
    expect(mapCorRaca("Parda")).toBe("parda");
    expect(mapCorRaca("xyz")).toBeNull();
  });
});

describe("slugEmail", () => {
  it("gera e-mail institucional sem acento", () => {
    expect(slugEmail("Dr. João Pôncio")).toBe("joao.poncio@familiaponcio.org.br");
  });
});
