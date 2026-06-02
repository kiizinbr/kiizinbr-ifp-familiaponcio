import type { Session } from "next-auth";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import type { NavItem } from "@/components/sidebar-nav";

/**
 * Navegação contextual da Capacitação (F1.A.1). Espelha medicoNavItems.
 * "Instrutores" só pra quem gerencia turmas; "Cidadãos" volta ao app global.
 */
export function capacitacaoNavItems(session: Session): NavItem[] {
  const items: NavItem[] = [
    { label: "Início", href: "/capacitacao" },
    { label: "Catálogo", href: "/capacitacao/cursos" },
    { label: "Turmas", href: "/capacitacao/turmas" },
  ];
  if (podeCriarTurma(session)) {
    items.push({ label: "Instrutores", href: "/capacitacao/instrutores" });
  }
  items.push({ label: "Cidadãos", href: "/app/cidadaos" });
  return items;
}
