import type { Session } from "next-auth";
import type { StatusConsulta } from "@prisma/client";
import { hasAnyRole } from "@/lib/rbac";

/**
 * Capabilities específicas do Centro Médico (F1.B.1).
 * Reusa hasAnyRole de @/lib/rbac. O escopo `medico` já é garantido pelo gate
 * de rota (/medico/* via canAccessUnidade), então aqui basta checar o role.
 */

export function podeGerenciarProfissional(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}

export function podeConfigurarAgendaProfissional(
  session: Session | null,
  profissionalUserId: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;
  if (hasAnyRole(session, "profissional") && session.user.id === profissionalUserId) return true;
  return false;
}

export function podeMarcarConsulta(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao", "social");
}

export function podeTransicionarConsulta(
  session: Session | null,
  _de: StatusConsulta,
  para: StatusConsulta,
  consultaProfissionalUserId: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;

  // recepção: check-in (em_atendimento), faltou, cancelada, confirmada
  if (hasAnyRole(session, "recepcao")) {
    return (
      para === "em_atendimento" ||
      para === "faltou" ||
      para === "cancelada" ||
      para === "confirmada"
    );
  }

  // profissional só transiciona consulta DELE
  if (hasAnyRole(session, "profissional") && session.user.id === consultaProfissionalUserId) {
    return true;
  }

  return false;
}

export function podeGerenciarEspecialidade(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}
