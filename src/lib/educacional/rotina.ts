import type { CheckInOut } from "@prisma/client";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import {
  validarAutorizado,
  proximoCheckPermitido,
  type AutorizadoCheck,
  type SentidoCheck,
} from "@/lib/educacional/autorizado";

/**
 * Serviço de check-in/out da creche (camada DB). A lógica de DECISÃO é pura
 * (`@/lib/educacional/autorizado`); aqui fica só o I/O: buscar o autorizado,
 * aplicar os 4 bloqueios, AUDITAR a tentativa bloqueada e criar o evento.
 *
 * Portado de `main` `apps/api/src/educacional/rotina.service.ts`, preservando:
 *   1. ordem dos bloqueios de `validarAutorizado` (intransponível);
 *   2. tentativa bloqueada SEMPRE gera auditoria (evidência de disputa de guarda),
 *      DEPOIS lança erro — antes de qualquer create;
 *   3. estado-do-dia: duplo check-in → conflito; check-out sem entrada → conflito.
 */

// ── Erros tipados (espelha o padrão de erros das libs do study) ──────────────

/** Bloqueio de segurança física (um dos 4) — equivale ao 403 do `main`. */
export class CheckBloqueadoError extends Error {
  constructor(public readonly motivo: string) {
    super(`Retirada/entrega bloqueada: ${motivo}.`);
    this.name = "CheckBloqueadoError";
  }
}

/** Estado-do-dia inválido (duplo check-in / check-out sem entrada) — 409 no `main`. */
export class CheckEstadoInvalidoError extends Error {
  constructor(public readonly motivo: string) {
    super(motivo);
    this.name = "CheckEstadoInvalidoError";
  }
}

export interface RegistrarCheckInput {
  criancaId: string;
  autorizadoId: string;
  profissionalId: string;
  /** userId de quem operou o portão (para o audit log). */
  userId: string;
}

/**
 * Janela do dia [início, fim) em horário local do servidor, para isolar os checks
 * "de hoje". O `main` usa timezone fixo de São Paulo (`janelaDoDiaSP`); o study ainda
 * não tem esse util — usamos o dia local, suficiente para o invariante de alternância.
 * TODO(revisão): portar `janelaDoDiaSP` quando a creche precisar de timezone fixo.
 */
function janelaDoDia(agora: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(agora);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return { inicio, fim };
}

async function ultimoSentidoDoDia(criancaId: string, agora: Date): Promise<SentidoCheck | null> {
  const { inicio, fim } = janelaDoDia(agora);
  const ultimo = await db.checkInOut.findFirst({
    where: { criancaId, ocorridoEm: { gte: inicio, lt: fim } },
    orderBy: { ocorridoEm: "desc" },
  });
  return (ultimo?.sentido as SentidoCheck | undefined) ?? null;
}

/**
 * Núcleo compartilhado de check-in/out: aplica os 4 bloqueios + estado-do-dia +
 * cria o CheckInOut. Tentativa bloqueada → logEvent da tentativa + CheckBloqueadoError
 * ANTES de qualquer create (preserva a evidência mesmo quando barra).
 */
async function registrarCheck(
  sentido: SentidoCheck,
  input: RegistrarCheckInput,
): Promise<CheckInOut> {
  const agora = new Date();

  // 1. Busca o autorizado DESTA criança (escopo por criancaId, como no main).
  const autorizado = await db.responsavelAutorizado.findFirst({
    where: { id: input.autorizadoId, criancaId: input.criancaId },
  });

  // 2. Os 4 bloqueios (puro). Se bloqueado → AUDITA a tentativa e lança.
  const validacao = validarAutorizado(autorizado as AutorizadoCheck | null, sentido, agora);
  if (!validacao.ok) {
    const motivo = validacao.motivo ?? "bloqueado";
    await logEvent({
      userId: input.userId,
      action: "check_tentativa_bloqueada",
      entityType: "CheckInOut.tentativaBloqueada",
      entityId: input.autorizadoId,
      meta: { criancaId: input.criancaId, sentido, motivo },
    });
    throw new CheckBloqueadoError(motivo);
  }

  // 3. Estado-do-dia (puro): alternância entrada/saída.
  const ultimo = await ultimoSentidoDoDia(input.criancaId, agora);
  const estado = proximoCheckPermitido(ultimo, sentido);
  if (!estado.ok) {
    throw new CheckEstadoInvalidoError(estado.motivo ?? "estado-do-dia inválido");
  }

  // 4. Cria o evento + auditoria de sucesso.
  const check = await db.checkInOut.create({
    data: {
      criancaId: input.criancaId,
      sentido,
      autorizadoId: input.autorizadoId,
      profissionalId: input.profissionalId,
    },
  });

  await logEvent({
    userId: input.userId,
    action: sentido === "ENTRADA" ? "check_in_registrado" : "check_out_registrado",
    entityType: "CheckInOut",
    entityId: check.id,
    meta: { criancaId: input.criancaId, sentido, autorizadoId: input.autorizadoId },
  });

  return check;
}

/** Check-in da manhã: registra QUEM entregou a criança. */
export async function checkin(input: RegistrarCheckInput): Promise<CheckInOut> {
  return registrarCheck("ENTRADA", input);
}

/** Check-out: valida pessoa autorizada e exige check-in aberto no dia. */
export async function checkout(input: RegistrarCheckInput): Promise<CheckInOut> {
  return registrarCheck("SAIDA", input);
}
