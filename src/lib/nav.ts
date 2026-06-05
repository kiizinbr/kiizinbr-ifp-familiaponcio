import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import type { NavItem } from "@/components/sidebar-nav";

/**
 * Atalho de Configurações (Usuários hoje; settings por unidade no futuro) — só
 * super_admin. Único lugar que define esse item, reusado por TODAS as shells
 * (app/Pôncio, Médico, Capacitação) pra aparecer de qualquer tela. null = oculto.
 */
export function configuracoesNavItem(session: Session): NavItem | null {
  return hasAnyRole(session, "super_admin")
    ? { label: "Configurações", href: "/admin/users" }
    : null;
}
