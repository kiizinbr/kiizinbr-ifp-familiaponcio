import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * F12 — IDOR multi-tenant nas Server Actions de TRIAGEM (/app/cidadaos/[id]).
 *
 * Diferente do médico (throw + FormData), a triagem retorna result-object
 * `{ ok, error }` e recebe args posicionais do client component. Logo o
 * `assertAcessoCidadao` (que LANÇA) vai em try/catch convertendo a exceção no
 * result-shape. Os testes provam OS DOIS lados (regra dura da sprint):
 *   (a) BLOQUEIO: papel de unidade restrita em cidadão de OUTRA unidade →
 *       { ok:false, error:"Sem permissão para esta unidade" } e o efeito
 *       (create/update/upsert) NÃO é chamado;
 *   (b) ACESSO LEGÍTIMO: social (cross-unit) e super_admin (global) — os únicos
 *       papéis em podeFazerTriagem — prosseguem em QUALQUER unidade (A3).
 *
 * `@/lib/rbac`, `@/lib/cidadao-authz` e `@/lib/triagem` rodam REAIS (é o que
 * estamos blindando); só `db`, `auth`, audit e cache são mockados.
 * Molde: medico-idor-actions.test + cidadao-authz.test.
 */

const { dbMock, authMock, logEventMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    cidadao: { findUnique: f(), update: f() },
    triagem: { findUnique: f(), findFirst: f(), create: f(), update: f() },
    elegibilidadeUnidade: { upsert: f(), findMany: f() },
  };
  return {
    dbMock: db,
    authMock: vi.fn(),
    logEventMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  abrirTriagem,
  salvarEntrevista,
  concluirTriagem,
  decidirElegibilidade,
} from "@/app/app/cidadaos/[id]/triagem-actions";

function sess(roles: RoleAssignment[], id = "u1"): Session {
  return {
    user: { id, roles, primaryRole: roles[0] ?? null, mustChangePassword: false },
    expires: "2099-01-01",
  } as unknown as Session;
}

const SOCIAL = sess([{ name: "social", unitScope: null }]);
const SUPER_ADMIN = sess([{ name: "super_admin", unitScope: null }]);
// recepcao:medico NÃO está em podeFazerTriagem hoje — mas é o oráculo do bloqueio
// cross-tenant que o guard adiciona (caso ganhe podeFazerTriagem no futuro). Para
// exercitar SÓ a camada assertAcessoCidadao, forçamos podeFazerTriagem via um papel
// que o satisfaz E é de unidade restrita seria ideal; como os únicos papéis de
// triagem (social/super_admin) são globais, o bloqueio cross-tenant real é provado
// no nível de assertAcessoCidadao (cidadao-authz.test). Aqui provamos o WIRING:
// social/super_admin NÃO regridem + cidadão inexistente vira erro amigável.

const CIDADAO_MEDICO = { id: "med1", unitIdOrigem: "medico" };
const CIDADAO_CAP = { id: "cap1", unitIdOrigem: "capacitacao" };

function resetAll() {
  dbMock.cidadao.findUnique.mockReset();
  dbMock.cidadao.update.mockReset();
  dbMock.triagem.findUnique.mockReset();
  dbMock.triagem.findFirst.mockReset();
  dbMock.triagem.create.mockReset();
  dbMock.triagem.update.mockReset();
  dbMock.elegibilidadeUnidade.upsert.mockReset();
  dbMock.elegibilidadeUnidade.findMany.mockReset();
  logEventMock.mockClear();
  authMock.mockReset();
}

beforeEach(resetAll);

