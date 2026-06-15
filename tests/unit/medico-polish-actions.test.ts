import { beforeEach, describe, expect, it, vi } from "vitest";

// Cobre os endurecimentos da sprint polish-medico nas server actions do médico:
// - F7  emitirAtestadoAction: guard "ao menos 1 campo" + ramo doc=erro_atestado
// - M4  criarProfissionalAction: valida papel do alvo + vínculo único
// - F6  criarProfissionalAction: especialidades existem e estão ativas
// - B12 salvarRascunhoAction: erro de QUERY na Cid10 aborta (?erro=cid_indisponivel),
//        não afrouxa a anti-forja
// Molde: receita-action-mock.test.ts / medico-prontuario-mock.test.ts (vi.hoisted).

const { dbMock, redirectMock, logEventMock, salvarRascunhoMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    consulta: { findUniqueOrThrow: f() },
    atestado: { create: f() },
    user: { findUnique: f() },
    profissional: { findUnique: f(), create: f() },
    especialidade: { findMany: f() },
    cid10: { findMany: f() },
  };
  // redirect() do Next lança internamente pra interromper a action; replicamos
  // lançando um erro tagueado pra distinguir o destino sem rodar o write.
  const redirect = vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  });
  const logEvent = vi.fn().mockResolvedValue(undefined);
  // salvarRascunho não deve ser alcançado quando o catch da Cid10 aborta (B12).
  const salvarRascunho = vi.fn().mockResolvedValue({ id: "nota1" });
  return {
    dbMock: db,
    redirectMock: redirect,
    logEventMock: logEvent,
    salvarRascunhoMock: salvarRascunho,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-X", roles: [{ name: "profissional", unitScope: "medico" }] },
    expires: "2099-01-01",
  }),
}));
vi.mock("@/lib/rbac", () => ({
  canAccessUnidade: vi.fn().mockReturnValue(true),
  hasAnyRole: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/medico/rbac", () => ({
  podeEmitirDocumento: vi.fn().mockReturnValue(true),
  podeGerenciarProfissional: vi.fn().mockReturnValue(true),
  camposEditaveisProfissional: vi.fn().mockReturnValue(["nomeExibicao", "bio"]),
  podeEditarNota: vi.fn().mockReturnValue(true),
}));
// O guard de objeto (A1) é exercido em medico-idor-actions.test.ts; aqui é
// passthrough pra focar nas validações novas (e @/lib/rbac está mockado sem `can`).
vi.mock("@/lib/cidadao-authz", () => ({
  assertAcessoCidadao: vi.fn().mockResolvedValue({ id: "cid1", unitIdOrigem: "medico" }),
}));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/medico/prontuario", () => ({
  salvarRascunho: salvarRascunhoMock,
  assinarNota: vi.fn(),
  adicionarAddendo: vi.fn(),
  NotaAssinadaError: class NotaAssinadaError extends Error {},
  NotaNaoAssinadaError: class NotaNaoAssinadaError extends Error {},
  TransicaoNotaInvalidaError: class TransicaoNotaInvalidaError extends Error {},
}));

import { emitirAtestadoAction } from "@/app/medico/consultas/[id]/documento-actions";
import { criarProfissionalAction } from "@/app/medico/profissionais/actions";
import { salvarRascunhoAction } from "@/app/medico/consultas/[id]/prontuario-actions";

const CONSULTA_DOC = {
  id: "c1",
  consultaId: "c1",
  cidadaoId: "cid1",
  profissionalId: "prof1",
  cidadao: { nomeCompleto: "Maria Silva", nomeSocial: null },
  profissional: {
    id: "prof1",
    userId: "user-X",
    nomeExibicao: "Dr. House",
    conselho: "CRM-RJ",
    nroConselho: "12345",
  },
};

