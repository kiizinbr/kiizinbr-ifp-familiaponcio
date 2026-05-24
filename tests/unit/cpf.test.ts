import { describe, expect, it } from "vitest";
import { formatCpf, normalizeCpf, validateCpf } from "@/lib/cpf";

describe("normalizeCpf", () => {
  it("remove pontuação", () => {
    expect(normalizeCpf("123.456.789-09")).toBe("12345678909");
  });

  it("mantém string só de dígitos", () => {
    expect(normalizeCpf("12345678909")).toBe("12345678909");
  });

  it("descarta letras", () => {
    expect(normalizeCpf("abc123def456")).toBe("123456");
  });
});

describe("formatCpf", () => {
  it("formata 11 dígitos no padrão XXX.XXX.XXX-XX", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });

  it("retorna entrada original se length != 11", () => {
    expect(formatCpf("123")).toBe("123");
  });

  it("normaliza antes de formatar", () => {
    expect(formatCpf("123.456.789-09")).toBe("123.456.789-09");
  });
});

describe("validateCpf", () => {
  it("aceita CPF válido formatado", () => {
    // CPFs válidos conhecidos (gerados algoritmicamente, não pertencem a ninguém)
    expect(validateCpf("123.456.789-09")).toBe(true);
    expect(validateCpf("111.444.777-35")).toBe(true);
  });

  it("aceita CPF válido só com dígitos", () => {
    expect(validateCpf("12345678909")).toBe(true);
  });

  it("rejeita CPF com dígitos verificadores errados", () => {
    expect(validateCpf("123.456.789-00")).toBe(false);
    expect(validateCpf("12345678900")).toBe(false);
  });

  it("rejeita CPF com length != 11", () => {
    expect(validateCpf("123")).toBe(false);
    expect(validateCpf("123456789012")).toBe(false);
  });

  it("rejeita CPFs com todos dígitos iguais (caso especial RFB)", () => {
    expect(validateCpf("00000000000")).toBe(false);
    expect(validateCpf("11111111111")).toBe(false);
    expect(validateCpf("99999999999")).toBe(false);
  });

  it("rejeita strings vazias e não-numéricas", () => {
    expect(validateCpf("")).toBe(false);
    expect(validateCpf("abc.def.ghi-jk")).toBe(false);
  });
});
