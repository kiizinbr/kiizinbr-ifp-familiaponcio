import type { CheckInOut, RegistroRotina, DiarioDia, TipoRegistroRotina } from "@prisma/client";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import {
  validarAutorizado,
  proximoCheckPermitido,
  type AutorizadoCheck,
  type SentidoCheck,
} from "@/lib/educacional/autorizado";
import {
  podeRegistrar,
  podeFechar,
  type StatusDiario as StatusDiarioPuro,
} from "@/lib/educacional/diario";

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

// ── Erros do diário/selo (Slice 3) ───────────────────────────────────────────

/** Diário inexistente (lock vazio ou não encontrado) — equivale ao 404 do `main`. */
export class DiarioNaoEncontradoError extends Error {
  constructor() {
    super("Diário não encontrado.");
    this.name = "DiarioNaoEncontradoError";
  }
}

/** Registro novo num diário SELADO — imutabilidade (409 no `main`). */
export class DiarioFechadoError extends Error {
  constructor() {
    super("Diário fechado — registros são imutáveis após o selo.");
    this.name = "DiarioFechadoError";
  }
}

/** Tentativa de fechar um diário sem nenhum registro — validação (400 no `main`). */
export class DiarioSemRegistroError extends Error {
  constructor() {
    super("Lance ao menos um registro antes de fechar o diário do dia.");
    this.name = "DiarioSemRegistroError";
  }
}

/** Fechar um diário já FECHADO (idempotência: 2º selo concorrente) — 409 no `main`. */
export class DiarioJaFechadoError extends Error {
  constructor() {
    super("Diário já fechado.");
    this.name = "DiarioJaFechadoError";
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

// ── Diário de rotina + selo (Slice 3) ────────────────────────────────────────

/**
 * Janela do dia [início, dataDb) — `dataDb` é meia-noite local, usado como a
 * coluna `DiarioDia.data` (`@db.Date`, sem hora). Espelha `janelaDoDiaSP().dataDb`
 * do `main`; aqui usamos o dia local (sem timezone fixo), suficiente para o
 * invariante "um diário por criança por dia".
 */
function dataDoDia(agora: Date): Date {
  const data = new Date(agora);
  data.setHours(0, 0, 0, 0);
  return data;
}

export interface RegistrarRotinaInput {
  criancaId: string;
  profissionalId: string;
  /** userId de quem operou (para o audit log). */
  userId: string;
  tipo: TipoRegistroRotina;
  descricao: string;
}

/**
 * Lança um registro de rotina no diário do dia da criança. Em transação:
 *   1. upsert do DiarioDia do dia (cria ABERTO se não existe);
 *   2. `FOR UPDATE` do diário — serializa com fecharDiario (sem janela pra
 *      registrar depois do selo, mesma disciplina do prontuário médico);
 *   3. se o status (relido sob lock) é FECHADO → DiarioFechadoError (imutável);
 *   4. senão cria o RegistroRotina.
 * Decisão pura do bloqueio fica em `podeRegistrar` (`diario.ts`).
 *
 * Adaptação ao study: o DiarioDia não tem `unidadeId` (o escopo da unidade é a
 * String "educacional", garantida pelo gate de rota `canAccessUnidade`); por isso
 * o serviço recebe o `profissionalId` já resolvido pela action, como no check-in/out.
 */
export async function registrarRotina(input: RegistrarRotinaInput): Promise<RegistroRotina> {
  const data = dataDoDia(new Date());

  const registro = await db.$transaction(async (tx) => {
    const diario = await tx.diarioDia.upsert({
      where: { criancaId_data: { criancaId: input.criancaId, data } },
      update: {},
      create: { criancaId: input.criancaId, data, profissionalId: input.profissionalId },
    });

    // Lock pessimista: relê o status sob FOR UPDATE p/ serializar com o fechar().
    const lockado = await tx.$queryRaw<{ status: StatusDiarioPuro }[]>`
      SELECT status FROM "DiarioDia" WHERE id = ${diario.id} FOR UPDATE
    `;
    const status = lockado[0]?.status;
    if (!status) {
      throw new DiarioNaoEncontradoError();
    }
    if (!podeRegistrar(status).ok) {
      throw new DiarioFechadoError();
    }

    return tx.registroRotina.create({
      data: {
        diarioId: diario.id,
        tipo: input.tipo,
        descricao: input.descricao,
        profissionalId: input.profissionalId,
      },
    });
  });

  await logEvent({
    userId: input.userId,
    action: "rotina_registrada",
    entityType: "RegistroRotina",
    entityId: registro.id,
    meta: { criancaId: input.criancaId, tipo: input.tipo },
  });

  return registro;
}

export interface FecharDiarioInput {
  diarioId: string;
  profissionalId: string;
  /** userId de quem operou (para o audit log). */
  userId: string;
}

/**
 * Sela o diário do dia — só então ele fica visível à família. Valida que o diário
 * existe, está ABERTO e tem ≥1 registro (`podeFechar`), depois fecha com
 * `updateMany ... WHERE status=ABERTO` exigindo `count === 1` para idempotência:
 * dois selos simultâneos → o segundo recebe DiarioJaFechadoError.
 *
 * Adaptação ao study: sem `unidadeId` no diário, a checagem de unidade do `main`
 * (`diario.unidadeId !== profissional.unidadeId`) é coberta pelo gate de rota
 * `canAccessUnidade("educacional")` na action; aqui validamos o estado do selo.
 */
export async function fecharDiario(input: FecharDiarioInput): Promise<DiarioDia> {
  const diario = await db.diarioDia.findUnique({
    where: { id: input.diarioId },
    include: { _count: { select: { registros: true } } },
  });
  if (!diario) {
    throw new DiarioNaoEncontradoError();
  }

  const validacao = podeFechar(diario.status, diario._count.registros);
  if (!validacao.ok) {
    if (diario.status === "FECHADO") {
      throw new DiarioJaFechadoError();
    }
    throw new DiarioSemRegistroError();
  }

  const fechado = await db.$transaction(async (tx) => {
    // updateMany condicional: dois selos simultâneos → o 2º vê count 0 → 409.
    const r = await tx.diarioDia.updateMany({
      where: { id: input.diarioId, status: "ABERTO" },
      data: { status: "FECHADO", fechadoEm: new Date(), profissionalId: input.profissionalId },
    });
    if (r.count === 0) {
      throw new DiarioJaFechadoError();
    }
    return tx.diarioDia.findUniqueOrThrow({ where: { id: input.diarioId } });
  });

  await logEvent({
    userId: input.userId,
    action: "diario_fechado",
    entityType: "DiarioDia",
    entityId: input.diarioId,
    meta: { criancaId: diario.criancaId },
  });

  return fechado;
}
