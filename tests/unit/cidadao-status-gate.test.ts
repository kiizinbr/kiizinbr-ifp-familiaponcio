import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * M2 — gate de compliance no eixo deletado/anonimizado.
 *
 * `listCidadaos` deve forçar status "ativo" para quem NÃO é super_admin/gestor,
 * mesmo que o filtro peça "deletado"/"anonimizado" (defesa real no servidor —
 * o query param vem do cliente). super_admin/gestor mantêm o acesso de
 * compliance. Eixo ortogonal ao escopo de unidade (getUserUnits).
 *
 * Padrão -mock do projeto: vi.hoisted + vi.mock("@/lib/db") com
 * cidadao.findMany controlável; asseramos o `where` repassado ao Prisma.
 */

const { dbMock } = vi.hoisted(() => {
  return { dbMock: { cidadao: { findMany: vi.fn() } } };
});
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  listCidadaos,
  resolveStatusCidadao,
  podeVerCidadaosDeletados,
  buildCarregarMaisHref,
} from "@/lib/cidadao";

function sess(roles: RoleAssignment[]): Session {
  return {
    user: { id: "u1", roles, primaryRole: roles[0] ?? null, mustChangePassword: false },
    expires: "2099-01-01",
  } as unknown as Session;
}

const recepcaoMedico = sess([{ name: "recepcao", unitScope: "medico" }]);
const profissionalMedico = sess([{ name: "profissional", unitScope: "medico" }]);
const socialGlobal = sess([{ name: "social", unitScope: null }]);
const gestorMedico = sess([{ name: "gestor_unidade", unitScope: "medico" }]);
const superAdmin = sess([{ name: "super_admin", unitScope: null }]);

const ATIVO = { deletedAt: null, anonimizadoEm: null };
const DELETADO = { deletedAt: { not: null } };
const ANONIMIZADO = { anonimizadoEm: { not: null } };

beforeEach(() => {
  dbMock.cidadao.findMany.mockReset();
  dbMock.cidadao.findMany.mockResolvedValue([]);
});

/** Lê o objeto `where` repassado ao findMany na última chamada. */
function whereDaUltimaChamada(): Record<string, unknown> {
  return dbMock.cidadao.findMany.mock.calls.at(-1)?.[0]?.where ?? {};
}

