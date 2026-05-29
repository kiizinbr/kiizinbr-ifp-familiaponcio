import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import type { NavItem } from "@/components/sidebar-nav";

/**
 * Navegação contextual do Centro Médico (F1.B.1 T14).
 * Itens variam por capability: "Minha agenda" só pra profissional,
 * "Especialidades" só pra quem gerencia. "Cidadãos" leva de volta ao app global.
 */
export function medicoNavItems(session: Session): NavItem[] {
  const items: NavItem[] = [
    { label: "Fila do dia", href: "/medico" },
    { label: "Agenda semanal", href: "/medico/agenda" },
  ];
  if (hasAnyRole(session, "profissional")) {
    items.push({ label: "Minha agenda", href: "/medico/minha-agenda" });
  }
  items.push({ label: "Profissionais", href: "/medico/profissionais" });
  if (podeGerenciarEspecialidade(session)) {
    items.push({ label: "Especialidades", href: "/medico/especialidades" });
  }
  items.push({ label: "Cidadãos", href: "/app/cidadaos" });
  return items;
}
