import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import { podeGerenciarEspecialidade, podeAgendarEncaminhamento } from "@/lib/medico/rbac";
import type { NavItem } from "@/components/sidebar-nav";
import { configuracoesNavItem } from "@/lib/nav";

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
  if (podeAgendarEncaminhamento(session) || hasAnyRole(session, "profissional")) {
    items.push({ label: "A agendar", href: "/medico/encaminhamentos" });
  }
  if (hasAnyRole(session, "profissional")) {
    items.push({ label: "Minha agenda", href: "/medico/minha-agenda" });
  }
  items.push({ label: "Profissionais", href: "/medico/profissionais" });
  if (podeGerenciarEspecialidade(session)) {
    items.push({ label: "Especialidades", href: "/medico/especialidades" });
    items.push({ label: "Indicadores", href: "/medico/indicadores" });
  }
  items.push({ label: "Cidadãos", href: "/app/cidadaos" });
  const config = configuracoesNavItem(session);
  if (config) items.push(config);
  return items;
}
