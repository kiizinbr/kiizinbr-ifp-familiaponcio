import type { Session } from "next-auth";
import type { StatusConsulta, StatusNota } from "@prisma/client";
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

// ── F1.B.2 Prontuário ────────────────────────────────────────────────

/**
 * Leitura do prontuário (conteúdo clínico) — §4. Cross-profissional:
 * super_admin, gestor_unidade e profissional veem. Recepção/social NÃO veem.
 */
export function podeVerProntuario(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/**
 * Edição da nota de evolução (§0.3): SÓ o profissional DONO e SÓ enquanto rascunho.
 * Gestor/super_admin não editam conteúdo clínico; nota assinada é imutável.
 */
export function podeEditarNota(
  session: Session | null,
  notaProfissionalUserId: string,
  status: StatusNota,
): boolean {
  if (!session) return false;
  if (status !== "rascunho") return false;
  return hasAnyRole(session, "profissional") && session.user.id === notaProfissionalUserId;
}

/**
 * Assinatura da nota (§0.4): ato pessoal/legal — só o profissional DONO,
 * SEM bypass de admin/gestor.
 */
export function podeAssinarNota(session: Session | null, notaProfissionalUserId: string): boolean {
  if (!session) return false;
  return hasAnyRole(session, "profissional") && session.user.id === notaProfissionalUserId;
}

/**
 * Edição dos campos de saúde do cidadão a partir do prontuário (§0.7):
 * profissional (e gestão), mas NÃO recepção/social.
 */
export function podeAtualizarSaudeCidadao(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

// ── F1.B Encaminhamento ───────────────────────────────────────────────

/** Criar/cancelar pedido de encaminhamento: GP + gestão. NÃO recepção. */
export function podeEncaminhar(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/** Trabalhar a fila "A agendar" e agendar (callcenter/recepção + gestão). */
export function podeAgendarEncaminhamento(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "recepcao");
}

// ── F1.B.3 Documentos (Receita / Atestado) ───────────────────────────

/**
 * Emitir receita/atestado (§F1.B.3): ato clínico do profissional DONO da
 * consulta. Gestão (super_admin/gestor_unidade) também pode emitir em nome da
 * unidade. Recepção/social NÃO emitem documentos clínicos.
 */
export function podeEmitirDocumento(
  session: Session | null,
  consultaProfissionalUserId: string,
): boolean {
  if (!session) return false;
  if (hasAnyRole(session, "super_admin", "gestor_unidade")) return true;
  if (hasAnyRole(session, "profissional") && session.user.id === consultaProfissionalUserId) {
    return true;
  }
  return false;
}
