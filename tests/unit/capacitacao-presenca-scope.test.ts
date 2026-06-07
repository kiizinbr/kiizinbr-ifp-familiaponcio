import { beforeEach, describe, expect, it, vi } from "vitest";

// Padrão -mock do projeto: controla db.matricula.findMany.
const { dbMock } = vi.hoisted(() => ({ dbMock: { matricula: { findMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { matriculasDaTurma } from "@/lib/capacitacao/presenca-scope";

beforeEach(() => dbMock.matricula.findMany.mockReset());

describe("matriculasDaTurma (fecha IDOR cross-turma no registro de presença)", () => {
  it("descarta matriculaIds que NÃO pertencem à turma", async () => {
    // O banco só retorna as matrículas que de fato estão na turma 'tA'.
    dbMock.matricula.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    const ok = await matriculasDaTurma("tA", ["m1", "m2", "mDeOutraTurma"]);
    expect(ok).toEqual(["m1", "m2"]);
    // A consulta TEM que filtrar por turmaId — senão aceitaria qualquer id forjado.
    expect(dbMock.matricula.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ turmaId: "tA" }) }),
    );
  });

  it("roster vazio → [] sem tocar o banco", async () => {
    const r = await matriculasDaTurma("tA", []);
    expect(r).toEqual([]);
    expect(dbMock.matricula.findMany).not.toHaveBeenCalled();
  });
});
