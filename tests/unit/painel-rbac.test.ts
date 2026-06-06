import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import { podeChamar, podeGerirPainel } from "@/lib/rbac";

function sessionWith(
  roles: { name: RoleName; unitScope: UnitScope | null }[],
  userId = "u1",
): Session {
  return {
    user: { id: userId, email: "x@y.z", name: null, roles, primaryRole: roles[0] ?? null },
    expires: "2099-01-01",
  } as Session;
}

describe("podeChamar", () => {
  it("recepcao pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(true);
  });
  it("profissional pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "profissional", unitScope: "medico" }]))).toBe(true);
  });
  it("social (triagem) pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "social", unitScope: null }]))).toBe(true);
  });
  it("painel (quiosque) NAO pode chamar", () => {
    expect(podeChamar(sessionWith([{ name: "painel", unitScope: "medico" }]))).toBe(false);
  });
  it("sem sessao NAO pode chamar", () => {
    expect(podeChamar(null)).toBe(false);
  });
});

describe("podeGerirPainel", () => {
  it("gestor_unidade pode gerir", () => {
    expect(podeGerirPainel(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
      true,
    );
  });
  it("recepcao NAO pode gerir", () => {
    expect(podeGerirPainel(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
  it("sem sessao NAO pode gerir", () => {
    expect(podeGerirPainel(null)).toBe(false);
  });
});
