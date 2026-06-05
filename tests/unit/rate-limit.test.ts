import { describe, it, expect } from "vitest";
import { loginBloqueado, LOGIN_MAX_TENTATIVAS, LOGIN_JANELA_MIN } from "@/lib/rate-limit";

/**
 * C2 — rate-limit de login (sliding-window via audit log). O núcleo de decisão é
 * puro: bloqueia quando as falhas na janela atingem o limite.
 */

describe("loginBloqueado", () => {
  it("não bloqueia abaixo do limite", () => {
    expect(loginBloqueado(0)).toBe(false);
    expect(loginBloqueado(LOGIN_MAX_TENTATIVAS - 1)).toBe(false);
  });

  it("bloqueia exatamente ao atingir o limite", () => {
    expect(loginBloqueado(LOGIN_MAX_TENTATIVAS)).toBe(true);
  });

  it("permanece bloqueado acima do limite", () => {
    expect(loginBloqueado(LOGIN_MAX_TENTATIVAS + 3)).toBe(true);
  });

  it("constantes coerentes (5 tentativas / janela de 15 min)", () => {
    expect(LOGIN_MAX_TENTATIVAS).toBe(5);
    expect(LOGIN_JANELA_MIN).toBe(15);
  });
});
