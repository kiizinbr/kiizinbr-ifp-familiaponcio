import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import {
  podeCriarTurma,
  podeGerenciarCurso,
  podeGerenciarInstrutor,
  podeMatricular,
  podeTransicionarMatricula,
} from "@/lib/capacitacao/rbac";

// T4 — capabilities puras de Capacitação (sem DB). Helper sessionWith igual ao medico-rbac.test.ts.

function sessionWith(
  roles: { name: RoleName; unitScope: UnitScope | null }[],
  userId = "u1",
): Session {
  return {
    user: { id: userId, email: "x@y.z", name: null, roles, primaryRole: roles[0] ?? null },
    expires: "2099-01-01",
  } as Session;
}

describe("podeGerenciarCurso", () => {
  it("sem sessão → false", () => {
    expect(podeGerenciarCurso(null)).toBe(false);
  });
  it("super_admin → true", () => {
    expect(podeGerenciarCurso(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(true);
  });
  it("gestor_unidade:capacitacao → true", () => {
    expect(
      podeGerenciarCurso(sessionWith([{ name: "gestor_unidade", unitScope: "capacitacao" }])),
    ).toBe(true);
  });
  it("recepcao:capacitacao → false", () => {
    expect(podeGerenciarCurso(sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]))).toBe(
      false,
    );
  });
});

describe("podeCriarTurma", () => {
  it("recepcao → false (recepção não cria turma)", () => {
    expect(podeCriarTurma(sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]))).toBe(
      false,
    );
  });
});

describe("podeMatricular", () => {
  it("recepcao:capacitacao → true", () => {
    expect(podeMatricular(sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]))).toBe(
      true,
    );
  });
  it("social (encaminhamento) → true", () => {
    expect(podeMatricular(sessionWith([{ name: "social", unitScope: null }]))).toBe(true);
  });
  it("profissional → false", () => {
    expect(podeMatricular(sessionWith([{ name: "profissional", unitScope: "capacitacao" }]))).toBe(
      false,
    );
  });
});

describe("podeGerenciarInstrutor", () => {
  it("profissional dono (próprio userId) → true", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeGerenciarInstrutor(s, "u1")).toBe(true);
  });
  it("profissional não-dono → false", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeGerenciarInstrutor(s, "outro")).toBe(false);
  });
});

describe("podeTransicionarMatricula (RBAC)", () => {
  it("recepcao: inscrito → confirmado → true", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]);
    expect(podeTransicionarMatricula(s, "inscrito", "confirmado")).toBe(true);
  });
  it("recepcao: cursando → concluido → false (recepção não conclui)", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]);
    expect(podeTransicionarMatricula(s, "cursando", "concluido")).toBe(false);
  });
  it("gestor_unidade: cursando → concluido → true", () => {
    const s = sessionWith([{ name: "gestor_unidade", unitScope: "capacitacao" }]);
    expect(podeTransicionarMatricula(s, "cursando", "concluido")).toBe(true);
  });
  it("sem sessão → false", () => {
    expect(podeTransicionarMatricula(null, "inscrito", "confirmado")).toBe(false);
  });
});
