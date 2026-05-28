import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { canAccessUnidade } from "@/lib/rbac";

function sessionWith(roles: { name: string; unitScope: string | null }[]): Session {
  return {
    user: {
      id: "u1",
      email: "x@y.z",
      name: null,
      roles: roles as Session["user"]["roles"],
      primaryRole: roles[0] as Session["user"]["primaryRole"],
    },
    expires: "2099-01-01",
  } as Session;
}

describe("canAccessUnidade", () => {
  it("super_admin passa em qualquer slug (inclusive poncio e social)", () => {
    const erick = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(canAccessUnidade(erick, "medico")).toBe(true);
    expect(canAccessUnidade(erick, "poncio")).toBe(true);
    expect(canAccessUnidade(erick, "social")).toBe(true);
  });

  it("presidencia só em poncio", () => {
    const saulo = sessionWith([{ name: "presidencia", unitScope: null }]);
    expect(canAccessUnidade(saulo, "poncio")).toBe(true);
    expect(canAccessUnidade(saulo, "medico")).toBe(false);
    expect(canAccessUnidade(saulo, "social")).toBe(false);
  });

  it("social só em /social", () => {
    const regina = sessionWith([{ name: "social", unitScope: null }]);
    expect(canAccessUnidade(regina, "social")).toBe(true);
    expect(canAccessUnidade(regina, "medico")).toBe(false);
    expect(canAccessUnidade(regina, "poncio")).toBe(false);
  });

  it("gestor_unidade:medico só em /medico", () => {
    const raquel = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]);
    expect(canAccessUnidade(raquel, "medico")).toBe(true);
    expect(canAccessUnidade(raquel, "capacitacao")).toBe(false);
    expect(canAccessUnidade(raquel, "poncio")).toBe(false);
  });

  it("recepcao:medico só em /medico", () => {
    const maria = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(canAccessUnidade(maria, "medico")).toBe(true);
    expect(canAccessUnidade(maria, "social")).toBe(false);
  });

  it("sem sessão → falso pra qualquer slug", () => {
    expect(canAccessUnidade(null, "medico")).toBe(false);
    expect(canAccessUnidade(null, "poncio")).toBe(false);
  });

  it("slug inexistente → falso", () => {
    const erick = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(canAccessUnidade(erick, "xyz")).toBe(false);
  });
});
