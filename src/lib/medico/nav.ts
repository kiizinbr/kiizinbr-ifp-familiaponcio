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
  // #17 — as três visões de agenda viraram abas dentro das telas; o menu expõe um
  // único item "Agenda" (→ board do dia). As rotas /medico, /medico/agenda e
  // /medico/agenda-dia seguem todas vivas e alcançáveis pela barra de abas.
  const items: NavItem[] = [{ label: "Agenda", href: "/medico/agenda-dia" }];
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
  // #17 — as três visões de agenda (Fila do dia / Agenda do dia / Agenda semanal)
  // foram consolidadas numa barra de ABAS dentro das próprias telas, então o menu
  // expõe um único ponto de entrada "Agenda" (→ board do dia) em vez de três itens
  // que confundiam. As rotas seguem todas vivas e navegáveis pelas abas.
  const operacao: NavItem[] = [{ label: "Agenda", href: "/medico/agenda-dia" }];
  if (podeMarcarConsulta(session)) {
    operacao.push({ label: "Recepção", href: "/medico/recepcao" });
  }

  // MEU TRABALHO — só pra profissional (sua fila e sua agenda).
  const meuTrabalho: NavItem[] = [];
  if (hasAnyRole(session, "profissional")) {
    meuTrabalho.push({ label: "Minha fila", href: "/medico/minha-fila" });
    meuTrabalho.push({ label: "Minha agenda", href: "/medico/minha-agenda" });
  }

  // AGENDA — planejamento. #17 — a "Agenda semanal" virou aba dentro das telas de
  // agenda (não some, só sai do menu); aqui resta o trabalho a agendar.
  const agenda: NavItem[] = [];
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
