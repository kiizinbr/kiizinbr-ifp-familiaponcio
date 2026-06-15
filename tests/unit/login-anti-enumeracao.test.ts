import { describe, expect, it } from "vitest";
import { unidadesAcessiveis, UNIDADES } from "@/lib/unidades";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * B14 — anti-enumeração no login por unidade.
 *
 * O `unidadeLoginAction` ([unidade]/login/login-action.ts) tem dois pré-flights:
 *   1. senha errada / conta inexistente → "E-mail ou senha incorretos."
 *   2. credencial OK mas role não cobre a unidade → ANTES dizia "Não foi possível
 *      acessar essa unidade…", o que vazava (a) que a conta existe e (b) que a
 *      senha confere. AGORA devolve a MESMA "E-mail ou senha incorretos.".
 *
 * Testar a action inteira exigiria mockar Prisma + NextAuth (sem harness no repo).
 * Aqui trancamos o GATILHO do ramo (2): o predicado de acesso à unidade — o mesmo
 * `canAccess` da action, derivado de `rolesAceitas` — retorna false para
 * "credencial válida, salão errado". Se esse gatilho regredir, a mensagem genérica
 * deixaria de cobrir o caso e o vetor de enumeração voltaria.
 */
function cobreUnidade(roles: RoleAssignment[], slug: keyof typeof UNIDADES): boolean {
  // Espelha o `canAccess` da action: super_admin bypassa; senão match em rolesAceitas.
  if (roles.some((r) => r.name === "super_admin")) return true;
  return UNIDADES[slug].rolesAceitas.some((aceita) =>
    roles.some((r) => r.name === aceita.name && r.unitScope === aceita.unitScope),
  );
}

describe("B14 — gatilho do ramo de acesso negado por unidade", () => {
  it("conta válida no salão errado dispara o ramo (canAccess=false) → mensagem genérica", () => {
    // recepção do médico tentando logar no /capacitacao/login: credencial confere,
    // mas a role não cobre capacitação → cai no ramo que agora devolve a msg genérica.
    const recepcaoMedico: RoleAssignment[] = [{ name: "recepcao", unitScope: "medico" }];
    expect(cobreUnidade(recepcaoMedico, "capacitacao")).toBe(false);
    expect(unidadesAcessiveis(recepcaoMedico)).not.toContain("capacitacao");
  });

  it("conta válida no salão certo NÃO dispara o ramo (login legítimo segue intacto)", () => {
    const recepcaoMedico: RoleAssignment[] = [{ name: "recepcao", unitScope: "medico" }];
    expect(cobreUnidade(recepcaoMedico, "medico")).toBe(true);
  });

  it("super_admin nunca cai no ramo de acesso negado (bypass)", () => {
    const admin: RoleAssignment[] = [{ name: "super_admin", unitScope: null }];
    expect(cobreUnidade(admin, "medico")).toBe(true);
    expect(cobreUnidade(admin, "poncio")).toBe(true);
  });
});
