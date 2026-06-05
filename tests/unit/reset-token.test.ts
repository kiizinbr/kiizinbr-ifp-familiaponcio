import { describe, it, expect } from "vitest";
import { gerarTokenRaw, hashToken, tokenExpirado, RESET_TOKEN_TTL_MIN } from "@/lib/reset-token";

/**
 * Fase 1 / Identidade — núcleo do reset de senha (admin-driven). O banco guarda só
 * o HASH do token; o raw só existe no link. Helpers puros e determinísticos.
 */

describe("gerarTokenRaw", () => {
  it("gera hex de 64 chars (32 bytes) e único entre chamadas", () => {
    const a = gerarTokenRaw();
    const b = gerarTokenRaw();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("é determinístico e NÃO devolve o raw", () => {
    const raw = "abc123def456";
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("tokenExpirado", () => {
  const agora = new Date("2026-06-05T12:00:00Z");
  it("não expirado quando expiresAt está no futuro", () => {
    expect(tokenExpirado(new Date("2026-06-05T12:30:00Z"), agora)).toBe(false);
  });
  it("expirado quando expiresAt no passado ou exatamente agora", () => {
    expect(tokenExpirado(new Date("2026-06-05T11:30:00Z"), agora)).toBe(true);
    expect(tokenExpirado(agora, agora)).toBe(true);
  });
  it("TTL é 60 min", () => {
    expect(RESET_TOKEN_TTL_MIN).toBe(60);
  });
});
