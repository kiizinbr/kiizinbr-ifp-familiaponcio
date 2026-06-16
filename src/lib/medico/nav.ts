import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";
import {
  podeGerenciarEspecialidade,
  podeAgendarEncaminhamento,
  podeMarcarConsulta,
} from "@/lib/medico/rbac";
import type { NavItem, NavGroup } from "@/components/sidebar-nav";
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
    { label: "Agenda do dia", href: "/medico/agenda-dia" },
  ];
  if (podeMarcarConsulta(session)) {
    items.push({ label: "Recepção", href: "/medico/recepcao" });
  }
  if (podeAgendarEncaminhamento(session) || hasAnyRole(session, "profissional")) {
    items.push({ label: "A agendar", href: "/medico/encaminhamentos" });
  }
  if (hasAnyRole(session, "profissional")) {
    items.push({ label: "Minha fila", href: "/medico/minha-fila" });
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

/**
 * Mesma navegação do `medicoNavItems`, porém PARTICIONADA em grupos rotulados
 * por intenção (wayfinding — QW2). Os MESMOS gates por capability decidem cada
 * item; só muda em qual grupo ele entra. Nenhum item é removido nem tem o
 * predicado relaxado. Grupos que ficam vazios após o gating são omitidos pelo
 * `SidebarNavGroups` (não deixa rótulo órfão), então pode-se montar todos os
 * grupos e só fazer `push` condicional dos itens.
 */
export function medicoNavGroups(session: Session): NavGroup[] {
  // OPERAÇÃO — o dia a dia do balcão e da fila geral.
  const operacao: NavItem[] = [
    { label: "Fila do dia", href: "/medico" },
    { label: "Agenda do dia", href: "/medico/agenda-dia" },
  ];
  if (podeMarcarConsulta(session)) {
    operacao.push({ label: "Recepção", href: "/medico/recepcao" });
  }

  // MEU TRABALHO — só pra profissional (sua fila e sua agenda).
  const meuTrabalho: NavItem[] = [];
  if (hasAnyRole(session, "profissional")) {
    meuTrabalho.push({ label: "Minha fila", href: "/medico/minha-fila" });
    meuTrabalho.push({ label: "Minha agenda", href: "/medico/minha-agenda" });
  }

  // AGENDA — visão de planejamento (semana + encaminhamentos a agendar).
  const agenda: NavItem[] = [{ label: "Agenda semanal", href: "/medico/agenda" }];
  if (podeAgendarEncaminhamento(session) || hasAnyRole(session, "profissional")) {
    agenda.push({ label: "A agendar", href: "/medico/encaminhamentos" });
  }

  // CADASTROS — quem/que (profissionais, especialidades, cidadãos).
  const cadastros: NavItem[] = [{ label: "Profissionais", href: "/medico/profissionais" }];
  if (podeGerenciarEspecialidade(session)) {
    cadastros.push({ label: "Especialidades", href: "/medico/especialidades" });
  }
  cadastros.push({ label: "Cidadãos", href: "/app/cidadaos" });

  // GESTÃO — indicadores e configurações.
  const gestao: NavItem[] = [];
  if (podeGerenciarEspecialidade(session)) {
    gestao.push({ label: "Indicadores", href: "/medico/indicadores" });
  }
  const config = configuracoesNavItem(session);
  if (config) gestao.push(config);

  return [
    { label: "Operação", items: operacao },
    { label: "Meu trabalho", items: meuTrabalho },
    { label: "Agenda", items: agenda },
    { label: "Cadastros", items: cadastros },
    { label: "Gestão", items: gestao },
  ];
}