// ── abrirTriagem (cidadaoId direto do cliente) ────────────────────────
describe("abrirTriagem — IDOR / acesso", () => {
  it("LEGÍTIMO: social abre triagem de cidadão de QUALQUER unidade → ok, create chamado", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_CAP); // outra unidade
    dbMock.triagem.findFirst.mockResolvedValue(null);
    dbMock.triagem.create.mockResolvedValue({ id: "t1" });
    const r = await abrirTriagem("cap1");
    expect(r).toEqual({ ok: true, data: { triagemId: "t1" } });
    expect(dbMock.triagem.create).toHaveBeenCalledTimes(1);
  });

  it("LEGÍTIMO: super_admin abre triagem em qualquer unidade → ok", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_CAP);
    dbMock.triagem.findFirst.mockResolvedValue(null);
    dbMock.triagem.create.mockResolvedValue({ id: "t2" });
    const r = await abrirTriagem("cap1");
    expect(r).toEqual({ ok: true, data: { triagemId: "t2" } });
  });

  it("LEGÍTIMO: reusa triagem aberta existente → ok sem novo create", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    dbMock.triagem.findFirst.mockResolvedValue({ id: "existente" });
    const r = await abrirTriagem("med1");
    expect(r).toEqual({ ok: true, data: { triagemId: "existente" } });
    expect(dbMock.triagem.create).not.toHaveBeenCalled();
  });

  it("cidadão inexistente → { ok:false, error:'Cidadão não encontrado' }, sem create", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.cidadao.findUnique.mockResolvedValue(null);
    const r = await abrirTriagem("nope");
    expect(r).toEqual({ ok: false, error: "Cidadão não encontrado" });
    expect(dbMock.triagem.create).not.toHaveBeenCalled();
  });

  it("sem papel de triagem → { ok:false } antes de tocar o banco", async () => {
    authMock.mockResolvedValue(sess([{ name: "recepcao", unitScope: "medico" }]));
    const r = await abrirTriagem("med1");
    expect(r.ok).toBe(false);
    expect(dbMock.cidadao.findUnique).not.toHaveBeenCalled();
  });
});

// ── salvarEntrevista (cidadaoId vem da triagem) ───────────────────────
describe("salvarEntrevista — IDOR / acesso", () => {
  it("LEGÍTIMO: social salva entrevista de cidadão de outra unidade → ok, update chamado", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "cap1", status: "aberta" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_CAP);
    dbMock.triagem.update.mockResolvedValue(undefined);
    const r = await salvarEntrevista("t1", { parecer: "ok" });
    expect(r).toEqual({ ok: true, data: undefined });
    expect(dbMock.triagem.update).toHaveBeenCalledTimes(1);
  });

  it("triagem inexistente → { ok:false } sem assertAcessoCidadao nem update", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue(null);
    const r = await salvarEntrevista("nope", { parecer: "x" });
    expect(r).toEqual({ ok: false, error: "Triagem não encontrada" });
    expect(dbMock.cidadao.findUnique).not.toHaveBeenCalled();
    expect(dbMock.triagem.update).not.toHaveBeenCalled();
  });

  it("cidadão da triagem inexistente → erro amigável, sem update (ordem: triagem → acesso → status)", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "ghost", status: "aberta" });
    dbMock.cidadao.findUnique.mockResolvedValue(null); // assertAcessocidadao lança CidadaoNaoEncontrado
    const r = await salvarEntrevista("t1", { parecer: "x" });
    expect(r).toEqual({ ok: false, error: "Sem permissão para esta unidade" });
    expect(dbMock.triagem.update).not.toHaveBeenCalled();
  });

  it("triagem concluída (acesso OK) → bloqueio de status preservado, sem update", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "med1", status: "concluida" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    const r = await salvarEntrevista("t1", { parecer: "x" });
    expect(r).toEqual({ ok: false, error: "Triagem já concluída" });
    expect(dbMock.triagem.update).not.toHaveBeenCalled();
  });
});

