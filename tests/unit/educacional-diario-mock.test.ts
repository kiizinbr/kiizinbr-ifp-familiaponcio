import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Serviço de diário/rotina (camada DB) via mock de @/lib/db + @/lib/audit.
 * Mesmo padrão do educacional-rotina-mock: vi.hoisted + vi.mock; $transaction(cb)
 * roda o callback com o db mock como tx. A serialização real (FOR UPDATE,
 * updateMany condicional) é provada no teste DB-real.
 *
 * Slice 3 — o SELO:
 *  - registrar em diário FECHADO → DiarioFechadoError (409), sem create;
 *  - fechar sem registro → DiarioSemRegistroError;
 *  - fechar com ≥1 registro → ok + logEvent;
 *  - fechar de novo (updateMany count 0) → DiarioJaFechadoError (idempotência).
 */

const { dbMock, logEventMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    diarioDia: {
      upsert: f(),
      findUnique: f(),
      findUniqueOrThrow: f(),
      updateMany: f(),
    },
    registroRotina: { create: f() },
    $queryRaw: f(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(db)
      : Promise.all(arg as unknown[]),
  );
  return { dbMock: db, logEventMock: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));

import {
  registrarRotina,
  fecharDiario,
  DiarioFechadoError,
  DiarioSemRegistroError,
  DiarioJaFechadoError,
  DiarioNaoEncontradoError,
} from "@/lib/educacional/rotina";

function reset() {
  dbMock.diarioDia.upsert.mockReset();
  dbMock.diarioDia.findUnique.mockReset();
  dbMock.diarioDia.findUniqueOrThrow.mockReset();
  dbMock.diarioDia.updateMany.mockReset();
  dbMock.registroRotina.create.mockReset();
  dbMock.$queryRaw.mockReset();
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
  logEventMock.mockReset();
  logEventMock.mockResolvedValue(undefined);
}

const baseRotina = {
  criancaId: "crianca-1",
  profissionalId: "prof-1",
  userId: "user-1",
  tipo: "ALIMENTACAO" as const,
  descricao: "Almoço completo.",
};

describe("registrarRotina — selo (imutabilidade do diário FECHADO)", () => {
  beforeEach(reset);

  it("diário FECHADO → DiarioFechadoError (409) e NÃO cria registro", async () => {
    dbMock.diarioDia.upsert.mockResolvedValue({ id: "d1", status: "ABERTO" });
    // FOR UPDATE relê o status: encontra FECHADO (outro selou).
    dbMock.$queryRaw.mockResolvedValue([{ status: "FECHADO" }]);

    await expect(registrarRotina(baseRotina)).rejects.toBeInstanceOf(DiarioFechadoError);
    expect(dbMock.registroRotina.create).not.toHaveBeenCalled();
  });

  it("diário ABERTO → cria o registro + logEvent", async () => {
    dbMock.diarioDia.upsert.mockResolvedValue({ id: "d1", status: "ABERTO" });
    dbMock.$queryRaw.mockResolvedValue([{ status: "ABERTO" }]);
    dbMock.registroRotina.create.mockResolvedValue({ id: "r1", tipo: "ALIMENTACAO" });

    const reg = await registrarRotina(baseRotina);
    expect(reg.id).toBe("r1");
    expect(dbMock.registroRotina.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diarioId: "d1",
          tipo: "ALIMENTACAO",
          profissionalId: "prof-1",
        }),
      }),
    );
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "RegistroRotina" }),
    );
  });

  it("diário não encontrado no lock (FOR UPDATE vazio) → DiarioNaoEncontradoError", async () => {
    dbMock.diarioDia.upsert.mockResolvedValue({ id: "d1", status: "ABERTO" });
    dbMock.$queryRaw.mockResolvedValue([]);

    await expect(registrarRotina(baseRotina)).rejects.toBeInstanceOf(DiarioNaoEncontradoError);
    expect(dbMock.registroRotina.create).not.toHaveBeenCalled();
  });
});

const baseFechar = {
  diarioId: "d1",
  profissionalId: "prof-1",
  userId: "user-1",
};

describe("fecharDiario — exige ≥1 registro + idempotência", () => {
  beforeEach(reset);

  it("diário inexistente → DiarioNaoEncontradoError", async () => {
    dbMock.diarioDia.findUnique.mockResolvedValue(null);
    await expect(fecharDiario(baseFechar)).rejects.toBeInstanceOf(DiarioNaoEncontradoError);
    expect(dbMock.diarioDia.updateMany).not.toHaveBeenCalled();
  });

  it("diário ABERTO sem registro → DiarioSemRegistroError, sem updateMany", async () => {
    dbMock.diarioDia.findUnique.mockResolvedValue({
      id: "d1",
      status: "ABERTO",
      criancaId: "crianca-1",
      _count: { registros: 0 },
    });
    await expect(fecharDiario(baseFechar)).rejects.toBeInstanceOf(DiarioSemRegistroError);
    expect(dbMock.diarioDia.updateMany).not.toHaveBeenCalled();
  });

  it("diário já FECHADO → DiarioJaFechadoError, sem updateMany", async () => {
    dbMock.diarioDia.findUnique.mockResolvedValue({
      id: "d1",
      status: "FECHADO",
      criancaId: "crianca-1",
      _count: { registros: 3 },
    });
    await expect(fecharDiario(baseFechar)).rejects.toBeInstanceOf(DiarioJaFechadoError);
    expect(dbMock.diarioDia.updateMany).not.toHaveBeenCalled();
  });

  it("ABERTO com ≥1 registro → fecha (updateMany count 1) + logEvent", async () => {
    dbMock.diarioDia.findUnique.mockResolvedValue({
      id: "d1",
      status: "ABERTO",
      criancaId: "crianca-1",
      _count: { registros: 2 },
    });
    dbMock.diarioDia.updateMany.mockResolvedValue({ count: 1 });
    dbMock.diarioDia.findUniqueOrThrow.mockResolvedValue({ id: "d1", status: "FECHADO" });

    const fechado = await fecharDiario(baseFechar);
    expect(fechado.status).toBe("FECHADO");
    expect(dbMock.diarioDia.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "d1", status: "ABERTO" }),
        data: expect.objectContaining({ status: "FECHADO" }),
      }),
    );
    expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "DiarioDia" }));
  });

  it("corrida: passou na pré-checagem mas updateMany count 0 → DiarioJaFechadoError", async () => {
    dbMock.diarioDia.findUnique.mockResolvedValue({
      id: "d1",
      status: "ABERTO",
      criancaId: "crianca-1",
      _count: { registros: 2 },
    });
    dbMock.diarioDia.updateMany.mockResolvedValue({ count: 0 }); // outro selou no meio

    await expect(fecharDiario(baseFechar)).rejects.toBeInstanceOf(DiarioJaFechadoError);
    expect(dbMock.diarioDia.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
