import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import { omitCamposSensiveisSemPermissao } from "@/lib/cidadao";
import { podeEditarSaudeCidadao, podeEditarSocioCidadao } from "@/lib/rbac";
import { cidadaoCreateSchema } from "@/lib/cidadao-schema";

/**
 * B2 — escrita de campos sensíveis gated por capability na CAMADA DE DADOS.
 * `omitCamposSensiveisSemPermissao` remove (não nula) os campos que o caller
 * não pode escrever, ANTES do update — preservando o valor existente no banco.
 */

// ── Mocks p/ o round-trip de persistência das actions (B6) ─────────────────
// `@/lib/rbac` e `@/lib/cidadao` rodam REAIS (são os gates que queremos exercer);
// só `db`, `auth`, `audit` e `next/navigation` são mockados. Molde: medico-idor-actions.
const { dbMock, authMock, logEventMock } = vi.hoisted(() => ({
  dbMock: {
    cidadao: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  authMock: vi.fn(),
  logEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// Extrai o 1º arg (`{ where?, data }`) da 1ª chamada de um mock de db.cidadao.*,
// de forma type-safe (os mocks são `vi.fn()` sem tipo, então `.mock.calls[0][0]`
// é `possibly undefined` no strict). Falha o teste se o mock não foi chamado.
function primeiraChamada(mock: ReturnType<typeof vi.fn>): {
  where?: { id: string };
  data: { tipoSanguineo?: string };
} {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("mock não foi chamado");
  return call[0] as { where?: { id: string }; data: { tipoSanguineo?: string } };
}

function fixtureUpdate() {
  return {
    nomeCompleto: "Maria Almeida",
    telefonePrincipal: "11999990000",
    // saúde
    tipoSanguineo: "O+",
    alergias: "dipirona",
    medicamentosEmUso: "losartana",
    condicoesCronicas: "hipertensão",
    // socioeconômico
    rendaFamiliar: "1200.00",
    pessoasNaCasa: 4,
    beneficioSocial: "bolsa_familia",
    escolaridade: "fundamental",
    trabalha: true,
    trabalhoDescricao: "diarista",
  };
}

function sessionComRoles(...roles: { name: string; unitScope: string | null }[]): Session {
  return { user: { id: "u1", roles } } as unknown as Session;
}

describe("omitCamposSensiveisSemPermissao", () => {
  it("remove os campos de saúde quando !podeEscreverSaude (mantém socio + básico)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: false,
      podeEscreverSocio: true,
    });
    expect("tipoSanguineo" in out).toBe(false);
    expect("alergias" in out).toBe(false);
    expect("medicamentosEmUso" in out).toBe(false);
    expect("condicoesCronicas" in out).toBe(false);
    // socio + básico preservados
    expect("beneficioSocial" in out).toBe(true);
    expect("nomeCompleto" in out).toBe(true);
  });

  it("remove os campos socioeconômicos quando !podeEscreverSocio (mantém saúde)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: true,
      podeEscreverSocio: false,
    });
    expect("rendaFamiliar" in out).toBe(false);
    expect("pessoasNaCasa" in out).toBe(false);
    expect("trabalha" in out).toBe(false);
    expect("alergias" in out).toBe(true);
  });

  it("remove AMBOS os blocos sem nenhuma permissão (sobra só o básico)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: false,
      podeEscreverSocio: false,
    });
    expect("alergias" in out).toBe(false);
    expect("rendaFamiliar" in out).toBe(false);
    expect("nomeCompleto" in out).toBe(true);
    expect("telefonePrincipal" in out).toBe(true);
  });

  it("preserva todos os campos quando tem ambas as permissões", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: true,
      podeEscreverSocio: true,
    });
    expect(Object.keys(out).sort()).toEqual(Object.keys(fixtureUpdate()).sort());
  });

  it("é imutável — não remove chaves do objeto original", () => {
    const original = fixtureUpdate();
    omitCamposSensiveisSemPermissao(original, {
      podeEscreverSaude: false,
      podeEscreverSocio: false,
    });
    expect("alergias" in original).toBe(true);
    expect("rendaFamiliar" in original).toBe(true);
  });
});

describe("podeEditarSaudeCidadao", () => {
  it("permite gestão e profissional, nega recepção/social", () => {
    expect(
      podeEditarSaudeCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(true);
    expect(
      podeEditarSaudeCidadao(sessionComRoles({ name: "gestor_unidade", unitScope: "medico" })),
    ).toBe(true);
    expect(podeEditarSaudeCidadao(sessionComRoles({ name: "recepcao", unitScope: "medico" }))).toBe(
      false,
    );
    expect(podeEditarSaudeCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(
      false,
    );
    expect(podeEditarSaudeCidadao(null)).toBe(false);
  });
});

describe("cidadaoCreateSchema · tipoSanguineo (B6 — regressão do save travado)", () => {
  // 12345678909 é CPF válido (dígito verificador OK, ver cpf.test.ts).
  // rendaFamiliar/pessoasNaCasa vão como "" (o que o form envia) — o union do
  // schema espera a chave presente; o foco do teste é só tipoSanguineo (B6).
  const base = {
    nomeCompleto: "Maria Almeida",
    cpf: "12345678909",
    dataNascimento: "1990-05-10",
    telefonePrincipal: "11999990000",
    rendaFamiliar: "",
    pessoasNaCasa: "",
    unitIdOrigem: "medico" as const,
  };

  it("texto-livre migrado ('O Positivo') NÃO trava — normaliza pro enum 'O+'", () => {
    const parsed = cidadaoCreateSchema.safeParse({ ...base, tipoSanguineo: "O Positivo" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.tipoSanguineo).toBe("O+");
  });

  it("lixo irreconhecível ('xyz') NÃO trava — vira undefined (campo some)", () => {
    const parsed = cidadaoCreateSchema.safeParse({ ...base, tipoSanguineo: "xyz" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.tipoSanguineo).toBeUndefined();
  });

  it("canônico 'A-' continua passando intacto", () => {
    const parsed = cidadaoCreateSchema.safeParse({ ...base, tipoSanguineo: "A-" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.tipoSanguineo).toBe("A-");
  });
});

describe("podeEditarSocioCidadao", () => {
  it("permite social/super_admin, nega presidência (view-only)/profissional/recepção", () => {
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(true);
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "super_admin", unitScope: null }))).toBe(
      true,
    );
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "presidencia", unitScope: null }))).toBe(
      false,
    );
    expect(
      podeEditarSocioCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(false);
    expect(podeEditarSocioCidadao(null)).toBe(false);
  });
});

