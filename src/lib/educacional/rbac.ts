import type { Session } from "next-auth";
import { hasAnyRole } from "@/lib/rbac";

/**
 * Capabilities da Educacional (creche). Espelha `lib/capacitacao/rbac.ts`.
 * O escopo `educacional` é garantido pelo gate de rota (canAccessUnidade),
 * então aqui basta checar o NOME do papel via hasAnyRole.
 */

/**
 * Registrar entrada/saída da criança (o portão). Gestão, educador (profissional)
 * e recepção operam o portão. NÃO `painel` (quiosque só exibe).
 */
export function podeRegistrarCheck(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional", "recepcao");
}

/**
 * Lançar registro de rotina no diário (alimentação, sono, etc.). Tarefa do
 * educador: gestão e profissional. NÃO recepção (não é tarefa de balcão).
 */
export function podeRegistrarRotina(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}

/** Selar (fechar) o diário do dia: gestão e profissional. NÃO recepção. */
export function podeFecharDiario(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, "super_admin", "gestor_unidade", "profissional");
}
