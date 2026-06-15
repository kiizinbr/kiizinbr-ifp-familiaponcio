import { describe, it, expect } from "vitest";
import { bytesToHex, isValidSha256Hex, sha256Hex } from "@/lib/hash";

/**
 * F13 — integridade de anexos. Hash determinístico + validação de formato no
 * boundary do Server Action (não confiar no cliente cegamente).
 */

describe("bytesToHex", () => {
  it("converte bytes em hex minúsculo com padding", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });

  it("retorna string vazia para buffer vazio", () => {
    expect(bytesToHex(new Uint8Array([]))).toBe("");
  });
});

describe("sha256Hex (vetor conhecido, determinístico)", () => {
  it("SHA-256 de bytes vazios", async () => {
    const hex = await sha256Hex(new Uint8Array([]).buffer);
    expect(hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("SHA-256 de 'abc'", async () => {
    const hex = await sha256Hex(new TextEncoder().encode("abc").buffer);
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("produz sempre 64 chars hex válidos", async () => {
    const hex = await sha256Hex(new TextEncoder().encode("ifp-connect").buffer);
    expect(isValidSha256Hex(hex)).toBe(true);
  });
});

describe("isValidSha256Hex (boundary validation)", () => {
  it("aceita 64 chars hex minúsculos", () => {
    expect(
      isValidSha256Hex("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
    ).toBe(true);
  });

  it("rejeita string vazia (o caso do MVP antigo)", () => {
    expect(isValidSha256Hex("")).toBe(false);
  });

  it("rejeita comprimento errado (63 e 65 chars)", () => {
    expect(isValidSha256Hex("a".repeat(63))).toBe(false);
    expect(isValidSha256Hex("a".repeat(65))).toBe(false);
  });

  it("rejeita uppercase e caracteres não-hex", () => {
    expect(
      isValidSha256Hex("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"),
    ).toBe(false);
    expect(isValidSha256Hex("z".repeat(64))).toBe(false);
  });

  it("rejeita não-strings", () => {
    expect(isValidSha256Hex(undefined)).toBe(false);
    expect(isValidSha256Hex(null)).toBe(false);
    expect(isValidSha256Hex(123)).toBe(false);
  });
});
