import { beforeEach, describe, expect, it, vi } from "vitest";

// Padrão de mock do repo (encaminhamento-mock / medico-prontuario-mock):
// vi.hoisted + vi.mock("@/lib/db"). Aqui o objetivo é provar a FORMA da query
// (where/include/orderBy) passada ao Prisma — é o que blinda o refator das 3
// telas ("comportamento idêntico"). Conteúdo real fica na integração existente.

const { dbMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    consulta: { findMany: f() },
    slot: { findMany: f() },
  };
  return { dbMock: db };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  buildJanelaDia,
  getConsultasHoje,
  getSlotsHoje,
  INCLUDE_CONSULTA_DIA,
} from "@/lib/medico/agenda-dia";

function reset() {
  dbMock.consulta.findMany.mockReset();
  dbMock.slot.findMany.mockReset();
  dbMock.consulta.findMany.mockResolvedValue([]);
  dbMock.slot.findMany.mockResolvedValue([]);
}

describe("buildJanelaDia", () => {
  it("retorna 00:00:00.000 → 23:59:59.999 do mesmo dia local", () => {
    const agora = new Date(2026, 0, 15, 13, 42, 7, 250); // 15/01/2026 13:42 local
    const { inicioDia, fimDia } = buildJanelaDia(agora);

    expect(inicioDia.getFullYear()).toBe(2026);
    expect(inicioDia.getMonth()).toBe(0);
    expect(inicioDia.getDate()).toBe(15);
    expect(inicioDia.getHours()).toBe(0);
    expect(inicioDia.getMinutes()).toBe(0);
    expect(inicioDia.getSeconds()).toBe(0);
    expect(inicioDia.getMilliseconds()).toBe(0);

    expect(fimDia.getDate()).toBe(15);
    expect(fimDia.getHours()).toBe(23);
    expect(fimDia.getMinutes()).toBe(59);
    expect(fimDia.getSeconds()).toBe(59);
    expect(fimDia.getMilliseconds()).toBe(999);
  });

  it("não vaza pro dia seguinte na virada de mês (31/01)", () => {
    const agora = new Date(2026, 0, 31, 23, 30, 0, 0); // 31/01/2026 23:30 local
    const { inicioDia, fimDia } = buildJanelaDia(agora);
    // ambos no MESMO dia 31 — sem rollover pra 01/02
    expect(inicioDia.getMonth()).toBe(0);
    expect(inicioDia.getDate()).toBe(31);
    expect(fimDia.getMonth()).toBe(0);
    expect(fimDia.getDate()).toBe(31);
    expect(fimDia.getHours()).toBe(23);
  });

  it("não muta o argumento `agora`", () => {
    const agora = new Date(2026, 5, 13, 9, 0, 0, 0);
    const antes = agora.getTime();
    buildJanelaDia(agora);
    expect(agora.getTime()).toBe(antes);
  });
});

describe("getConsultasHoje", () => {
  beforeEach(reset);

  it("sem opts → janela do dia, include default, orderBy slot asc", async () => {
    const agora = new Date(2026, 2, 10, 10, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await getConsultasHoje();

    vi.useRealTimers();

    expect(dbMock.consulta.findMany).toHaveBeenCalledTimes(1);
    const arg = dbMock.consulta.findMany.mock.calls[0]![0];
    expect(arg.where.slot.dataHoraInicio.gte.getHours()).toBe(0);
    expect(arg.where.slot.dataHoraInicio.gte.getMinutes()).toBe(0);
    expect(arg.where.slot.dataHoraInicio.lte.getHours()).toBe(23);
    expect(arg.where.slot.dataHoraInicio.lte.getMinutes()).toBe(59);
    expect(arg.include).toBe(INCLUDE_CONSULTA_DIA);
    expect(arg.orderBy).toEqual({ slot: { dataHoraInicio: "asc" } });
  });

  it("filtro é mesclado ao where E a janela do slot é preservada (invariante minha-fila)", async () => {
    const agora = new Date(2026, 4, 20, 8, 0, 0, 0);
    await getConsultasHoje({
      agora,
      filtro: {
        profissional: { userId: "u1" },
        status: { in: ["agendada", "confirmada", "em_atendimento"] },
      },
    });

    const arg = dbMock.consulta.findMany.mock.calls[0]![0];
    // filtros do nível da consulta preservados
    expect(arg.where.profissional).toEqual({ userId: "u1" });
    expect(arg.where.status).toEqual({ in: ["agendada", "confirmada", "em_atendimento"] });
    // E a janela do slot continua aplicada
    expect(arg.where.slot.dataHoraInicio.gte).toBeInstanceOf(Date);
    expect(arg.where.slot.dataHoraInicio.lte).toBeInstanceOf(Date);
    expect(arg.where.slot.dataHoraInicio.gte.getDate()).toBe(20);
  });

  it("filtro com slot próprio é mesclado preservando a janela (blindagem do merge)", async () => {
    const agora = new Date(2026, 4, 20, 8, 0, 0, 0);
    await getConsultasHoje({
      agora,
      filtro: { slot: { profissionalId: "p9" } },
    });

    const arg = dbMock.consulta.findMany.mock.calls[0]![0];
    expect(arg.where.slot.profissionalId).toBe("p9");
    expect(arg.where.slot.dataHoraInicio.gte).toBeInstanceOf(Date);
    expect(arg.where.slot.dataHoraInicio.lte).toBeInstanceOf(Date);
  });

  it("include parcial é repassado literalmente", async () => {
    const agora = new Date(2026, 4, 20, 8, 0, 0, 0);
    const includeParcial = {
      slot: { select: { dataHoraInicio: true } },
      cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
      especialidade: { select: { nome: true } },
      profissional: { select: { nomeExibicao: true } },
    } as const;

    await getConsultasHoje({ agora, include: includeParcial });

    const arg = dbMock.consulta.findMany.mock.calls[0]![0];
    expect(arg.include).toEqual(includeParcial);
  });

  it("janela deriva de `agora`, não de new Date()", async () => {
    const agora = new Date(2026, 0, 31, 12, 0, 0, 0);
    await getConsultasHoje({ agora });

    const arg = dbMock.consulta.findMany.mock.calls[0]![0];
    expect(arg.where.slot.dataHoraInicio.gte.getMonth()).toBe(0);
    expect(arg.where.slot.dataHoraInicio.gte.getDate()).toBe(31);
    expect(arg.where.slot.dataHoraInicio.lte.getDate()).toBe(31);
  });
});

describe("getSlotsHoje", () => {
  beforeEach(reset);

  it("janela do dia, include profissional+especialidade, orderBy dataHoraInicio asc", async () => {
    const agora = new Date(2026, 2, 10, 10, 0, 0, 0);
    await getSlotsHoje({ agora });

    expect(dbMock.slot.findMany).toHaveBeenCalledTimes(1);
    const arg = dbMock.slot.findMany.mock.calls[0]![0];
    expect(arg.where.dataHoraInicio.gte.getHours()).toBe(0);
    expect(arg.where.dataHoraInicio.lte.getHours()).toBe(23);
    expect(arg.include).toEqual({ profissional: true, especialidade: true });
    expect(arg.orderBy).toEqual({ dataHoraInicio: "asc" });
  });
});
