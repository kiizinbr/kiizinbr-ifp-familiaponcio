import { beforeEach, describe, expect, it, vi } from "vitest";

// T3 (núcleo TRANSACIONAL via mock) — padrão do prontuário: vi.hoisted + vi.mock("@/lib/db");
// $transaction(cb) executa o callback com o PRÓPRIO db mock como tx. Atomicidade real (race)
// fica na integração DB-real (T16, fora do loop).

const { dbMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    matricula: {
      findUnique: f(),
      findUniqueOrThrow: f(),
      findFirst: f(),
      count: f(),
      create: f(),
      update: f(),
    },
    turma: { findUniqueOrThrow: f() },
    $queryRaw: f(), // no-op no mock; o lock real (FOR UPDATE) é coberto pelo teste DB-real
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
  aplicarTransicaoMatricula,
  ListaEsperaVaziaError,
  matricular,
  MatriculaDuplicadaError,
  promoverDaListaEspera,
  transicionarMatricula,
  TransicaoMatriculaInvalidaError,
  TurmaLotadaError,
} from "@/lib/capacitacao/matricula";

function reset() {
  for (const m of [dbMock.matricula, dbMock.turma]) {
    for (const fn of Object.values(m)) fn.mockReset();
  }
  dbMock.$transaction.mockReset();
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(dbMock)
      : Promise.all(arg as unknown[]),
  );
}

const base = { turmaId: "t1", cidadaoId: "c1", createdBy: "u1" };

describe("matricular (anti-overcapacity)", () => {
  beforeEach(reset);

  it("turma com vaga → cria status inscrito", async () => {
    dbMock.matricula.findUnique.mockResolvedValue(null);
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(0);
    dbMock.matricula.create.mockResolvedValue({ id: "m1", status: "inscrito" });
    await matricular(base);
    expect(dbMock.matricula.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "inscrito" }) }),
    );
  });

  it("turma cheia → cria status lista_espera", async () => {
    dbMock.matricula.findUnique.mockResolvedValue(null);
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(20);
    dbMock.matricula.create.mockResolvedValue({ id: "m1", status: "lista_espera" });
    await matricular(base);
    expect(dbMock.matricula.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "lista_espera" }) }),
    );
  });

  it("matrícula existente não-cancelada → MatriculaDuplicadaError, sem create", async () => {
    dbMock.matricula.findUnique.mockResolvedValue({ id: "m1", status: "inscrito" });
    await expect(matricular(base)).rejects.toBeInstanceOf(MatriculaDuplicadaError);
    expect(dbMock.matricula.create).not.toHaveBeenCalled();
  });

  it("conta só os status que ocupam vaga (inscrito/confirmado/cursando)", async () => {
    dbMock.matricula.findUnique.mockResolvedValue(null);
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(0);
    dbMock.matricula.create.mockResolvedValue({ id: "m1", status: "inscrito" });
    await matricular(base);
    const arg = dbMock.matricula.count.mock.calls[0]?.[0] as
      | { where?: { status?: { in?: string[] } } }
      | undefined;
    expect(arg?.where?.status?.in).toEqual(
      expect.arrayContaining(["inscrito", "confirmado", "cursando"]),
    );
  });
});

describe("aplicarTransicaoMatricula", () => {
  beforeEach(reset);

  it("transição válida → update com o novo status", async () => {
    dbMock.matricula.findUniqueOrThrow.mockResolvedValue({ id: "m1", status: "inscrito" });
    dbMock.matricula.update.mockResolvedValue({ id: "m1", status: "confirmado" });
    await aplicarTransicaoMatricula(dbMock as never, "m1", "confirmado");
    expect(dbMock.matricula.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "confirmado" }) }),
    );
  });

  it("transição inválida → TransicaoMatriculaInvalidaError, sem update", async () => {
    dbMock.matricula.findUniqueOrThrow.mockResolvedValue({ id: "m1", status: "concluido" });
    await expect(
      aplicarTransicaoMatricula(dbMock as never, "m1", "cursando"),
    ).rejects.toBeInstanceOf(TransicaoMatriculaInvalidaError);
    expect(dbMock.matricula.update).not.toHaveBeenCalled();
  });

  it("saída com motivo (desistente) → update recebe motivoSaida", async () => {
    dbMock.matricula.findUniqueOrThrow.mockResolvedValue({ id: "m1", status: "cursando" });
    dbMock.matricula.update.mockResolvedValue({ id: "m1", status: "desistente" });
    await aplicarTransicaoMatricula(dbMock as never, "m1", "desistente", "mudou de cidade");
    expect(dbMock.matricula.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ motivoSaida: "mudou de cidade" }),
      }),
    );
  });
});

describe("transicionarMatricula", () => {
  beforeEach(reset);
  it("abre $transaction 1x e delega", async () => {
    dbMock.matricula.findUniqueOrThrow.mockResolvedValue({ id: "m1", status: "inscrito" });
    dbMock.matricula.update.mockResolvedValue({ id: "m1", status: "confirmado" });
    await transicionarMatricula("m1", "confirmado");
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("promoverDaListaEspera", () => {
  beforeEach(reset);

  it("sem ninguém na lista → ListaEsperaVaziaError", async () => {
    dbMock.matricula.findFirst.mockResolvedValue(null);
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(0);
    await expect(promoverDaListaEspera("t1")).rejects.toBeInstanceOf(ListaEsperaVaziaError);
  });

  it("com vaga livre → promove a 1ª da fila para inscrito", async () => {
    dbMock.matricula.findFirst.mockResolvedValue({ id: "m9", status: "lista_espera" });
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(0);
    dbMock.matricula.findUniqueOrThrow.mockResolvedValue({ id: "m9", status: "lista_espera" });
    dbMock.matricula.update.mockResolvedValue({ id: "m9", status: "inscrito" });
    await promoverDaListaEspera("t1");
    expect(dbMock.matricula.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "inscrito" }) }),
    );
  });

  it("sem vaga (turma lotada) → TurmaLotadaError", async () => {
    dbMock.matricula.findFirst.mockResolvedValue({ id: "m9", status: "lista_espera" });
    dbMock.turma.findUniqueOrThrow.mockResolvedValue({ id: "t1", capacidade: 20 });
    dbMock.matricula.count.mockResolvedValue(20);
    await expect(promoverDaListaEspera("t1")).rejects.toBeInstanceOf(TurmaLotadaError);
  });
});
