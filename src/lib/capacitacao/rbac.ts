import type { Session } from "next-auth";
import type { StatusMatricula } from "@prisma/client";
import { canAccessUnit, hasAnyRole } from "@/lib/rbac";

/**
 * Capabilities da Capacitação (F1.A.1). Espelha `lib/medico/rbac.ts`.
 *
 * Self-protecting (M7): além de checar o NOME do papel, os ramos de GESTÃO
 * combinam `canAccessUnit(session, "capacitacao")` para que um gestor de OUTRA
 * unidade não passe nestes predicados mesmo se algum call-site futuro esquecer
 * o gate de rota (canAccessUnidade). super_admin/presidencia/social têm escopo
 * "all" em getUserUnits → canAccessUnit passa (sem regressão). É endurecimento,
 * não afrouxamento. Os ramos `profissional` seguem por ownership de userId.
 */
const UNIDADE = "capacitacao" as const;

export function podeGerenciarCurso(session: Session | null): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  return hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE);
}

export function podeCriarTurma(session: Session | null): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  return hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE);
}

export function podeGerenciarInstrutor(session: Session | null, instrutorUserId?: string): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  if (hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE)) return true;
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
  if (hasAnyRole(session, "super_admin", "social")) return true;
  return hasAnyRole(session, "gestor_unidade", "recepcao") && canAccessUnit(session, UNIDADE);
}

export function podeTransicionarMatricula(
  session: Session | null,
  _de: StatusMatricula,
  para: StatusMatricula,
  matriculaInstrutorUserId?: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  if (hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE)) return true;
  // recepção só confirma ou cancela (na própria unidade)
  if (hasAnyRole(session, "recepcao") && canAccessUnit(session, UNIDADE)) {
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

/** Registrar presença na aula (F1.A.2): gestão e instrutor (profissional). NÃO recepção. */
export function podeRegistrarPresenca(session: Session | null): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "profissional")) return true;
  return hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE);
}

/** Emitir certificado de conclusão (F1.A.3): só gestão/secretaria. */
export function podeEmitirCertificado(session: Session | null): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  return hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE);
}

/**
 * Registrar presença NUMA turma específica (F1.A.2): gestão marca qualquer turma;
 * instrutor (profissional) só nas próprias (turmaInstrutorUserId === seu userId).
 * Versão com contexto de turma do podeRegistrarPresenca.
 */
export function podeRegistrarPresencaNaTurma(
  session: Session | null,
  turmaInstrutorUserId: string | null,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin")) return true;
  if (hasAnyRole(session, "gestor_unidade") && canAccessUnit(session, UNIDADE)) return true;
  if (hasAnyRole(session, "profissional")) {
    return turmaInstrutorUserId !== null && session.user.id === turmaInstrutorUserId;
  }
  return false;
}
