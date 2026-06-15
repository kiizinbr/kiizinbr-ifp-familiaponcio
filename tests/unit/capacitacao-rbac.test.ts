import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import {
  podeCriarTurma,
  podeEmitirCertificado,
  podeGerenciarCurso,
  podeGerenciarInstrutor,
  podeMatricular,
  podeRegistrarPresencaNaTurma,
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
  // M7 — endurecimento: gestor de OUTRA unidade não passa (self-protecting, sem
  // depender do gate de rota canAccessUnidade num call-site externo).
  it("gestor_unidade:medico → false (cross-unit)", () => {
    expect(podeGerenciarCurso(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
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
  it("gestor_unidade:capacitacao → true", () => {
    expect(
      podeCriarTurma(sessionWith([{ name: "gestor_unidade", unitScope: "capacitacao" }])),
    ).toBe(true);
  });
  it("gestor_unidade:medico → false (cross-unit, M7)", () => {
    expect(podeCriarTurma(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
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
  it("gestor_unidade:medico → false (cross-unit, M7)", () => {
    expect(podeMatricular(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
      false,
    );
  });
  it("recepcao:medico → false (cross-unit, M7)", () => {
    expect(podeMatricular(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
});

describe("podeEmitirCertificado (M7 cross-unit)", () => {
  it("gestor_unidade:capacitacao → true", () => {
    expect(
      podeEmitirCertificado(sessionWith([{ name: "gestor_unidade", unitScope: "capacitacao" }])),
    ).toBe(true);
  });
  it("gestor_unidade:medico → false (cross-unit)", () => {
    expect(
      podeEmitirCertificado(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }])),
    ).toBe(false);
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
  it("gestor_unidade:medico → false (cross-unit, M7)", () => {
    const s = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]);
    expect(podeTransicionarMatricula(s, "cursando", "concluido")).toBe(false);
  });
  // M6 — ramo do instrutor (profissional) só funciona quando o 4º arg (userId do
  // dono da turma) chega. Antes a action chamava com 3 args → capability MORTA.
  it("profissional dono (4º arg = userId): cursando → concluido → true", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeTransicionarMatricula(s, "cursando", "concluido", "u1")).toBe(true);
  });
  it("profissional não-dono (4º arg ≠ userId) → false", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeTransicionarMatricula(s, "cursando", "concluido", "outro")).toBe(false);
  });
  it("profissional SEM 4º arg → false (regressão-guard: bug que matava a action)", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeTransicionarMatricula(s, "cursando", "concluido")).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeTransicionarMatricula(null, "inscrito", "confirmado")).toBe(false);
  });
});

describe("podeRegistrarPresencaNaTurma", () => {
  it("gestor_unidade marca qualquer turma", () => {
    const s = sessionWith([{ name: "gestor_unidade", unitScope: "capacitacao" }]);
    expect(podeRegistrarPresencaNaTurma(s, "outro-instrutor")).toBe(true);
  });
  it("profissional marca só a própria turma", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "capacitacao" }], "u1");
    expect(podeRegistrarPresencaNaTurma(s, "u1")).toBe(true);
    expect(podeRegistrarPresencaNaTurma(s, "outro")).toBe(false);
    expect(podeRegistrarPresencaNaTurma(s, null)).toBe(false);
  });
  it("recepcao → false (não marca presença)", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "capacitacao" }]);
    expect(podeRegistrarPresencaNaTurma(s, "u1")).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeRegistrarPresencaNaTurma(null, "u1")).toBe(false);
  });
});
