import { describe, expect, it } from "vitest";
import { normalizeTipoSanguineo } from "@/lib/tipo-sanguineo";

// B6 (higiene da ficha) — molde de texto-clinico.test.ts: função pura, sem DB.
// Caso real: Cidadao.tipoSanguineo migrado da Amplimed como texto-livre
// ("O Positivo", "o+"…) travava o save inteiro no z.enum do schema.

describe("normalizeTipoSanguineo", () => {
  it("canônicos passam intactos", () => {
    for (const t of ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]) {
      expect(normalizeTipoSanguineo(t)).toBe(t);
    }
  });
  it("minúsculas e espaços", () => {
    expect(normalizeTipoSanguineo("o+")).toBe("O+");
    expect(normalizeTipoSanguineo(" a - ")).toBe("A-");
  });
  it("texto-livre por extenso", () => {
    expect(normalizeTipoSanguineo("O Positivo")).toBe("O+");
    expect(normalizeTipoSanguineo("A Negativo")).toBe("A-");
    expect(normalizeTipoSanguineo("AB POS")).toBe("AB+");
    expect(normalizeTipoSanguineo("Rh+ O")).toBe("O+");
  });
  it("AB não é confundido com A", () => {
    expect(normalizeTipoSanguineo("AB-")).toBe("AB-");
    expect(normalizeTipoSanguineo("ab negativo")).toBe("AB-");
  });
  it("irreconhecível → undefined (nunca erro)", () => {
    expect(normalizeTipoSanguineo("Não sabe")).toBeUndefined();
    expect(normalizeTipoSanguineo("—")).toBeUndefined();
    expect(normalizeTipoSanguineo("")).toBeUndefined();
    expect(normalizeTipoSanguineo(null)).toBeUndefined();
    expect(normalizeTipoSanguineo(undefined)).toBeUndefined();
  });
  it("ambíguo (sem Rh, ou pos e neg juntos) → undefined", () => {
    expect(normalizeTipoSanguineo("O")).toBeUndefined();
    expect(normalizeTipoSanguineo("A pos neg")).toBeUndefined();
  });
});
