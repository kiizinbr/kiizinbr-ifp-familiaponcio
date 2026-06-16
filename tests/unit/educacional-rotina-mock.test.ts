import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Serviço de check-in/out (camada DB) via mock de @/lib/db + @/lib/audit.
 * Padrão do prontuário/matrícula: vi.hoisted + vi.mock. $transaction(cb) roda o
 * callback com o próprio db mock como tx. Atomicidade real fica no teste DB-real.
 *
 * Foco do Slice 2: provar que a tentativa BLOQUEADA gera logEvent
 * (entityType "CheckInOut.tentativaBloqueada") E lança erro, ANTES de qualquer create.
 */

const { dbMock, logEventMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    responsavelAutorizado: { findFirst: f() },
    checkInOut: { findFirst: f(), create: f() },
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

import { checkin, checkout, CheckBloqueadoError } from "@/lib/educacional/rotina";

function reset() {
  dbMock.responsavelAutorizado.findFirst.mockReset();
  dbMock.checkInOut.findFirst.mockReset();
  dbMock.checkInOut.create.mockReset();
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
  logEventMock.mockReset();
  logEventMock.mockResolvedValue(undefined);
}

const base = {
  criancaId: "crianca-1",
  autorizadoId: "aut-1",
  profissionalId: "prof-1",
  userId: "user-1",
};

const autorizadoValido = {
  id: "aut-1",
  criancaId: "crianca-1",
  nome: "Sandra Oliveira",
  parentesco: "mãe",
  restricaoJudicial: false,
  vigenteAte: null,
  revogadoEm: null,
};

describe("checkout — tentativa BLOQUEADA (coração de segurança)", () => {
  beforeEach(reset);

  it("autorizado REVOGADO → lança CheckBloqueadoError e NÃO cria check", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue({
      ...autorizadoValido,
      revogadoEm: new Date("2026-05-01T12:00:00Z"),
    });

    await expect(checkout(base)).rejects.toBeInstanceOf(CheckBloqueadoError);
    expect(dbMock.checkInOut.create).not.toHaveBeenCalled();
  });

  it("autorizado REVOGADO → registra logEvent da tentativa bloqueada", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue({
      ...autorizadoValido,
      revogadoEm: new Date("2026-05-01T12:00:00Z"),
    });

    await expect(checkout(base)).rejects.toBeInstanceOf(CheckBloqueadoError);

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "CheckInOut.tentativaBloqueada",
        meta: expect.objectContaining({
          criancaId: "crianca-1",
          sentido: "SAIDA",
          motivo: expect.stringMatching(/revogad/i),
        }),
      }),
    );
  });

  it("autorizado INEXISTENTE (não está na lista) → bloqueado + auditado", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue(null);

    await expect(checkout(base)).rejects.toBeInstanceOf(CheckBloqueadoError);
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "CheckInOut.tentativaBloqueada",
        meta: expect.objectContaining({ motivo: expect.stringMatching(/não está na lista/i) }),
      }),
    );
    expect(dbMock.checkInOut.create).not.toHaveBeenCalled();
  });

  it("restrição judicial → bloqueado + auditado", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue({
      ...autorizadoValido,
      restricaoJudicial: true,
    });
    await expect(checkout(base)).rejects.toBeInstanceOf(CheckBloqueadoError);
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ motivo: expect.stringMatching(/restrição judicial/i) }),
      }),
    );
  });
});

describe("checkout — estado-do-dia", () => {
  beforeEach(reset);

  it("sem check-in aberto (último check do dia = null) → ConflictError, sem create", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue(autorizadoValido);
    dbMock.checkInOut.findFirst.mockResolvedValue(null); // nenhum check hoje

    await expect(checkout(base)).rejects.toThrow(/check-in/i);
    expect(dbMock.checkInOut.create).not.toHaveBeenCalled();
  });

  it("com check-in aberto (último = ENTRADA) → cria SAIDA + logEvent de sucesso", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue(autorizadoValido);
    dbMock.checkInOut.findFirst.mockResolvedValue({ id: "c1", sentido: "ENTRADA" });
    dbMock.checkInOut.create.mockResolvedValue({ id: "c2", sentido: "SAIDA" });

    const check = await checkout(base);
    expect(check.sentido).toBe("SAIDA");
    expect(dbMock.checkInOut.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sentido: "SAIDA" }) }),
    );
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "CheckInOut" }),
    );
  });
});

describe("checkin — estado-do-dia", () => {
  beforeEach(reset);

  it("duplo check-in (último = ENTRADA) → ConflictError 'já presente', sem create", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue(autorizadoValido);
    dbMock.checkInOut.findFirst.mockResolvedValue({ id: "c1", sentido: "ENTRADA" });

    await expect(checkin(base)).rejects.toThrow(/presente/i);
    expect(dbMock.checkInOut.create).not.toHaveBeenCalled();
  });

  it("primeiro check-in do dia (sem check anterior) → cria ENTRADA", async () => {
    dbMock.responsavelAutorizado.findFirst.mockResolvedValue(autorizadoValido);
    dbMock.checkInOut.findFirst.mockResolvedValue(null);
    dbMock.checkInOut.create.mockResolvedValue({ id: "c1", sentido: "ENTRADA" });

    const check = await checkin(base);
    expect(check.sentido).toBe("ENTRADA");
    expect(dbMock.checkInOut.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sentido: "ENTRADA" }) }),
    );
  });
});
