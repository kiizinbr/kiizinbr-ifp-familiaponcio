import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * Regressão de acesso: o livro-razão de auditoria de /inicio (db.auditLog sem
 * filtro de unidade) expõe nome/e-mail + ações de TODA a organização. Desde que
 * getLandingPath passou a mandar a sessão SEM papel pra /inicio (em vez de
 * /login), uma conta logada com zero papel — ou um papel unitário comum que caia
 * em /inicio por outra via — não pode ver esse feed.
 *
 * O gate na page é `hasAnyRole(session, "super_admin", "presidencia")` (mesma
 * leitura institucional do proxy /admin e de can(audit_log)). Estes testes
 * trancam a invariante: SÓ esses dois papéis veem o feed; todo o resto recebe
 * lista vazia.
 */
function sessao(roles: RoleAssignment[]): Session {
  return {
    user: {
      id: "u1",
      email: "x@y.z",
      name: null,
      roles,
      primaryRole: roles[0] ?? null,
      mustChangePassword: false,
    },
    expires: "2099-01-01",
  } as Session;
}

const veAuditoria = (s: Session | null) => hasAnyRole(s, "super_admin", "presidencia");

describe("gate da auditoria em /inicio", () => {
  it("super_admin vê o feed de auditoria", () => {
    expect(veAuditoria(sessao([{ name: "super_admin", unitScope: null }]))).toBe(true);
  });

  it("presidência (leitura institucional) vê o feed de auditoria", () => {
    expect(veAuditoria(sessao([{ name: "presidencia", unitScope: null }]))).toBe(true);
  });

  it("REGRESSÃO: sessão logada SEM papel NÃO vê o feed cross-org", () => {
    expect(veAuditoria(sessao([]))).toBe(false);
  });

  it("papel unitário comum (recepção/profissional/gestão) NÃO vê o feed cross-org", () => {
    expect(veAuditoria(sessao([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
    expect(veAuditoria(sessao([{ name: "profissional", unitScope: "esportivo" }]))).toBe(false);
    expect(veAuditoria(sessao([{ name: "gestor_unidade", unitScope: "capacitacao" }]))).toBe(false);
  });

  it("social (cross-unit, mas não institucional) NÃO vê o feed de auditoria", () => {
    expect(veAuditoria(sessao([{ name: "social", unitScope: null }]))).toBe(false);
  });

  it("sem sessão NÃO vê o feed", () => {
    expect(veAuditoria(null)).toBe(false);
  });
});
