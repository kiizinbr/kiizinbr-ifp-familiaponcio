import type { Session } from "next-auth";
import type { StatusMatricula } from "@prisma/client";
import { hasAnyRole } from "@/lib/rbac";

/**
 * Capabilities da Capacitação (F1.A.1). Espelha `lib/medico/rbac.ts`.
 * O escopo `capacitacao` é garantido pelo gate de rota (canAccessUnidade),
 * então aqui basta checar o NOME do papel via hasAnyRole.
 */

export function podeGerenciarCurso(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}

export function podeCriarTurma(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade");
}

export function podeGerenciarInstrutor(session: Session | null, instrutorUserId?: string): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;
  // profissional (instrutor logado, F1.A.2) só gerencia o próprio
  if (
    hasAnyRole(session, "profissional") &&
    instrutorUserId !== undefined &&
    session.user.id === instrutorUserId
  ) {
    return true;
  }
  return false;
}

export function podeMatricular(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao", "social");
}

export function podeTransicionarMatricula(
  session: Session | null,
  _de: StatusMatricula,
  para: StatusMatricula,
  matriculaInstrutorUserId?: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;
  // recepção só confirma ou cancela
  if (hasAnyRole(session, "recepcao")) {
    return para === "confirmado" || para === "cancelado";
  }
  // instrutor logado (F1.A.2) transiciona matrículas das próprias turmas
  if (
    hasAnyRole(session, "profissional") &&
    matriculaInstrutorUserId !== undefined &&
    session.user.id === matriculaInstrutorUserId
  ) {
    return true;
  }
  return false;
}
