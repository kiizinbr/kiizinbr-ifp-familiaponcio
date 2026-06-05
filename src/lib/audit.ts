import { headers } from "next/headers";
import { db } from "@/lib/db";

export type AuditAction =
  | "signin_success"
  | "signin_failed"
  | "signin_denied_unit"
  | "signout"
  | "role_changed"
  | "data_exported"
  | "cidadao_anonimizado"
  | "medical_data_accessed"
  | "ficha_created"
  | "ficha_updated"
  | "anexo_uploaded"
  | "anexo_removed"
  | "triagem_aberta"
  | "triagem_concluida"
  | "elegibilidade_decidida"
  | "vaga_criada"
  | "agendamento_criado"
  | "agendamento_confirmado"
  | "agendamento_realizado"
  | "agendamento_cancelado"
  | "agendamento_faltou"
  // Centro Médico (F1.B.1)
  | "especialidade_criada"
  | "especialidade_atualizada"
  | "especialidade_desativada"
  | "especialidade_reativada"
  | "profissional_cadastrado"
  | "profissional_atualizado"
  | "profissional_desativado"
  | "template_criado"
  | "template_atualizado"
  | "slot_bloqueado"
  | "slot_desbloqueado"
  | "consulta_agendada"
  | "consulta_confirmada"
  | "consulta_iniciada"
  | "consulta_realizada"
  | "consulta_faltou"
  | "consulta_cancelada"
  // Prontuário (F1.B.2)
  | "prontuario_criado"
  | "prontuario_assinado"
  | "prontuario_addendo"
  | "cidadao_saude_atualizada"
  // Capacitação (F1.A.1)
  | "curso_criado"
  | "curso_atualizado"
  | "curso_desativado"
  | "curso_reativado"
  | "turma_criada"
  | "turma_atualizada"
  | "turma_cancelada"
  | "instrutor_criado"
  | "instrutor_atualizado"
  | "matricula_criada"
  | "matricula_confirmada"
  | "matricula_transicionada"
  | "matricula_cancelada"
  | "lista_espera_promovida"
  // Encaminhamento (F1.B)
  | "encaminhamento_criado"
  | "encaminhamento_agendado"
  | "encaminhamento_cancelado";

interface LogEventArgs {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  /** Entidade-raiz do evento (ex.: 'cidadao') — correlaciona sub-entidades na timeline. */
  rootEntityType?: string;
  rootEntityId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Registra evento no audit log. Captura IP + UserAgent dos headers automaticamente.
 * Nao lanca em caso de erro (audit nao deve quebrar fluxo de negocio); apenas loga
 * no console pra observabilidade.
 *
 * Eventos cobertos no MVP (Plano 2 Task 8):
 * - signin_success / signin_failed / signout: hookados em auth.ts + login/actions.ts
 * - role_changed / data_exported / medical_data_accessed: tipos preparados, callers futuros
 *
 * NAO logamos `ficha_read` (custo I/O alto, decisao §0.3).
 * Retencao indefinida no MVP (decisao §0.4 ainda aberta).
 */
export async function logEvent(args: LogEventArgs): Promise<void> {
  try {
    const h = await headers();
    const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const userAgent = h.get("user-agent");

    await db.auditLog.create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        rootEntityType: args.rootEntityType ?? null,
        rootEntityId: args.rootEntityId ?? null,
        meta: args.meta ? (args.meta as object) : undefined,
        ipAddress,
        userAgent: userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to log event", args.action, error);
  }
}
