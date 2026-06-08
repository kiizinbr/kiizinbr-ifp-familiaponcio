import type { Session } from "next-auth";
import { type RoleName, type UnitScope, getLandingPathFor } from "@/lib/rbac-types";
import { unidadeFromSlug } from "@/lib/unidades";

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
 * super_admin, presidencia → todas. social → todas (cross-unit).
 */
export function getUserUnits(session: Session | null): UnitScope[] | "all" {
  if (!session?.user.roles) return [];
  const roles = session.user.roles;

  const hasGlobalAccess = roles.some((r) =>
    ["super_admin", "presidencia", "social"].includes(r.name),
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
      return false; // só super_admin (já tratado acima)
    case "audit_log":
      return false; // só super_admin (já tratado acima)
  }
}

/**
 * Visibilidade dos campos CLÍNICOS (saúde) da Ficha Cidadã: gestão e profissional.
 * NÃO recepção, NÃO social. Espelha o conjunto de podeAtualizarSaudeCidadao
 * (medico/rbac.ts), mas é o predicado canônico de LEITURA dos campos de saúde.
 */
export function podeVerSaudeCidadao(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/**
 * Visibilidade dos campos SOCIOECONÔMICOS da Ficha: super_admin, presidência e
 * social. NÃO profissional, NÃO recepção.
 */
export function podeVerSocioCidadao(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "presidencia", "social");
}

/**
 * ESCRITA dos campos clínicos (saúde) da Ficha: gestão e profissional.
 * Subconjunto de quem vê (podeVerSaudeCidadao). NÃO recepção, NÃO social.
 */
export function podeEditarSaudeCidadao(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/**
 * ESCRITA dos campos socioeconômicos da Ficha: super_admin e social (domínio do
 * Serviço Social). Presidência só VÊ (view-only), não escreve.
 */
export function podeEditarSocioCidadao(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "social");
}

/**
 * Registrar/revogar consentimentos LGPD (base legal): staff do cadastro/atendimento —
 * super_admin, gestão, serviço social e recepção. NÃO profissional (não é tarefa de balcão dele).
 */
export function podeGerirConsentimento(session: Session | null): boolean {
  return hasAnyRole(session, "super_admin", "gestor_unidade", "social", "recepcao");
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

/**
 * Quem pode CHAMAR um paciente no painel (opera a fila da superficie).
 * Inclui social (triagem). NAO inclui "painel" (quiosque so exibe). A unidade
 * e garantida pelo gate de rota da superficie (canAccessUnidade), como no resto do medico.
 */
export function podeChamar(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional", "recepcao", "social");
}

/** Quem pode configurar o painel (video do mes + anuncios). Gestao only. */
export function podeGerirPainel(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}

/** Default landing path baseado no primaryRole do user. Resolve em /login se sem sessão. */
export function getLandingPath(session: Session | null): string {
  if (!session?.user.primaryRole) return "/login";
  const { name, unitScope } = session.user.primaryRole;
  return getLandingPathFor(name, unitScope);
}

/**
 * Path-based access check para a arquitetura multi-tenant (spec 2026-05-28).
 * Aceita os 6 slugs (medico/capacitacao/esportivo/recreativo/poncio/social).
 *
 * Ordem: (1) sessão válida com pelo menos 1 role, (2) slug existe em UNIDADES,
 * (3) super_admin bypassa, (4) match em UNIDADES[slug].rolesAceitas. Slug é
 * validado ANTES do bypass por segurança — slug inexistente nega acesso mesmo
 * pra super_admin (evita normalizar URL inválida em comportamento permissivo).
 */
export function canAccessUnidade(session: Session | null, slug: string): boolean {
  if (!session?.user.roles?.length) return false;

  const unidade = unidadeFromSlug(slug);
  if (!unidade) return false;

  // super_admin: acesso irrestrito. presidencia: read-only GLOBAL (Q4, 2026-06-08)
  // — acessa a ROTA de qualquer unidade; a ESCRITA segue barrada nos predicados
  // por-acao (can()=view; podeChamar/podeEditar* nao a incluem). Unifica D7 com
  // getUserUnits, que ja tratava presidencia como "all".
  if (session.user.roles.some((r) => r.name === "super_admin" || r.name === "presidencia"))
    return true;

  return unidade.rolesAceitas.some((aceita) =>
    session.user.roles.some(
      (userRole) => userRole.name === aceita.name && userRole.unitScope === aceita.unitScope,
    ),
  );
}
