/**
 * Core de agenda — lógica resource-agnostic (não conhece médico nem social).
 * Extraído de `src/lib/medico/agenda.ts` (Fase 1, doc docs/superpowers/plans/
 * 2026-06-09-motor-agenda-fase1-core.md) para ser reusado por médico, serviço
 * social e demais unidades agendáveis.
 */

/** Janela de disponibilidade recorrente — base da geração de slots. */
export interface JanelaDisponibilidade {
  diasSemana: readonly number[]; // 0=dom..6=sáb
  faixaInicio: string; // "HH:mm"
  faixaFim: string;
  duracaoSlotMin: number;
  validoDe: Date;
  validoAte: Date | null;
}

/** Slot gerado, sem recurso — o consumidor anexa profissionalId/assistenteSocialId/etc. */
export interface SlotBase {
  dataHoraInicio: Date;
  duracaoMin: number;
}

export interface GerarSlotsOpts {
  limiteSuperior?: Date; // usado quando validoAte é null
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h = 0, m = 0] = s.split(":").map(Number);
  return { h, m };
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Gera slots disponíveis derivados de uma janela recorrente. PURO (não toca banco).
 * Generalização do antigo `medico/agenda.gerarSlots` sem profissional/especialidade.
 */
export function gerarSlots(janela: JanelaDisponibilidade, opts: GerarSlotsOpts = {}): SlotBase[] {
  const slots: SlotBase[] = [];
  const inicio = startOfUtcDay(janela.validoDe);
  const fim = janela.validoAte ?? opts.limiteSuperior;
  if (!fim) {
    throw new Error("gerarSlots: validoAte é null e limiteSuperior não foi fornecido");
  }
  const fimUtc = startOfUtcDay(fim);
  const { h: hIni, m: mIni } = parseHHMM(janela.faixaInicio);
  const { h: hFim, m: mFim } = parseHHMM(janela.faixaFim);

  let dia = inicio;
  while (dia < fimUtc) {
    if (janela.diasSemana.includes(dia.getUTCDay())) {
      const ini = new Date(dia);
      ini.setUTCHours(hIni, mIni, 0, 0);
      const fimDia = new Date(dia);
      fimDia.setUTCHours(hFim, mFim, 0, 0);
      let cursor = ini;
      while (cursor.getTime() + janela.duracaoSlotMin * 60_000 <= fimDia.getTime()) {
        slots.push({ dataHoraInicio: new Date(cursor), duracaoMin: janela.duracaoSlotMin });
        cursor = new Date(cursor.getTime() + janela.duracaoSlotMin * 60_000);
      }
    }
    dia = addDays(dia, 1);
  }
  return slots;
}

/** Máquina de estados genérica: dado um mapa de transições, valida `de -> para`. */
export function criarMaquinaEstados<S extends string>(transicoes: Record<S, ReadonlySet<S>>) {
  return {
    pode: (de: S, para: S): boolean => transicoes[de].has(para),
    alvos: (de: S): ReadonlySet<S> => transicoes[de],
  };
}

/**
 * Encapsula o invariante anti-overbooking: recebe um thunk que faz o `updateMany`
 * compare-and-swap (status disponível -> reservado, com filtro de status no WHERE).
 * Retorna true se reservou (count === 1), false se outro já pegou. O caller monta
 * o updateMany tipado da SUA tabela (Slot, SlotSocial…), mantendo o core sem
 * acoplamento com Prisma.
 */
export async function reservarCAS(updateMany: () => Promise<{ count: number }>): Promise<boolean> {
  const { count } = await updateMany();
  return count === 1;
}

export interface CriarSlotAdHocArgs<T> {
  /** Create delegate da tabela do consumidor — ex.: `(d) => tx.slot.create({ data: d })`. */
  create: (
    data: Record<string, unknown> & { dataHoraInicio: Date; duracaoMin: number; status: "disponivel" },
  ) => Promise<T>;
  /** Campos do recurso, mesclados no slot — ex.: `{ profissionalId, especialidadeId }` | `{ assistenteSocialId }`. */
  recurso: Record<string, unknown>;
  dataHoraInicio: Date;
  duracaoMin: number;
}

/**
 * Cria um slot disponível on-demand — o "dinâmico" (encaixe/walk-in), sem depender de
 * template pré-gerado. Delegate-based como `reservarCAS`: o caller passa o `create` da
 * SUA tabela; o core padroniza `status: "disponivel"` e mescla o recurso. Não importa
 * Prisma — mantém o core agnóstico. A unicidade `@@unique([recurso, dataHoraInicio])` da
 * tabela do consumidor é o guard de corrida (o create lança P2002 em colisão).
 */
export async function criarSlotAdHoc<T>(args: CriarSlotAdHocArgs<T>): Promise<T> {
  if (args.duracaoMin <= 0) {
    throw new Error("criarSlotAdHoc: duracaoMin deve ser > 0");
  }
  return args.create({
    ...args.recurso,
    dataHoraInicio: args.dataHoraInicio,
    duracaoMin: args.duracaoMin,
    status: "disponivel",
  });
}
