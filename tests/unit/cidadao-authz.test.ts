import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { RoleAssignment } from "@/lib/rbac-types";

// Mock do Prisma (padrão -mock do projeto): cidadao.findUnique controlável.
const { dbMock } = vi.hoisted(() => {
  return { dbMock: { cidadao: { findUnique: vi.fn() } } };
});
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  assertAcessoCidadao,
  CidadaoNaoEncontradoError,
  SemAcessoCidadaoError,
} from "@/lib/cidadao-authz";

function sess(roles: RoleAssignment[]): Session {
  return {
    user: { id: "u1", roles, primaryRole: roles[0] ?? null, mustChangePassword: false },
    expires: "2099-01-01",
  } as unknown as Session;
}

const recepcaoMedico = sess([{ name: "recepcao", unitScope: "medico" }]);
const superAdmin = sess([{ name: "super_admin", unitScope: null }]);

beforeEach(() => dbMock.cidadao.findUnique.mockReset());

describe("assertAcessoCidadao", () => {
  it("IDOR: recepção do médico em cidadão de OUTRA unidade → SemAcessoCidadaoError", async () => {
    dbMock.cidadao.findUnique.mockResolvedValue({ id: "cap1", unitIdOrigem: "capacitacao" });
    await expect(assertAcessoCidadao(recepcaoMedico, "cap1", "edit")).rejects.toBeInstanceOf(
      SemAcessoCidadaoError,
    );
  });

  it("recepção do médico em cidadão da PRÓPRIA unidade → retorna o cidadão", async () => {
    dbMock.cidadao.findUnique.mockResolvedValue({ id: "med1", unitIdOrigem: "medico" });
    const c = await assertAcessoCidadao(recepcaoMedico, "med1", "edit");
    expect(c.unitIdOrigem).toBe("medico");
  });

  it("super_admin acessa qualquer unidade", async () => {
    dbMock.cidadao.findUnique.mockResolvedValue({ id: "cap1", unitIdOrigem: "capacitacao" });
    await expect(assertAcessoCidadao(superAdmin, "cap1", "delete")).resolves.toMatchObject({
      unitIdOrigem: "capacitacao",
    });
  });

  it("cidadão inexistente → CidadaoNaoEncontradoError (sem vazar)", async () => {
    dbMock.cidadao.findUnique.mockResolvedValue(null);
    await expect(assertAcessoCidadao(recepcaoMedico, "nope", "edit")).rejects.toBeInstanceOf(
      CidadaoNaoEncontradoError,
    );
  });

  it("delete cross-tenant por gestor de outra unidade → SemAcessoCidadaoError (caso removeAnexo)", async () => {
    const gestorMedico = sess([{ name: "gestor_unidade", unitScope: "medico" }]);
    dbMock.cidadao.findUnique.mockResolvedValue({ id: "cap1", unitIdOrigem: "capacitacao" });
    await expect(assertAcessoCidadao(gestorMedico, "cap1", "delete")).rejects.toBeInstanceOf(
      SemAcessoCidadaoError,
    );
  });
});