/**
 * B6 — round-trip de PERSISTÊNCIA das actions. Os testes acima cobrem o normalizador
 * puro e o output do safeParse; faltava provar o WIRING: que o valor que chega ao
 * `db.cidadao.{create,update}` é o NORMALIZADO (não o raw recebido do form). Como a
 * normalização no z.preprocess reescreve o valor no próximo save (não é só exibição),
 * este é o teste que documenta/cobre esse efeito de borda.
 *
 * Endurecimento de teste só — comportamento e schema do banco intocados (sem migration).
 */
describe("create/updateCidadaoAction · round-trip de persistência (B6)", () => {
  const PROFISSIONAL_MEDICO = sessionComRoles({ name: "profissional", unitScope: "medico" });

  // payload mínimo válido pro schema (4 obrigatórios + sistema). CPF 12345678909 é
  // válido (ver cpf.test.ts). enderecos default [] cobre o resto.
  const baseInput = {
    nomeCompleto: "Maria Almeida",
    cpf: "12345678909",
    dataNascimento: "1990-05-10",
    telefonePrincipal: "11999990000",
    rendaFamiliar: "",
    pessoasNaCasa: "",
    unitIdOrigem: "medico" as const,
  };

  beforeEach(() => {
    dbMock.cidadao.findUnique.mockReset();
    dbMock.cidadao.create.mockReset();
    dbMock.cidadao.update.mockReset();
    authMock.mockReset();
    logEventMock.mockClear();
    authMock.mockResolvedValue(PROFISSIONAL_MEDICO);
    dbMock.cidadao.create.mockResolvedValue({
      id: "c1",
      nomeCompleto: "Maria Almeida",
      unitIdOrigem: "medico",
    });
    dbMock.cidadao.update.mockResolvedValue({ id: "c1" });
  });

  it("create GRAVA o valor NORMALIZADO: 'O Positivo' → 'O+' chega ao db.cidadao.create", async () => {
    const { createCidadaoAction } = await import("@/app/app/cidadaos/novo/actions");
    dbMock.cidadao.findUnique.mockResolvedValue(null); // CPF não duplicado

    const res = await createCidadaoAction({ ...baseInput, tipoSanguineo: "O Positivo" });

    expect(res.ok).toBe(true);
    expect(dbMock.cidadao.create).toHaveBeenCalledTimes(1);
    expect(primeiraChamada(dbMock.cidadao.create).data.tipoSanguineo).toBe("O+");
  });

  it("create com lixo 'xyz' GRAVA undefined (campo omitido, não trava nem persiste lixo)", async () => {
    const { createCidadaoAction } = await import("@/app/app/cidadaos/novo/actions");
    dbMock.cidadao.findUnique.mockResolvedValue(null);

    const res = await createCidadaoAction({ ...baseInput, tipoSanguineo: "xyz" });

    expect(res.ok).toBe(true);
    expect(primeiraChamada(dbMock.cidadao.create).data.tipoSanguineo).toBeUndefined();
  });

  it("update GRAVA o valor NORMALIZADO: 'O Positivo' → 'O+' chega ao db.cidadao.update", async () => {
    const { updateCidadaoAction } = await import("@/app/app/cidadaos/novo/actions");
    // findUnique é chamado p/ carregar a ficha atual antes do update (RBAC por unidade).
    dbMock.cidadao.findUnique.mockResolvedValue({
      id: "c1",
      unitIdOrigem: "medico",
      tipoSanguineo: "A-",
    });

    const res = await updateCidadaoAction("c1", { ...baseInput, tipoSanguineo: "O Positivo" });

    expect(res.ok).toBe(true);
    expect(dbMock.cidadao.update).toHaveBeenCalledTimes(1);
    const updateArg = primeiraChamada(dbMock.cidadao.update);
    expect(updateArg.where).toEqual({ id: "c1" });
    expect(updateArg.data.tipoSanguineo).toBe("O+");
  });

  it("update com lixo 'xyz' passa tipoSanguineo undefined (Prisma trata como no-op; raw preservado no banco)", async () => {
    const { updateCidadaoAction } = await import("@/app/app/cidadaos/novo/actions");
    dbMock.cidadao.findUnique.mockResolvedValue({
      id: "c1",
      unitIdOrigem: "medico",
      tipoSanguineo: "tipo legado estranho",
    });

    const res = await updateCidadaoAction("c1", { ...baseInput, tipoSanguineo: "xyz" });

    expect(res.ok).toBe(true);
    // chave presente porém undefined → Prisma NÃO toca a coluna (não zera o raw migrado).
    expect(primeiraChamada(dbMock.cidadao.update).data.tipoSanguineo).toBeUndefined();
  });
});
