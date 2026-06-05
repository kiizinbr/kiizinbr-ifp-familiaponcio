import { describe, it, expect } from "vitest";
import { validarTrocaSenha, SENHA_MIN } from "@/lib/senha";

describe("validarTrocaSenha", () => {
  it("null quando >= 8 caracteres e iguais", () => {
    expect(validarTrocaSenha("12345678", "12345678")).toBeNull();
  });
  it("rejeita senha curta", () => {
    const e = validarTrocaSenha("123", "123");
    expect(e).not.toBeNull();
    expect(e).toContain(String(SENHA_MIN));
  });
  it("rejeita quando não conferem", () => {
    expect(validarTrocaSenha("12345678", "87654321")).toContain("conferem");
  });
});
