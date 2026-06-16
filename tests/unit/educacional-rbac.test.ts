import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import { podeRegistrarCheck, podeRegistrarRotina, podeFecharDiario } from "@/lib/educacional/rbac";

// Capabilities puras da Educacional (sem DB). Helper sessionWith igual ao capacitacao-rbac.test.ts.
// O escopo "educacional" é garantido pelo gate de rota (canAccessUnidade); aqui só checa o papel.

function sessionWith(
  roles: { name: RoleName; unitScope: UnitScope | null }[],
  userId = "u1",
): Session {
  return {
    user: { id: userId, email: "x@y.z", name: null, roles, primaryRole: roles[0] ?? null },
    expires: "2099-01-01",
  } as Session;
}

describe("podeRegistrarCheck (entrada/saída da criança)", () => {
  it("sem sessão → false", () => {
    expect(podeRegistrarCheck(null)).toBe(false);
  });
  it("super_admin → true", () => {
    expect(podeRegistrarCheck(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(true);
  });
  it("gestor_unidade:educacional → true", () => {
    expect(
      podeRegistrarCheck(sessionWith([{ name: "gestor_unidade", unitScope: "educacional" }])),
    ).toBe(true);
  });
  it("profissional:educacional (educadora) → true", () => {
    expect(
      podeRegistrarCheck(sessionWith([{ name: "profissional", unitScope: "educacional" }])),
    ).toBe(true);
  });
  it("recepcao:educacional → true (recepção opera o portão de entrada/saída)", () => {
    expect(podeRegistrarCheck(sessionWith([{ name: "recepcao", unitScope: "educacional" }]))).toBe(
      true,
    );
  });
  it("painel (quiosque) → false", () => {
    expect(podeRegistrarCheck(sessionWith([{ name: "painel", unitScope: "educacional" }]))).toBe(
      false,
    );
  });
});

describe("podeRegistrarRotina (lançar registro de rotina no diário)", () => {
  it("profissional:educacional → true", () => {
    expect(
      podeRegistrarRotina(sessionWith([{ name: "profissional", unitScope: "educacional" }])),
    ).toBe(true);
  });
  it("recepcao → false (rotina é tarefa do educador, não do balcão)", () => {
    expect(podeRegistrarRotina(sessionWith([{ name: "recepcao", unitScope: "educacional" }]))).toBe(
      false,
    );
  });
  it("sem sessão → false", () => {
    expect(podeRegistrarRotina(null)).toBe(false);
  });
});

describe("podeFecharDiario (selar o diário do dia)", () => {
  it("gestor_unidade → true", () => {
    expect(
      podeFecharDiario(sessionWith([{ name: "gestor_unidade", unitScope: "educacional" }])),
    ).toBe(true);
  });
  it("profissional:educacional → true", () => {
    expect(
      podeFecharDiario(sessionWith([{ name: "profissional", unitScope: "educacional" }])),
    ).toBe(true);
  });
  it("recepcao → false", () => {
    expect(podeFecharDiario(sessionWith([{ name: "recepcao", unitScope: "educacional" }]))).toBe(
      false,
    );
  });
});
