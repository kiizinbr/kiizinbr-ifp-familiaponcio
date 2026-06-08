import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { RoleAssignment } from "@/lib/rbac-types";
import {
  canAccessUnidade,
  podeChamar,
  podeEditarSaudeCidadao,
  podeEditarSocioCidadao,
  podeGerirConsentimento,
  podeGerirPainel,
  can,
} from "@/lib/rbac";
import { UNIDADE_SLUGS } from "@/lib/unidades";

function sessao(roles: RoleAssignment[], primaryRole: RoleAssignment | null): Session {
  return {
    user: {
      id: "u1",
      roles,
      primaryRole,
      mustChangePassword: false,
      name: null,
      email: null,
      image: null,
    },
    expires: "2099-12-31T00:00:00.000Z",
  };
}

/**
 * Q4 (2026-06-08): presidência = read-only GLOBAL. Acessa a ROTA de qualquer
 * unidade (unifica D7 com getUserUnits), mas NÃO escreve em lugar nenhum.
 * Este teste tranca o invariante: se alguém adicionar presidência a um predicado
 * de escrita, isto quebra.
 */
describe("presidência — read-only global (Q4)", () => {
  const presidencia = sessao([{ name: "presidencia", unitScope: null }], {
    name: "presidencia",
    unitScope: null,
  });

  it("acessa a rota de TODAS as unidades (gate grosso)", () => {
    for (const slug of UNIDADE_SLUGS) {
      expect(canAccessUnidade(presidencia, slug)).toBe(true);
    }
  });

  it("slug inexistente nega mesmo para presidência (segurança do canAccessUnidade)", () => {
    expect(canAccessUnidade(presidencia, "inexistente")).toBe(false);
  });

  it("NÃO escreve: todos os predicados de escrita a excluem (gate fino)", () => {
    expect(podeChamar(presidencia)).toBe(false);
    expect(podeEditarSaudeCidadao(presidencia)).toBe(false);
    expect(podeEditarSocioCidadao(presidencia)).toBe(false);
    expect(podeGerirConsentimento(presidencia)).toBe(false);
    expect(podeGerirPainel(presidencia)).toBe(false);
  });

  it("ficha cidadã: só view, nunca edit/create/delete", () => {
    const ctx = { unitScope: "medico" as const };
    expect(can(presidencia, "view", "ficha_cidada", ctx)).toBe(true);
    expect(can(presidencia, "edit", "ficha_cidada", ctx)).toBe(false);
    expect(can(presidencia, "create", "ficha_cidada", ctx)).toBe(false);
    expect(can(presidencia, "delete", "ficha_cidada", ctx)).toBe(false);
  });

  it("recepção (unit-role) segue restrita à sua unidade — sem regressão", () => {
    const recepcaoMedico = sessao([{ name: "recepcao", unitScope: "medico" }], {
      name: "recepcao",
      unitScope: "medico",
    });
    expect(canAccessUnidade(recepcaoMedico, "medico")).toBe(true);
    expect(canAccessUnidade(recepcaoMedico, "capacitacao")).toBe(false);
    expect(canAccessUnidade(recepcaoMedico, "social")).toBe(false);
  });
});
