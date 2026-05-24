import type { Session } from "next-auth";
import { type RoleName, type UnitScope, getLandingPathFor } from "@/lib/rbac-types";

/**
 * Operações de RBAC para uso em Server Components, Server Actions e proxy.ts.
 * Decisões §0.1, §0.5, §0.9 do Plano 2 (fechadas em 2026-05-24).
 */

export type RbacAction = "view" | "edit" | "delete" | "create" | "export";

export interface CanContext {
  unitScope?: UnitScope | null;
  ownerId?: string | null;
}

/**
 * Retorna lista de unidades que o user tem acesso (via roles com unitScope ou roles globais).
 * super_admin, gestor_geral, presidencia → todas. social → todas (cross-unit).
 */
export function getUserUnits(session: Session | null): UnitScope[] | "all" {
  if (!session?.user.roles) return [];
  const roles = session.user.roles;

  const hasGlobalAccess = roles.some((r) =>
    ["super_admin", "presidencia", "gestor_geral", "social"].includes(r.name),
  );
  if (hasGlobalAccess) return "all";

  const units = new Set<UnitScope>();
  for (const r of roles) {
    if (r.unitScope) units.add(r.unitScope);
  }
  return Array.from(units);
}

/** Confere se o user tem PELO MENOS UM dos roles dados. */
export function hasAnyRole(session: Session | null, ...names: RoleName[]): boolean {
  if (!session?.user.roles) return false;
  return session.user.roles.some((r) => names.includes(r.name));
}

/** Confere se o user tem acesso à unidade específica. */
export function canAccessUnit(session: Session | null, unit: UnitScope): boolean {
  const units = getUserUnits(session);
  return units === "all" || units.includes(unit);
}

/**
 * Capability-based access control.
 * Centraliza a lógica de "pode fazer X em Y?" pra usar nas UIs e Server Actions.
 */
export function can(
  session: Session | null,
  action: RbacAction,
  resource: "ficha_cidada" | "user" | "audit_log" | "role",
  ctx?: CanContext,
): boolean {
  if (!session?.user) return false;
  const roles = session.user.roles;

  // super_admin pode tudo
  if (roles.some((r) => r.name === "super_admin")) return true;

  switch (resource) {
    case "ficha_cidada": {
      // presidencia: só view
      if (roles.some((r) => r.name === "presidencia")) return action === "view";
      // gestor_geral: tudo
      if (roles.some((r) => r.name === "gestor_geral")) return true;
      // social: view/edit cross-unit (triagem socioeconômica)
      if (roles.some((r) => r.name === "social")) {
        return action === "view" || action === "edit";
      }
      // gestor_unidade/profissional/recepcao: só na sua unidade
      if (ctx?.unitScope && canAccessUnit(session, ctx.unitScope)) {
        if (action === "view") return true;
        if (action === "create" || action === "edit") {
          return hasAnyRole(session, "gestor_unidade", "profissional", "recepcao");
        }
        if (action === "delete") return hasAnyRole(session, "gestor_unidade");
      }
      return false;
    }
    case "user":
    case "role":
      return hasAnyRole(session, "gestor_geral");
    case "audit_log":
      return false; // só super_admin (já tratado acima)
  }
}

/**
 * Para usar em Server Components: lança redirect pra /login se não autorizado.
 * Inspirado no pattern de Next.js "auth + redirect" nos boundaries.
 */
export function requireRole(session: Session | null, ...names: RoleName[]): void {
  if (!hasAnyRole(session, ...names)) {
    throw new Error(
      `Unauthorized: requires role ${names.join(" | ")}, has ${
        session?.user.roles.map((r) => r.name).join(",") ?? "none"
      }`,
    );
  }
}

/** Default landing path baseado no primaryRole do user. Resolve em /login se sem sessão. */
export function getLandingPath(session: Session | null): string {
  if (!session?.user.primaryRole) return "/login";
  const { name, unitScope } = session.user.primaryRole;
  return getLandingPathFor(name, unitScope);
}
