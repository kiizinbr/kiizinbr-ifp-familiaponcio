import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Agenda do dia (Fase 4 — só LEITURA/AGREGAÇÃO).
 *
 * Extrai a query base do dia que hoje vive triplicada nas 3 telas /medico/*
 * (home "Fila do dia", recepção, minha-fila) + alimenta o novo board
 * /medico/agenda-dia. NÃO toca o motor de agenda (core.ts / agenda.ts):
 * nada de reserva, transição, CAS ou slot ad-hoc — este módulo só consulta.
 *
 * O generic `I` preserva o tipo EXATO do payload por chamador (home = include
 * completo; recepção/minha-fila = include parcial com select aninhado), o que
 * garante "comportamento idêntico" com os tipos: se um include parcial perdesse
 * um campo, o typecheck quebraria no acesso (`c.cidadao.nomeSocial`).
 */

/** Janela do dia local: 00:00:00.000 → 23:59:59.999 do mesmo dia de `agora`. */
export function buildJanelaDia(agora: Date = new Date()): { inicioDia: Date; fimDia: Date } {
  const inicioDia = new Date(agora);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(agora);
  fimDia.setHours(23, 59, 59, 999);
  return { inicioDia, fimDia };
}

/**
 * Include default = o que a HOME consome (completo): slot/cidadao/profissional/
 * especialidade inteiros (precisa de corDestaque, duracaoMin, checkinEm).
 * Recepção e minha-fila passam o SEU include parcial (com select aninhado).
 */
export const INCLUDE_CONSULTA_DIA = {
  slot: true,
  cidadao: true,
  profissional: true,
  especialidade: true,
} satisfies Prisma.ConsultaInclude;

/** Tipo do payload default — usável direto pela home e pelo board, sem cast. */
export type ConsultaDoDia = Prisma.ConsultaGetPayload<{ include: typeof INCLUDE_CONSULTA_DIA }>;

/**
 * A QUERY BASE DO DIA, parametrizada. As 3 páginas + o board chamam isto.
 *
 * - `agora`: instante de referência da página (passe o MESMO `new Date()` de
 *   toda a página pra não driftar na virada de dia).
 * - `filtro`: condições extra no nível da Consulta (ex.: minha-fila filtra
 *   `profissional.userId` + `status.in`). A janela do slot é SEMPRE preservada,
 *   mesclando defensivamente um eventual `filtro.slot`.
 * - `include`: include por chamador. O generic `I` faz o payload bater exato.
 */
export function getConsultasHoje<
  I extends Prisma.ConsultaInclude = typeof INCLUDE_CONSULTA_DIA,
>(opts?: {
  agora?: Date;
  filtro?: Prisma.ConsultaWhereInput;
  include?: I;
}): Promise<Prisma.ConsultaGetPayload<{ include: I }>[]> {
  const { inicioDia, fimDia } = buildJanelaDia(opts?.agora);
  const { filtro, include } = opts ?? {};
  return db.consulta.findMany({
    where: {
      ...filtro,
      slot: {
        ...((filtro?.slot as Prisma.SlotWhereInput) ?? {}),
        dataHoraInicio: { gte: inicioDia, lte: fimDia },
      },
    },
    include: (include ?? INCLUDE_CONSULTA_DIA) as I,
    orderBy: { slot: { dataHoraInicio: "asc" } },
  }) as Promise<Prisma.ConsultaGetPayload<{ include: I }>[]>;
}

/** Slots do dia p/ a grade do board — inclui profissionais sem consulta ainda. */
export type SlotDoDia = Prisma.SlotGetPayload<{
  include: { profissional: true; especialidade: true };
}>;

/**
 * `status` default = "disponivel": é o ÚNICO status que o board consome (vaga
 * livre). Filtrar aqui aproveita o @@index([status, dataHoraInicio]) e evita
 * carregar slots reservado/bloqueado que seriam descartados em memória. Passe
 * `status: undefined` para trazer todos os status.
 */
export function getSlotsHoje(opts?: {
  agora?: Date;
  status?: Prisma.SlotWhereInput["status"];
}): Promise<SlotDoDia[]> {
  const { inicioDia, fimDia } = buildJanelaDia(opts?.agora);
  const status = opts && "status" in opts ? opts.status : "disponivel";
  return db.slot.findMany({
    where: {
      dataHoraInicio: { gte: inicioDia, lte: fimDia },
      ...(status !== undefined ? { status } : {}),
    },
    include: { profissional: true, especialidade: true },
    orderBy: { dataHoraInicio: "asc" },
  });
}
