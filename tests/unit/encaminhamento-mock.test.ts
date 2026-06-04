import { beforeEach, describe, expect, it, vi } from "vitest";

// Núcleo TRANSACIONAL via mock (padrão capacitacao-matricula-mock):
// vi.hoisted + vi.mock("@/lib/db"); $transaction(cb) roda o callback com o
// próprio db mock como tx. Atomicidade real (race) fica na integração DB-real.

const { dbMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    encaminhamento: {
      findUniqueOrThrow: f(),
      create: f(),
      update: f(),
    },
    consulta: { findUniqueOrThrow: f(), create: f() },
    slot: { updateMany: f() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(db)
      : Promise.all(arg as unknown[]),
  );
  return { dbMock: db };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  agendarEncaminhamento,
  aplicarTransicaoEncaminhamento,
  cancelarEncaminhamento,
  ConsultaOrigemInvalidaError,
  criarEncaminhamento,
  EncaminhamentoNaoPendenteError,
  TransicaoEncaminhamentoInvalidaError,
} from "@/lib/medico/encaminhamento";
import { reservarSlot } from "@/lib/medico/agenda";

function reset() {
  for (const m of [dbMock.encaminhamento, dbMock.consulta, dbMock.slot]) {
    for (const fn of Object.values(m)) fn.mockReset();
  }
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
}

const base = {
  cidadaoId: "c1",
  consultaOrigemId: "co1",
  especialidadeId: "e1",
  createdBy: "u1",
};

describe("criarEncaminhamento", () => {
  beforeEach(reset);

  it("consulta de origem do cidadão → cria aguardando_agendamento", async () => {
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ id: "co1", cidadaoId: "c1" });
    dbMock.encaminhamento.create.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    await criarEncaminhamento(base);
    expect(dbMock.encaminhamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "aguardando_agendamento", cidadaoId: "c1" }),
      }),
    );
  });

  it("consulta de origem de OUTRO cidadão → ConsultaOrigemInvalidaError, sem create", async () => {
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ id: "co1", cidadaoId: "OUTRO" });
    await expect(criarEncaminhamento(base)).rejects.toBeInstanceOf(ConsultaOrigemInvalidaError);
    expect(dbMock.encaminhamento.create).not.toHaveBeenCalled();
  });
});

describe("aplicarTransicaoEncaminhamento", () => {
  beforeEach(reset);

  it("transição válida → update com o novo status", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "agendado");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });

  it("transição inválida (já agendado) → TransicaoEncaminhamentoInvalidaError, sem update", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({ id: "enc1", status: "agendado" });
    await expect(
      aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "cancelado"),
    ).rejects.toBeInstanceOf(TransicaoEncaminhamentoInvalidaError);
    expect(dbMock.encaminhamento.update).not.toHaveBeenCalled();
  });

  it("cancelar passa canceladoMotivo no update", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await aplicarTransicaoEncaminhamento(dbMock as never, "enc1", "cancelado", "duplicado");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ canceladoMotivo: "duplicado" }) }),
    );
  });
});

describe("agendarEncaminhamento (tx-aware)", () => {
  beforeEach(reset);

  it("pendente → flipa para agendado", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await agendarEncaminhamento(dbMock as never, "enc1");
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });

  it("não-pendente (já cancelado) → EncaminhamentoNaoPendenteError", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await expect(agendarEncaminhamento(dbMock as never, "enc1")).rejects.toBeInstanceOf(
      EncaminhamentoNaoPendenteError,
    );
  });
});

describe("cancelarEncaminhamento", () => {
  beforeEach(reset);
  it("abre $transaction 1x e flipa para cancelado", async () => {
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "cancelado" });
    await cancelarEncaminhamento("enc1", "paciente desistiu");
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelado" }) }),
    );
  });
});

describe("reservarSlot com origemEncaminhamentoId", () => {
  beforeEach(reset);
  it("cria consulta com o FK e flipa o encaminhamento para agendado", async () => {
    dbMock.slot.updateMany.mockResolvedValue({ count: 1 });
    dbMock.consulta.create.mockResolvedValue({ id: "cons1" });
    dbMock.encaminhamento.findUniqueOrThrow.mockResolvedValue({
      id: "enc1",
      status: "aguardando_agendamento",
    });
    dbMock.encaminhamento.update.mockResolvedValue({ id: "enc1", status: "agendado" });
    await reservarSlot({
      slotId: "s1",
      cidadaoId: "c1",
      profissionalId: "p1",
      especialidadeId: "e1",
      createdBy: "u1",
      origemEncaminhamentoId: "enc1",
    });
    expect(dbMock.consulta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origemEncaminhamentoId: "enc1" }),
      }),
    );
    expect(dbMock.encaminhamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "agendado" }) }),
    );
  });
});
