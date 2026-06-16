import type { Session } from "next-auth";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { hasAnyRole } from "@/lib/rbac";
import type { NavItem } from "@/components/sidebar-nav";
import { configuracoesNavItem } from "@/lib/nav";

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
  if (hasAnyRole(session, "profissional")) {
    items.push({ label: "Minhas turmas", href: "/capacitacao/minhas-turmas" });
  }
  if (podeCriarTurma(session)) {
    items.push({ label: "Instrutores", href: "/capacitacao/instrutores" });
  }
  // "Cidadãos" leva à área GLOBAL (/app/cidadaos), fora do shell da Capacitação.
  // O destino é contrato de nav (não muda); o "↗" sinaliza que é uma saída pro app
  // geral, e o retorno fica óbvio pelo mini-breadcrumb do eyebrow ("Capacitação" →
  // /capacitacao) nas telas da unidade.
  items.push({ label: "Cidadãos ↗", href: "/app/cidadaos" });
  const config = configuracoesNavItem(session);
  if (config) items.push(config);
  return items;
}
