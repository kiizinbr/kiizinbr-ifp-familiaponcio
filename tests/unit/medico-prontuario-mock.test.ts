import { beforeEach, describe, expect, it, vi } from "vitest";

// T5 (lógica de orquestração) via mock de @/lib/db. $transaction(cb) executa o
// callback com o PRÓPRIO db mock como `tx`, então as asserções valem tanto para
// `tx.x` quanto `db.x` (e para aplicarTransicaoConsulta, que recebe o tx).
// Atomicidade real + derivação de slot são cobertas por e2e/integração (DB real).

const { dbMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    notaEvolucao: { findUnique: f(), findUniqueOrThrow: f(), upsert: f(), update: f() },
    consulta: { findUniqueOrThrow: f(), update: f() },
    slot: { update: f() },
    addendoNota: { create: f() },
    diagnosticoNota: { deleteMany: f(), createMany: f() },
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
  adicionarAddendo,
  assinarNota,
  NotaAssinadaError,
  NotaNaoAssinadaError,
  salvarRascunho,
  TransicaoNotaInvalidaError,
} from "@/lib/medico/prontuario";

function reset() {
  for (const model of [
    dbMock.notaEvolucao,
    dbMock.consulta,
    dbMock.slot,
    dbMock.addendoNota,
    dbMock.diagnosticoNota,
  ]) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
}

const base = { consultaId: "c1", cidadaoId: "cid1", profissionalId: "prof1", texto: "evolução" };

describe("salvarRascunho", () => {
  beforeEach(reset);

  it("nota inexistente → chama upsert 1x", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue(null);
    dbMock.notaEvolucao.upsert.mockResolvedValue({ id: "n1", status: "rascunho" });
    await salvarRascunho(base);
    expect(dbMock.notaEvolucao.upsert).toHaveBeenCalledTimes(1);
  });

  it("nota já assinada → NotaAssinadaError e NÃO faz upsert", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue({ id: "n1", status: "assinada" });
    await expect(salvarRascunho(base)).rejects.toBeInstanceOf(NotaAssinadaError);
    expect(dbMock.notaEvolucao.upsert).not.toHaveBeenCalled();
  });

  it("com diagnósticos → deleteMany ANTES de createMany", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue(null);
    dbMock.notaEvolucao.upsert.mockResolvedValue({ id: "n1", status: "rascunho" });
    dbMock.diagnosticoNota.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.diagnosticoNota.createMany.mockResolvedValue({ count: 1 });
    await salvarRascunho({
      ...base,
      diagnosticos: [{ codigoCid: "J06.9", descricao: "IVAS", principal: true }],
    });
    expect(dbMock.diagnosticoNota.deleteMany).toHaveBeenCalled();
    expect(dbMock.diagnosticoNota.createMany).toHaveBeenCalled();
    const del = dbMock.diagnosticoNota.deleteMany.mock.invocationCallOrder[0] ?? 0;
    const cre = dbMock.diagnosticoNota.createMany.mock.invocationCallOrder[0] ?? 0;
    expect(del).toBeLessThan(cre);
  });
});

describe("assinarNota", () => {
  beforeEach(reset);

  function armRascunho() {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "rascunho",
    });
    dbMock.notaEvolucao.update.mockResolvedValue({ id: "n1", status: "assinada" });
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      slotId: "s1",
      status: "em_atendimento",
    });
    dbMock.consulta.update.mockResolvedValue({ id: "c1", status: "realizada" });
    dbMock.slot.update.mockResolvedValue({ id: "s1", status: "realizado" });
  }

  it("rascunho → update com status assinada + assinadaPor=userId", async () => {
    armRascunho();
    await assinarNota("n1", "user-X");
    expect(dbMock.notaEvolucao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "assinada", assinadaPor: "user-X" }),
      }),
    );
  });

  it("conclui a consulta (realizada) na mesma transação", async () => {
    armRascunho();
    await assinarNota("n1", "user-X");
    expect(dbMock.consulta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "realizada" }) }),
    );
  });

  it("nota já assinada → TransicaoNotaInvalidaError, sem update", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "assinada",
    });
    await expect(assinarNota("n1", "user-X")).rejects.toBeInstanceOf(TransicaoNotaInvalidaError);
    expect(dbMock.notaEvolucao.update).not.toHaveBeenCalled();
  });
});

describe("adicionarAddendo", () => {
  beforeEach(reset);

  it("nota assinada → cria AddendoNota com texto/autorId", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({ id: "n1", status: "assinada" });
    dbMock.addendoNota.create.mockResolvedValue({ id: "a1" });
    await adicionarAddendo("n1", "user-X", "corrijo a dose");
    expect(dbMock.addendoNota.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ texto: "corrijo a dose", autorId: "user-X" }),
      }),
    );
  });

  it("nota rascunho → NotaNaoAssinadaError", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({ id: "n1", status: "rascunho" });
    await expect(adicionarAddendo("n1", "user-X", "x")).rejects.toBeInstanceOf(
      NotaNaoAssinadaError,
    );
  });

  it("NUNCA toca a nota original (sem update)", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({ id: "n1", status: "assinada" });
    dbMock.addendoNota.create.mockResolvedValue({ id: "a1" });
    await adicionarAddendo("n1", "user-X", "x");
    expect(dbMock.notaEvolucao.update).not.toHaveBeenCalled();
  });
});