describe("listCidadaos — gate de status (M2)", () => {
  it("recepção pedindo 'deletado' → servidor força ATIVO (não vaza excluídos)", async () => {
    await listCidadaos({ status: "deletado" }, recepcaoMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });

  it("recepção pedindo 'anonimizado' → servidor força ATIVO", async () => {
    await listCidadaos({ status: "anonimizado" }, recepcaoMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });

  it("profissional pedindo 'deletado' → servidor força ATIVO", async () => {
    await listCidadaos({ status: "deletado" }, profissionalMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });

  it("social (global p/ unidade) pedindo 'deletado' → ATIVO (gate é ortogonal ao escopo)", async () => {
    await listCidadaos({ status: "deletado" }, socialGlobal);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });

  it("gestor pedindo 'deletado' → mantém DELETADO (compliance LGPD legítimo)", async () => {
    await listCidadaos({ status: "deletado" }, gestorMedico);
    expect(whereDaUltimaChamada()).toMatchObject(DELETADO);
  });

  it("gestor pedindo 'anonimizado' → mantém ANONIMIZADO", async () => {
    await listCidadaos({ status: "anonimizado" }, gestorMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ANONIMIZADO);
  });

  it("super_admin pedindo 'deletado' → mantém DELETADO", async () => {
    await listCidadaos({ status: "deletado" }, superAdmin);
    expect(whereDaUltimaChamada()).toMatchObject(DELETADO);
  });

  it("enum inválido (forjado) → ATIVO mesmo p/ super_admin", async () => {
    await listCidadaos({ status: "xpto" as never }, superAdmin);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });

  it("sem filtro de status → ATIVO (default), para todos os papéis", async () => {
    await listCidadaos({}, recepcaoMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
    await listCidadaos({}, gestorMedico);
    expect(whereDaUltimaChamada()).toMatchObject(ATIVO);
  });
});

describe("podeVerCidadaosDeletados", () => {
  it("permite super_admin e gestor; nega recepção/profissional/social/presidência", () => {
    expect(podeVerCidadaosDeletados(superAdmin)).toBe(true);
    expect(podeVerCidadaosDeletados(gestorMedico)).toBe(true);
    expect(podeVerCidadaosDeletados(recepcaoMedico)).toBe(false);
    expect(podeVerCidadaosDeletados(profissionalMedico)).toBe(false);
    expect(podeVerCidadaosDeletados(socialGlobal)).toBe(false);
    expect(podeVerCidadaosDeletados(sess([{ name: "presidencia", unitScope: null }]))).toBe(false);
    expect(podeVerCidadaosDeletados(null)).toBe(false);
  });
});

describe("resolveStatusCidadao (pura)", () => {
  it("sem permissão: deletado/anonimizado caem para ativo; ativo permanece", () => {
    expect(resolveStatusCidadao("deletado", false)).toBe("ativo");
    expect(resolveStatusCidadao("anonimizado", false)).toBe("ativo");
    expect(resolveStatusCidadao("ativo", false)).toBe("ativo");
  });

  it("com permissão: deletado/anonimizado preservados", () => {
    expect(resolveStatusCidadao("deletado", true)).toBe("deletado");
    expect(resolveStatusCidadao("anonimizado", true)).toBe("anonimizado");
    expect(resolveStatusCidadao("ativo", true)).toBe("ativo");
  });

  it("enum inválido/undefined → ativo, independente da permissão", () => {
    expect(resolveStatusCidadao(undefined, true)).toBe("ativo");
    expect(resolveStatusCidadao("xpto", true)).toBe("ativo");
    expect(resolveStatusCidadao("", false)).toBe("ativo");
  });
});

describe("buildCarregarMaisHref — paginação preserva filtros (M1)", () => {
  function parseHref(href: string): { path: string; params: URLSearchParams } {
    const idx = href.indexOf("?");
    const path = idx === -1 ? href : href.slice(0, idx);
    const query = idx === -1 ? "" : href.slice(idx + 1);
    return { path, params: new URLSearchParams(query) };
  }

  it("reanexa TODOS os filtros ativos + cursor (página 2 não perde q/unidade/status/ciclo)", () => {
    const href = buildCarregarMaisHref(
      { q: "Maria", unidade: "medico", status: "deletado", ciclo: "ativo" },
      "cur123",
    );
    const { path, params } = parseHref(href);
    expect(path).toBe("/app/cidadaos");
    expect(params.get("q")).toBe("Maria");
    expect(params.get("unidade")).toBe("medico");
    expect(params.get("status")).toBe("deletado");
    expect(params.get("ciclo")).toBe("ativo");
    expect(params.get("cursor")).toBe("cur123");
  });

  it("omite filtros vazios mas sempre inclui o cursor", () => {
    const href = buildCarregarMaisHref({ q: "Ana" }, "cur9");
    const { params } = parseHref(href);
    expect(params.get("q")).toBe("Ana");
    expect(params.has("unidade")).toBe(false);
    expect(params.has("status")).toBe(false);
    expect(params.has("ciclo")).toBe(false);
    expect(params.get("cursor")).toBe("cur9");
  });

  it("escapa valores de busca corretamente (URLSearchParams)", () => {
    const href = buildCarregarMaisHref({ q: "José & Cia" }, "c1");
    const { params } = parseHref(href);
    // round-trip pelo parser confirma o encode/decode correto
    expect(params.get("q")).toBe("José & Cia");
    expect(params.get("cursor")).toBe("c1");
  });
});