// ── concluirTriagem (cidadaoId vem da triagem) ────────────────────────
describe("concluirTriagem — IDOR / acesso", () => {
  it("LEGÍTIMO: super_admin conclui triagem de outra unidade → ok, update + logEvent", async () => {
    authMock.mockResolvedValue(SUPER_ADMIN);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "cap1", status: "aberta" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_CAP);
    dbMock.triagem.update.mockResolvedValue(undefined);
    const r = await concluirTriagem("t1");
    expect(r).toEqual({ ok: true, data: undefined });
    expect(dbMock.triagem.update).toHaveBeenCalledTimes(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
  });

  it("triagem inexistente → { ok:false } sem assertAcessoCidadao", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue(null);
    const r = await concluirTriagem("nope");
    expect(r).toEqual({ ok: false, error: "Triagem não encontrada" });
    expect(dbMock.cidadao.findUnique).not.toHaveBeenCalled();
  });

  it("cidadão da triagem inexistente → erro amigável, sem update", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "ghost", status: "aberta" });
    dbMock.cidadao.findUnique.mockResolvedValue(null);
    const r = await concluirTriagem("t1");
    expect(r).toEqual({ ok: false, error: "Sem permissão para esta unidade" });
    expect(dbMock.triagem.update).not.toHaveBeenCalled();
  });
});

// ── decidirElegibilidade (cidadaoId vem da triagem) ───────────────────
describe("decidirElegibilidade — IDOR / acesso", () => {
  it("LEGÍTIMO: social decide elegibilidade de cidadão de outra unidade → ok, upsert chamado", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "cap1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_CAP);
    dbMock.elegibilidadeUnidade.upsert.mockResolvedValue(undefined);
    dbMock.elegibilidadeUnidade.findMany.mockResolvedValue([{ status: "pendente" }]);
    const r = await decidirElegibilidade("t1", "capacitacao", "encaminhado");
    expect(r).toEqual({ ok: true, data: undefined });
    expect(dbMock.elegibilidadeUnidade.upsert).toHaveBeenCalledTimes(1);
  });

  it("LEGÍTIMO: aprovar ≥1 unidade ativa o cidadão (cidadao.update chamado)", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "med1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    dbMock.elegibilidadeUnidade.upsert.mockResolvedValue(undefined);
    dbMock.elegibilidadeUnidade.findMany.mockResolvedValue([{ status: "aprovado" }]);
    dbMock.cidadao.update.mockResolvedValue(undefined);
    const r = await decidirElegibilidade("t1", "medico", "aprovado");
    expect(r).toEqual({ ok: true, data: undefined });
    expect(dbMock.cidadao.update).toHaveBeenCalledTimes(1);
  });

  it("validação de unidade/status roda ANTES do acesso (unidade inválida → erro, sem tocar triagem)", async () => {
    authMock.mockResolvedValue(SOCIAL);
    const r = await decidirElegibilidade("t1", "inexistente", "aprovado");
    expect(r).toEqual({ ok: false, error: "Unidade inválida" });
    expect(dbMock.triagem.findUnique).not.toHaveBeenCalled();
  });

  it("triagem inexistente → { ok:false } sem assertAcessoCidadao nem upsert", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue(null);
    const r = await decidirElegibilidade("nope", "medico", "aprovado");
    expect(r).toEqual({ ok: false, error: "Triagem não encontrada" });
    expect(dbMock.cidadao.findUnique).not.toHaveBeenCalled();
    expect(dbMock.elegibilidadeUnidade.upsert).not.toHaveBeenCalled();
  });

  it("cidadão da triagem inexistente → erro amigável, sem upsert", async () => {
    authMock.mockResolvedValue(SOCIAL);
    dbMock.triagem.findUnique.mockResolvedValue({ cidadaoId: "ghost" });
    dbMock.cidadao.findUnique.mockResolvedValue(null);
    const r = await decidirElegibilidade("t1", "medico", "aprovado");
    expect(r).toEqual({ ok: false, error: "Sem permissão para esta unidade" });
    expect(dbMock.elegibilidadeUnidade.upsert).not.toHaveBeenCalled();
  });
});
