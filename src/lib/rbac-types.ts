/**
 * RBAC constants e types compartilhados entre seed, rbac.ts, proxy.ts, UI.
 * Decisões do §0.1 e §0.9 do Plano 2 RBAC (fechadas em 2026-05-24).
 */

export const ROLE_NAMES = [
  "super_admin",
  "presidencia",
  "gestor_unidade",
  "social",
  "profissional",
  "recepcao",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const UNIT_SCOPES = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export type UnitScope = (typeof UNIT_SCOPES)[number];

/** Roles sem unit_scope (global). */
export const GLOBAL_ROLES: readonly RoleName[] = ["super_admin", "presidencia", "social"] as const;

/** Roles que exigem unit_scope. */
export const UNIT_ROLES: readonly RoleName[] = [
  "gestor_unidade",
  "profissional",
  "recepcao",
] as const;

export interface RoleAssignment {
  name: RoleName;
  unitScope: UnitScope | null;
}

/**
 * Descrição humana de cada role (para seed + UI).
 */
export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  super_admin: "Acesso irrestrito — TI / sistema",
  presidencia: "Diretoria — visão global read-only",
  gestor_unidade: "Coordenação de uma unidade específica",
  social: "Equipe de Serviço Social — cross-unidade",
  profissional: "Profissional que atende em uma unidade",
  recepcao: "Recepção / callcenter de uma unidade",
};

/**
 * Para cada role, retorna o landing path padrão (sem unit_scope).
 * Roles com unit_scope precisam do scope para compor o path final.
 */
export function getLandingPathFor(
  primaryRoleName: RoleName | null,
  primaryUnitScope: UnitScope | null,
): string {
  if (!primaryRoleName) return "/login";

  switch (primaryRoleName) {
    case "super_admin":
    case "presidencia":
      return "/app";
    case "social":
      return "/app/social";
    case "gestor_unidade":
    case "profissional":
    case "recepcao":
      return primaryUnitScope ? `/app/${primaryUnitScope}` : "/app";
  }
}
