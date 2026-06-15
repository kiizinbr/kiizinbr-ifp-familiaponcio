import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { getLandingPath } from "@/lib/rbac";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * B3 — getLandingPath nunca devolve /login para uma sessão VÁLIDA.
 *
 * O bug original: uma conta logada sem `primaryRole` caía em /login, e como
 * /login (antes do F21) não redirecionava logado, a pessoa ficava "presa no
 * login mesmo autenticada". O fix separa "sem sessão" (→ /login) de "sessão sem
 * papel" (→ deriva de roles[] ou /inicio neutro).
 */
function sessao(
  primaryRole: RoleAssignment | null,
  roles: RoleAssignment[] = primaryRole ? [primaryRole] : [],
): Session {
  return {
    user: {
      id: "u1",
      email: "x@y.z",
      name: null,
      roles,
      primaryRole,
      mustChangePassword: false,
    },
    expires: "2099-01-01",
  } as Session;
}

describe("getLandingPath", () => {
  it("sem sessão → /login (visitante precisa autenticar)", () => {
    expect(getLandingPath(null)).toBe("/login");
  });

  it("super_admin / presidência → /inicio", () => {
    expect(getLandingPath(sessao({ name: "super_admin", unitScope: null }))).toBe("/inicio");
    expect(getLandingPath(sessao({ name: "presidencia", unitScope: null }))).toBe("/inicio");
  });

  it("social → /social", () => {
    expect(getLandingPath(sessao({ name: "social", unitScope: null }))).toBe("/social");
  });

  it("unit-role aterrissa na raiz do módulo da unidade", () => {
    expect(getLandingPath(sessao({ name: "recepcao", unitScope: "medico" }))).toBe("/medico");
    expect(getLandingPath(sessao({ name: "gestor_unidade", unitScope: "capacitacao" }))).toBe(
      "/capacitacao",
    );
    expect(getLandingPath(sessao({ name: "profissional", unitScope: "esportivo" }))).toBe(
      "/esportivo",
    );
  });

  it("painel → /painel/<scope>", () => {
    expect(getLandingPath(sessao({ name: "painel", unitScope: "medico" }))).toBe("/painel/medico");
  });

  it("B3: sessão válida SEM primaryRole mas COM roles → deriva do primeiro papel (NUNCA /login)", () => {
    const s = sessao(null, [{ name: "recepcao", unitScope: "medico" }]);
    const home = getLandingPath(s);
    expect(home).toBe("/medico");
    expect(home).not.toBe("/login");
  });

  it("B3: sessão válida SEM primaryRole e SEM roles → /inicio neutro (NUNCA /login)", () => {
    const s = sessao(null, []);
    const home = getLandingPath(s);
    expect(home).toBe("/inicio");
    expect(home).not.toBe("/login");
  });

  it("B3: sessão válida onde o papel derivado resolveria em /login (painel sem scope) → /inicio, não /login", () => {
    // getLandingPathFor("painel", null) === "/login"; para uma sessão válida isso
    // recriaria o ciclo — getLandingPath neutraliza em /inicio.
    const s = sessao(null, [{ name: "painel", unitScope: null }]);
    const home = getLandingPath(s);
    expect(home).not.toBe("/login");
    expect(home).toBe("/inicio");
  });

  it("invariante: nenhuma sessão NÃO-nula resulta em /login", () => {
    const casos: Session[] = [
      sessao({ name: "super_admin", unitScope: null }),
      sessao({ name: "presidencia", unitScope: null }),
      sessao({ name: "social", unitScope: null }),
      sessao({ name: "recepcao", unitScope: "medico" }),
      sessao({ name: "painel", unitScope: "medico" }),
      sessao(null, [{ name: "profissional", unitScope: "recreativo" }]),
      sessao(null, []),
      sessao(null, [{ name: "painel", unitScope: null }]),
    ];
    for (const s of casos) {
      expect(getLandingPath(s)).not.toBe("/login");
    }
  });
});