const CONSULTA_RASCUNHO = {
  id: "c1",
  cidadaoId: "cid1",
  profissionalId: "prof1",
  profissional: { userId: "user-X" },
  notaEvolucao: null,
};

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function fdMulti(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

function resetAll() {
  for (const model of Object.values(dbMock)) {
    for (const fn of Object.values(model)) (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  redirectMock.mockClear();
  logEventMock.mockClear();
  salvarRascunhoMock.mockClear();
}

describe("F7 — emitirAtestadoAction guard", () => {
  beforeEach(() => {
    resetAll();
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue(CONSULTA_DOC);
    dbMock.atestado.create.mockResolvedValue({ id: "at1" });
  });

  it("todos os campos vazios → redirect doc=erro_atestado, sem create", async () => {
    await expect(emitirAtestadoAction(fd({ consultaId: "c1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/c1?doc=erro_atestado",
    );
    expect(dbMock.atestado.create).not.toHaveBeenCalled();
  });

  it("diasAfastamento=0 (não-positivo) e resto vazio → erro_atestado, sem create", async () => {
    await expect(
      emitirAtestadoAction(fd({ consultaId: "c1", diasAfastamento: "0" })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=erro_atestado");
    expect(dbMock.atestado.create).not.toHaveBeenCalled();
  });

  it("só diasAfastamento=3 → cria normalmente (doc=ok)", async () => {
    await expect(
      emitirAtestadoAction(fd({ consultaId: "c1", diasAfastamento: "3" })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=ok");
    expect(dbMock.atestado.create).toHaveBeenCalledTimes(1);
    const arg = dbMock.atestado.create.mock.calls[0]?.[0] as { data: { diasAfastamento: number } };
    expect(arg.data.diasAfastamento).toBe(3);
  });

  it("só CID → cria normalmente", async () => {
    await expect(emitirAtestadoAction(fd({ consultaId: "c1", cid: "J11" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/c1?doc=ok",
    );
    expect(dbMock.atestado.create).toHaveBeenCalledTimes(1);
  });

  it("só observação → cria normalmente", async () => {
    await expect(
      emitirAtestadoAction(fd({ consultaId: "c1", observacao: "Repouso" })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=ok");
    expect(dbMock.atestado.create).toHaveBeenCalledTimes(1);
  });
});

describe("M4/F6 — criarProfissionalAction guards", () => {
  const baseForm = {
    userId: "user-alvo",
    nomeExibicao: "Dra. Ana",
    conselho: "CRM-RJ",
    nroConselho: "99999",
  };
  const userComPapel = {
    id: "user-alvo",
    userRoles: [{ role: { name: "profissional" }, unitScope: "medico" }],
  };

  beforeEach(() => {
    resetAll();
    dbMock.profissional.create.mockResolvedValue({ id: "prof-novo" });
  });

  it("alvo sem papel profissional@medico → Error, sem create", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "user-alvo",
      userRoles: [{ role: { name: "recepcao" }, unitScope: "medico" }],
    });
    await expect(
      criarProfissionalAction(fdMulti({ ...baseForm, especialidadeIds: ["esp1"] })),
    ).rejects.toThrow(/papel de profissional/i);
    expect(dbMock.profissional.create).not.toHaveBeenCalled();
  });

  it("alvo já vinculado a um Profissional → Error, sem create", async () => {
    dbMock.user.findUnique.mockResolvedValue(userComPapel);
    dbMock.profissional.findUnique.mockResolvedValue({ id: "prof-existente" });
    await expect(
      criarProfissionalAction(fdMulti({ ...baseForm, especialidadeIds: ["esp1"] })),
    ).rejects.toThrow(/já está vinculado/i);
    expect(dbMock.profissional.create).not.toHaveBeenCalled();
  });

  it("especialidade inexistente/inativa → Error, sem create (F6)", async () => {
    dbMock.user.findUnique.mockResolvedValue(userComPapel);
    dbMock.profissional.findUnique.mockResolvedValue(null);
    // findMany devolve só 1 das 2 enviadas → uma é inválida.
    dbMock.especialidade.findMany.mockResolvedValue([{ id: "esp1" }]);
    await expect(
      criarProfissionalAction(fdMulti({ ...baseForm, especialidadeIds: ["esp1", "esp-fantasma"] })),
    ).rejects.toThrow(/inexistente ou inativa/i);
    expect(dbMock.profissional.create).not.toHaveBeenCalled();
  });

  it("alvo válido + especialidades ativas → cria + redirect", async () => {
    dbMock.user.findUnique.mockResolvedValue(userComPapel);
    dbMock.profissional.findUnique.mockResolvedValue(null);
    dbMock.especialidade.findMany.mockResolvedValue([{ id: "esp1" }]);
    await expect(
      criarProfissionalAction(fdMulti({ ...baseForm, especialidadeIds: ["esp1"] })),
    ).rejects.toThrow("__redirect__:/medico/profissionais/prof-novo");
    expect(dbMock.profissional.create).toHaveBeenCalledTimes(1);
  });
});

describe("B12 — salvarRascunhoAction: erro de query na Cid10 aborta sem afrouxar", () => {
  beforeEach(() => {
    resetAll();
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue(CONSULTA_RASCUNHO);
  });

  it("findMany da Cid10 lança → redirect cid_indisponivel, salvarRascunho NÃO é chamado", async () => {
    dbMock.cid10.findMany.mockRejectedValue(new Error("DB down"));
    const diagnosticos = JSON.stringify([
      { codigoCid: "Z99", descricao: "Forjado", principal: true },
    ]);
    await expect(
      salvarRascunhoAction(
        fd({ consultaId: "c1", texto: "evolução", diagnosticosJson: diagnosticos }),
      ),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?erro=cid_indisponivel");
    expect(salvarRascunhoMock).not.toHaveBeenCalled();
  });

  it("tabela vazia de verdade (0 linhas, sem throw) → NÃO aborta; salva (anti-forja rebaixa)", async () => {
    dbMock.cid10.findMany.mockResolvedValue([]); // SELECT ok, 0 linhas
    const diagnosticos = JSON.stringify([
      { codigoCid: "Z99", descricao: "Inexistente", principal: true },
    ]);
    await salvarRascunhoAction(
      fd({ consultaId: "c1", texto: "evolução", diagnosticosJson: diagnosticos }),
    );
    expect(salvarRascunhoMock).toHaveBeenCalledTimes(1);
    // anti-forja: código inexistente em tabela consultada com sucesso vira texto livre.
    const arg = salvarRascunhoMock.mock.calls[0]?.[0] as {
      diagnosticos: { codigoCid: string | null; descricao: string }[];
    };
    expect(arg.diagnosticos[0]?.codigoCid).toBeNull();
    expect(arg.diagnosticos[0]?.descricao).toBe("Inexistente");
  });
});

describe("B11 — sanitização anti open-redirect do campo `voltar`", () => {
  // Réplica do predicado usado em checkin-action.ts gate(): aceita só path
  // interno (começa com `/` e NÃO com `//` nem `/\`). Mantido em sincronia com
  // a action; se a regex de lá mudar, este teste deve falhar e ser atualizado.
  const ehInterno = (raw: string): boolean => /^\/(?![/\\])/.test(raw);

  it("paths internos legítimos passam", () => {
    expect(ehInterno("/medico")).toBe(true);
    expect(ehInterno("/medico/recepcao")).toBe(true);
    expect(ehInterno("/medico/consultas/c1")).toBe(true);
  });

  it("externos e protocol-relative são rejeitados", () => {
    expect(ehInterno("https://evil.com")).toBe(false);
    expect(ehInterno("//evil.com")).toBe(false);
    expect(ehInterno("/\\evil.com")).toBe(false);
    expect(ehInterno("")).toBe(false);
    expect(ehInterno("javascript:alert(1)")).toBe(false);
  });
});
