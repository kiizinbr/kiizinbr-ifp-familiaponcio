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
  NotaNaoPertenceAConsultaError,
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

  it("3 diagnósticos (CID-10 estruturado) → createMany com 3 itens e exatamente 1 principal", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue(null);
    dbMock.notaEvolucao.upsert.mockResolvedValue({ id: "n1", status: "rascunho" });
    dbMock.diagnosticoNota.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.diagnosticoNota.createMany.mockResolvedValue({ count: 3 });
    await salvarRascunho({
      ...base,
      diagnosticos: [
        { codigoCid: "J06.9", descricao: "IVAS", principal: true },
        { codigoCid: "E11.9", descricao: "Diabetes mellitus tipo 2", principal: false },
        { codigoCid: null, descricao: "Queixa inespecífica", principal: false },
      ],
    });
    expect(dbMock.diagnosticoNota.deleteMany).toHaveBeenCalledTimes(1);
    const arg = dbMock.diagnosticoNota.createMany.mock.calls[0]?.[0] as {
      data: { notaId: string; codigoCid: string | null; principal: boolean }[];
    };
    expect(arg.data).toHaveLength(3);
    expect(arg.data.filter((d) => d.principal)).toHaveLength(1);
    expect(arg.data.map((d) => d.codigoCid)).toEqual(["J06.9", "E11.9", null]);
  });

  it("diagnosticos [] → limpa (deleteMany) SEM createMany", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue(null);
    dbMock.notaEvolucao.upsert.mockResolvedValue({ id: "n1", status: "rascunho" });
    dbMock.diagnosticoNota.deleteMany.mockResolvedValue({ count: 2 });
    await salvarRascunho({ ...base, diagnosticos: [] });
    expect(dbMock.diagnosticoNota.deleteMany).toHaveBeenCalledTimes(1);
    expect(dbMock.diagnosticoNota.createMany).not.toHaveBeenCalled();
  });

  it("diagnosticos undefined → NÃO toca diagnosticoNota (nem deleteMany nem createMany)", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue(null);
    dbMock.notaEvolucao.upsert.mockResolvedValue({ id: "n1", status: "rascunho" });
    await salvarRascunho(base);
    expect(dbMock.diagnosticoNota.deleteMany).not.toHaveBeenCalled();
    expect(dbMock.diagnosticoNota.createMany).not.toHaveBeenCalled();
  });

  it("nota assinada + diagnosticos → NotaAssinadaError e NÃO toca diagnosticoNota", async () => {
    dbMock.notaEvolucao.findUnique.mockResolvedValue({ id: "n1", status: "assinada" });
    await expect(
      salvarRascunho({
        ...base,
        diagnosticos: [{ codigoCid: "J06.9", descricao: "IVAS", principal: true }],
      }),
    ).rejects.toBeInstanceOf(NotaAssinadaError);
    expect(dbMock.diagnosticoNota.deleteMany).not.toHaveBeenCalled();
    expect(dbMock.diagnosticoNota.createMany).not.toHaveBeenCalled();
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
    await assinarNota("n1", "user-X", "c1");
    expect(dbMock.notaEvolucao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "assinada", assinadaPor: "user-X" }),
      }),
    );
  });

  it("conclui a consulta (realizada) na mesma transação", async () => {
    armRascunho();
    await assinarNota("n1", "user-X", "c1");
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
    await expect(assinarNota("n1", "user-X", "c1")).rejects.toBeInstanceOf(
      TransicaoNotaInvalidaError,
    );
    expect(dbMock.notaEvolucao.update).not.toHaveBeenCalled();
  });

  it("IDOR: notaId de OUTRA consulta → NotaNaoPertenceAConsultaError, sem update", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "rascunho",
    });
    await expect(assinarNota("n1", "user-X", "c2")).rejects.toBeInstanceOf(
      NotaNaoPertenceAConsultaError,
    );
    expect(dbMock.notaEvolucao.update).not.toHaveBeenCalled();
  });

  it("regressão transação sagrada: assinar NÃO chama diagnosticoNota.*", async () => {
    armRascunho();
    await assinarNota("n1", "user-X", "c1");
    expect(dbMock.diagnosticoNota.deleteMany).not.toHaveBeenCalled();
    expect(dbMock.diagnosticoNota.createMany).not.toHaveBeenCalled();
  });
});

describe("adicionarAddendo", () => {
  beforeEach(reset);

  it("nota assinada → cria AddendoNota com texto/autorId", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "assinada",
    });
    dbMock.addendoNota.create.mockResolvedValue({ id: "a1" });
    await adicionarAddendo("n1", "user-X", "corrijo a dose", "c1");
    expect(dbMock.addendoNota.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ texto: "corrijo a dose", autorId: "user-X" }),
      }),
    );
  });

  it("nota rascunho → NotaNaoAssinadaError", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "rascunho",
    });
    await expect(adicionarAddendo("n1", "user-X", "x", "c1")).rejects.toBeInstanceOf(
      NotaNaoAssinadaError,
    );
  });

  it("IDOR: notaId de OUTRA consulta → NotaNaoPertenceAConsultaError, sem create", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "assinada",
    });
    await expect(adicionarAddendo("n1", "user-X", "x", "c2")).rejects.toBeInstanceOf(
      NotaNaoPertenceAConsultaError,
    );
    expect(dbMock.addendoNota.create).not.toHaveBeenCalled();
  });

  it("NUNCA toca a nota original (sem update)", async () => {
    dbMock.notaEvolucao.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      consultaId: "c1",
      status: "assinada",
    });
    dbMock.addendoNota.create.mockResolvedValue({ id: "a1" });
    await adicionarAddendo("n1", "user-X", "x", "c1");
    expect(dbMock.notaEvolucao.update).not.toHaveBeenCalled();
  });
});
